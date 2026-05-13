# DEX Aggregator

受 1inch 启发的去中心化交易所聚合器，全栈作品项目。聚合 **Uniswap V2、Uniswap V3 和 Curve** 的流动性，基于图寻路与拆分路由算法发现最优兑换路径。

**状态**：Sepolia 测试网运行中 ✦ WETH ↔ USDC / USDT 兑换正常 ✦ 详细技术文档见 [learn.md](./learn.md)

[English](./README.md)

## 架构

```
                          ┌──────────────────────┐
                          │    用户钱包 (EOA)      │
                          └──────────┬───────────┘
                                     │ swap()
                                     ▼
┌────────────────────────────────────────────────────────────┐
│              AggregationRouter (入口合约)                   │
│  · 单笔交易中托管所有代币                                    │
│  · ETH ↔ WETH 自动包装/解包，滑点保护                        │
│  · V3 回调: uniswapV3SwapCallback()                        │
├────────────────────────────────────────────────────────────┤
│           │ delegatecall                                    │
│           ▼                                                 │
│  ┌──────────────────┐                                      │
│  │    Executor       │  executeRoute(steps[])               │
│  │   (payable)       │  遍历路由步骤, delegatecall 适配器     │
│  └──────┬───────────┘                                      │
│         │ delegatecall per step                              │
│  ┌──────▼──────────────────────────────────────────────┐   │
│  │                    适配器                              │   │
│  │  UniswapV2Adapter  │  UniswapV3Adapter  │  CurveAdapter │
│  │  (预转币模式)       │  (回调模式)        │  (预转币模式)   │
│  └───────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────┘
                                     │ 外部调用
                                     ▼
                    ┌─────────────────────────────────┐
                    │   Uniswap V2 / V3 / Curve 池子   │
                    │          (Sepolia 测试网)         │
                    └─────────────────────────────────┘
```

## 核心技术亮点

### 1. delegatecall 执行链
AggregationRouter 托管所有代币。Executor + Adapter 通过 `delegatecall` 在 Router 的存储上下文中运行，无需在合约间转移代币。整条调用链上的所有 `external` 函数必须声明为 `payable`——Solidity 编译器会对非 payable 函数自动插入 `require(msg.value == 0)`，但 `delegatecall` 会保留原始交易的 `msg.value`。

### 2. Bellman-Ford 寻路
将流动性池建模为带权有向图，Bellman-Ford 算法迭代松弛最多 4 跳，找到最优兑换路径。通过屏蔽已用池子重新运行，发现 TOP_K=3 条备选路径供拆分路由使用。

### 3. 贪心边际拆分路由
将交易金额离散为 20 份增量，每份分配给边际产出最高的路径。逼近 AMM 凹函数曲线上的最优拆分比例。

### 4. 多协议 AMM 定价
- **Uniswap V2**：精确恒定乘积公式，0.3% 手续费
- **Uniswap V3**：从 `sqrtPriceX96` + `liquidity` 反算虚拟储备，套用恒定乘积公式近似
- **Curve**：简化 1:1 稳定币兑换，0.04% 手续费

### 5. V3 回调模式
Uniswap V3 要求回调函数完成代币转账。Adapter 将 `(token0, token1)` 编码进 swap 的 `data` 参数，Router 的 `uniswapV3SwapCallback` 解码后向池子支付所需代币。预转币模式在 V3 中不可行——池子的余额快照会将预转的代币双重计数，导致余额校验失败。

## 项目结构

```
dex-aggregator/
├── contracts/                          # Foundry (Solidity 0.8.33)
│   ├── src/
│   │   ├── AggregationRouter.sol       # 入口合约 + V3 回调
│   │   ├── Executor.sol                # delegatecall 路由执行器
│   │   ├── adapters/
│   │   │   ├── IAdapter.sol            # 适配器统一接口
│   │   │   ├── UniswapV2Adapter.sol    # 预转币 + pair.swap()
│   │   │   ├── UniswapV3Adapter.sol    # 回调模式 + pool.swap()
│   │   │   └── CurveAdapter.sol        # 预转币 + exchange()
│   │   ├── interfaces/                 # IWETH, IUniswapV2Pair, IV3Pool, ICurvePool
│   │   ├── libraries/TransferHelper.sol
│   │   └── types/DataTypes.sol         # SwapDescription, RouteStep
│   ├── test/AggregationRouter.t.sol    # 8 个测试 (全部通过)
│   └── script/Deploy.s.sol             # Sepolia 部署脚本
├── web/                                # Next.js 16 + React 19
│   ├── src/
│   │   ├── engine/                     # 链下路由引擎
│   │   │   ├── types.ts               # 核心类型定义
│   │   │   ├── graph.ts               # 邻接表构建
│   │   │   ├── pricing.ts             # V2/V3/Curve AMM 定价公式
│   │   │   ├── pathfinder.ts          # Bellman-Ford (最大 4 跳)
│   │   │   ├── split-router.ts        # 贪心边际分配
│   │   │   ├── pool-fetcher.ts        # 链上池数据拉取 (30s 缓存)
│   │   │   ├── pool-registry.ts       # 已验证的池子地址
│   │   │   ├── pool-data-static.ts    # 后备快照数据
│   │   │   └── index.ts               # getQuote() 调度器
│   │   ├── app/
│   │   │   ├── api/quote/route.ts     # POST /api/quote
│   │   │   ├── providers.tsx          # Wagmi + QueryClient
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   ├── components/                # SwapForm, TokenSelect, RouteDisplay, SlippageSettings
│   │   ├── hooks/                     # useQuote, useSwap, useTokenBalances
│   │   └── lib/                       # contracts.ts, tokens.ts, utils.ts, config.ts
│   └── package.json
├── README.md                           # English version
├── README_CN.md                        # 中文版
└── learn.md                            # 详细技术文档
```

