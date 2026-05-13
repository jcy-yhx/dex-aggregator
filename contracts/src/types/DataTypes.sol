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

/***
srcToken：输入代币地址（ERC20 或 WETH）
dstToken：目标代币地址（ERC20 或 WETH）
dstReceiver：payable 类型，输出代币最终接收者的地址（可以是用户自己，也可以是其他合约）
amount：用户想要卖出的 srcToken 数量
minReturnAmount：用户能接受的最低输出数量。这是滑点控制的核心参数。
flags：使用位标志（bit flags），目前定义了两个：
0x01 = _UNWRAP_WETH：如果设置，最终把 WETH 解包成原生 ETH 返回给用户
0x02 = _PARTIAL_FILL：如果设置，允许部分成交（不需要严格满足 minReturnAmount）

permit：用于 EIP-2612 Permit 签名数据。
如果用户不想提前 approve，可以在 off-chain 签名，然后把签名数据填在这里。
Router 会自动调用 permit() 授权自己扣款。
*/

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
