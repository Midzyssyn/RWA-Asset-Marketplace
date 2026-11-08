// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title IRWAShare
 * @notice Vault 所需的份额接口：铸/毁 + 白名单查询
 */
interface IRWAShare {
    function mint(address to, uint256 amount) external;

    function burn(address from, uint256 amount) external;

    function whitelist(address account) external view returns (bool);

    function totalSupply() external view returns (uint256);

    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title RWAVault
 * @notice RWA 金库柜台：按中心化净值 nav 申购/赎回；pull 派息与 nav 分轨
 * @dev nav 为 6 位小数缩放；1e6 表示 1 份额 = 1 USDC。
 *      setNAV 仅 NAV_MANAGER_ROLE（Admin 可授此角色）；pause / distributeYield 仍为 DEFAULT_ADMIN_ROLE，
 *      与「只能改净值」分钥，避免同一把钥匙叙事。
 *      派息用 rewardIndex，禁止改 nav 代替发息，禁止把利息滚进 nav。
 *
 *      下架 vs 暂停：
 *      - depositsOpen=false（常与 Registry setListed(false) 联调）：拒绝新 deposit；redeem / claimYield 仍允许（未 pause 时）
 *      - pause()：deposit / redeem / setNAV / distribute / claim 全部 whenNotPaused
 */
contract RWAVault is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice 指数精度（放大除法，减轻整数截断）
    uint256 public constant INDEX_PRECISION = 1e18;

    /// @notice 仅可调用 setNAV；由 DEFAULT_ADMIN_ROLE 授予/撤销
    bytes32 public constant NAV_MANAGER_ROLE = keccak256("NAV_MANAGER_ROLE");

    /// @notice 单次 setNAV 相对变动上限：2000 bps = ±20%
    uint256 public constant MAX_NAV_CHANGE_BPS = 2000;
    uint256 public constant BPS_DENOMINATOR = 10_000;

    /// @notice 本金稳定币（MockUSDC）
    IERC20 public immutable usdc;
    /// @notice 许可份额代币
    IRWAShare public immutable share;

    /**
     * @notice 当前净值（中心化喂价，非 Chainlink）
     * @dev 与 MockUSDC 同为 6 位小数；1e6 = 1 share = 1 USDC
     */
    uint256 public nav;

    /**
     * @notice 是否接受新认购
     * @dev 与 Registry.listed 产品联调：下架时建议同时 setDepositsOpen(false)。
     *      仅挡 deposit；redeem / claimYield 不受本开关影响（pause 另论）。
     */
    bool public depositsOpen = true;

    /// @notice 全局累计分红指数（每份额累计利息，×1e18）
    uint256 public rewardIndex;
    /// @notice 用户上次结算时的指数
    mapping(address => uint256) public userIndex;
    /// @notice 用户已结算、待 claim 的利息（USDC 最小单位）
    mapping(address => uint256) public claimable;
    /// @notice 累计注入利息（会计）
    uint256 public totalYieldDistributed;
    /// @notice 累计已领取利息（会计）
    uint256 public totalYieldClaimed;

    event Deposited(address indexed user, uint256 assets, uint256 shares);
    event Redeemed(address indexed user, uint256 shares, uint256 assets);
    event NavUpdated(uint256 oldNav, uint256 newNav);
    event YieldDistributed(uint256 amount, uint256 newRewardIndex);
    event YieldClaimed(address indexed user, uint256 amount);
    event DepositsOpenUpdated(bool open);

    error ZeroAmount();
    error ZeroNav();
    error NoShares();
    error NotWhitelisted(address account);
    error DepositsClosed();
    error NavChangeTooLarge(uint256 oldNav, uint256 newNav);
    error InsufficientReserve(uint256 needed, uint256 balance);

    constructor(address admin, address usdc_, address share_) {
        require(admin != address(0) && usdc_ != address(0) && share_ != address(0), "zero addr");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        // 演示：部署者兼任 NAV 经理；生产可拆钱包后由 Admin 单独 grantRole(NAV_MANAGER_ROLE, …)
        _grantRole(NAV_MANAGER_ROLE, admin);
        usdc = IERC20(usdc_);
        share = IRWAShare(share_);
        nav = 1e6;
    }

    /**
     * @notice 打开/关闭新认购（项目方 Admin）
     * @dev 目录下架（Registry.setListed）≠ 本开关；产品上建议下架时一并关闭。
     *      关闭后 deposit 失败；redeem / claimYield 在未 pause 时仍可用。
     */
    function setDepositsOpen(bool open) external onlyRole(DEFAULT_ADMIN_ROLE) {
        depositsOpen = open;
        emit DepositsOpenUpdated(open);
    }

