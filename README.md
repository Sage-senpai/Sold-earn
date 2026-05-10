# SOL'D 

**Bounty-driven sales generation for Solana.** Vendors hold USDC in on-chain escrow, scouts mint a soulbound identity (SBT) and earn a unique Sales ID, buyers pay via Solana Pay with the Sales ID encoded as a reference, and the vendor releases escrow with one click. An agentic backbone — bounty drafter, funnel architect, outreach composer, escrow advisor, and a multi-signal sale verifier — runs alongside every step so the marketplace stays gameable-resistant without a heavy ops team.

The product target is **the final evolution of Superteam Earn**: extension and completion, not clone.

---

## Run

```bash
npm install
cp .env.example .env.local   # all keys are optional — app works in mock mode
npm run dev                  # http://localhost:3001
```

The scaffold runs with **no env vars set** — every external integration (Privy, Solana RPC, Anchor escrow, Metaplex Core SBT, Supabase, Groq, Helius, MCP) gracefully falls back to a local stub. As you fill keys in, more features come alive. `src/lib/env.ts` is the single typed read surface.

---

## Architecture at a glance

```
                 BUYER
                   │ Solana Pay (QR + deep link)
                   ▼
   ┌────────────────────────────────────────────────┐
   │   /sale/[salesId]    public sales link          │
   │   reference = derived(salesId)                  │
   └────────────────────────────────────────────────┘
                   │
                   ▼  USDC → vendor wallet  (tx tagged with reference)
   ┌────────────────────────────────────────────────┐
   │   Anchor escrow program (programs/sold-earn-   │
   │   escrow): initialize_bounty / deposit /       │
   │   release / close_bounty                       │
   └────────────────────────────────────────────────┘
            ▲                              ▲
            │ vendor signs release         │ scout SBT receives payout
            │                              │ (Metaplex Core, frozen=true)
   ┌────────┴──────────┐         ┌─────────┴────────┐
   │  VENDOR           │         │  SCOUT            │
   │  /vendor/dashboard│         │  /scout/dashboard │
   │  /vendor/inbox    │         │  /scout/[address] │
   └────────┬──────────┘         └─────────┬────────┘
            │                              │
            ▼                              ▼
   ┌──────────────────────────────────────────────┐
   │   Supabase (server of record)                 │
   │   vendors, scouts, bounties, applications,    │
   │   sales, sale_verifications, bounty_funnels,  │
   │   agent_actions (audit log)                   │
   └──────────────────────────────────────────────┘
                   ▲
                   │
   ┌──────────────────────────────────────────────┐
   │   Agent backbone (src/lib/agents)             │
   │   drafter · funnel · outreach · escrow        │
   │   advisor · sale verifier · onchain prober    │
   │   Groq llama-3.3 + Helius + deterministic     │
   │   heuristics. Audited via agent_actions.      │
   └──────────────────────────────────────────────┘
                   ▲
                   │
   ┌──────────────────────────────────────────────┐
   │   MCP server (POST /api/mcp)                  │
   │   read tools open · writes gated by API key   │
   └──────────────────────────────────────────────┘
```

---

## What's real vs. what's stubbed

| Layer | File(s) | Status |
|---|---|---|
| Anchor escrow program | `programs/sold-earn-escrow/src/lib.rs` | **Built** (4 ixs: `initialize_bounty`, `deposit`, `release`, `close_bounty`). Awaiting devnet deploy. Until `NEXT_PUBLIC_ESCROW_PROGRAM_ID` is set the frontend uses an in-memory mock with the same shape. |
| Metaplex Core SBT | `src/lib/sbt.ts` | **Real on-chain mint** via `@metaplex-foundation/mpl-core` with `PermanentFreezeDelegate { frozen: true }`. Falls back to a deterministic mock when no signer or RPC is available. |
| Solana Pay attribution | `src/lib/solana-pay.ts`, `src/app/sale/[salesId]/page.tsx` | **Real**. Reference Pubkey derived deterministically from Sales ID; QR + `solana:` deep link rendered on the public sale page. Indexer-attributable via `getSignaturesForAddress(reference)`. |
| Supabase server of record | `supabase/migrations/*.sql`, `src/lib/supabase.ts` | **Real** schema with RLS + `sales_with_suggestion` and `bounty_latest_funnel` views. App stays alive (localStorage only) when keys are absent. |
| Privy embedded wallet | `src/lib/wallet.tsx`, `src/lib/solana.ts` | **Real** Privy auth, sign-transaction wired through embedded provider. Phantom + Solflare are live (window injection). Manual paste address still supported with a disclaimer. |
| Agent backbone | `src/lib/agents/*` + `src/app/api/*` | **Real** with graceful degradation. Groq drives drafts/funnel/outreach/buyer-note adjudication; Helius drives on-chain proof. Each agent has a heuristic fallback so the marketplace doesn't stall when an external service is down. |
| MCP server | `src/lib/mcp/*`, `src/app/api/mcp/route.ts` | **Real** JSON-RPC 2.0 streamable transport. Reads open; writes (`submit_sale_proof`) require `X-MCP-Key`. |

