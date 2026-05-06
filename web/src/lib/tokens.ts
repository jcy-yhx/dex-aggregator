export interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  iconUrl?: string;
}

// Sepolia testnet tokens curated list
export const TOKEN_LIST: TokenInfo[] = [
  {
    address: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18,
  },
  {
    address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
  },
  {
    address: '0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0',
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
  },
];

export function getTokenByAddress(address: string): TokenInfo | undefined {
  const lower = address.toLowerCase();
  return TOKEN_LIST.find((t) => t.address.toLowerCase() === lower);
}

export function getTokenBySymbol(symbol: string): TokenInfo | undefined {
  return TOKEN_LIST.find(
    (t) => t.symbol.toLowerCase() === symbol.toLowerCase()
  );
}
