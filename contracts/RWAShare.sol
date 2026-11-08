// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title IVaultAccrue
 * @notice 份额变动前由 Share 回调 Vault 结息（仅用户互转）
 */
interface IVaultAccrue {
    function accrue(address account) external;
}

/**
 * @title RWAShare
 * @notice 许可型 RWA 份额：白名单拦截转让；mint/burn 分角色授予 Vault；互转前挂钩结息
 */
contract RWAShare is ERC20, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");

    mapping(address => bool) public whitelist;

    /// @notice 挂钩的金库；用户互转时回调 accrue。mint/burn 由 Vault 自行结息，此处不回调以免重复/死循环
    address public vault;

    event WhitelistUpdated(address indexed account, bool allowed);
    event VaultUpdated(address indexed oldVault, address indexed newVault);

    error NotWhitelisted(address account);
    /// @notice 移出白名单前须先清仓（赎回/转出至余额为 0），以维持「非白名单余额恒为 0」
    error NonZeroShareBalance(address account, uint256 balance);

    constructor(address admin) ERC20("RWA Share", "RWAS") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /**
     * @notice Admin 绑定金库地址（部署后设置一次）
     */
    function setVault(address vault_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(vault_ != address(0), "zero vault");
        address old = vault;
        vault = vault_;
        emit VaultUpdated(old, vault_);
    }

    function addToWhitelist(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setWhitelist(account, true);
    }

    function removeFromWhitelist(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 bal = balanceOf(account);
        if (bal != 0) revert NonZeroShareBalance(account, bal);
        _setWhitelist(account, false);
    }

    function addToWhitelistBatch(address[] calldata accounts) external onlyRole(DEFAULT_ADMIN_ROLE) {
        for (uint256 i = 0; i < accounts.length; ) {
            _setWhitelist(accounts[i], true);
            unchecked {
                ++i;
            }
        }
    }

    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external onlyRole(BURNER_ROLE) {
        _burn(from, amount);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from == address(0)) {
            // mint: only require recipient；结息由 Vault.deposit 在 mint 前完成
            if (!whitelist[to]) revert NotWhitelisted(to);
        } else if (to == address(0)) {
            // burn: only require sender；结息由 Vault.redeem 在 burn 前完成
            if (!whitelist[from]) revert NotWhitelisted(from);
        } else {
            // transfer: both sides；份额变化前先给 from/to 结息
            if (!whitelist[from]) revert NotWhitelisted(from);
            if (!whitelist[to]) revert NotWhitelisted(to);
            address v = vault;
            if (v != address(0)) {
                IVaultAccrue(v).accrue(from);
                IVaultAccrue(v).accrue(to);
            }
        }
        super._update(from, to, value);
    }

    function _setWhitelist(address account, bool allowed) private {
        whitelist[account] = allowed;
        emit WhitelistUpdated(account, allowed);
    }
}
