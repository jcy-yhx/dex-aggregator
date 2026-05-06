# DEX Aggregator

A decentralized exchange (DEX) aggregator inspired by 1inch, built as a full-stack portfolio project.

Aggregates liquidity across **Uniswap V2, Uniswap V3, and Curve** to find the best swap routes using graph-based pathfinding and split-routing algorithms.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                     Frontend (Next.js)               │
│  ┌─────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │ SwapForm │  │ RouteDisp│  │ Wallet (Reown)    │  │
│  └────┬─────┘  └────┬─────┘  └───────────────────┘  │
│       │              │                               │
│  ┌────▼──────────────▼────────────────────────────┐  │
│  │              API Route: /api/quote              │  │
│  └────────────────────┬───────────────────────────┘  │
├───────────────────────┼──────────────────────────────┤
│             Routing Engine (TypeScript)              │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │Pathfinder│  │  Pricing │  │  Split Router    │   │
│  │Bellman-  │  │  AMM V2  │  │  Greedy Marginal │   │
│  │Ford  4hop│  │  V3 Curve│  │  Rate Allocation │   │
│  └────┬─────┘  └────┬─────┘  └────────┬─────────┘   │
│       └──────────────┴────────────────┘              │
├──────────────────────────────────────────────────────┤
│             Smart Contracts (Solidity/Foundry)        │
│  ┌──────────────────┐  ┌──────────────────────────┐  │
│  │AggregationRouter │  │        Executor           │  │
│  │  - swap()        │  │  - executeRoute()         │  │
│  │  - slippage      │  │  - delegatecall adapters  │  │
│  │  - ETH wrapping  │  │                           │  │
│  └────────┬─────────┘  └────────────┬──────────────┘  │
│           │ delegatecall            │ delegatecall    │
│  ┌────────▼─────────────────────────▼──────────────┐  │
│  │         Adapters (delegatecall)                  │  │
│  │  UniswapV2 │ UniswapV3 │ Curve                   │  │
│  └──────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

## Key Technical Highlights

### 1. delegatecall Execution Pattern
The AggregationRouter holds all tokens in a single transaction. The Executor and adapters run via `delegatecall` in the Router's storage context, eliminating token transfers between contracts.

### 2. Bellman-Ford Routing
Models liquidity pools as a weighted directed graph. Iteratively relaxes token distances up to 4 hops, finding the optimal swap path in O(H × E) time.

### 3. Split Routing via Greedy Marginal Rate
Discretizes swap amount into 20 increments. Each increment is allocated to the path with the highest marginal output, approximating the optimal convex split across concave AMM curves.

### 4. Multi-Protocol AMM Pricing
Implements exact pricing formulas for Uniswap V2 (constant-product), V3 (concentrated liquidity), and Curve (stableswap).

## Project Structure

```
dex-aggregator/
├── contracts/                    # Foundry (Solidity)
│   ├── src/
│   │   ├── AggregationRouter.sol # Entry point contract
│   │   ├── Executor.sol          # delegatecall route executor
│   │   ├── adapters/             # UniswapV2, V3, Curve adapters
│   │   ├── interfaces/           # DEX protocol interfaces
│   │   ├── libraries/            # TransferHelper
│   │   └── types/                # SwapDescription, RouteStep
│   ├── test/                     # Forge tests (8 passing)
│   └── script/                   # Deployment scripts
├── web/                          # Next.js app
│   ├── src/
│   │   ├── engine/               # Off-chain routing engine
│   │   │   ├── pathfinder.ts     # Bellman-Ford algorithm
│   │   │   ├── split-router.ts   # Greedy allocation
│   │   │   ├── pricing.ts        # AMM output calculation
│   │   │   ├── graph.ts          # Pool graph construction
│   │   │   └── pool-data-static.ts
│   │   ├── app/api/quote/        # POST /api/quote
│   │   ├── components/           # SwapForm, TokenSelect, RouteDisplay
│   │   └── hooks/                # useQuote, useSwap, useTokenBalances
│   └── package.json
├── README.md
└── .env.example
```

## Quick Start

### Prerequisites
- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- Node.js 18+
- Sepolia RPC URL (Alchemy/Infura)

### 1. Smart Contracts

```bash
cd contracts
cp .env.example .env  # add PRIVATE_KEY, SEPOLIA_RPC_URL
forge build
forge test
forge script script/Deploy.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast
```

### 2. Frontend

```bash
cd web
cp .env.example .env.local  # add NEXT_PUBLIC_REOWN_PROJECT_ID
npm install
npm run dev
```

Visit `http://localhost:3000`

## Environment Variables

```bash
# contracts/.env
PRIVATE_KEY=            # Deployer private key
SEPOLIA_RPC_URL=        # Sepolia RPC endpoint
ETHERSCAN_API_KEY=      # For contract verification

# web/.env.local
NEXT_PUBLIC_REOWN_PROJECT_ID=   # From cloud.reown.com
NEXT_PUBLIC_ROUTER_ADDRESS=     # AggregationRouter Sepolia address
NEXT_PUBLIC_SEPOLIA_RPC_URL=    # Sepolia RPC endpoint
```

## Testing

### Smart Contracts
```bash
cd contracts && forge test -vvv
```
8 tests covering: single-hop swaps (V2/V3), split routing (V2+V3), multi-hop (V2→Curve), slippage protection, ETH wrapping/unwrapping.

### Routing Engine
```bash
cd web && npx vitest src/engine/
```

## Sepolia Deployments

| Contract | Address |
|----------|---------|
| AggregationRouter | TBD after deployment |
| Executor | (embedded in Router) |
| UniswapV2Adapter | TBD |
| UniswapV3Adapter | TBD |
| CurveAdapter | TBD |

## Tech Stack

- **Smart Contracts:** Solidity 0.8.33, Foundry, OpenZeppelin v5
- **Frontend:** Next.js 16, React 19, TypeScript
- **Web3:** Wagmi v2, Reown AppKit, Viem
- **Routing Engine:** TypeScript, Bellman-Ford, Greedy optimization
- **Styling:** Tailwind CSS
- **Target Network:** Sepolia (Ethereum testnet)
