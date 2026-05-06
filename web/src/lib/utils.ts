export function formatAmount(amount: string, decimals: number): string {
  if (amount === '0') return '0';
  const len = amount.length;
  if (len <= decimals) {
    const padded = amount.padStart(decimals, '0');
    const int = padded.slice(0, len - decimals);
    const frac = padded.slice(len - decimals);
    return `${int || '0'}.${frac}`.replace(/0+$/, '').replace(/\.$/, '');
  }
  const int = amount.slice(0, len - decimals);
  const frac = amount.slice(len - decimals);
  return `${int}.${frac}`.replace(/0+$/, '').replace(/\.$/, '');
}

export function parseAmount(amount: string, decimals: number): bigint {
  const parts = amount.split('.');
  const int = parts[0] || '0';
  const frac = (parts[1] || '').padEnd(decimals, '0').slice(0, decimals);
  return BigInt(int + frac);
}

export function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatUsd(amount: string, _decimals: number): string {
  // Simplified: show raw amount for testnet
  const num = Number(amount) / 10 ** 18;
  return num.toFixed(6);
}
