// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {RouteStep} from "./types/DataTypes.sol";
import {IAdapter} from "./adapters/IAdapter.sol";

contract Executor {
    function executeRoute(
        RouteStep[] calldata steps
    ) external payable returns (uint256 dstAmount) {
        for (uint256 i = 0; i < steps.length; i++) {
            RouteStep calldata step = steps[i];

            uint256 amountIn = step.amount;
            if (amountIn == 0) {
                amountIn = dstAmount;
            }
            if (amountIn == 0) {
                amountIn = IERC20(step.tokenIn).balanceOf(address(this));
            }

            (bool ok, bytes memory ret) = step.adapter.delegatecall(
                abi.encodeWithSelector(
                    IAdapter.swap.selector,
                    step.pool,
                    step.tokenIn,
                    step.tokenOut,
                    amountIn,
                    step.extraData
                )
            );

            if (!ok) {
                if (ret.length > 0) {
                    assembly {
                        revert(add(32, ret), mload(ret))
                    }
                } else {
                    revert("Executor: adapter call failed");
                }
            }

            dstAmount = abi.decode(ret, (uint256));
        }
    }
}