---

## Repo map

```
programs/
  sold-earn-escrow/             # Anchor program (Rust)
    src/lib.rs                  # initialize_bounty / deposit / release / close_bounty
supabase/
  migrations/
    20260510000000_init.sql     # vendors, scouts, bounties, applications, sales,
                                # sale_verifications, agent_actions, sales_with_suggestion view
    20260510010000_funnels.sql  # bounty_funnels + bounty_latest_funnel view
src/app/
  page.tsx                      # landing
  vendor/signup/                # vendor profile creation
  vendor/dashboard/             # all bounties this vendor owns
  vendor/dashboard/[id]/        # single-bounty management + verify panel
  vendor/inbox/                 # NEW: cross-bounty pending sales feed
  scout/signup/                 # profile -> SBT mint (Metaplex Core, soulbound)
  scout/dashboard/              # per-bounty performance + sales kit (funnel + outreach)
  scout/bounties/               # global / regional filter, apply
  scout/leaderboard/            # protocol-wide ranking
  scout/[address]/              # NEW: public scout profile (shareable)
  sale/[salesId]/               # public sales link with Solana Pay QR
  api/
    bounties/draft              # POST  → bounty drafter agent
    bounties/[id]/funnel        # GET/POST → funnel architect agent
    outreach/draft              # POST  → outreach composer agent
    sales                       # POST  → write sale + run verifier
    sales/[id]/verify           # POST  → re-run verifier on existing sale
    sales/suggestions           # GET   → poll verifier suggestions for vendor UI
    mcp                         # POST  → MCP JSON-RPC endpoint
src/components/
  HoldBountyDialog.tsx          # vendor: agent draft → manual edit → escrow deposit
  ApplyDialog.tsx               # scout: SBT-bound application → unique Sales ID
  LogSaleDialog.tsx             # scout: log a sale (fires verifier)
  AgentSuggestion.tsx           # verifier verdict chip (auto_approve | review | auto_reject)
  EscrowAdvisor.tsx             # vendor escrow health banner + top-up CTA
  FunnelPanel.tsx               # ICP / channels / lead sources / templates / objections
  OutreachComposer.tsx          # scout per-lead multi-channel drafter
  DevnetFundCard.tsx            # devnet helper (1 SOL airdrop + USDC faucet)
  WalletButton.tsx              # phantom / solflare / privy embedded / manual / dev mock
src/lib/
  store.ts                      # in-memory + localStorage shared state, selectors, mutations
  wallet.tsx                    # multi-provider wallet context
  sbt.ts                        # mintSbt() (Metaplex Core soulbound) + mock fallback
  escrow.ts                     # depositToEscrow / releaseFromEscrow / closeBountyEscrow
  sales.ts                      # Sales ID derivation + verification
  solana.ts                     # Connection cache + useSigner() multi-provider hook
  solana-pay.ts                 # reference key derivation + Solana Pay URL builder
  chain-config.ts               # isEscrowDeployed / chainLabel — safe for static pages
  supabase.ts                   # server + browser client factories (null-safe)
  env.ts                        # single typed env read surface
  toast.tsx                     # toast context
  hooks/useVerifierSuggestions.ts   # 6 s polling for sale verifier verdicts
  agents/groq.ts                # chatJson — JSON-mode Groq client with retry
  agents/drafter.ts             # bounty drafter (vendor brief → DraftedBounty)
  agents/funnel.ts              # funnel architect (bounty → ICP, channels, templates)
  agents/outreach.ts            # outreach composer (lead + channels → OutreachKit)
  agents/escrowAdvisor.ts       # deterministic escrow health (no LLM)
  agents/onchain.ts             # Helius-backed on-chain payment prober
  agents/verifier.ts            # multi-signal sale verifier (hard + soft + LLM)
  mcp/tools.ts                  # MCP JSON-RPC tool catalog
  mcp/resources.ts              # MCP resource handlers
```

