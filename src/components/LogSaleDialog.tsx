'use client';

import { useEffect, useState } from 'react';
import Modal from './Modal';
import { useToast } from '@/lib/toast';
import { recordSale, useScout, useVendor } from '@/lib/store';
import type { Application, Bounty } from '@/lib/types';

export default function LogSaleDialog({
  open,
  onClose,
  application,
  bounty,
}: {
  open: boolean;
  onClose: () => void;
  application: Application | undefined;
  bounty: Bounty | undefined;
}) {
  const { toast } = useToast();
  const scout = useScout(application?.scoutAddress);
  const vendor = useVendor(bounty?.vendorAddress);
  const [buyer, setBuyer] = useState('');
  const [note, setNote] = useState('');
  const [tx, setTx] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setBuyer('');
      setNote('');
      setTx('');
    }
  }, [open]);

  if (!application || !bounty) return null;

  const submit = async () => {
    if (!buyer.trim()) {
      toast('Tell us who the buyer was', 'error');
      return;
    }
    setBusy(true);
    try {
      const txHash = tx.trim() || `mock_sale_${Math.random().toString(36).slice(2, 8)}`;
      const buyerNote = note.trim() ? `${buyer.trim()} — ${note.trim()}` : buyer.trim();
      const sale = recordSale({
        application,
        buyerNote,
        txHash,
        payoutAmount: bounty.rewardAmount,
      });
      // Fire-and-forget: persist to Supabase + run the verifier agent.
      // Failure here doesn't block the local UX; the vendor dashboard
      // simply won't show an agent suggestion for this sale.
      fetch('/api/sales', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sale, bounty, scout, vendor }),
      }).catch(() => {});
      toast('Sale submitted — awaiting vendor verify', 'success');
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Log a sale · ${bounty.title}`}>
      <div className="space-y-4">
        <div className="ink-card-accent border-l-4 border-earn-accent bg-earn-accent-soft/30 p-3">
          <p className="font-mono text-[10px] uppercase">Reward / sale</p>
          <p className="font-eldritch text-xl font-bold mt-1">
            {bounty.rewardAmount} {bounty.rewardToken}
          </p>
          <p className="font-mono text-[10px] uppercase text-earn-gray-600 mt-1 break-all">
            Sales ID · {application.salesId}
          </p>
        </div>

        <div>
          <label className="field-label">Buyer</label>
          <input
            value={buyer}
            onChange={(e) => setBuyer(e.target.value)}
            className="field-input"
            placeholder="Alpha Books, Lagos"
            autoFocus
          />
          <p className="font-mono text-[10px] uppercase text-earn-gray-600 mt-1">
            Brand, business, or person you closed.
          </p>
        </div>

        <div>
          <label className="field-label">Notes for the vendor (optional)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="field-input min-h-[72px]"
            placeholder="Channel, deal context, anything that helps the vendor verify quickly."
          />
        </div>

        <div>
          <label className="field-label">On-chain payment tx (optional)</label>
          <input
            value={tx}
            onChange={(e) => setTx(e.target.value)}
            className="field-input font-mono"
            placeholder="5xj2…  (paste the buyer's USDC transfer signature)"
          />
          <p className="font-mono text-[10px] uppercase text-earn-gray-600 mt-1">
            If the buyer paid in USDC on-chain, paste the tx — it speeds up vendor verification.
          </p>
        </div>

        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-1">
          <button className="btn-secondary text-xs" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn-accent text-xs" onClick={submit} disabled={busy || !buyer.trim()}>
            {busy ? 'Submitting…' : 'Submit for verification'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