    /**
     * @notice NAV 经理更新净值（作业演示级喂价，非 Chainlink）
     * @dev 只改本金兑换价，不发息、不滚进 rewardIndex。
     *      护栏：(1) newNav > 0；(2) 单次相对变动 ≤ ±20%；(3) 抬价时金库须偿付
     *      USDC.balanceOf(vault) >= totalSupply * newNav / 1e6 + 未领利息，否则先注资。
     * @param newNav 新净值，须 > 0；缩放同 USDC（6 位小数）
     */
    function setNAV(uint256 newNav) external onlyRole(NAV_MANAGER_ROLE) whenNotPaused {
        if (newNav == 0) revert ZeroNav();

        uint256 oldNav = nav;

        // 单次相对变动上限 ±20%
        uint256 diff = newNav > oldNav ? newNav - oldNav : oldNav - newNav;
        if (diff * BPS_DENOMINATOR > oldNav * MAX_NAV_CHANGE_BPS) {
            revert NavChangeTooLarge(oldNav, newNav);
        }

        // 抬价时偿付检查：本金负债 + 未领利息 ≤ 金库 USDC
        if (newNav > oldNav) {
            uint256 supply = share.totalSupply();
            uint256 principal = (supply * newNav) / 1e6;
            uint256 unclaimed = totalYieldDistributed - totalYieldClaimed;
            uint256 needed = principal + unclaimed;
            uint256 bal = usdc.balanceOf(address(this));
            if (bal < needed) revert InsufficientReserve(needed, bal);
        }

        nav = newNav;
        emit NavUpdated(oldNav, newNav);
    }

    /**
     * @notice 注入利息：Admin 将 USDC 转入金库并抬升 rewardIndex（pull，无全体循环打款）
     */
    function distributeYield(uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();
        uint256 supply = share.totalSupply();
        if (supply == 0) revert NoShares();

        usdc.safeTransferFrom(msg.sender, address(this), amount);
        rewardIndex += (amount * INDEX_PRECISION) / supply;
        totalYieldDistributed += amount;

        emit YieldDistributed(amount, rewardIndex);
    }

    /**
     * @notice 白名单持有人领取已累计利息（与按 nav 赎回的本金分轨）
     */
    function claimYield() external nonReentrant whenNotPaused {
        if (!share.whitelist(msg.sender)) revert NotWhitelisted(msg.sender);

        _accrue(msg.sender);
        uint256 amount = claimable[msg.sender];
        if (amount == 0) revert ZeroAmount();

        claimable[msg.sender] = 0;
        totalYieldClaimed += amount;
        usdc.safeTransfer(msg.sender, amount);

        emit YieldClaimed(msg.sender, amount);
    }

    /**
     * @notice 结算某地址待领利息到 claimable，并同步 userIndex
     * @dev 由 Share 用户互转回调；mint/burn 路径由 Vault 自行调用，避免与钩子重复
     */
    function accrue(address account) external {
        _accrue(account);
    }

    /**
     * @notice 视图：已记 claimable + 按当前余额尚未结算的利息
     */
    function pendingYield(address account) external view returns (uint256) {
        uint256 bal = share.balanceOf(account);
        uint256 delta = rewardIndex - userIndex[account];
        uint256 accrued = bal == 0 || delta == 0 ? 0 : (bal * delta) / INDEX_PRECISION;
        return claimable[account] + accrued;
    }

    /**
     * @notice 会计上尚未领走的利息合计（注入 − 已领；含舍入尘埃）
     */
    function unclaimedYieldAccounting() external view returns (uint256) {
        return totalYieldDistributed - totalYieldClaimed;
    }

    /**
     * @notice 申购：先结息，再扣 USDC，按 shares = assets * 1e6 / nav 铸造份额
     * @dev 要求 depositsOpen；下架关闭新认购后本路径失败，赎回/领息不受影响
     */
    function deposit(uint256 assets) external nonReentrant whenNotPaused {
        if (!depositsOpen) revert DepositsClosed();
        if (assets == 0) revert ZeroAmount();
        if (!share.whitelist(msg.sender)) revert NotWhitelisted(msg.sender);

        _accrue(msg.sender);

        uint256 sharesToMint = (assets * 1e6) / nav;
        if (sharesToMint == 0) revert ZeroAmount();

        usdc.safeTransferFrom(msg.sender, address(this), assets);
        share.mint(msg.sender, sharesToMint);

        emit Deposited(msg.sender, assets, sharesToMint);
    }

    /**
     * @notice 赎回：先结息，再 burn 份额，按 assetsOut = shares * nav / 1e6 退 USDC（CEI）
     * @dev 仅下架（depositsOpen=false）时仍允许；pause 后失败
     */
    function redeem(uint256 sharesAmount) external nonReentrant whenNotPaused {
        if (sharesAmount == 0) revert ZeroAmount();
        if (!share.whitelist(msg.sender)) revert NotWhitelisted(msg.sender);

        _accrue(msg.sender);

        uint256 assetsOut = (sharesAmount * nav) / 1e6;
        if (assetsOut == 0) revert ZeroAmount();

        // Checks-Effects-Interactions：先改份额会计，再转出 USDC
        share.burn(msg.sender, sharesAmount);
        usdc.safeTransfer(msg.sender, assetsOut);

        emit Redeemed(msg.sender, sharesAmount, assetsOut);
    }

    /// @notice 暂停本项目柜台（Pausable；≠ Registry 下架 / ≠ depositsOpen）
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /// @notice 恢复本项目柜台
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function _accrue(address account) internal {
        uint256 accruedIndex = rewardIndex;
        uint256 delta = accruedIndex - userIndex[account];
        if (delta > 0) {
            uint256 bal = share.balanceOf(account);
            if (bal > 0) {
                claimable[account] += (bal * delta) / INDEX_PRECISION;
            }
            userIndex[account] = accruedIndex;
        }
    }
}
