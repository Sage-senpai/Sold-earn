'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import Nav from '@/components/Nav';
import {
  addEscrow,
  pauseBounty,
  reviewSale,
  useBounty,
  useBountyApplications,
  useBountySales,
  useScoutLeaderboardForBounty,
} from '@/lib/store';
import Modal from '@/components/Modal';
import AgentSuggestion from '@/components/AgentSuggestion';
import EscrowAdvisor from '@/components/EscrowAdvisor';
import EscrowDepositCard from '@/components/EscrowDepositCard';
import FunnelPanel from '@/components/FunnelPanel';
import { useVerifierSuggestions } from '@/lib/hooks/useVerifierSuggestions';
import { adviseEscrow } from '@/lib/agents/escrowAdvisor';
import { useToast } from '@/lib/toast';
import { useWallet } from '@/lib/wallet';
import { isEscrowDeployed, useSigner } from '@/lib/solana';

export default function VendorBountyDetail() {
  const params = useParams<{ id: string }>();
  const bounty = useBounty(params.id);
  const applications = useBountyApplications(params.id);
  const sales = useBountySales(params.id);
  const board = useScoutLeaderboardForBounty(params.id);
  const { toast } = useToast();
  const { wallet } = useWallet();
  const sign = useSigner(wallet?.provider);
  const onChain = isEscrowDeployed();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState(0);
  const pendingSaleIds = sales.filter((s) => s.status === 'pending').map((s) => s.id);
  const suggestions = useVerifierSuggestions(pendingSaleIds);

  if (!bounty) {
    return (
      <main className="min-h-screen">
        <Nav />
        <div className="section-shell pt-16 text-center">
          <p>Bounty not found.</p>
          <Link href="/vendor/dashboard" className="btn-secondary text-xs mt-4 inline-flex">
            Back
          </Link>
        </div>
      </main>
    );
  }

  const verified = sales.filter((s) => s.status === 'verified').length;
  const pendingCount = sales.filter((s) => s.status === 'pending').length;
  const advice = adviseEscrow({
    rewardPerSale: bounty.rewardAmount,
    targetSales: bounty.targetSales,
    escrowDeposited: bounty.escrowDeposited,
    pendingSalesCount: pendingCount,
  });

  return (
    <main className="relative min-h-screen overflow-hidden text-earn-gray-900">
      <div className="nascent-bg" aria-hidden="true" />
      <Nav />

      <section className="section-shell relative z-10 py-8 sm:py-10 appear">
        <Link href="/vendor/dashboard" className="font-mono text-[10px] uppercase text-earn-gray-600 hover:text-earn-accent">
          ← All bounties
        </Link>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-eldritch text-2xl sm:text-3xl md:text-4xl font-bold break-words">{bounty.title}</h1>
            <p className="mt-2 max-w-2xl text-earn-gray-700 text-sm sm:text-base">{bounty.description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="btn-secondary text-xs"
              onClick={() => {
                pauseBounty(bounty.id);
                toast(`Bounty ${bounty.status === 'active' ? 'paused' : 'resumed'}`, 'info');
              }}
            >
              {bounty.status === 'active' ? 'Pause' : 'Resume'}
            </button>
            <button
              className="btn-accent text-xs"
              onClick={() => {
                setTopUpAmount(bounty.rewardAmount * 10);
                setTopUpOpen(true);
              }}
            >
              Top up
            </button>
            {bounty.escrowDeposited > 0 && (
              <button
                className="btn-danger text-xs"
                disabled={pendingId === 'close'}
                onClick={async () => {
                  if (!wallet || wallet.address !== bounty.vendorAddress) {
                    toast('Connect the vendor wallet to close this bounty', 'error');
                    return;
                  }
                  if (onChain && !sign) {
                    toast('Vendor wallet cannot sign. Use Phantom, Solflare, or Embedded.', 'error');
                    return;
                  }
                  setPendingId('close');
                  try {
                    const { closeBountyEscrow } = await import('@/lib/escrow');
                    const r = await closeBountyEscrow(
                      { vendorAddress: wallet.address, bountyId: bounty.id },
                      sign ? { signTransaction: sign } : undefined,
                    );
                    pauseBounty(bounty.id);
                    toast(
                      onChain
                        ? `Escrow refunded · ${r.txHash.slice(0, 8)}…`
                        : 'Escrow refunded (mock)',
                      'success',
                    );
                  } catch (e) {
                    toast(e instanceof Error ? e.message : 'Refund failed', 'error');
                  } finally {
                    setPendingId(null);
                  }
                }}
              >
                {pendingId === 'close' ? 'Closing…' : 'Close & refund'}
              </button>
            )}
          </div>
        </div>

        <div className="grid gap-4 grid-cols-2 md:grid-cols-4 my-8">
          <Stat label="Reward / Sale" value={`${bounty.rewardAmount} ${bounty.rewardToken}`} />
          <Stat label="Target" value={bounty.targetSales.toString()} />
          <Stat label="Verified" value={`${verified} / ${bounty.targetSales}`} />
          <Stat label="Escrow" value={`$${bounty.escrowDeposited.toLocaleString()}`} />
        </div>

        <EscrowAdvisor
          advice={advice}
          token={bounty.rewardToken}
          onTopUp={(amount) => {
            setTopUpAmount(amount);
            setTopUpOpen(true);
          }}
        />

        <div className="mt-6">
          <EscrowDepositCard bountyId={bounty.id} rewardToken={bounty.rewardToken} />
        </div>

        <div className="grid gap-6 md:grid-cols-2 mt-6">
          <div className="ink-panel p-6">
            <h2 className="font-eldritch text-xl font-bold">Scout Leaderboard</h2>
            <p className="font-mono text-[10px] uppercase text-earn-gray-600">Ranked by verified sales</p>
            <div className="rune-rule my-4" />
            {board.length === 0 ? (
              <p className="text-sm text-earn-gray-600">No scouts have applied yet.</p>
            ) : (
              <ol className="space-y-2">
                {board.map((row, i) => (
                  <li key={row.salesId} className="flex items-center justify-between gap-3 border border-earn-gray-200 p-2">
                    <div className="flex items-center gap-3">
                      <span className="glyph-badge">#{i + 1}</span>
                      <div>
                        <p className="font-mono text-xs font-bold">{row.displayName}</p>
                        <p className="font-mono text-[10px] uppercase text-earn-gray-600">{row.salesId}</p>
                      </div>
                    </div>
                    <span className="metric-number font-bold">{row.verifiedSales}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="ink-panel p-6">
            <h2 className="font-eldritch text-xl font-bold">Pending Sales</h2>
            <p className="font-mono text-[10px] uppercase text-earn-gray-600">Verify or reject scout submissions</p>
            <div className="rune-rule my-4" />
            {sales.filter((s) => s.status === 'pending').length === 0 ? (
              <p className="text-sm text-earn-gray-600">No pending submissions.</p>
            ) : (
              <ul className="space-y-2">
                {sales
                  .filter((s) => s.status === 'pending')
                  .map((s) => (
                    <li key={s.id} className="border border-earn-gray-200 p-3">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="min-w-0 flex-1">
                          <p className="font-mono text-xs font-bold break-all">{s.salesId}</p>
                          <p className="text-xs mt-1 break-words">{s.buyerNote}</p>
                          <p className="font-mono text-[10px] uppercase text-earn-gray-500 mt-1 break-all">tx: {s.txHash}</p>
                          {suggestions[s.id] && (
                            <AgentSuggestion
                              decision={suggestions[s.id].decision}
                              confidence={suggestions[s.id].confidence}
                              signals={suggestions[s.id].signals}
                              reasoning={suggestions[s.id].reasoning}
                            />
                          )}
                        </div>
                        <div className="flex sm:flex-col gap-1 shrink-0">
                          <button
                            className="btn-accent text-[10px] px-3 py-1"
                            disabled={pendingId === s.id}
                            onClick={async () => {
                              if (!wallet || wallet.address !== bounty.vendorAddress) {
                                toast('Connect the vendor wallet to verify', 'error');
                                return;
                              }
                              if (onChain && !sign) {
                                toast('Vendor wallet cannot sign. Use Phantom, Solflare, or Embedded.', 'error');
                                return;
                              }
                              setPendingId(s.id);
                              try {
                                const { releaseFromEscrow } = await import('@/lib/escrow');
                                const r = await releaseFromEscrow(
                                  {
                                    vendorAddress: wallet.address,
                                    bountyId: bounty.id,
                                    scoutAddress: s.scoutAddress,
                                    amount: s.payoutAmount,
                                  },
                                  sign ? { signTransaction: sign } : undefined,
                                );
                                reviewSale(s.id, 'verified');
                                toast(
                                  onChain
                                    ? `Released ${s.payoutAmount} ${bounty.rewardToken} · ${r.txHash.slice(0, 8)}…`
                                    : `Released ${s.payoutAmount} ${bounty.rewardToken} (mock)`,
                                  'success',
                                );
                              } catch (e) {
                                toast(e instanceof Error ? e.message : 'Release failed', 'error');
                              } finally {
                                setPendingId(null);
                              }
                            }}
                          >
                            {pendingId === s.id ? 'Releasing…' : 'Verify'}
                          </button>
                          <button
                            className="btn-secondary text-[10px] px-3 py-1"
                            onClick={() => {
                              reviewSale(s.id, 'rejected');
                              toast('Sale rejected', 'info');
                            }}
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </div>

        <div className="ink-panel p-6 mt-6">
          <h2 className="font-eldritch text-xl font-bold">Applications ({applications.length})</h2>
          <div className="rune-rule my-4" />
          {applications.length === 0 ? (
            <p className="text-sm text-earn-gray-600">No scouts have applied yet.</p>
          ) : (
            <ul className="space-y-1">
              {applications.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2 font-mono text-xs flex-wrap">
                  <span className="break-all">{a.salesId}</span>
                  <span className="text-earn-gray-600">{a.scoutAddress.slice(0, 8)}…</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-6">
          <FunnelPanel
            bountyId={bounty.id}
            mode="vendor"
            onError={(m) => toast(m, 'error')}
          />
        </div>
      </section>

      <Modal open={topUpOpen} onClose={() => setTopUpOpen(false)} title="Top up escrow">
        <div className="space-y-4">
          <p className="text-sm text-earn-gray-700">
            Add more {bounty.rewardToken} to{' '}
            <span className="font-mono break-words">{bounty.title}</span>. Each {bounty.rewardAmount}{' '}
            {bounty.rewardToken} buys one more verified-sale payout.
          </p>
          <div>
            <label className="field-label">Amount ({bounty.rewardToken})</label>
            <input
              type="number"
              min={bounty.rewardAmount}
              step={bounty.rewardAmount}
              value={topUpAmount}
              onChange={(e) => setTopUpAmount(Number(e.target.value))}
              className="field-input"
            />
            <p className="font-mono text-[10px] uppercase text-earn-gray-600 mt-1">
              Funds {Math.max(0, Math.floor(topUpAmount / Math.max(1, bounty.rewardAmount)))} more sale
              {topUpAmount / Math.max(1, bounty.rewardAmount) === 1 ? '' : 's'}.
            </p>
          </div>
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
            <button
              className="btn-secondary text-xs"
              onClick={() => setTopUpOpen(false)}
              disabled={pendingId === 'topup'}
            >
              Cancel
            </button>
            <button
              className="btn-accent text-xs"
              disabled={pendingId === 'topup' || topUpAmount <= 0}
              onClick={async () => {
                if (!wallet || wallet.address !== bounty.vendorAddress) {
                  toast('Connect the vendor wallet to top up', 'error');
                  return;
                }
                if (onChain && bounty.rewardToken === 'USDC' && !sign) {
                  toast('Vendor wallet cannot sign. Use Phantom, Solflare, or Embedded.', 'error');
                  return;
                }
                setPendingId('topup');
                try {
                  const { depositToEscrow } = await import('@/lib/escrow');
                  const r = await depositToEscrow(
                    {
                      vendorAddress: wallet.address,
                      bountyId: bounty.id,
                      amount: topUpAmount,
                      token: bounty.rewardToken,
                    },
                    sign ? { signTransaction: sign } : undefined,
                  );
                  addEscrow(bounty.id, r.deposited);
                  toast(
                    onChain && bounty.rewardToken === 'USDC'
                      ? `Topped up ${r.deposited.toLocaleString()} ${bounty.rewardToken} · ${r.txHash.slice(0, 8)}…`
                      : `Topped up ${r.deposited.toLocaleString()} ${bounty.rewardToken}`,
                    'success',
                  );
                  setTopUpOpen(false);
                } catch (e) {
                  toast(e instanceof Error ? e.message : 'Top-up failed', 'error');
                } finally {
                  setPendingId(null);
                }
              }}
            >
              {pendingId === 'topup' ? 'Depositing…' : `Deposit ${topUpAmount.toLocaleString()} ${bounty.rewardToken}`}
            </button>
          </div>
        </div>
      </Modal>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="ink-card p-5">
      <p className="font-mono text-[10px] uppercase text-earn-gray-600">{label}</p>
      <p className="metric-number mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}
