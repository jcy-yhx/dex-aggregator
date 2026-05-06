// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockUniswapV3Pool {
    address public immutable token0;
    address public immutable token1;
    uint24 public immutable fee;

    // Simplified: store as constant-product for testing
    uint256 public reserve0;
    uint256 public reserve1;

    constructor(address token0_, address token1_, uint24 fee_) {
        require(token0_ < token1_, "MockV3Pool: token0 must be < token1");
        token0 = token0_;
        token1 = token1_;
        fee = fee_;
    }

    function setReserves(uint256 r0, uint256 r1) external {
        reserve0 = r0;
        reserve1 = r1;
    }

    function swap(
        address recipient,
        bool zeroForOne,
        int256 amountSpecified,
        uint160 /* sqrtPriceLimitX96 */,
        bytes calldata /* data */
    ) external returns (int256 amount0, int256 amount1) {
        if (zeroForOne) {
            // Swap token0 for token1
            uint256 amountIn = uint256(amountSpecified);
            // Use constant-product with fee for simplicity in mock
            uint256 amountInWithFee = amountIn * (1_000_000 - fee);
            uint256 amountOut = (amountInWithFee * reserve1) /
                (reserve0 * 1_000_000 + amountInWithFee);
            IERC20(token1).transfer(recipient, amountOut);
            amount0 = amountSpecified;
            amount1 = -int256(amountOut);
        } else {
            // Swap token1 for token0
            uint256 amountIn = uint256(amountSpecified);
            uint256 amountInWithFee = amountIn * (1_000_000 - fee);
            uint256 amountOut = (amountInWithFee * reserve0) /
                (reserve1 * 1_000_000 + amountInWithFee);
            IERC20(token0).transfer(recipient, amountOut);
            amount0 = -int256(amountOut);
            amount1 = amountSpecified;
        }
    }
}
