// Single typed surface for all client-readable env vars. Anything that
// branches on env should import from here so the defaults live in one place.
// See `.env.example` for descriptions and how to obtain each value.

export const env = {
  privy: {
    appId: process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? '',
    clientId: process.env.NEXT_PUBLIC_PRIVY_CLIENT_ID ?? '',
    enabled: !!process.env.NEXT_PUBLIC_PRIVY_APP_ID,
  },
  solana: {
    network: (process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? 'devnet') as
      | 'devnet'
      | 'mainnet-beta'
      | 'testnet'
      | 'localnet',
    rpcUrl: process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.devnet.solana.com',
    usdcMint: process.env.NEXT_PUBLIC_USDC_MINT ?? '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
  },
  escrow: {
    programId: process.env.NEXT_PUBLIC_ESCROW_PROGRAM_ID ?? '',
  },
  sbt: {
    collectionMint: process.env.NEXT_PUBLIC_SBT_COLLECTION_MINT ?? '',
    authority: process.env.NEXT_PUBLIC_SBT_AUTHORITY ?? '',
  },
  treasury: {
    address: process.env.NEXT_PUBLIC_TREASURY_ADDRESS ?? '',
    // 15% platform premium added on top of every bounty escrow.
    // Vendors deposit base × target × (1 + feeBps/10_000) into the vault.
    // Override per-deployment via NEXT_PUBLIC_PLATFORM_FEE_BPS.
    feeBps: Number(process.env.NEXT_PUBLIC_PLATFORM_FEE_BPS ?? '1500'),
  },
} as const;
