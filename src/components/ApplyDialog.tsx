'use client';

import { useState } from 'react';
import Modal from './Modal';
import { useWallet } from '@/lib/wallet';
import { useToast } from '@/lib/toast';
import { applyToBounty, useScout } from '@/lib/store';
import type { Bounty } from '@/lib/types';

export default function ApplyDialog({
  open,
  onClose,
  bounty,
}: {
  open: boolean;
  onClose: () => void;
  bounty: Bounty | null;
}) {
  const { wallet } = useWallet();
  const scout = useScout(wallet?.address);
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  if (!bounty) return null;

  const submit = async () => {
    if (!wallet) {
      toast('Connect a wallet first', 'error');
      return;
    }
    setBusy(true);
    try {
      const result = applyToBounty(wallet.address, bounty);
      if (!result.ok) {
        const messages: Record<typeof result.reason, string> = {
          NO_SBT: 'Mint your SBT first — finish scout signup.',
          ALREADY_APPLIED: 'You already hold a Sales ID for this bounty.',
          CAP_REACHED: '10 active applications cap reached. Verify a sale to free a slot.',
          BOUNTY_NOT_ACTIVE: 'This bounty is not currently active.',
        };
        toast(messages[result.reason], 'error');
        return;
      }
      toast(`Sales ID issued: ${result.application.salesId}`, 'success');
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Apply: ${bounty.title}`}>
      <div className="space-y-4">
        <p className="text-sm text-earn-gray-700">
          Applying binds this bounty to your SBT. You'll receive a Sales ID — share it on every pitch so verified sales credit you.
        </p>

        <div className="ink-card p-4 space-y-2">
          <Row label="SBT" value={scout?.sbtMint ?? 'Not minted'} />
          <Row label="Reward" value={`${bounty.rewardAmount} ${bounty.rewardToken} per sale`} />
          <Row label="Region" value={bounty.region} />
          <Row label="Payout wallet" value={scout?.payoutLocked ? 'Locked to embedded wallet' : 'Connected wallet'} />
        </div>

        <p className="font-mono text-[10px] uppercase text-earn-gray-600">
          Active-application cap is 10. Once you fill it, you must verify or rotate one out before applying again.
        </p>

        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
          <button className="btn-secondary text-xs" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn-accent text-xs" onClick={submit} disabled={busy || !scout?.sbtMint}>
            {busy ? 'Generating…' : 'Generate Sales ID'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="font-mono text-[10px] uppercase text-earn-gray-600">{label}</span>
      <span className="font-mono text-xs">{value}</span>
    </div>
  );
}
