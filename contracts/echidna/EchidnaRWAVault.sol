// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../MockUSDC.sol";
import "../RWAShare.sol";
import "../RWAVault.sol";

/**
 * @title EchidnaRWAVault
 * @notice Echidna 模糊测试 harness：暴露可变入口 + 两条不变量
 * @dev 运行见 project-log/phase-06-security/log.md 与 echidna.yaml
 *
 * 不变量：
 * 1) 从未入白的外部地址 OUTSIDER 份额余额恒为 0
 * 2) 金库 USDC >= totalSupply * nav / 1e6 + 未领利息会计
 *
 * 说明：抬高 nav 会抬升按 nav 计价的本金负债；harness 在 setNAV 时自动补足差额，
 * 以便在「金库已注资」前提下检验会计不变量。产品上 Admin 抬价不注资属于中心化喂价风险，见威胁表。
 */
contract EchidnaRWAVault {
    MockUSDC public usdc;
    RWAShare public share;
    RWAVault public vault;

    address constant USER_A = address(0x20000);
    address constant USER_B = address(0x30000);
    /// @dev 永不入白的外部地址，用于准入不变量
    address constant OUTSIDER = address(0xBEEF);

    uint256 constant NAV_ONE = 1e6;
    uint256 constant SEED_USDC = 1_000_000e6;

    constructor() {
        usdc = new MockUSDC(address(this));
        share = new RWAShare(address(this));
        vault = new RWAVault(address(this), address(usdc), address(share));

        share.grantRole(share.MINTER_ROLE(), address(vault));
        share.grantRole(share.BURNER_ROLE(), address(vault));
        share.setVault(address(vault));

        share.addToWhitelist(USER_A);
        share.addToWhitelist(USER_B);
        // OUTSIDER 故意不加入白名单

        usdc.mint(USER_A, SEED_USDC);
        usdc.mint(USER_B, SEED_USDC);
        usdc.mint(address(this), SEED_USDC);

        // 预授权，便于 fuzz 直接 deposit / distribute
        // USER 侧授权需由代理函数里用prank；Echidna 无prank，改用本合约代持再转
        // 简化：本合约作为「代理用户」入白并持币，同时 USER_A/B 通过 transfer 场景测转让
        share.addToWhitelist(address(this));
        usdc.approve(address(vault), type(uint256).max);
    }

    // ---------- fuzz 入口（Echidna 随机调用）----------

    function deposit(uint256 assets) public {
        assets = assets % (SEED_USDC / 10);
        if (assets == 0) return;
        uint256 bal = usdc.balanceOf(address(this));
        if (bal < assets) {
            usdc.mint(address(this), assets - bal);
        }
        vault.deposit(assets);
    }

    function redeem(uint256 sharesAmount) public {
        uint256 bal = share.balanceOf(address(this));
        if (bal == 0) return;
        sharesAmount = sharesAmount % bal;
        if (sharesAmount == 0) return;
        vault.redeem(sharesAmount);
    }

    function setNAV(uint256 raw) public {
        // 尊重链上 ±20% 护栏：在 [nav*0.8, nav*1.2] 内采样
        uint256 oldNav = vault.nav();
        uint256 maxDelta = (oldNav * 2000) / 10_000;
        uint256 delta = raw % (maxDelta + 1);
        uint256 newNav = (raw % 2 == 0) ? oldNav + delta : oldNav - delta;
        if (newNav == 0) newNav = 1;

        if (newNav > oldNav) {
            uint256 supply = share.totalSupply();
            uint256 unclaimed = vault.unclaimedYieldAccounting();
            uint256 needed = (supply * newNav) / NAV_ONE + unclaimed;
            uint256 vaultBal = usdc.balanceOf(address(vault));
            if (needed > vaultBal) {
                usdc.mint(address(vault), needed - vaultBal);
            }
        }
        vault.setNAV(newNav);
    }

    function distributeYield(uint256 amount) public {
        uint256 supply = share.totalSupply();
        if (supply == 0) return;
        amount = amount % (SEED_USDC / 100);
        if (amount == 0) return;
        uint256 bal = usdc.balanceOf(address(this));
        if (bal < amount) {
            usdc.mint(address(this), amount - bal);
        }
        vault.distributeYield(amount);
    }

    function claimYield() public {
        uint256 pending = vault.pendingYield(address(this));
        if (pending == 0) return;
        vault.claimYield();
    }

    function pause() public {
        vault.pause();
    }

    function unpause() public {
        vault.unpause();
    }

    function transferSharesToUserA(uint256 amount) public {
        uint256 bal = share.balanceOf(address(this));
        if (bal == 0) return;
        amount = amount % bal;
        if (amount == 0) return;
        share.transfer(USER_A, amount);
    }

    // ---------- 不变量 ----------

    /// @notice 不在白名单的外部地址 OUTSIDER，份额余额为 0
    function echidna_outsider_zero_shares() public view returns (bool) {
        return !share.whitelist(OUTSIDER) && share.balanceOf(OUTSIDER) == 0;
    }

    /// @notice 金库 USDC >= totalSupply * nav / 1e6 + 未领利息（会计）
    function echidna_vault_solvency() public view returns (bool) {
        uint256 vaultBal = usdc.balanceOf(address(vault));
        uint256 principal = (share.totalSupply() * vault.nav()) / NAV_ONE;
        uint256 unclaimed = vault.unclaimedYieldAccounting();
        return vaultBal >= principal + unclaimed;
    }
}
