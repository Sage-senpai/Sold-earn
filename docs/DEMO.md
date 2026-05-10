# SOL'D · Earn — 3-minute demo script

**Total target: 2:50–3:00.** Cuts assume you have one screen recording, one webcam corner, and a vendor wallet + scout wallet pre-funded on devnet. Everything in **bold** is on-screen action; everything in *italics* is voiceover. Section timings are cumulative.

---

## 0:00 – 0:15 · Hook

**On-screen:** Landing page (`/`) with the wordmark and the "Drive sales · Hold bounties" CTAs.

> *Solana has the rails for instant payments. It does not have the people. SOL'D · Earn is a bounty marketplace that turns anyone with an audience into a verified salesforce — paid out of on-chain escrow, with an agentic backbone keeping the marketplace honest.*

---

## 0:15 – 0:50 · Vendor side: hold a bounty in 30 seconds

**On-screen:** Click "Become a Vendor" → wallet connects via Privy → dashboard at `/vendor/dashboard`.

> *I'm a vendor. I want a hundred Solana Pay terminals into Lagos SMEs by month end.*

**On-screen:** Click "Hold a Bounty". Open the **Draft with agent** disclosure. Type a one-line brief: *"Solana Pay POS terminals into Lagos SMEs, 100 by end of month."* Click **Generate draft**.

> *I type one line. The drafter agent — running on Groq llama-3.3 — reads the live market reward distribution and proposes a complete bounty: title, description, product kind, fifty USDC per sale, target of a hundred, region Lagos.*

**On-screen:** Form fills in. Reward = 50 USDC, target = 100, escrow required = **5,000 USDC**. Click **Submit**.

> *Phantom prompts me. I sign. The Anchor escrow program initializes the bounty PDA and locks five thousand USDC. The bounty is live — that's the on-chain guarantee scouts need before they spend a minute pitching.*

**On-screen:** Toast: `Escrow on-chain · 5,000 USDC · 4f3a2b9c…`. Bounty card appears.

---

## 0:50 – 1:35 · Scout side: mint, apply, get a Sales ID

**On-screen:** Switch to a second browser profile. Click "Become a Scout" at `/scout/signup`.

> *Different person. They want to sell.*

**On-screen:** Connect wallet. Fill display name, bio, region = Lagos. Click **Mint SBT on-chain & enter dashboard**.

> *We mint a Metaplex Core asset with the PermanentFreezeDelegate plugin set to frozen. That's a soulbound token — non-transferable, owner-locked, the only address that can ever receive payout for sales attributed to this scout.*

**On-screen:** Toast: `SBT minted on-chain · 5xK9p3mN…`. Land on `/scout/dashboard`.

**On-screen:** Click "Browse bounties" → see the Lagos terminals bounty → click **Apply**.

> *Applying derives a Sales ID by hashing the SBT mint with the bounty ID. It's unique to this scout, this bounty, this device — and it's the reference Pubkey on every Solana Pay link they share.*

**On-screen:** Toast shows the Sales ID. Click **Open sales link** → land on `/sale/[salesId]`.

---

## 1:35 – 2:10 · The buyer experience: Solana Pay attribution

**On-screen:** The public sale page. Bounty title, scout profile chip, **Verified Sales Link** badge, and a large QR + "Pay 50 USDC" button.

> *This is what the scout shares with a buyer. The QR is a Solana Pay deep link: recipient is the vendor, amount is fifty USDC, and the reference key is derived deterministically from the Sales ID. Any buyer who scans this with any Solana Pay wallet pays the vendor and tags the transaction with this scout's reference — no server round-trip, no oracle, just on-chain attribution.*

**On-screen:** Hover the QR. Highlight the `ref · …` line below the button.

> *That's the breakthrough: every USDC transfer carrying this reference is auto-attributable.*

**On-screen:** Click "Pay now" — wallet opens, sign, confirm.

---

## 2:10 – 2:40 · Verifier agent + escrow release

**On-screen:** Switch back to vendor. Click the **Inbox** tab in the nav (red badge: "1"). Land on `/vendor/inbox`.

> *Sale shows up in the vendor's inbox. Above the verify button — the agent suggestion.*

**On-screen:** Click into the bounty detail. Show the AgentSuggestion chip: "looks good · 0.92". Expand it.

> *The verifier ran six signals: amount matches the bounty, tx hash unique, bounty active, Helius confirms the recipient is the vendor, velocity is under threshold, buyer note is unique for this scout. Hard checks weight one — any failure forces auto-reject. Soft signals plus a Groq judgement on the buyer note ride above. The vendor still clicks Verify — the agent is advisory, not autonomous, and auto-approve is capped at $250 a sale.*

**On-screen:** Click **Verify**. Phantom prompts. Sign.

> *That signs the Anchor `release` instruction. Escrow CPIs into the SPL token program, fifty USDC moves from the vault to the scout's associated token account. Sale flips to verified. Leaderboard updates.*

**On-screen:** Toast: `Released · 50 USDC · 8a1c…`. Sale row turns green.

---

## 2:40 – 3:00 · MCP + the close

**On-screen:** Quick split-screen — terminal showing a `curl` POST to `/api/mcp` returning `list_bounties`, then back to `/scout/[address]` showing the public scout profile with new verified sale.

> *Everything you just saw is also exposed as a Model Context Protocol server. Claude, Cursor, or any agent can list bounties, read funnels, submit sale proofs through the same verifier. We don't compete with Superteam Earn — we extend it. Bounties for sales, not bounties for tasks. Vendor escrow, scout SBT, buyer Solana Pay, agent backbone keeping the whole thing honest. SOL'D · Earn.*

**On-screen:** End on the wordmark.

---

## Recording cheat sheet

- **Pre-record:** Vendor wallet with ≥6 SOL devnet + 6,000 devnet USDC. Scout wallet with 0.05 SOL devnet (mint rent). Both registered as their roles already if you don't want to spend airtime on signup — keep one fresh signup if you want the SBT-mint moment on camera.
- **Toggles:** `NEXT_PUBLIC_ESCROW_PROGRAM_ID`, `GROQ_API_KEY`, `HELIUS_API_KEY`, Supabase keys all set in `.env.local`. The "live" / "Mock mode" pill in the nav is your safety check — it should read `Devnet · live`.
- **B-roll:** the FunnelPanel artifact and the OutreachComposer are great cutaways if you have 10 spare seconds in the scout section. They're the second order of agentic value (channels, templates, ICP) but the verifier is the headline.
- **Don't show:** the Supabase dashboard, the audit-log table, raw env files — they distract and add no narrative force.
