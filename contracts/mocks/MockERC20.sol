// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MockERC20 — Simple test token for vault demos
contract MockERC20 is ERC20 {
    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {}

    /// @notice Mint tokens to any address (no access control — for testing only)
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