---

## Constraints enforced

- Each scout has **one SBT**. Mint locks identity. Only the minting wallet can receive payout. The Metaplex Core `PermanentFreezeDelegate` plugin makes the asset non-transferable on-chain.
- Scouts are capped at **10 active applications** (`APPLICATION_CAP_VALUE` in `store.ts`). New applies blocked until one is verified.
- **Bounty escrow must be deposited** before the bounty goes live; the dialog blocks submit on insufficient deposit.
- Vendors can run **multiple bounties** — each gets its own dashboard at `/vendor/dashboard/[id]`.
- The verifier's auto-approve path is **capped at $250 per sale** to limit blast radius from a bad LLM signal.

---

## End-to-end flows

### Vendor flow

1. **Sign up** at `/vendor/signup` — connect Phantom / Solflare / Privy embedded → enter brand, bio, socials → `upsertVendor` → role becomes `vendor`.
2. **Hold a bounty** at `/vendor/dashboard` → "Hold a Bounty" → optionally type a one-line brief and click **Generate draft**: the bounty drafter agent (`POST /api/bounties/draft`) returns a structured draft (title, description, product kind, reward, target sales, region) grounded in the live market reward distribution.
3. **Fund escrow** — the dialog computes `requiredEscrow = reward × target` and routes through `depositToEscrow`. With `NEXT_PUBLIC_ESCROW_PROGRAM_ID` set this is a real Anchor `initialize_bounty + deposit` ix; otherwise it's a synchronous mock.
4. **(Optional) Generate funnel** at `/vendor/dashboard/[id]` → FunnelPanel → "Generate funnel". The funnel architect agent writes ICP, channel rankings, lead sources, outreach templates, objection rebuttals, and a *do-not-say* list, persisted to `bounty_funnels` and exposed read-only to scouts.
5. **Review pending sales** at `/vendor/inbox` (cross-bounty feed) or `/vendor/dashboard/[id]` (per-bounty). Each sale carries an `AgentSuggestion` chip with confidence + signals (hard checks, on-chain proof, velocity, buyer-note quality).
6. **Verify** with one click → `releaseFromEscrow` signs the Anchor `release` ix → USDC transfers from vault → scout's ATA → sale flips to `verified` → leaderboards update.
7. **Top up or close** — EscrowAdvisor surfaces a banner when free balance < 2-sale cushion. "Close & refund" calls `close_bounty` and returns the vault remainder.

### Scout flow

1. **Sign up** at `/scout/signup` — connect wallet → enter display name, bio, region → click **Mint SBT**. With a real signer this calls `mintSbt` (Metaplex Core asset with PermanentFreezeDelegate `frozen=true`) and stores the asset address as `sbtMint`. With manual / mock wallets it falls back to a deterministic local SBT.
2. **Browse** at `/scout/bounties` — filter by product kind / region. Apply through `ApplyDialog`: the SBT is checked, the 10-app cap is enforced, and a unique **Sales ID** is generated by hashing `(sbtMint, bountyId)`.
3. **Pitch** — every Sales ID has a public landing at `/sale/[salesId]` showing bounty info, scout profile link, authenticity verdict, and a **Solana Pay QR + button**. The reference Pubkey is derived deterministically from the Sales ID, so any wallet that scans it can attribute the payment back without a server round-trip.
4. **Buyer pays** — wallet opens, USDC sent to vendor with `reference=<derived>`. The `memo` field carries `SOLd:<salesId>` for human-readable backup.
5. **Log the sale** at `/scout/dashboard` → LogSaleDialog → enter buyer note + tx hash. `recordSale` writes locally and fires `POST /api/sales` which upserts to Supabase and runs the verifier inline.
6. **Verifier scores it** — hard checks (amount matches, tx hash unique, bounty active), soft signals (Helius-backed `tx_recipient_is_vendor`, velocity under threshold, buyer-note quality via Groq), then a weighted decision: `auto_approve` / `human_review` / `auto_reject`. Vendor still clicks Verify in UI — agent suggestion is advisory, not autonomous.
7. **Earn** — once verified, `releaseFromEscrow` pays the scout, `scout.totalEarned` increments, the leaderboard moves, and `/scout/[address]` (the public profile) reflects new verified count.

### External agent / MCP flow

External agents (Claude Desktop, Cursor, custom clients) speak to `POST /api/mcp` over JSON-RPC 2.0:

