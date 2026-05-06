// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IAdapter {
    function swap(
        address pool,
        address tokenIn,
        address tokenOut,
        uint256 amount,
        bytes calldata extraData
    ) external returns (uint256 amountOut);
}
