// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

struct SwapDescription {
    address srcToken;
    address dstToken;
    address payable dstReceiver;
    uint256 amount;
    uint256 minReturnAmount;
    // Bit flags:
    //   0x01 - unwrapWETH: unwrap output WETH to native ETH
    //   0x02 - partialFill: allow partial fill
    uint256 flags;
    bytes permit;
}

struct RouteStep {
    address pool;
    address adapter;
    address tokenIn;
    address tokenOut;
    // Amount for this step. If 0, use the output from the previous step.
    uint256 amount;
    // Protocol-specific data (e.g., V3 fee tier encoded as uint24)
    bytes extraData;
}
