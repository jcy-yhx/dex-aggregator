# DEX Aggregator

A decentralized exchange (DEX) aggregator inspired by 1inch, built as a full-stack portfolio project. Aggregates liquidity across **Uniswap V2, Uniswap V3, and Curve** to find the best swap routes using graph-based pathfinding and split-routing algorithms.

**Status**: Live on Sepolia testnet ✦ WETH ↔ USDC / USDT swaps working ✦ For detailed technical docs see [learn.md](./learn.md)

[中文版](./README_CN.md)

## Architecture

```
                          ┌──────────────────────┐
                          │   User Wallet (EOA)   │
                          └──────────┬───────────┘
                                     │ swap()
                                     ▼
┌────────────────────────────────────────────────────────────┐
│              AggregationRouter (entry contract)             │
│  • Holds all tokens in a single transaction                │
│  • ETH ↔ WETH wrapping, slippage protection                │
│  • V3 callback: uniswapV3SwapCallback()                    │
├────────────────────────────────────────────────────────────┤
│           │ delegatecall                                    │
│           ▼                                                 │
│  ┌──────────────────┐                                      │
│  │    Executor       │  executeRoute(steps[])               │
│  │   (payable)       │  Iterates steps, delegatecall adapters│
│  └──────┬───────────┘                                      │
│         │ delegatecall per step                              │
│  ┌──────▼──────────────────────────────────────────────┐   │
│  │                    Adapters                            │   │
│  │  UniswapV2Adapter  │  UniswapV3Adapter  │  CurveAdapter │
│  │  (pre-transfer)    │  (callback mode)   │  (pre-transfer)│
│  └───────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────┘
                                     │ external calls
                                     ▼
                    ┌─────────────────────────────────┐
                    │  Uniswap V2 / V3 / Curve Pools   │
                    │        (Sepolia testnet)         │
                    └─────────────────────────────────┘
```

## Key Technical Highlights

### 1. delegatecall Chain
The AggregationRouter holds all tokens. Executor + Adapters run via `delegatecall` in the Router's storage context. No token transfers between contracts. Every external function in the chain must be `payable` — the Solidity compiler inserts `require(msg.value == 0)` for non-payable functions, but `msg.value` persists through `delegatecall`.

### 2. Bellman-Ford Pathfinding
Models liquidity pools as a weighted directed graph. DFS-relaxes token distances up to 4 hops, finding optimal swap paths. Finds TOP_K=3 alternative paths by blocking used pools and re-running.

### 3. Split Routing via Greedy Marginal Rate
Discretizes swap amount into 20 increments. Each allocated to the path with highest marginal output. Approximates optimal convex split across concave AMM curves.

### 4. Multi-Protocol AMM Pricing
- **Uniswap V2**: Exact constant-product formula with 0.3% fee
- **Uniswap V3**: Virtual reserves derived from `sqrtPriceX96` + `liquidity`, then constant-product approximation
- **Curve**: Simplified 1:1 stableswap with 0.04% fee

### 5. V3 Callback Pattern
Uniswap V3 requires a callback to transfer tokens. The adapter encodes `(token0, token1)` into the swap's `data` parameter. The Router's `uniswapV3SwapCallback` decodes and transfers the required token to the pool. Pre-transfer doesn't work with V3 — the pool's balance snapshot double-counts pre-transferred tokens.

## Project Structure

```
dex-aggregator/
├── contracts/                          # Foundry (Solidity 0.8.33)
│   ├── src/
│   │   ├── AggregationRouter.sol       # Entry point + V3 callback
│   │   ├── Executor.sol                # delegatecall route executor
│   │   ├── adapters/
│   │   │   ├── IAdapter.sol            # Common adapter interface
│   │   │   ├── UniswapV2Adapter.sol    # Pre-transfer + pair.swap()
│   │   │   ├── UniswapV3Adapter.sol    # Callback mode + pool.swap()
│   │   │   └── CurveAdapter.sol        # Pre-transfer + exchange()
│   │   ├── interfaces/                 # IWETH, IUniswapV2Pair, IV3Pool, ICurvePool
│   │   ├── libraries/TransferHelper.sol
│   │   └── types/DataTypes.sol         # SwapDescription, RouteStep
│   ├── test/AggregationRouter.t.sol    # 8 tests (all passing)
│   └── script/Deploy.s.sol             # Sepolia deploy script
├── web/                                # Next.js 16 + React 19
│   ├── src/
│   │   ├── engine/                     # Off-chain routing engine
│   │   │   ├── types.ts               # Core type definitions
│   │   │   ├── graph.ts               # Adjacency list builder
│   │   │   ├── pricing.ts             # V2/V3/Curve AMM formulas
│   │   │   ├── pathfinder.ts          # Bellman-Ford (max 4 hops)
│   │   │   ├── split-router.ts        # Greedy marginal allocation
│   │   │   ├── pool-fetcher.ts        # On-chain pool data (30s cache)
│   │   │   ├── pool-registry.ts       # Verified pool addresses
│   │   │   ├── pool-data-static.ts    # Fallback snapshot data
│   │   │   └── index.ts               # getQuote() orchestrator
│   │   ├── app/
│   │   │   ├── api/quote/route.ts     # POST /api/quote
│   │   │   ├── providers.tsx          # Wagmi + QueryClient
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   ├── components/                # SwapForm, TokenSelect, RouteDisplay, SlippageSettings
│   │   ├── hooks/                     # useQuote, useSwap, useTokenBalances
│   │   └── lib/                       # contracts.ts, tokens.ts, utils.ts, config.ts
│   └── package.json
├── README.md
├── README_CN.md                        # Chinese version
└── learn.md                            # Detailed technical docs
```

