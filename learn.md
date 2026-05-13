# DEX Aggregator — 项目详解

## 目录

1. [项目概述](#1-项目概述)
2. [总体架构](#2-总体架构)
3. [智能合约层](#3-智能合约层)
4. [链下路由引擎](#4-链下路由引擎)
5. [前端应用](#5-前端应用)
6. [一次 Swap 的完整生命周期](#6-一次-swap-的完整生命周期)
7. [本次会话完成的工作](#7-本次会话完成的工作)
8. [如何运行](#8-如何运行)
9. [Sepolia 部署地址](#9-sepolia-部署地址)
10. [Bug 修复实战（5 连环）](#10-bug-修复实战5-连环)

---

## 1. 项目概述

DEX Aggregator 是一个去中心化交易所聚合器，功能类似 1inch。它聚合 Uniswap V2、Uniswap V3 和 Curve 的流动性，通过图算法找到最优兑换路径，并在一笔原子交易中执行。

**核心价值**：在多个 DEX 之间寻找最优价格，拆分订单以降低价格影响（price impact），用户无需手动对比不同 DEX 的报价。

**技术栈**：
- 智能合约：Solidity 0.8.20 + Foundry
- 前端：Next.js 16 + React 19 + TypeScript
- 区块链交互：Wagmi 3 + Viem 2
- 钱包连接：Reown AppKit
- 目标网络：Sepolia 测试网

---

## 2. 总体架构

```
┌─────────────────────────────────────────────────────────┐
│                   浏览器 (Browser)                       │
│  ┌──────────┐ ┌────────────┐ ┌──────────────────────┐  │
│  │ SwapForm │ │ TokenSelect│ │ RouteDisplay         │  │
│  │ 输入金额  │ │ 选择代币   │ │ 显示路径/价格影响     │  │
│  └────┬─────┘ └────┬───────┘ └──────────────────────┘  │
│       │             │                                    │
│  ┌────▼─────────────▼─────────────────────────────────┐ │
│  │              Hooks (useQuote / useSwap)             │ │
│  └────────────────────┬───────────────────────────────┘ │
├───────────────────────┼─────────────────────────────────┤
│                  网络请求                                │
├───────────────────────┼─────────────────────────────────┤
│           Next.js API Route: POST /api/quote            │
│  ┌────────────────────▼───────────────────────────────┐ │
│  │              Routing Engine (TypeScript)            │ │
│  │  ┌───────────┐ ┌──────────┐ ┌──────────────────┐  │ │
│  │  │Graph      │ │Pathfinder│ │Split Router      │  │ │
│  │  │构建邻接表  │ │Bellman-  │ │贪心边际分配       │  │ │
│  │  │           │ │Ford 4跳  │ │20等分增量法       │  │ │
│  │  └───────────┘ └──────────┘ └──────────────────┘  │ │
│  │  ┌──────────────────────────────────────────────┐  │ │
│  │  │Pool Fetcher: 从链上实时拉取池子储备/价格      │  │ │
│  │  └──────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│               以太坊 Sepolia 测试网                       │
│  ┌──────────────────────────────────────────────────┐   │
│  │          AggregationRouter (入口合约)              │   │
│  │  ┌─────────────────────────────────────────────┐ │   │
│  │  │              Executor (执行引擎)              │ │   │
│  │  │  ┌──────────┐ ┌──────────┐ ┌────────────┐  │ │   │
│  │  │  │V2Adapter │ │V3Adapter │ │CurveAdapter│  │ │   │
│  │  │  │(delegate)│ │(delegate)│ │(delegate)  │  │ │   │
│  │  │  └──────────┘ └──────────┘ └────────────┘  │ │   │
│  │  └─────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────┘   │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────────────┐ │
│  │Uniswap V2│ │Uniswap V3│ │Curve (Sepolia 无部署)     │ │
│  │  Pools   │ │  Pools   │ │                          │ │
│  └──────────┘ └──────────┘ └──────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### 数据流总结

1. 用户在 UI 选择代币和数量
2. `useQuote` hook 发送请求到 `/api/quote`
3. API Route 调用 `pool-fetcher` 从链上获取最新池子数据
4. `buildGraph()` 将池子列表构建为邻接表
5. `findPaths()` 用 Bellman-Ford 算法找到最优路径（最多 4 跳）
6. `allocateSplit()` 用贪心算法将资金分配到一个或多个路径
7. 返回最优报价和路由信息给前端
8. 用户点击 Swap，`useSwap` 构建交易 calldata
9. 调用 `AggregationRouter.swap()` 在链上原子执行所有路由

---

## 3. 智能合约层

### 3.1 核心设计：delegatecall 执行模式

这是整个合约架构的核心概念。传统的 DEX 聚合器在合约之间进行代币转移，而这个项目使用 `delegatecall` 让所有逻辑在 AggregationRouter 的存储上下文中执行。

```
用户 EOA
  │
  │ swap()
  ▼
AggregationRouter (持有所有代币)
  │
  │ delegatecall ──► Executor.executeRoute()
  │                      │
  │                      │ delegatecall ──► UniswapV2Adapter.swap()
  │                      │                      │
  │                      │                      │ call ──► Uniswap V2 Pool
  │                      │
  │                      │ delegatecall ──► UniswapV3Adapter.swap()
  │                      │                      │
  │                      │                      │ call ──► Uniswap V3 Pool
  │                      │
  │                      │ delegatecall ──► CurveAdapter.swap()
  │                                             │
  │                                             │ call ──► Curve Pool
  ▼
用户收到输出代币
```

**delegatecall 的含义**：
- 被调用合约（Adapter）的代码在**调用者（Router）的存储空间**中运行
- `address(this)` 指向 Router，不是 Adapter
- 所有代币余额在 Router 地址上，Adapter 直接操作它们
- 好处：无需在合约之间转移代币，节省 gas，减少攻击面

### 3.2 AggregationRouter.sol（入口合约，149 行）

**职责**：面向用户的主合约，协调整个兑换流程。

**状态变量**：
- `IWETH public immutable weth` — WETH 合约地址（Sepolia: `0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14`）
- `Executor public immutable executor` — 执行引擎，构造时部署（不可变）

**核心函数 `swap()`**：

```
swap(SwapDescription, RouteStep[][]) → (returnAmount, spentAmount)
```

执行步骤：

1. **Permit（可选）**：如果提供了 EIP-2612 permit 签名，先执行 `permit()` 授权

2. **获取代币**：
   - 如果 `msg.value > 0`：将 ETH 包装为 WETH
   - 否则：`transferFrom` 从用户拉取代币到 Router

3. **执行路由**：每条路由 `delegatecall` 到 Executor，累加产出

4. **滑点检查**：验证总产出 ≥ `minReturnAmount`（除非设置 PARTIAL_FILL 标志）

5. **发送产出**：
   - 如果设置 UNWRAP_WETH 标志：WETH → ETH 发送给接收者
   - 否则：直接转目标代币给接收者

6. **退款**：退还剩余的源代币给用户

**Flag 系统**：
| Flag | 值 | 含义 |
|------|-----|------|
| UNWRAP_WETH | 0x01 | 将产出的 WETH 解包为 ETH |
| PARTIAL_FILL | 0x02 | 允许部分成交（产出可以 < minReturnAmount） |

**安全机制**：
- 继承 `ReentrancyGuard`：防止重入攻击
- 继承 `Ownable`：`rescueTokens()` 只能由 owner 调用
- 滑点保护：`returnAmount >= minReturnAmount`

**uniswapV3SwapCallback**：

Router 实现了 Uniswap V3 要求的回调接口：
```solidity
function uniswapV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata data) external {
    (address token0, address token1) = abi.decode(data, (address, address));
    if (amount0Delta > 0) token0.safeTransfer(msg.sender, uint256(amount0Delta));
    if (amount1Delta > 0) token1.safeTransfer(msg.sender, uint256(amount1Delta));
}
```
- `amount0Delta > 0` 表示需要向池子支付 token0
- `amount1Delta > 0` 表示需要向池子支付 token1
- `data` 由 V3Adapter 编码传入，包含 `(token0, token1)` 地址
- `msg.sender` 是 V3 Pool（池子回调 Router），直接转币给池子

### 3.3 Executor.sol（执行引擎，47 行）

**职责**：遍历路由步骤，逐跳 `delegatecall` 到对应适配器。

```
executeRoute(RouteStep[]) → dstAmount
```

执行逻辑：
1. 遍历 RouteStep 数组
2. 如果某步 `amount == 0`，使用前一步的产出量（用于多跳路由）
3. `delegatecall` 到步骤指定的 adapter 地址
4. 解码返回值作为 `dstAmount`
5. 每步的产出自动成为下一步的输入（通过 Router 余额）

### 3.4 适配器（Adapters）

适配器是**无状态逻辑合约**，只负责与底层 DEX 池子交互。它们通过 `delegatecall` 在 Router 上下文中执行。

**IAdapter.sol** — 统一接口：
```solidity
interface IAdapter {
    function swap(
        address pool,      // DEX 池子地址
        address tokenIn,   // 输入代币
        address tokenOut,  // 输出代币
        uint256 amount,    // 输入数量
        bytes calldata extraData  // 协议特定数据（如 Curve 的 coin indices）
    ) external returns (uint256 amountOut);
}
```

#### UniswapV2Adapter.sol（38 行）

经典常数乘积做市商（Constant Product AMM）。

**定价公式**（与链上 Uniswap V2 一致）：
```
amountOut = (amountIn × 997 × reserveOut) / (reserveIn × 1000 + amountIn × 997)
```

其中 997/1000 表示 0.3% 手续费。

**流程**：
1. 授权池子花费代币
2. 读取池子 `getReserves()` 获取储备量
3. 根据 `token0/token1` 确定输入/输出方向
4. 链上计算输出量（与链下引擎公式一致，Solidity 命名返回值隐式返回）
5. 转移输入代币到池子
6. 调用池子 `swap()` 获取输出代币

#### UniswapV3Adapter.sol（31 行）

集中流动性做市商（Concentrated Liquidity）。

**关键设计**：与 V2 不同，V3 使用 **callback 模式**而非预转代币。Adapter 不直接转账到池子，而是将 `(token0, token1)` 编码进 `data` 参数传给 pool，由 Router 的 `uniswapV3SwapCallback` 完成实际转账。

**流程**：
1. 调用 `pool.token0()` 确定代币顺序
2. 确定 `zeroForOne` 方向（tokenIn == token0 则 token0 → token1）
3. 编码 `data = abi.encode(token0, token1)` 传给 callback 使用
4. 调用 `pool.swap(recipient, zeroForOne, amount, sqrtPriceLimit, data)`
   - `amount` 为正：exact input（精确输入）
   - `sqrtPriceLimit`：设为 MIN+1 或 MAX-1，接受任意价格（滑点由 Router 层统一控制）
5. V3 pool 内部回调 `Router.uniswapV3SwapCallback(amount0, amount1, data)`
6. 从返回值中解析 `amountOut`（V3 用正/负值：正=流入池子，负=流出池子）

#### CurveAdapter.sol（24 行）

稳定币专用做市商（Stableswap）。

**流程**：
1. 授权并转移代币到池子
2. 从 `extraData` 解码 coin indices（`(int128 i, int128 j)`）
3. 调用 `pool.exchange(i, j, amount, 0)` 执行兑换

### 3.5 DataTypes.sol

```solidity
struct SwapDescription {
    address srcToken;           // 输入代币地址
    address dstToken;           // 输出代币地址
    address payable dstReceiver;// 接收者
    uint256 amount;             // 输入数量
    uint256 minReturnAmount;    // 最小产出（滑点保护）
    uint256 flags;              // UNWRAP_WETH | PARTIAL_FILL
    bytes permit;               // EIP-2612 许可数据
}

struct RouteStep {
    address pool;      // 池子地址
    address adapter;   // 适配器地址
    address tokenIn;   // 输入代币
    address tokenOut;  // 输出代币
    uint256 amount;    // 数量（0 表示使用上一步产出）
    bytes extraData;   // 额外数据（如 Curve coin indices）
}
```

### 3.6 TransferHelper.sol

封装 OpenZeppelin SafeERC20，提供安全的代币操作：
- `safeTransferFrom` / `safeTransfer` / `safeApprove`
- `universalApproveMax`：先重置为零再批准最大值，兼容 USDT 等有批准 race condition 的代币

---

## 4. 链下路由引擎

路由引擎在 `web/src/engine/` 目录中，是 TypeScript 实现的算法核心。

### 4.1 数据模型（types.ts）

```typescript
// 池子边（图中的边）
interface PoolEdge {
  address: string;       // 池子合约地址
  protocol: 'uniswap_v2' | 'uniswap_v3' | 'curve';
  token0: string;        // 代币0地址
  token1: string;        // 代币1地址
  reserve0: bigint;      // 代币0储备（V3为虚拟储备）
  reserve1: bigint;      // 代币1储备（V3为虚拟储备）
  fee: number;           // 手续费（基点：30 = 0.3%）
}

// 报价响应
interface QuoteResponse {
  routes: RoutePath[];   // 路由列表（拆分时有多条）
  totalOutput: string;   // 总产出
  priceImpact: number;   // 价格影响百分比
}
```

### 4.2 图构建（graph.ts）

将池子列表 `PoolEdge[]` 构建为**邻接表**（Adjacency List）：

```
输入: [USDC-WETH池, USDT-WETH池, V3 USDC-WETH池]

输出: Map<tokenAddress, PoolEdge[]>
  USDC → [V2 USDC-WETH池, V3 USDC-WETH池]
  WETH → [V2 USDC-WETH池, V2 USDT-WETH池, V3 USDC-WETH池]
  USDT → [V2 USDT-WETH池]
```

每个代币地址映射到包含它的所有池子，池子即图中的"边"，连接两个代币（图中的"节点"）。

### 4.3 定价公式（pricing.ts）

#### Uniswap V2（常数乘积）

```
amountOut = (amountIn × (10000 - feeBps) × reserveOut) /
            (reserveIn × 10000 + amountIn × (10000 - feeBps))
```

对于 0.3% 手续费：(10000 - 30) = 9970，等价于合约中的 997/1000。

#### Uniswap V3（集中流动性近似）

虚拟储备（Virtual Reserves）计算：
```
sqrtPrice = sqrtPriceX96 / 2^96
virtualReserve0 = liquidity / sqrtPrice
virtualReserve1 = liquidity × sqrtPrice
```

然后用常数乘积公式近似——在交易量不大且当前 tick 内流动性充足时近似合理。

#### Curve（稳定币）

简化 1:1 兑换：
```
amountOut = amountIn × (1 - fee/10000)
```

实际 Curve 使用更复杂的 stableswap 公式，这里简化为近似。

### 4.4 路径查找（pathfinder.ts）— Bellman-Ford 算法

**问题**：给定输入代币和输出代币，在有手续费的多池子图中找到产出最大的路径。

**算法选择**：Bellman-Ford 而非 Dijkstra，因为：
- 池子手续费导致"边的权重"不是静态的（依赖于交易量）
- Bellman-Ford 天然支持每次迭代用不同权重（根据当前累积输入量重新计算产出）

**流程**：
```
1. dist[srcToken] = amountIn（起点初始化为输入量）
2. for hop in 1..MAX_HOPS(4):
3.   for each token with dist[token] > 0:
4.     for each pool connected to token:
5.       out = getAmountOut(pool, token, dist[token])
6.       if out > dist[neighbour]:
7.         dist[neighbour] = out（松弛操作）
8.         prev[neighbour] = path + currentPool
```

**多路径策略**：找到最佳路径后，屏蔽已使用的池子索引，再次运行 Bellman-Ford 寻找备选路径（最多 TOP_K=3 条）。

**时间复杂度**：O(H × E)，H=4（最大跳数），E=边数。

### 4.5 拆分路由（split-router.ts）— 贪心边际分配

**问题**：如果有多个路径（如 V2 和 V3 都能到达目标），如何分配资金以最大化总产出？

**算法**：贪心边际率（Greedy Marginal Rate）：
1. 将总金额分成 `SPLIT_GRANULARITY=20` 等份
2. 对每份增量，计算分配给每条路径的**边际产出**（多分配一份增加的产出）
3. 将增量分配给边际产出最高的路径
4. 重复直到所有增量分配完毕

**为什么有效**：AMM 曲线是凹函数（concave），通过贪心边际分配可以近似凸优化最优解。

**回退逻辑**：如果贪心分配只给了 1 条路径（或多条路径但只有 1 条有资金），则全部分配给最佳路径。

### 4.6 动态池数据获取（pool-fetcher.ts + pool-registry.ts）

**问题**：池子储备量会随交易实时变化，硬编码数据会过时。

**方案**：每次收到报价请求时，从链上拉取最新数据。

**V2 池查询**：
```typescript
// 调用 3 个 view 函数
token0() → address
token1() → address
getReserves() → (uint112 reserve0, uint112 reserve1, uint32)
```

**V3 池查询**：
```typescript
// 调用 5 个 view 函数
token0(), token1(), fee()
slot0() → (sqrtPriceX96, tick, ...)
liquidity() → uint128
// 然后计算虚拟储备
```

**缓存策略**：30 秒内存缓存，避免频繁 RPC 请求。

**回退机制**：链上查询失败时，使用 `pool-data-static.ts` 中缓存的静态快照数据。

---

## 5. 前端应用

### 5.1 页面结构

```
/ (首页)
├── Header: Logo + Sepolia标签 + 钱包按钮
├── SwapForm (主体)
│   ├── SlippageSettings (滑点设置)
│   ├── 输入区域 (You pay)
│   │   ├── 金额输入框
│   │   └── TokenSelect (选择卖出代币)
│   ├── 方向切换按钮
│   ├── 输出区域 (You receive)
│   │   ├── 报价显示 / 加载动画
│   │   └── TokenSelect (选择买入代币)
│   ├── RouteDisplay (路由可视化)
│   └── Swap按钮 (渐变紫色)
└── Footer: How it works (3步说明)
```

### 5.2 组件关系

```
page.tsx
├── SwapForm.tsx (状态管理核心)
│   ├── SlippageSettings.tsx (滑点预设 + 自定义)
│   ├── TokenSelect.tsx (代币下拉选择器)
│   │   └── 搜索过滤 + 多彩代币图标
│   └── RouteDisplay.tsx (路径可视化)
│       └── 协议徽章 + 百分比进度条
├── WalletButton.tsx (Reown AppKit 钱包连接)
└── Providers → Wagmi + QueryClient
```

### 5.3 Hooks

**useQuote.ts** — 报价查询
```
输入: srcToken, dstToken, amountIn
行为: 300ms 防抖 → POST /api/quote
输出: { quote, loading, error }
```

**useSwap.ts** — 执行兑换
```
输入: quote, srcToken, amountIn, slippage
行为:
  1. 检测 srcToken 是否为 WETH → 自动使用 msg.value 发送原生 ETH
  2. 构建 SwapDescription (含 minReturnAmount = totalOutput × (1 - slippage))
  3. 从 ADAPTER_ADDRESS 映射 protocol → adapter 地址填充 RouteStep.adapter
  4. 调用 writeContractAsync(router.swap, { value, gas: 5M }) 
输出: { status, txHash, executeSwap }
```

**useTokenBalances.ts** — 余额查询
```
输入: tokenAddress
输出: { balance, loading }
```

### 5.4 API 路由

`POST /api/quote`

请求体：
```json
{
  "srcToken": "0x...",
  "dstToken": "0x...",
  "amountIn": "1000000000000000000"
}
```

响应体：
```json
{
  "routes": [
    {
      "path": ["0xWETH", "0xUSDC"],
      "protocols": ["uniswap_v3"],
      "pools": ["0x..."],
      "percentage": 100,
      "expectedOutput": "..",
      "steps": [{ "pool": "..", "adapter": "..", "tokenIn": "..", "tokenOut": "..", "amount": "..", "extraData": ".." }]
    }
  ],
  "totalOutput": "..",
  "priceImpact": 0.05
}
```

---

## 6. 一次 Swap 的完整生命周期

以 WETH → USDC 为例：

```
Step 1: 用户在 SwapForm 选择 WETH → USDC，输入 0.01

Step 2: useQuote hook (300ms 防抖后)
  → POST /api/quote { srcToken: WETH, dstToken: USDC, amountIn: 0.01 ether }

Step 3: API Route
  → fetchAllPools() 从 Sepolia RPC 拉取最新池数据
  → buildGraph(pools) 构建邻接表
  → findPaths() Bellman-Ford 算出最优路径(们)
  → allocateSplit() 贪心分配金额
  → 返回 QuoteResponse

Step 4: 前端更新显示
  → 输出金额显示
  → RouteDisplay 显示路由可视化
  → 价格影响百分比

Step 5: 用户点击 Swap
  → useSwap.executeSwap()
  → 构建 SwapDescription (含 minReturnAmount = expected × (1 - slippage))
  → 构建 RouteStep[][] (adapter 地址从 ADAPTER_ADDRESS 映射获取)
  → writeContractAsync(router.swap, [desc, routes])

Step 6: MetaMask/钱包弹出确认

Step 7: 链上执行
  → AggregationRouter.swap{value: amount}()
    → WETH.deposit{value: amount}()  — 自动打包 ETH 为 WETH
    → delegatecall Executor.executeRoute(routes[0])
      → delegatecall V3Adapter.swap(pool, WETH, USDC, amount, "")
        → 读取 token0/token1，确定 swap 方向
        → 编码 data = abi.encode(token0, token1)
        → pool.swap(Router, zeroForOne, amount, priceLimit, data)
          → V3 Pool 内部计算 swap，确定需要的 token 量
          → 回调 Router.uniswapV3SwapCallback(amount0, amount1, data)
            → 解码 token0/token1
            → 转账 amount1Delta WETH 给池子
          → V3 Pool 检查余额 OK，转 USDC 给 Router
    → 验证 returnAmount >= minReturnAmount
    → transfer(Router → 用户, USDC)
  → emit Swapped(...)
```

---

## 7. 本次会话完成的工作

### 7.1 创建部署脚本

**文件**：`contracts/script/Deploy.s.sol`

部署 AggregationRouter + 3 个适配器到 Sepolia。支持两种密钥方式：
- 加密 keystore（`cast wallet import` + `--account deployer`）
- 环境变量 `PRIVATE_KEY`

### 7.2 前端适配器地址配置

解决了 `useSwap.ts` 中适配器地址硬编码为 `0x0000...` 的问题：

- `config.ts`：新增 `V2_ADAPTER`、`V3_ADAPTER`、`CURVE_ADAPTER` 环境变量
- `contracts.ts`：新增 `ADAPTER_ADDRESS` 映射表（protocol → adapter 地址）
- `useSwap.ts`：使用 `ADAPTER_ADDRESS[route.protocols[idx]]` 替代占位符

### 7.3 Sepolia 部署

合约已部署到 Sepolia，地址见下方第 9 节。

### 7.4 动态池数据获取

将硬编码的静态池数据替换为从链上实时获取：

- `pool-registry.ts`：已验证的 Sepolia 池地址注册表
- `pool-fetcher.ts`：使用 Viem 从链上查询 V2 reserves / V3 sqrtPrice + liquidity
- `pool-data-static.ts`：更新为真实 Sepolia 数据，作为链上查询失败时的回退
- API Route：优先链上获取，失败回退静态数据
- 带 30 秒内存缓存

### 7.5 UI 重新设计

从暗色主题改为明亮现代风格：

- `globals.css`：浅色背景 + 径向渐变
- `layout.tsx`：移除 `dark` 模式
- `page.tsx`：白色 header/footer，渐变按钮，新 How it works 设计
- `SwapForm.tsx`：白色卡片，渐变 Swap 按钮，余额一键填充，加载动画
- `TokenSelect.tsx`：多彩代币图标（WETH=紫、USDC=蓝、USDT=绿）
- `RouteDisplay.tsx`：彩色协议徽章，渐变进度条
- `SlippageSettings.tsx`：现代化分段控制器

### 7.6 移除 DAI

从代币列表中移除 DAI（Sepolia 无 DAI 池子）。涉及文件：
- `tokens.ts`：移除 DAI 条目
- `pool-data-static.ts`：移除无效 DAI 池子条目
- `pool-registry.ts`：仅注册已验证的 3 个池子

### 7.7 Bug 修复

- 修复水合错误（hydration mismatch）：`SwapForm.tsx` 添加 `mounted` 状态确保 SSR 与客户端一致性

---

## 8. 如何运行

### 环境准备

```bash
# 1. 安装 Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

# 2. 安装 Node.js 18+
# 3. 克隆/进入项目
cd dex-aggregator
```

### 合约编译与测试

```bash
cd contracts
forge build
forge test -vvv    # 8 个测试全部通过
```

### 部署到 Sepolia

```bash
# 导入私钥到加密 keystore（需要 Sepolia ETH）
cast wallet import deployer --interactive

# 部署
source .env
forge script script/Deploy.s.sol --rpc-url $SEPOLIA_RPC_URL --account deployer --broadcast
```

### 启动前端

```bash
cd web
cp .env.example .env.local
# 编辑 .env.local 填入 Reown Project ID + 部署地址
npm install
npm run dev
# 访问 http://localhost:3000
```

### 环境变量

| 变量 | 用途 |
|------|------|
| `SEPOLIA_RPC_URL` | Sepolia RPC 节点地址 |
| `ETHERSCAN_API_KEY` | 合约验证（可选） |
| `NEXT_PUBLIC_REOWN_PROJECT_ID` | 钱包连接（cloud.reown.com 免费申请） |
| `NEXT_PUBLIC_ROUTER_ADDRESS` | AggregationRouter 部署地址 |
| `NEXT_PUBLIC_V2_ADAPTER` | UniswapV2Adapter 部署地址 |
| `NEXT_PUBLIC_V3_ADAPTER` | UniswapV3Adapter 部署地址 |
| `NEXT_PUBLIC_CURVE_ADAPTER` | CurveAdapter 部署地址 |

---

## 9. Sepolia 部署地址

| 合约 | 地址 |
|------|------|
| AggregationRouter | `0xb86eD998628D6395B9BD6C2a6D9Fa089A9DC99b5` |
| UniswapV2Adapter | `0x2E246624306e322687612443907f5fc3A3AE89FC` |
| UniswapV3Adapter | `0x3814A971cA10f416525c7E674534c688F8Db53DE` |
| CurveAdapter | `0x19bedA72B731820bec947b518a26A7023C1D0f38` |

### Sepolia 可用池子

| 池子 | 地址 | 协议 |
|------|------|------|
| USDC-WETH | `0x8af3398492E8e64Da6aF148BF5867F543817BD6b` | Uniswap V2 |
| USDT-WETH | `0xc7808638742780A98A34724530e6EA434483Da97` | Uniswap V2 |
| USDC-WETH | `0x6Ce0896eAE6D4BD668fDe41BB784548fb8F59b50` | Uniswap V3 |

---

## 附录：关键概念

### A. delegatecall vs call

| | call | delegatecall |
|------|------|------|
| 存储上下文 | 被调用合约自己的 | **调用合约的** |
| msg.sender | 调用者 | 原始调用者 |
| msg.value | 传入的ETH | 原始传入的ETH |
| address(this) | 被调用合约 | **调用合约** |

本项目使用 delegatecall 是为了让 Executor 和 Adapter 直接在 Router 的存储中操作代币，避免代币在合约之间转移。

### B. Solidity 命名返回值

```solidity
function swap(...) external returns (uint256 amountOut) {
    amountOut = ...;  // 赋值给命名返回值
    // 即使没有显式 return，amountOut 的值也会被返回
}
```

这是在 Solidity 中合法的返回值方式。

### C. 测试网池子价格偏离

Sepolia 测试网的池子没有套利者维护价格一致性，因此不同池子之间同一资产可能有极大价格差异。路由引擎会正确发现并利用这些套利机会。在主网上，套利者会立刻消除这些偏离。

---

## 10. Bug 修复实战（5 连环）

这是本次会话的核心实战内容。从合约部署到 Sepolia 后连续发现并修复了 5 个 bug，每个都需要到 EVM 字节码层面才能诊断。

### Bug 1: V3 Pool 回调函数缺失

**现象**：交易 revert，gas 只用了 69738，revert reason: `Router: route execution failed`

**诊断过程**：
1. 用 `cast run <txhash>` 追踪链上交易，发现 Executor 的 delegatecall 只用了 95 gas 就 revert 了
2. 95 gas 刚好是函数分发器（function dispatcher）的开销 —— selector 匹配但函数体立即 revert
3. 排查 Executor 的函数分发器字节码：`CALLVALUE PUSH2 0x00b8 JUMPI`
4. 这是 Solidity 编译器的 **non-payable 保护**：对非 payable 的 external 函数，编译器自动插入 `require(msg.value == 0)`
5. 但 `msg.value` 在 delegatecall 中保持原始值（用户发的 0.1 ETH），所以检查失败！

**根因**：`Executor.executeRoute()` 是 non-payable external 函数，但 Router 通过 delegatecall 调用它。delegatecall 保留 `msg.value`（原始交易的 ETH 金额），Executor 看到 `msg.value != 0` 就 revert 了。

**修复**：`Executor.executeRoute()` 加 `payable` 关键字，移除编译器的自动检查。

**教训**：delegatecall 链上的**每一层** external 函数都会继承原始 `msg.value`，都必须是 payable。

### Bug 2: 所有 Adapter 的同一问题

**现象**：修完 Bug 1 后，gas 从 69738 涨到 73921，但 Executor 内部 adapter delegatecall 又用 98 gas revert。

**诊断**：同样的 `CALLVALUE` + `JUMPI` 模式 —— V3Adapter 的 `swap()` 也是 non-payable。

**根因**：delegatecall 链：`Router → Executor → Adapter`，msg.value 在整条链上保持。Excecutor 修了但 Adapter 没修。

**修复**：
- `IAdapter.swap()` 接口加 `payable`
- `UniswapV2Adapter.swap()` 加 `payable`
- `UniswapV3Adapter.swap()` 加 `payable`
- `CurveAdapter.swap()` 加 `payable`

**教训**：接口和所有实现要**同步**加 `payable`。缺一个就挂在那一层。

### Bug 3: V3 预转币与 Balancer 快照冲突

**现象**：修完 Bug 1+2 后，gas 涨到 271635，swap 真的在 V3 pool 里执行了。但 V3 pool revert `IIA`（Insufficient Input Amount）。

**诊断**：追踪完整链路，发现 swap 确实在 V3 pool 内执行了，但 V3 pool 的余额校验失败。

**根因**：V3 Adapter 采用"先转币再调 swap"模式：
```
1. WETH.transfer(V3Pool, 1 ETH)   // 预转币
2. V3Pool.swap(...)               // 调 swap
```
但 V3 Pool 的 swap 内部逻辑是：
```
balanceBefore = balanceOf(token1)   // 已包含预转的 1 ETH
amount1 = computed by AMM math     // 需要 ~1 ETH
callback()                          // no-op
balanceAfter = balanceOf(token1)   // 不变（callback 没转币）
require(balanceBefore + amount1 <= balanceAfter)  // FAIL!
// balanceBefore + amount1 = (原始+1) + 1 = 原始+2 > 原始+1 = balanceAfter
```
预转的币在 `balanceBefore` 里被计入一次，`amount1` 又计入一次，等式翻倍。

**修复**：改为 V3 标准的 callback 模式：
1. V3Adapter **不再预转币**，将 `(token0, token1)` 编码进 `data` 传给 pool
2. V3 pool 回调 Router 的 `uniswapV3SwapCallback`（Bug 1 已经加上了空壳）
3. 回调里根据 `amount0Delta` / `amount1Delta` 判断需要支付哪种 token，直接转账给 pool

修改前后对比：
```
之前: Adapter pre-transfer → Pool.swap → callback(no-op) → balance check FAILS
之后: Pool.swap → callback(token0,token1) → Router 在回调里转账 → balance check PASS
```

**教训**：Uniswap V2 支持预转币模式，但 V3 不行。V3 在 swap 函数开头拍余额快照，预转的币被"双重计数"。必须使用回调模式，让 V3 pool 控制转账时机。

### Bug 4: 前端未传 msg.value

**现象**：用户有 Sepolia ETH，选了 WETH → USDC，但前端报 "gas limit too high"。

**诊断**：前端 `useSwap.ts` 中 `writeContractAsync` 没有传 `value` 参数。

**根因**：用户只有 ETH，前端选了 WETH 作为 srcToken。合约 `swap()` 支持 `msg.value > 0` 时自动打包 ETH → WETH。但前端没有传 `value`，合约走 `transferFrom` 试图从用户钱包拉 WETH —— 用户没 WETH 也没 approve。

**修复**：
```typescript
const isNativeETH = srcToken.toLowerCase() === WETH.toLowerCase();
await writeContractAsync({
  ...
  value: isNativeETH ? amountIn : 0n,
  gas: 5_000_000n,  // delegatecall 链导致 estimateGas 估算异常
});
```

**教训**：前端和合约的 ETH/WETH 处理要对称。合约已支持自动包装，前端只需把 ETH 以 `value` 形式传过去。

### Bug 5: 报价引擎使用过期静态数据

**现象**：修完 Bug 1-4 后，swap 执行成功但 revert `Router: minReturnAmount not met`。实际输出 15214 USDC，预期 72886 USDC，偏差 382%。

**诊断**：
1. 用 Python 重新计算引擎的输出量，发现引擎的 V3 定价公式本身是正确的
2. 但 `totalOutput` 的值恰好等于静态后备数据的计算结果
3. 追踪发现 `pool-fetcher.ts` 的链上查询静默失败，引擎回退到 `pool-data-static.ts` 里的**旧快照**数据
4. 旧数据中 V3 pool 的储备量严重过时（虚数储备差 175 倍）

**根因**：
- `pool-fetcher` 使用 `Promise.all` 并行查询 3 个池子（共 11 个 view 调用）
- Next.js API Route 中 try-catch 静默降级到静态数据
- 静态数据是几个月前的快照，池子储备已完全变化

**修复**：
1. 更新 `pool-data-static.ts` 为当前链上实时数据作为后备
2. 重启 Next.js dev server 让新 env 生效

**教训**：
1. 后备数据需要定期或不定期更新，否则"静默降级"会变成"静默错误"
2. 报价偏差导致的 `minReturnAmount not met` 说明核心流程是对的（swap 执行成功），定价是附件问题

### 调试工具总结

| 工具 | 用途 |
|------|------|
| `cast tx <hash>` | 查看交易详情（gas、calldata） |
| `cast receipt <hash>` | 查看交易结果和 revert reason |
| `cast run <hash> -vvvvv` | 完整追踪交易执行（每步调用 + gas 分布） |
| `cast call <addr> <sig>` | 模拟 view 函数调用 |
| `cast code <addr>` | 查看合约部署的字节码 |
| `cast sig <signature>` | 计算函数选择器 |
| `forge test -vvv` | 本地全量测试（mock 环境下验证逻辑） |
| 字节码分析 | 在 dispatcher 处查找 `CALLVALUE + JUMPI` 模式诊断 non-payable 问题 |

### Bug 修复信息汇总

| # | 层 | Bug | Gas 特征 | Revert | Fix |
|---|-----|-----|----------|--------|-----|
| 1 | Router | 缺 `uniswapV3SwapCallback` | 69738 | V3 回调到不存在函数 | 新增 callback 函数 |
| 2 | Executor | non-payable → `require(msg.value==0)` | 69738 (95 内) | Executor 分发器 revert | 加 `payable` |
| 3 | 所有 Adapter | 同上，delegatecall 链每层都卡 | 73921 (98 内) | Adapter 分发器 revert | 接口+3 个实现全加 `payable` |
| 4 | V3 Adapter | 预转币导致 V3 Pool balance 校验翻倍 | 271635 | `IIA` (Insufficient Input) | 改 callback 转账模式 |
| 5 | 前端 useSwap | 未传 `value`；未设 gas limit | — | gas limit too high | 传 `value` + `gas:5M` |
| 6 | 引擎后备数据 | 静态数据过期 → 报价虚高 382% | 251090+ | `minReturnAmount not met` | 更新静态储备量 |
