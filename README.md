# sold-earn

Bounty / sales-generation arm of the SOLd. protocol. Sister project to `sold-main`. Vendors hold bounties in escrow, scouts mint a Soulbound identity (SBT), generate a Sales ID off it, and drive verified sales — payout flows from on-chain escrow to the wallet that minted the SBT.

The product feel target is **the final evolution of Superteam Earn** — extension and completion, not clone.

## Run

```
npm install
npm run dev
```

Dev server: http://localhost:3001 (sold-main runs on 3000).

## What's stubbed

This scaffold is UI-first. The on-chain pieces are mocked locally:

- **Escrow** (`src/lib/escrow.ts`) — deposit / hold / release run against in-memory state. Replace with an Anchor program later.
- **SBT mint** (`src/lib/sbt.ts`) — generates a deterministic mock mint address, no Metaplex call. Each scout gets exactly one SBT; payment is locked to the wallet that minted it.
- **Embedded wallet** (`src/lib/wallet.tsx`) — `embedded` provider falls back to a local mock. Real Privy integration goes where the `// PRIVY:` comments are. Phantom + Solflare are real (window injection); manual address input is supported with a disclaimer.
- **Sales verification** (`src/lib/sales.ts`) — verifies a Sales ID against the SBT registry. Real version reads on-chain.

## Structure

```
src/app/
  page.tsx                      # 2-scroll landing
  vendor/signup/                # vendor profile creation
  vendor/dashboard/             # all bounties this vendor owns
  vendor/dashboard/[id]/        # single-bounty management
  scout/signup/                 # profile -> SBT mint
  scout/dashboard/              # per-bounty performance + charts
  scout/bounties/               # global / regional filter, apply
  scout/leaderboard/            # vendor-side ranking surface
  sale/[salesId]/               # public sales-link landing
src/components/
  landing/                      # Hero + DualCTA (animated)
  HoldBountyDialog.tsx          # vendor: name, bio, escrow deposit
  ApplyDialog.tsx               # scout: apply with SBT, generates Sales ID
  WalletButton.tsx              # phantom / solflare / embedded / manual
src/lib/
  store.ts                      # localStorage-backed shared state
  wallet.tsx                    # multi-provider wallet context
  sbt.ts                        # mint stub + ownership lookup
  escrow.ts                     # deposit / release stub
  sales.ts                      # Sales ID gen + verification
```

## Constraints enforced in this build

- Each scout has **one SBT**. Mint locks identity. Only the minting wallet can receive payout.
- Scouts are capped at **10 active applications**. New applies blocked until one is verified.
- Bounty escrow must be deposited before the bounty goes live.
- Vendors can run **multiple bounties** — each gets its own dashboard at `/vendor/dashboard/[id]`.

## Open decisions (deferred per scope)

- SBT standard — likely Metaplex non-transferable NFT.
- Escrow program — Anchor.
- Embedded-wallet provider — Privy (chosen, not yet wired).