## Quick Start

### Prerequisites
- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- Node.js 18+
- Sepolia ETH (from a faucet)

### 1. Smart Contracts

```bash
cd contracts
cp .env.example .env          # Add SEPOLIA_RPC_URL
forge build
forge test -vvv               # 8 tests
```

To deploy (requires Sepolia ETH + private key in Foundry keystore):
```bash
forge script script/Deploy.s.sol \
  --rpc-url $SEPOLIA_RPC_URL \
  --account deployer \
  --password <your_password> \
  --broadcast
```

### 2. Frontend

```bash
cd web
cp .env.example .env.local    # Add NEXT_PUBLIC_REOWN_PROJECT_ID
npm install
npm run dev                   # → http://localhost:3000
```

## Environment Variables

### contracts/.env
| Variable | Description |
|----------|-------------|
| `SEPOLIA_RPC_URL` | Sepolia RPC endpoint |
| `ETHERSCAN_API_KEY` | Contract verification (optional) |

### web/.env.local
| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_REOWN_PROJECT_ID` | From [cloud.reown.com](https://cloud.reown.com) |
| `NEXT_PUBLIC_SEPOLIA_RPC_URL` | Sepolia RPC endpoint |
| `NEXT_PUBLIC_ROUTER_ADDRESS` | AggregationRouter address |
| `NEXT_PUBLIC_WETH_ADDRESS` | WETH address (default: Sepolia WETH) |
| `NEXT_PUBLIC_V2_ADAPTER` | UniswapV2Adapter address |
| `NEXT_PUBLIC_V3_ADAPTER` | UniswapV3Adapter address |
| `NEXT_PUBLIC_CURVE_ADAPTER` | CurveAdapter address |

## Sepolia Deployments

| Contract | Address |
|----------|---------|
| AggregationRouter | `0xb86eD998628D6395B9BD6C2a6D9Fa089A9DC99b5` |
| Executor | Embedded in Router |
| UniswapV2Adapter | `0x2E246624306e322687612443907f5fc3A3AE89FC` |
| UniswapV3Adapter | `0x3814A971cA10f416525c7E674534c688F8Db53DE` |
| CurveAdapter | `0x19bedA72B731820bec947b518a26A7023C1D0f38` |

### Available Tokens on Sepolia

| Symbol | Address | Decimals |
|--------|---------|----------|
| WETH | `0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14` | 18 |
| USDC | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` | 6 |
| USDT | `0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0` | 6 |

### Available Pools

| Pair | Address | Protocol | Fee |
|------|---------|----------|-----|
| USDC-WETH | `0x8af3398492E8e64Da6aF148BF5867F543817BD6b` | Uniswap V2 | 0.3% |
| USDT-WETH | `0xc7808638742780A98A34724530e6EA434483Da97` | Uniswap V2 | 0.3% |
| USDC-WETH | `0x6Ce0896eAE6D4BD668fDe41BB784548fb8F59b50` | Uniswap V3 | 0.3% |

## Testing

### Smart Contracts
```bash
cd contracts && forge test -vvv
```
8 tests: single-hop V2/V3, split routing V2+V3, multi-hop V2→Curve, slippage, ETH wrapping/unwrapping.

### Routing Engine
```bash
cd web && npx vitest src/engine/
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contracts | Solidity 0.8.33, Foundry, OpenZeppelin v5 |
| Frontend | Next.js 16, React 19, TypeScript |
| Web3 | Wagmi v3, Reown AppKit, Viem v2 |
| Routing Engine | TypeScript, Bellman-Ford, Greedy optimization |
| Styling | Tailwind CSS v4 |
| Network | Sepolia (Ethereum testnet) |

## Bugs We Fixed

5 bugs were discovered and fixed during the Sepolia integration. Each required EVM bytecode-level debugging with `cast run` + `cast code`. Full debugging journal in [learn.md](./learn.md#10-bug-修复实战5-连环).

| # | Layer | Bug | Fix |
|---|-------|-----|-----|
| 1 | Router | Missing `uniswapV3SwapCallback` | Added callback function |
| 2 | Executor | `non-payable` → compiler rejected `msg.value > 0` via delegatecall | Made `payable` |
| 3 | All Adapters | Same non-payable issue (entire delegatecall chain) | Made all `payable` |
| 4 | V3 Adapter | Pre-transfer broke V3 balance snapshot check → `IIA` | Switched to callback transfer |
| 5 | Engine | Stale static fallback data → 382% price error | Updated on-chain reserves |

## Learn More

For a comprehensive walkthrough of the architecture, algorithms, contract design, and debugging process, read **[learn.md](./learn.md)** (includes Chinese bug-fix section).
