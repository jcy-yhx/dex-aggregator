'use client';

import { createAppKit } from '@reown/appkit/react';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { sepolia } from '@reown/appkit/networks';
import { http } from 'wagmi';

const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID || 'demo';

export const wagmiAdapter = new WagmiAdapter({
  networks: [sepolia],
  projectId,
  transports: {
    [sepolia.id]: http(
      process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || 'https://sepolia.gateway.tenderly.co'
    ),
  },
});

export const appKit = createAppKit({
  adapters: [wagmiAdapter],
  projectId,
  networks: [sepolia],
  defaultNetwork: sepolia,
  metadata: {
    name: 'DEX Aggregator',
    description: 'A decentralized exchange aggregator inspired by 1inch',
    url: 'https://dex-aggregator.vercel.app',
    icons: [],
  },
});

export const ROUTER_ADDRESS =
  process.env.NEXT_PUBLIC_ROUTER_ADDRESS ||
  '0x0000000000000000000000000000000000000000';

// Adapter contract addresses (set after deployment)
export const V2_ADAPTER =
  process.env.NEXT_PUBLIC_V2_ADAPTER ||
  '0x0000000000000000000000000000000000000000';
export const V3_ADAPTER =
  process.env.NEXT_PUBLIC_V3_ADAPTER ||
  '0x0000000000000000000000000000000000000000';
export const CURVE_ADAPTER =
  process.env.NEXT_PUBLIC_CURVE_ADAPTER ||
  '0x0000000000000000000000000000000000000000';
