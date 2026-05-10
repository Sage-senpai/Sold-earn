# sold-earn-escrow

Anchor program that holds bounty escrow vaults on Solana. Each bounty owns a
PDA-derived SPL token vault. Only the vendor that initialised the bounty can
deposit, release, or close it.

## Instructions

| Instruction          | Purpose                                                        |
| -------------------- | -------------------------------------------------------------- |
| `initialize_bounty`  | Create the Bounty PDA + vault token account.                   |
| `deposit`            | Vendor moves SPL tokens from their ATA → vault.                |
| `release`            | Vendor releases tokens from vault → scout's ATA on a sale.     |
| `close_bounty`       | Vendor closes the bounty; remaining tokens refund to vendor.    |

## PDAs

```
Bounty  PDA = ["bounty", bounty_seed_16]                program=ESCROW_PROGRAM_ID
Vault   PDA = ["vault", bounty_pda]                     program=ESCROW_PROGRAM_ID
                                                        token-account, owner = Bounty PDA
```

`bounty_seed_16` is a deterministic 16-byte seed derived client-side from the
off-chain `bountyId` string (see `src/lib/escrow.ts → bountySeedBytes`).

## Deploying

There are two paths. Both end with you putting the deployed program ID into
`.env.local` as `NEXT_PUBLIC_ESCROW_PROGRAM_ID` — the client picks it up
automatically and switches off the local mock.

### Option A — Solana Playground (no toolchain install)

1. Open https://beta.solpg.io
2. Create a new Anchor project, replace the contents of `programs/<name>/src/lib.rs`
   with [./sold-earn-escrow/src/lib.rs](./sold-earn-escrow/src/lib.rs).
3. In the Playground sidebar:
   - Set cluster to **Devnet**.
   - Connect / fund a Playground wallet (the airdrop button works).
   - Build → Deploy. Wait for "Program deployed".
4. Copy the program ID printed in the deploy log.
5. In your local `.env.local`:

   ```
   NEXT_PUBLIC_ESCROW_PROGRAM_ID=<paste here>
   ```

6. Restart `npm run dev`. The vendor "Hold a Bounty" → deposit flow now
   submits a real devnet transaction.

### Option B — Local Anchor + Solana CLI

Requires Rust + Solana CLI (you have this) + Anchor (you don't yet).

```bash
# Install AVM (Anchor version manager) once. Takes ~5 minutes.
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
avm install 0.30.1
avm use 0.30.1

# From repo root:
solana config set --url devnet
solana airdrop 2

anchor build
anchor deploy

# Copy the printed program id into .env.local as NEXT_PUBLIC_ESCROW_PROGRAM_ID.
```

If you change the program later, redeploy with the same id by passing
`--program-id <existing-id>` to `anchor deploy`, or by keeping the keypair at
`target/deploy/sold_earn_escrow-keypair.json`.

## Devnet USDC

`.env.example` ships the well-known devnet USDC mint
(`4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`). Vendors and scouts need a
USDC ATA funded with that mint to actually use the program; airdrop with:

```bash
spl-token create-account 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU
# Mint test USDC via https://spl-token-faucet.com/?token-name=USDC-Dev
```

## Failure modes the client surfaces

- `Unauthorized` — caller is not the vendor that initialised this bounty.
- `BountyNotActive` — bounty has been closed.
- `WrongMint` / `WrongVault` — the supplied accounts don't match what the PDA
  records.
- `InsufficientVault` — release amount exceeds vault balance.
- `Overflow` — totals overflowed u64 (unreachable in practice).

## Discriminators

The client (`src/lib/escrow.ts → DISCRIMINATORS`) embeds pre-computed
`sha256("global:<name>")[0..8]` values for each instruction. If you rename
any instruction in `lib.rs`, regenerate them with:

```bash
node -e "for (const n of ['initialize_bounty','deposit','release','close_bounty']) {
  console.log(n, Array.from(require('crypto').createHash('sha256').update('global:'+n).digest().slice(0,8)));
}"
```

A runtime warning fires from the browser console if the embedded values
drift from the live computation.
