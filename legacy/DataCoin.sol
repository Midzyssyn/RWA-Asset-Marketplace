// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title DataCoin
 * @notice 阶段 01 脚手架用的最小 ERC-20：可转让，仅 owner 可 mint
 * @dev 后续阶段会换成 MockUSDC / RWAShare / Vault，本文件仅用于跑通工具链
 */
contract DataCoin is ERC20, Ownable {
    constructor(address initialOwner) ERC20("Data Coin", "DATA") Ownable(initialOwner) {}

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
