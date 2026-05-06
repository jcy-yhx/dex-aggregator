// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockCurvePool {
    address[] public coins;
    uint256[] public balances;

    constructor(address[2] memory coinAddresses) {
        coins = new address[](2);
        coins[0] = coinAddresses[0];
        coins[1] = coinAddresses[1];
        balances = new uint256[](2);
    }

    function setBalances(uint256 b0, uint256 b1) external {
        balances[0] = b0;
        balances[1] = b1;
    }

    function exchange(
        int128 i,
        int128 j,
        uint256 dx,
        uint256 /* minDy */
    ) external payable returns (uint256) {
        // Stableswap invariant: simplified to 1:1 with 0.04% fee for mock
        uint256 feeDeducted = dx - (dx / 2500); // 0.04%
        IERC20(coins[uint256(int256(j))]).transfer(msg.sender, feeDeducted);
        return feeDeducted;
    }

    function exchange(
        uint256 i,
        uint256 j,
        uint256 dx,
        uint256 /* minDy */
    ) external payable returns (uint256) {
        uint256 feeDeducted = dx - (dx / 2500);
        IERC20(coins[j]).transfer(msg.sender, feeDeducted);
        return feeDeducted;
    }
}