- `initialize` / `tools/list` / `tools/call` / `resources/list` / `resources/read`
- Read tools: `list_bounties`, `get_bounty`, `get_bounty_funnel`, `get_leaderboard`, `get_scout_profile`
- Write tool: `submit_sale_proof(salesId, scoutAddress, buyerNote, txHash, payoutAmount)` — gated by `X-MCP-Key`. Same verifier that runs from the UI runs here.
- Resource URIs: `sold-earn://bounties/active`, `sold-earn://bounty/{id}`, `sold-earn://bounty/{id}/funnel`.

---

## The agent backbone

| Agent | File | Inputs | Output | When LLM is off |
|---|---|---|---|---|
| Bounty Drafter | `agents/drafter.ts` | vendor brief + market reward distribution | `DraftedBounty` (validated) | 503 — drafter offline (UI shows "set GROQ_API_KEY") |
| Funnel Architect | `agents/funnel.ts` | bounty metadata | `FunnelArtifact` (ICP, channels, templates) | 503 |
| Outreach Composer | `agents/outreach.ts` | bounty + lead text + channels[] (max 3) | `OutreachKit` per-channel + research_hooks + unknown_fields | 503 |
| Escrow Advisor | `agents/escrowAdvisor.ts` | escrow snapshot | severity, reason, suggested top-up | works (deterministic) |
| On-chain Prober | `agents/onchain.ts` | tx hash + expected vendor + amount | proof object | falls back to format-only soft check |
| Sale Verifier | `agents/verifier.ts` | sale + bounty + prior scout sales + tx collisions | decision + signals + confidence | hard + soft signals still run; LLM signal neutralized |

All agent runs are written to `agent_actions` (audit log). Hard checks always weight 1.0 — any failure forces `auto_reject` regardless of soft scores.

---

## Environment variables

Anything `NEXT_PUBLIC_…` is exposed to the browser. Server secrets are unprefixed.

**Keep alive even with everything blank** — the marketplace runs on localStorage with deterministic mocks. Fill keys to graduate features.

| Var | Purpose | Without it |
|---|---|---|
| `NEXT_PUBLIC_PRIVY_APP_ID` | Privy embedded wallet auth | Embedded button issues a deterministic local address |
| `NEXT_PUBLIC_SOLANA_NETWORK` / `NEXT_PUBLIC_SOLANA_RPC_URL` | Solana cluster | RPC defaults to public devnet |
| `NEXT_PUBLIC_USDC_MINT` | USDC SPL mint | required for real Solana Pay + escrow |
| `NEXT_PUBLIC_ESCROW_PROGRAM_ID` | Anchor program after deploy | escrow runs in mock mode |
| `NEXT_PUBLIC_SBT_COLLECTION_MINT` / `NEXT_PUBLIC_SBT_AUTHORITY` | optional Core collection ref | SBTs minted as standalone assets |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser reads | UI shows local-only data; agent rows skipped |
| `SUPABASE_SERVICE_ROLE_KEY` | server writes | API routes return 200 no-op (graceful) |
| `GROQ_API_KEY` (+ optional `GROQ_MODEL`) | drafter / funnel / outreach / buyer-note | those endpoints return 503 |
| `HELIUS_API_KEY` | on-chain payment proof | verifier uses tx-format-only soft signal |
| `MCP_API_KEY` | gates `submit_sale_proof` | MCP read-only |

Run the SQL migrations once in Supabase:

```bash
# either: supabase db push    (if using the CLI with linked project)
# or:     paste supabase/migrations/*.sql into the SQL editor in order
```

---

## Build + deploy notes

- `npm run build` is currently configured for Next 14.2.x. `NODE_OPTIONS="--max-old-space-size=8192"` is recommended on Windows where the typecheck pass can OOM during production builds.
- The Anchor program lives in `programs/sold-earn-escrow`. Deploy with `anchor build && anchor deploy --provider.cluster devnet`, then put the resulting program ID into `NEXT_PUBLIC_ESCROW_PROGRAM_ID` and `Anchor.toml`.
- Heavy SDKs (web3.js, mpl-core, umi) are dynamically imported in route handlers and dialogs so the marketing pages don't ship them.

---

## Open work

- Deploy the Anchor escrow program to devnet (program is built; just needs deploy step).
- Wire `NEXT_PUBLIC_SBT_COLLECTION_MINT` to a Core collection so all scouts share a parent.
- Add an indexer worker that watches `getSignaturesForAddress(reference)` for each open Sales ID and pre-fills the buyer's tx hash automatically — closing the only manual step in the scout flow.
