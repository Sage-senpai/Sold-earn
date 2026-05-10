// Light-weight environment-derived flags. Importable from anywhere — does not
// pull in @solana/web3.js or wallet adapters. Use src/lib/solana.ts when you
// need actual Connection / PublicKey / signing capabilities.

import { env } from './env';

export function isEscrowDeployed() {
  return !!env.escrow.programId;
}

export type SolanaNetwork = 'devnet' | 'mainnet-beta' | 'testnet' | 'localnet';

export function chainLabel(): 'Mock' | 'Devnet' | 'Testnet' | 'Mainnet' | 'Localnet' {
  if (!isEscrowDeployed()) return 'Mock';
  switch (env.solana.network) {
    case 'mainnet-beta':
      return 'Mainnet';
    case 'testnet':
      return 'Testnet';
    case 'localnet':
      return 'Localnet';
    default:
      return 'Devnet';
  }
}
