// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ProjectRegistry
 * @notice 多公司 RWA 资产项目目录：登记每套独立的 Share+Vault，供前端市场页 list/get
 * @dev 创建方式 B：部署脚本先部署多套 Share+Vault，再 register 进本目录。
 *      不改 Vault 会计；白名单 / nav / 派息 / pause 仍在各自 Vault/Share 上按项目隔离。
 */
contract ProjectRegistry is Ownable {
    struct Project {
        string name;
        string description;
        string companyName;
        address share;
        address vault;
        bool listed;
    }

    Project[] private _projects;

    event ProjectRegistered(
        uint256 indexed id,
        string name,
        string companyName,
        address share,
        address vault,
        bool listed
    );
    event ProjectListedUpdated(uint256 indexed id, bool listed);

    error InvalidId(uint256 id);
    error ZeroAddress();
    error EmptyName();

    constructor(address initialOwner) Ownable(initialOwner) {}

    /**
     * @notice 登记一套已部署的 Share+Vault 项目（平台 Admin）
     */
    function registerProject(
        string calldata name,
        string calldata description,
        string calldata companyName,
        address share,
        address vault,
        bool listed
    ) external onlyOwner returns (uint256 id) {
        if (bytes(name).length == 0 || bytes(companyName).length == 0) revert EmptyName();
        if (share == address(0) || vault == address(0)) revert ZeroAddress();

        id = _projects.length;
        _projects.push(
            Project({
                name: name,
                description: description,
                companyName: companyName,
                share: share,
                vault: vault,
                listed: listed
            })
        );
        emit ProjectRegistered(id, name, companyName, share, vault, listed);
    }

    /**
     * @notice 上架 / 下架（仅改目录展示位；不 pause Vault）
     * @dev 目录开关 ≠ Pausable。产品联调：下架时由项目方 Vault.setDepositsOpen(false) 链上拒绝新 deposit；
     *      redeem / claimYield 在未 pause 时仍允许。应急停柜台请调该项目 RWAVault.pause()。
     */
    function setListed(uint256 id, bool listed) external onlyOwner {
        if (id >= _projects.length) revert InvalidId(id);
        _projects[id].listed = listed;
        emit ProjectListedUpdated(id, listed);
    }

    function projectCount() external view returns (uint256) {
        return _projects.length;
    }

    function getProject(uint256 id) external view returns (Project memory) {
        if (id >= _projects.length) revert InvalidId(id);
        return _projects[id];
    }

    /**
     * @notice 返回全部已登记项目（含未上架）；前端可按 listed 过滤
     */
    function listProjects() external view returns (Project[] memory) {
        return _projects;
    }
}
