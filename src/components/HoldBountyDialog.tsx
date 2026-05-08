'use client';

import { useMemo, useState } from 'react';
import Modal from './Modal';
import { useWallet } from '@/lib/wallet';
import { useToast } from '@/lib/toast';
import { createBounty } from '@/lib/store';
import { depositToEscrow } from '@/lib/escrow';
import type { Bounty } from '@/lib/types';

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

  const [title, setTitle] = useState('');
  const [bio, setBio] = useState('');
  const [productKind, setProductKind] = useState<Bounty['productKind']>('digital');
  const [productName, setProductName] = useState('');
  const [reward, setReward] = useState(50);
  const [token, setToken] = useState<'USDC' | 'SOL'>('USDC');
  const [target, setTarget] = useState(50);
  const [region, setRegion] = useState('Global');
  const [busy, setBusy] = useState(false);

  const requiredEscrow = useMemo(() => reward * target, [reward, target]);

  const reset = () => {
    setTitle('');
    setBio('');
    setProductKind('digital');
    setProductName('');
    setReward(50);
    setToken('USDC');
    setTarget(50);
    setRegion('Global');
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
    setBusy(true);
    try {
      const dep = await depositToEscrow({
        vendorAddress: wallet.address,
        bountyId: 'pre',
        amount: requiredEscrow,
        token,
      });
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
        escrowDeposited: dep.deposited,
      });
      toast(`Bounty live · escrow ${dep.deposited.toLocaleString()} ${token}`, 'success');
      onCreated?.(bounty);
      reset();
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not create bounty', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Hold a Bounty">
      <div className="space-y-4">
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