## 快速开始

### 环境准备
- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- Node.js 18+
- Sepolia ETH（从水龙头获取）

### 1. 智能合约

```bash
cd contracts
cp .env.example .env          # 填写 SEPOLIA_RPC_URL
forge build
forge test -vvv               # 8 个测试
```

部署到 Sepolia（需要 Sepolia ETH + Foundry keystore 中的私钥）：
```bash
forge script script/Deploy.s.sol \
  --rpc-url $SEPOLIA_RPC_URL \
  --account deployer \
  --password <你的密码> \
  --broadcast
```

### 2. 前端

```bash
cd web
cp .env.example .env.local    # 填写 NEXT_PUBLIC_REOWN_PROJECT_ID
npm install
npm run dev                   # → http://localhost:3000
```

## 环境变量

### contracts/.env
| 变量 | 说明 |
|----------|-------------|
| `SEPOLIA_RPC_URL` | Sepolia RPC 节点地址 |
| `ETHERSCAN_API_KEY` | 合约验证（可选） |

### web/.env.local
| 变量 | 说明 |
|----------|-------------|
| `NEXT_PUBLIC_REOWN_PROJECT_ID` | 从 [cloud.reown.com](https://cloud.reown.com) 申请 |
| `NEXT_PUBLIC_SEPOLIA_RPC_URL` | Sepolia RPC 节点地址 |
| `NEXT_PUBLIC_ROUTER_ADDRESS` | AggregationRouter 部署地址 |
| `NEXT_PUBLIC_WETH_ADDRESS` | WETH 地址（默认: Sepolia WETH） |
| `NEXT_PUBLIC_V2_ADAPTER` | UniswapV2Adapter 地址 |
| `NEXT_PUBLIC_V3_ADAPTER` | UniswapV3Adapter 地址 |
| `NEXT_PUBLIC_CURVE_ADAPTER` | CurveAdapter 地址 |

## Sepolia 部署地址

| 合约 | 地址 |
|----------|---------|
| AggregationRouter | `0xb86eD998628D6395B9BD6C2a6D9Fa089A9DC99b5` |
| Executor | 随 Router 部署（内嵌） |
| UniswapV2Adapter | `0x2E246624306e322687612443907f5fc3A3AE89FC` |
| UniswapV3Adapter | `0x3814A971cA10f416525c7E674534c688F8Db53DE` |
| CurveAdapter | `0x19bedA72B731820bec947b518a26A7023C1D0f38` |

### Sepolia 可用代币

| 符号 | 地址 | 精度 |
|--------|---------|----------|
| WETH | `0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14` | 18 |
| USDC | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` | 6 |
| USDT | `0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0` | 6 |

### 可用池子

| 交易对 | 地址 | 协议 | 费率 |
|------|---------|----------|-----|
| USDC-WETH | `0x8af3398492E8e64Da6aF148BF5867F543817BD6b` | Uniswap V2 | 0.3% |
| USDT-WETH | `0xc7808638742780A98A34724530e6EA434483Da97` | Uniswap V2 | 0.3% |
| USDC-WETH | `0x6Ce0896eAE6D4BD668fDe41BB784548fb8F59b50` | Uniswap V3 | 0.3% |

## 测试

### 智能合约
```bash
cd contracts && forge test -vvv
```
8 个测试覆盖：单跳 V2/V3、拆分路由 V2+V3、多跳 V2→Curve、滑点保护、ETH 包装/解包。

### 路由引擎
```bash
cd web && npx vitest src/engine/
```

## 技术栈

| 层 | 技术 |
|-------|-----------|
| 智能合约 | Solidity 0.8.33, Foundry, OpenZeppelin v5 |
| 前端 | Next.js 16, React 19, TypeScript |
| Web3 | Wagmi v3, Reown AppKit, Viem v2 |
| 路由引擎 | TypeScript, Bellman-Ford, 贪心优化 |
| 样式 | Tailwind CSS v4 |
| 网络 | Sepolia (Ethereum 测试网) |

## Bug 修复实录

Sepolia 集成过程中发现并修复了 5 个 bug，每个都需要到 EVM 字节码层面诊断（使用 `cast run` + `cast code`）。完整调试记录见 [learn.md](./learn.md#10-bug-修复实战5-连环)。

| # | 层 | 问题 | 修复 |
|---|-------|-----|-----|
| 1 | Router | 缺少 `uniswapV3SwapCallback` | 新增回调函数 |
| 2 | Executor | `non-payable` → 编译器拒绝 delegatecall 传入的 `msg.value` | 加 `payable` |
| 3 | 所有 Adapter | 同上——delegatecall 链上每层都被卡 | 全部加 `payable` |
| 4 | V3 Adapter | 预转币破坏 V3 余额快照校验 → `IIA` | 改为回调转账 |
| 5 | 引擎 | 静态后备数据过期 → 报价偏差 382% | 更新链上储备量 |
| 6 | 前端 | ERC20 代币缺少 approve 步骤 | useSwap 增加授权检查 |

## 延伸学习

关于架构、算法、合约设计和调试过程的全面讲解，请阅读 **[learn.md](./learn.md)**。
