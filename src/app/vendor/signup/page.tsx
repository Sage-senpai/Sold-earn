'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Nav from '@/components/Nav';
import WalletButton from '@/components/WalletButton';
import { useWallet } from '@/lib/wallet';
import { useToast } from '@/lib/toast';
import { upsertVendor, useVendor } from '@/lib/store';

export default function VendorSignup() {
  const router = useRouter();
  const { wallet, setRole } = useWallet();
  const existing = useVendor(wallet?.address);
  const { toast } = useToast();

  const [brandName, setBrandName] = useState(existing?.brandName ?? '');
  const [bio, setBio] = useState(existing?.bio ?? '');
  const [website, setWebsite] = useState(existing?.website ?? '');
  const [contactX, setContactX] = useState(existing?.contactX ?? '');
  const [contactTelegram, setContactTelegram] = useState(existing?.contactTelegram ?? '');

  const submit = () => {
    if (!wallet) return toast('Connect a wallet first', 'error');
    if (!brandName || !bio) return toast('Brand and bio required', 'error');
    upsertVendor({ address: wallet.address, brandName, bio, website, contactX, contactTelegram });
    setRole('vendor');
    toast('Vendor profile saved', 'success');
    router.push('/vendor/dashboard');
  };

  return (
    <main className="relative min-h-screen overflow-hidden text-earn-gray-900">
      <div className="nascent-bg" aria-hidden="true" />
      <Nav />

      <section className="section-shell relative z-10 py-12 appear">
        <div className="ink-panel max-w-2xl mx-auto p-8 md:p-10">
          <div className="glyph-badge mb-4">Need sales · Vendor</div>
          <h1 className="font-eldritch text-3xl font-bold md:text-4xl">Forge your vendor profile</h1>
          <p className="mt-2 text-earn-gray-700">
            This is what scouts will see when they consider applying to your bounties. Make it sharp.
          </p>
          <div className="rune-rule my-6" />

          {!wallet ? (
            <div className="text-center py-8">
              <p className="font-mono text-xs uppercase text-earn-gray-600 mb-4">Connect first</p>
              <WalletButton />
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="field-label">Brand name</label>
                <input className="field-input" value={brandName} onChange={(e) => setBrandName(e.target.value)} />
              </div>
              <div>
                <label className="field-label">Bio</label>
                <textarea className="field-input min-h-[100px]" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Who you are, what you sell, why scouts should care." />
              </div>
              <div>
                <label className="field-label">Website</label>
                <input className="field-input" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label">X / Twitter</label>
                  <input className="field-input" value={contactX} onChange={(e) => setContactX(e.target.value)} placeholder="@handle" />
                </div>
                <div>
                  <label className="field-label">Telegram</label>
                  <input className="field-input" value={contactTelegram} onChange={(e) => setContactTelegram(e.target.value)} placeholder="@handle" />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button className="btn-accent" onClick={submit}>
                  Save & enter dashboard
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
