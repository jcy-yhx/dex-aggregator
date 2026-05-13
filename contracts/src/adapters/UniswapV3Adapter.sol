// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IAdapter} from "./IAdapter.sol";
import {IUniswapV3Pool} from "../interfaces/IUniswapV3Pool.sol";

contract UniswapV3Adapter is IAdapter {
    function swap(
        address pool,
        address tokenIn,
        address tokenOut,
        uint256 amount,
        bytes calldata /* extraData */
    ) external payable returns (uint256 amountOut) {
        address token0 = IUniswapV3Pool(pool).token0();
        bool zeroForOne = tokenIn == token0;

        // Pass token0/token1 to the callback so it knows which token to pay
        bytes memory data = abi.encode(token0, IUniswapV3Pool(pool).token1());

        (int256 amount0, int256 amount1) = IUniswapV3Pool(pool).swap(
            address(this),
            zeroForOne,
            int256(amount),
            zeroForOne
                ? 4295128740 // sqrtPriceLimitX96 = TickMath.MIN_SQRT_PRICE + 1
                : 1461446703485210103287273052203988822378723970341, // MAX - 1
            data
        );

        amountOut = uint256(zeroForOne ? -amount1 : -amount0);
    }
}
