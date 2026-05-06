// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IAdapter} from "./IAdapter.sol";
import {IUniswapV2Pair} from "../interfaces/IUniswapV2Pair.sol";
import {TransferHelper} from "../libraries/TransferHelper.sol";

contract UniswapV2Adapter is IAdapter {
    function swap(
        address pool,
        address tokenIn,
        address tokenOut,
        uint256 amount,
        bytes calldata /* extraData */
    ) external returns (uint256 amountOut) {
        TransferHelper.universalApproveMax(tokenIn, pool, amount);

        (uint256 r0, uint256 r1, ) = IUniswapV2Pair(pool).getReserves();
        bool isToken0 = tokenIn == IUniswapV2Pair(pool).token0();

        uint256 reserveIn = isToken0 ? r0 : r1;
        uint256 reserveOut = isToken0 ? r1 : r0;
        uint256 amountInWithFee = amount * 997;
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = reserveIn * 1000 + amountInWithFee;
        amountOut = numerator / denominator;

        TransferHelper.safeTransfer(tokenIn, pool, amount);

        IUniswapV2Pair(pool).swap(
            isToken0 ? 0 : amountOut,
            isToken0 ? amountOut : 0,
            address(this),
            ""
        );
    }
}
