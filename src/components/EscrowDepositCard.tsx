'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { getEscrowVaultInfo, type EscrowVaultInfo } from '@/lib/escrow';

// QRCodeSVG ships its own font-loading + svg generation; lazy-load to keep
// the bounty detail bundle slim. It's only useful once a vendor opens this
// card, so paying for it on first interaction is the right trade.
const QRCodeSVG = dynamic(
  () => import('qrcode.react').then((m) => m.QRCodeSVG),
  { ssr: false },
);

type Props = {
  bountyId: string;
  rewardToken: 'USDC' | 'SOL';
  onCopy?: () => void;
};

// Vendor-side surface that makes escrow concrete: shows the deterministic
// vault address derived from the bounty id, with a QR code so the vendor
// can fund escrow from any wallet, CEX withdrawal, or Solana Pay client —
// not just the one connected to this dApp. The status banner makes the
// mock/pending/live state explicit so no one's confused about whether
// money is actually moving.
export default function EscrowDepositCard({ bountyId, rewardToken, onCopy }: Props) {
  const [info, setInfo] = useState<EscrowVaultInfo | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await getEscrowVaultInfo(bountyId);
      if (!cancelled) setInfo(result);
    })();
    return () => {
      cancelled = true;
    };
  }, [bountyId]);

  if (!info) {
    return (
      <div className="ink-panel p-6">
        <p className="font-mono text-[10px] uppercase text-earn-gray-600">Loading escrow address…</p>
      </div>
    );
  }

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      onCopy?.();
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <div className="ink-panel p-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-eldritch text-xl font-bold">Escrow vault</h2>
          <p className="font-mono text-[10px] uppercase text-earn-gray-600">
            send {rewardToken} here from any wallet to fund this bounty
          </p>
        </div>
        <StatusBadge status={info.status} network={info.network} />
      </div>
      <div className="rune-rule my-4" />

      {info.status === 'mock' && <MockBanner />}
      {info.status === 'pending' && <PendingBanner />}

      {info.vaultAddress ? (
        <div className="grid gap-5 md:grid-cols-[auto,1fr] items-start">
          <div className="bg-white border border-earn-gray-300 p-3 self-start mx-auto md:mx-0">
            <QRCodeSVG
              value={info.vaultAddress}
              size={144}
              level="M"
              fgColor="#0b0b0b"
              bgColor="#ffffff"
            />
          </div>
          <div className="min-w-0 space-y-3">
            <AddressRow
              label="Vault address"
              value={info.vaultAddress}
              copied={copied}
              onCopy={() => copy(info.vaultAddress!)}
            />
            {info.bountyAddress && (
              <AddressRow label="Bounty PDA" value={info.bountyAddress} muted onCopy={() => copy(info.bountyAddress!)} />
            )}
            {info.mintAddress && (
              <AddressRow label="USDC mint" value={info.mintAddress} muted onCopy={() => copy(info.mintAddress!)} />
            )}
            <ul className="text-xs text-earn-gray-700 space-y-1 mt-3">
              <li>
                ◆ Only send <strong>{rewardToken}</strong> on{' '}
                <strong>{prettyNetwork(info.network)}</strong>. Anything else is lost.
              </li>
              <li>◆ Funds at this address are released only on verified sales.</li>
              <li>◆ Closing the bounty refunds the unspent balance back to your wallet.</li>
            </ul>
          </div>
        </div>
      ) : (
        <p className="text-sm text-earn-gray-700">
          A vault address will appear here once the Anchor escrow program is deployed.
        </p>
      )}
    </div>
  );
}

function StatusBadge({ status, network }: { status: EscrowVaultInfo['status']; network: string }) {
  const map = {
    mock: { label: 'mock · stub', cls: 'border-amber-400 bg-amber-50 text-amber-900' },
    pending: { label: 'pending init', cls: 'border-amber-400 bg-amber-50 text-amber-900' },
    live: { label: `live · ${prettyNetwork(network)}`, cls: 'border-emerald-400 bg-emerald-50 text-emerald-900' },
  } as const;
  const t = map[status];
  return (
    <span className={`font-mono text-[9px] uppercase px-1.5 py-0.5 border ${t.cls}`}>
      {t.label}
    </span>
  );
}

function MockBanner() {
  return (
    <div className="border border-amber-400 bg-amber-50/60 text-amber-900 p-3 mb-4 text-xs">
      <p className="font-mono text-[10px] uppercase font-bold">No on-chain escrow program deployed</p>
      <p className="mt-1 break-words">
        The vault address below is computed locally only and shown for layout. Real escrow
        starts working when <code className="font-mono">NEXT_PUBLIC_ESCROW_PROGRAM_ID</code> is set
        to a deployed Anchor program. Until then, the deposit + release flow returns mock tx
        hashes instantly so the UI is testable end-to-end.
      </p>
    </div>
  );
}

function PendingBanner() {
  return (
    <div className="border border-amber-400 bg-amber-50/60 text-amber-900 p-3 mb-4 text-xs">
      <p className="font-mono text-[10px] uppercase font-bold">Vault not initialised yet</p>
      <p className="mt-1 break-words">
        The escrow program is deployed and this address is derived correctly, but the vault
        token account hasn&apos;t been created on-chain. Sign the first deposit (Deposit &amp;
        Launch) once — that tx initialises the vault. After that, anyone can top up by sending
        USDC directly to the vault address.
      </p>
    </div>
  );
}

function AddressRow({
  label,
  value,
  muted,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  muted?: boolean;
  copied?: boolean;
  onCopy: () => void;
}) {
  return (
    <div className={muted ? 'opacity-80' : ''}>
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-[10px] uppercase text-earn-gray-600">{label}</p>
        <button
          type="button"
          onClick={onCopy}
          className="font-mono text-[10px] uppercase text-earn-accent hover:underline"
        >
          {copied ? 'copied' : 'copy'}
        </button>
      </div>
      <p className="font-mono text-[11px] sm:text-xs break-all mt-1">{value}</p>
    </div>
  );
}

function prettyNetwork(n: string): string {
  if (n === 'mainnet-beta' || n === 'mainnet') return 'mainnet';
  if (n === 'devnet') return 'devnet';
  if (n === 'testnet') return 'testnet';
  return n;
}
