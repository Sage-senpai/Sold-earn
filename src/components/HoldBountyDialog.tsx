'use client';

import { useMemo, useState } from 'react';
import Modal from './Modal';
import { useWallet } from '@/lib/wallet';
import { useToast } from '@/lib/toast';
import { createBounty, removeBounty } from '@/lib/store';
import { isEscrowDeployed, useSigner } from '@/lib/solana';
import type { Bounty } from '@/lib/types';
import type { DraftedBounty } from '@/lib/agents/drafter';

export default function HoldBountyDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: (b: Bounty) => void;
}) {
  const { wallet } = useWallet();
  const { toast } = useToast();
  const sign = useSigner(wallet?.provider);
  const onChain = isEscrowDeployed();

  const [title, setTitle] = useState('');
  const [bio, setBio] = useState('');
  const [productKind, setProductKind] = useState<Bounty['productKind']>('digital');
  const [productName, setProductName] = useState('');
  const [reward, setReward] = useState(50);
  const [token, setToken] = useState<'USDC' | 'SOL'>('USDC');
  const [target, setTarget] = useState(50);
  const [region, setRegion] = useState('Global');
  const [busy, setBusy] = useState(false);
  const [brief, setBrief] = useState('');
  const [drafting, setDrafting] = useState(false);
  const [draftReason, setDraftReason] = useState<string | null>(null);

  const requiredEscrow = useMemo(() => reward * target, [reward, target]);

  const draftWithAgent = async () => {
    if (brief.trim().length < 8) {
      toast('Type a longer brief — at least a sentence', 'error');
      return;
    }
    setDrafting(true);
    setDraftReason(null);
    try {
      const res = await fetch('/api/bounties/draft', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ brief, vendorAddress: wallet?.address }),
      });
      if (res.status === 503) {
        toast('Drafter offline — set GROQ_API_KEY in .env.local', 'error');
        return;
      }
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        toast(j.error ? `Drafter: ${j.error}` : 'Drafter failed', 'error');
        return;
      }
      const { draft } = (await res.json()) as { draft: DraftedBounty };
      setTitle(draft.title);
      setBio(draft.description);
      setProductKind(draft.productKind);
      setProductName(draft.productName);
      setReward(draft.rewardAmount);
      setTarget(draft.targetSales);
      setRegion(draft.region);
      setToken('USDC');
      setDraftReason(draft.reasoning);
      toast('Draft ready — review and edit before launch', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Drafter failed', 'error');
    } finally {
      setDrafting(false);
    }
  };

  const reset = () => {
    setTitle('');
    setBio('');
    setProductKind('digital');
    setProductName('');
    setReward(50);
    setToken('USDC');
    setTarget(50);
    setRegion('Global');
    setBrief('');
    setDraftReason(null);
  };

  const submit = async () => {
    if (!wallet) {
      toast('Connect a wallet first', 'error');
      return;
    }
    if (!title || !productName || !bio) {
      toast('Fill in title, product, and a short bio', 'error');
      return;
    }
    if (onChain && token === 'USDC' && !sign) {
      toast('Connect Phantom, Solflare, or Embedded to sign the deposit', 'error');
      return;
    }
    setBusy(true);
    let bountyId: string | null = null;
    try {
      // Lazy-load the chain client so the heavy web3.js/spl-token tree only
      // ships when the user actually opens this modal.
      const { depositToEscrow } = await import('@/lib/escrow');
      const bounty = createBounty({
        vendorAddress: wallet.address,
        title,
        description: bio,
        productKind,
        productName,
        rewardAmount: reward,
        rewardToken: token,
        targetSales: target,
        region,
        escrowDeposited: 0,
      });
      bountyId = bounty.id;
      const dep = await depositToEscrow(
        {
          vendorAddress: wallet.address,
          bountyId: bounty.id,
          amount: requiredEscrow,
          token,
        },
        sign ? { signTransaction: sign } : undefined,
      );
      bounty.escrowDeposited = dep.deposited;
      toast(
        onChain && token === 'USDC'
          ? `Escrow on-chain · ${dep.deposited.toLocaleString()} ${token} · ${dep.txHash.slice(0, 8)}…`
          : `Bounty live · escrow ${dep.deposited.toLocaleString()} ${token}`,
        'success',
      );
      onCreated?.(bounty);
      reset();
      onClose();
    } catch (e) {
      if (bountyId) removeBounty(bountyId);
      toast(e instanceof Error ? e.message : 'Could not create bounty', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Hold a Bounty">
      <div className="space-y-4">
        <details className="border border-earn-gray-200 bg-earn-gray-50/50 p-3">
          <summary className="cursor-pointer select-none flex items-center justify-between gap-2">
            <span className="font-mono text-[10px] uppercase">Draft with agent</span>
            <span className="font-mono text-[9px] uppercase text-earn-gray-600">Groq · llama-3.3</span>
          </summary>
          <div className="mt-3 space-y-2">
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              className="field-input min-h-[72px]"
              placeholder="One or two lines: what you sell, who buys it, how a sale gets verified."
            />
            <div className="flex justify-end">
              <button
                type="button"
                className="btn-secondary text-xs"
                onClick={draftWithAgent}
                disabled={drafting || brief.trim().length < 8}
              >
                {drafting ? 'Drafting…' : 'Generate draft'}
              </button>
            </div>
            {draftReason && (
              <p className="font-mono text-[10px] text-earn-gray-600 break-words">
                agent: {draftReason}
              </p>
            )}
          </div>
        </details>

        <div>
          <label className="field-label">Bounty title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="field-input" placeholder="Solana Pay onboarding — Lagos" />
        </div>
        <div>
          <label className="field-label">Short brief / bio</label>
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} className="field-input min-h-[88px]" placeholder="Who can sell this, expected pitch angle, what counts as a verified sale." />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="field-label">Product kind</label>
            <select value={productKind} onChange={(e) => setProductKind(e.target.value as Bounty['productKind'])} className="field-input">
              <option value="digital">Digital</option>
              <option value="service">Service</option>
              <option value="physical">Physical</option>
            </select>
          </div>
          <div>
            <label className="field-label">Product name</label>
            <input value={productName} onChange={(e) => setProductName(e.target.value)} className="field-input" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <label className="field-label">Reward / sale</label>
            <input type="number" min={1} value={reward} onChange={(e) => setReward(Number(e.target.value))} className="field-input" />
          </div>
          <div>
            <label className="field-label">Token</label>
            <select value={token} onChange={(e) => setToken(e.target.value as 'USDC' | 'SOL')} className="field-input">
              <option value="USDC">USDC</option>
              <option value="SOL">SOL</option>
            </select>
          </div>
          <div>
            <label className="field-label">Target sales</label>
            <input type="number" min={1} value={target} onChange={(e) => setTarget(Number(e.target.value))} className="field-input" />
          </div>
        </div>
        <div>
          <label className="field-label">Region</label>
          <input value={region} onChange={(e) => setRegion(e.target.value)} className="field-input" placeholder="Global, Lagos Nigeria, EU…" />
        </div>

        <div className="ink-card-accent border-l-4 border-earn-accent bg-earn-accent-soft/30 p-4">
          <p className="font-mono text-[10px] uppercase text-earn-gray-700">Required escrow deposit</p>
          <p className="font-eldritch text-2xl font-bold mt-1">
            {requiredEscrow.toLocaleString()} {token}
          </p>
          <p className="font-mono text-[10px] uppercase text-earn-gray-600 mt-1">
            Locked on-chain until verified sales pay out scouts.
          </p>
        </div>

        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
          <button className="btn-secondary text-xs" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn-accent text-xs" onClick={submit} disabled={busy}>
            {busy ? 'Depositing…' : 'Deposit & Launch'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
