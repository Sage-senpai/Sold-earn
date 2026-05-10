'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Nav from '@/components/Nav';
import WalletButton from '@/components/WalletButton';
import { useWallet } from '@/lib/wallet';
import { useToast } from '@/lib/toast';
import { upsertScout, useScout } from '@/lib/store';
import { mockSbtMintAddress } from '@/lib/sbt';
import { useSigner } from '@/lib/solana';

export default function ScoutSignup() {
  const router = useRouter();
  const { wallet, setRole } = useWallet();
  const existing = useScout(wallet?.address);
  const { toast } = useToast();

  const [displayName, setDisplayName] = useState(existing?.displayName ?? '');
  const [bio, setBio] = useState(existing?.bio ?? '');
  const [socialX, setSocialX] = useState(existing?.socialX ?? '');
  const [socialTelegram, setSocialTelegram] = useState(existing?.socialTelegram ?? '');
  const [region, setRegion] = useState(existing?.region ?? 'Global');
  const [busy, setBusy] = useState(false);

  const sign = useSigner(wallet?.provider);
  const previewSbt = wallet ? mockSbtMintAddress(wallet.address) : '—';
  const isEmbedded = wallet?.provider === 'embedded';
  const canMintOnChain = !!sign;

  const submit = async () => {
    if (!wallet) return toast('Connect a wallet first', 'error');
    if (!displayName) return toast('Display name is required', 'error');

    setBusy(true);
    try {
      let sbtMint = existing?.sbtMint;
      if (!sbtMint && canMintOnChain) {
        try {
          const { mintSbt } = await import('@/lib/sbt');
          const { PublicKey } = await import('@solana/web3.js');
          const r = await mintSbt({
            walletPublicKey: new PublicKey(wallet.address),
            signTransaction: sign!,
            displayName,
            region,
            bio,
          });
          sbtMint = r.assetAddress;
          toast(`SBT minted on-chain · ${r.signature.slice(0, 8)}…`, 'success');
        } catch (e) {
          // Fall back to deterministic mock so the rest of the flow keeps moving.
          // eslint-disable-next-line no-console
          console.warn('[scout-signup] on-chain mint failed; falling back to mock', e);
          sbtMint = mockSbtMintAddress(wallet.address);
          toast(
            e instanceof Error ? `On-chain mint failed: ${e.message} — using local SBT.` : 'On-chain mint failed.',
            'error',
          );
        }
      }
      if (!sbtMint) sbtMint = mockSbtMintAddress(wallet.address);
      upsertScout({
        address: wallet.address,
        displayName,
        bio,
        socialX,
        socialTelegram,
        region,
        walletProvider: wallet.provider,
        sbtMint,
      });
      setRole('scout');
      router.push('/scout/dashboard');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden text-earn-gray-900">
      <div className="nascent-bg" aria-hidden="true" />
      <Nav />

      <section className="section-shell relative z-10 py-12 appear">
        <div className="grid gap-6 md:grid-cols-[1.2fr,0.8fr]">
          <div className="ink-panel p-8 md:p-10">
            <div className="glyph-badge mb-4">Drive sales · Scout</div>
            <h1 className="font-eldritch text-3xl font-bold md:text-4xl">Mint your scout identity</h1>
            <p className="mt-2 text-earn-gray-700">
              On submission we mint a unique Soulbound Token (SBT) keyed to your wallet. It is your identity for every
              future bounty — non-transferable, owner-bound.
            </p>
            <div className="rune-rule my-6" />

            {!wallet ? (
              <div className="text-center py-6">
                <p className="font-mono text-xs uppercase text-earn-gray-600 mb-4">Connect first</p>
                <WalletButton />
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="field-label">Display name</label>
                  <input className="field-input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                </div>
                <div>
                  <label className="field-label">Bio</label>
                  <textarea className="field-input min-h-[80px]" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="What you sell well, who you can reach." />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="field-label">X / Twitter</label>
                    <input className="field-input" value={socialX} onChange={(e) => setSocialX(e.target.value)} placeholder="@handle" />
                  </div>
                  <div>
                    <label className="field-label">Telegram</label>
                    <input className="field-input" value={socialTelegram} onChange={(e) => setSocialTelegram(e.target.value)} placeholder="@handle" />
                  </div>
                </div>
                <div>
                  <label className="field-label">Region</label>
                  <input className="field-input" value={region} onChange={(e) => setRegion(e.target.value)} placeholder="City, Country, or Global" />
                </div>

                <div className="flex flex-col-reverse sm:flex-row justify-end pt-4 gap-2">
                  <button className="btn-accent" onClick={submit} disabled={busy}>
                    {busy
                      ? 'Minting…'
                      : canMintOnChain
                        ? 'Mint SBT on-chain & enter dashboard'
                        : 'Mint SBT & enter dashboard'}
                  </button>
                </div>
                {!canMintOnChain && wallet && (
                  <p className="font-mono text-[10px] uppercase text-earn-gray-600">
                    {wallet.provider === 'manual'
                      ? 'Pasted addresses cannot sign. Connect a real wallet to mint a real SBT.'
                      : 'Connected wallet cannot sign — using a deterministic local SBT.'}
                  </p>
                )}
              </div>
            )}
          </div>

          <aside className="ink-card p-6 h-fit">
            <p className="font-mono text-[10px] uppercase text-earn-gray-600">Your future SBT</p>
            <p className="metric-number mt-2 break-all text-lg font-bold">{previewSbt}</p>
            <div className="rune-rule my-5" />
            <ul className="space-y-3 font-mono text-[11px] uppercase text-earn-gray-700">
              <li>◆ Non-transferable — bound to wallet</li>
              <li>◆ One SBT per scout</li>
              <li>◆ Carries identity into every Sales ID</li>
              <li>◆ Required to apply, sell, and receive payout</li>
            </ul>
            {isEmbedded && (
              <div className="mt-5 border-l-4 border-earn-amber bg-earn-amber/10 p-3">
                <p className="font-mono text-[10px] uppercase">Embedded wallet detected</p>
                <p className="text-xs mt-1">Payout will be permanently locked to this embedded wallet.</p>
              </div>
            )}
          </aside>
        </div>
      </section>
    </main>
  );
}
