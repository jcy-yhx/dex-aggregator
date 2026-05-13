// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IAdapter} from "./IAdapter.sol";
import {ICurvePool} from "../interfaces/ICurvePool.sol";
import {TransferHelper} from "../libraries/TransferHelper.sol";

contract CurveAdapter is IAdapter {
    function swap(
        address pool,
        address tokenIn,
        address tokenOut,
        uint256 amount,
        bytes calldata extraData
    ) external payable returns (uint256 amountOut) {
        TransferHelper.universalApproveMax(tokenIn, pool, amount);
        TransferHelper.safeTransfer(tokenIn, pool, amount);

        (int128 i, int128 j) = abi.decode(extraData, (int128, int128));

        amountOut = ICurvePool(pool).exchange(i, j, amount, 0);
    }
}
