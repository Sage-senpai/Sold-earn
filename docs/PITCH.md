# SOL'D · Earn — pitch script

Two flavours below: a **2-minute spoken pitch** for a judge round or open-mic, and a **30-second elevator** for a hallway. Both work without slides.

---

## 2-minute pitch (≈ 320 words)

**The problem.** Solana has the rails for instant, low-fee payments. It does not have the people. Every founder you talk to has the same conversation: "We have the product. We don't have a way to acquire customers." Today's options are bad — you either run a paid ads loop that doesn't accept stablecoins, or you rent a Web2 affiliate platform where attribution is opaque and payouts take thirty days.

**The insight.** Solana Pay already has the perfect attribution primitive. Every transfer can carry a reference Pubkey. We just have to issue references that are owned by humans, fund them on-chain, and pay out automatically when proof of payment lands.

**The product. SOL'D · Earn** is a bounty marketplace for sales generation on Solana. Three sides:

- **Vendors** hold a bounty in USDC escrow — an Anchor program we wrote — for a real product, real reward per sale, real target volume.
- **Scouts** mint a soulbound identity token, get a unique Sales ID, and share a public Solana Pay link that's bound to their SBT.
- **Buyers** scan, pay, done. The reference is auto-attributable on-chain.

When a sale comes in, an agent backbone scores it: hard checks for the obvious (amount, tx-hash uniqueness, bounty active), Helius confirms the buyer's USDC actually landed in the vendor's wallet, a Groq-hosted llama-3.3 judges the buyer-note quality, velocity ratios catch self-pay games. The vendor still presses Verify — the agent is advisory, never autonomous — and that one click signs the `release` instruction. Escrow → scout's wallet. Done.

**Why now.** Superteam Earn proved bounties for tasks works. We're the next chapter — bounties for *sales*. And the agent backbone — bounty drafter, funnel architect, outreach composer, sale verifier — runs as both a UI and an MCP server, so Claude or Cursor or any external agent can drive the marketplace.

**Where we are.** App is shipping; Anchor program is built and ready to deploy to devnet. We're looking for the first ten vendors with real products and real budgets to test pricing, payout latency, and verifier accuracy under live load.

---

## 30-second elevator (≈ 70 words)

> Solana has the rails for stablecoin payments — it doesn't have a salesforce. SOL'D · Earn is a bounty marketplace where vendors hold USDC in on-chain escrow, scouts mint a soulbound identity, and every Sales ID becomes a Solana Pay reference that's auto-attributable. An agent backbone scores every sale before the vendor verifies, so the marketplace stays honest without human ops. Bounties for tasks already works. We're bounties for sales.

---

## Talking-points cheat sheet

If you only have 5 seconds:
- **What:** "On-chain bounty marketplace for sales generation."
- **Why us:** "Solana Pay reference attribution + SBT identity + agent verifier."

If a judge asks "why won't this be gamed":
- Hard checks (tx hash unique, amount matches, bounty active) weight 1.0 — any failure forces auto-reject.
- On-chain proof via Helius confirms the buyer's USDC actually landed in the vendor's vault.
- Auto-approve is capped at $250 per sale.
- Velocity, buyer-note duplication, and self-pay are flagged as soft signals.
- Vendor still clicks Verify on every sale. The agent is advisory, not autonomous.

If a judge asks "what's the moat":
- The reference-key attribution is already in the Solana Pay spec — adoption is the moat, not the primitive.
- The agent backbone (drafter, funnel architect, outreach composer, verifier) is exposed as an MCP server, so the marketplace itself is agent-native — third parties can build scout assistants, vendor analytics, custom verifiers without forking us.
- Soulbound identity means a scout's reputation doesn't transfer with their wallet — that compounds over time.

If a judge asks "why not just use Superteam Earn":
- They're for tasks: design a logo, write a thread. We're for sales: drive a paid signup, place a terminal, book a consultation.
- The unit of work is different (sale, not deliverable), the verification surface is different (on-chain payment, not subjective review), the payout primitive is different (escrow release on tx confirmation, not weekly admin payouts).
