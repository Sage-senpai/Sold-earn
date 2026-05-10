'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { mockSbtMintAddress } from './sbt';
import { generateSalesId } from './sales';
import type {
  Application,
  ApplyResult,
  Bounty,
  Sale,
  ScoutProfile,
  VendorProfile,
  WalletProvider,
} from './types';

const APPLICATION_CAP = 10;

type StoreState = {
  bounties: Bounty[];
  applications: Application[];
  sales: Sale[];
  vendors: Record<string, VendorProfile>;
  scouts: Record<string, ScoutProfile>;
};

const KEY = 'earn.store.v1';

const seedBounties: Bounty[] = [
  {
    id: 'bnt_seed_solana_pay',
    vendorAddress: 'SEED_VENDOR_SOLPAY',
    title: 'Solana Pay terminals — Lagos',
    description: 'Sign up SMEs in Lagos and Abuja for Solana Pay POS terminals.',
    productKind: 'physical',
    productName: 'Solana Pay POS',
    rewardAmount: 50,
    rewardToken: 'USDC',
    escrowDeposited: 25_000,
    targetSales: 100,
    region: 'Lagos, Nigeria',
    status: 'active',
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 3,
  },
  {
    id: 'bnt_seed_creator_tools',
    vendorAddress: 'SEED_VENDOR_CT',
    title: 'Creator-tool annual subscriptions',
    description: 'Drive paid annual signups for our analytics suite.',
    productKind: 'digital',
    productName: 'Creator Analytics Pro',
    rewardAmount: 35,
    rewardToken: 'USDC',
    escrowDeposited: 10_500,
    targetSales: 200,
    region: 'Global',
    status: 'active',
    createdAt: Date.now() - 1000 * 60 * 60 * 24,
  },
  {
    id: 'bnt_seed_consult',
    vendorAddress: 'SEED_VENDOR_AGENCY',
    title: 'On-chain audit consultations',
    description: 'Refer protocol founders for paid audit intros.',
    productKind: 'service',
    productName: 'Audit intro call',
    rewardAmount: 120,
    rewardToken: 'USDC',
    escrowDeposited: 7_200,
    targetSales: 60,
    region: 'EU / North America',
    status: 'active',
    createdAt: Date.now() - 1000 * 60 * 60 * 5,
  },
];

const initial: StoreState = {
  bounties: seedBounties,
  applications: [],
  sales: [],
  vendors: {},
  scouts: {},
};

let state: StoreState = initial;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

function persist() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {}
}

let hydrated = false;
function hydrate() {
  if (hydrated || typeof window === 'undefined') return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoreState;
      state = {
        ...initial,
        ...parsed,
        bounties: parsed.bounties?.length ? parsed.bounties : initial.bounties,
      };
    }
  } catch {}
  notify();
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function set(updater: (s: StoreState) => StoreState) {
  state = updater(state);
  persist();
  notify();
}

const newId = (prefix: string) =>
  `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;

// ---------- Hooks ----------

export function useStore<T>(selector: (s: StoreState) => T): T {
  useEffect(() => {
    hydrate();
  }, []);
  return useSyncExternalStore(subscribe, () => selector(state), () => selector(initial));
}

export function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

export function useBounties(opts: { activeOnly?: boolean; vendorAddress?: string; region?: string } = {}) {
  const all = useStore((s) => s.bounties);
  let list = all;
  if (opts.activeOnly) list = list.filter((b) => b.status === 'active');
  if (opts.vendorAddress) list = list.filter((b) => b.vendorAddress === opts.vendorAddress);
  if (opts.region && opts.region !== 'Global') {
    list = list.filter((b) => b.region.toLowerCase().includes(opts.region!.toLowerCase()));
  }
  return list;
}

export function useBounty(id?: string) {
  const all = useStore((s) => s.bounties);
  return id ? all.find((b) => b.id === id) : undefined;
}

export function useVendor(address?: string) {
  const vendors = useStore((s) => s.vendors);
  return address ? vendors[address] : undefined;
}

export function useScout(address?: string) {
  const scouts = useStore((s) => s.scouts);
  return address ? scouts[address] : undefined;
}

export function useScoutApplications(address?: string) {
  const apps = useStore((s) => s.applications);
  return address ? apps.filter((a) => a.scoutAddress === address) : [];
}

export function useScoutSales(address?: string) {
  const sales = useStore((s) => s.sales);
  return address ? sales.filter((s) => s.scoutAddress === address) : [];
}

export function useBountySales(bountyId?: string) {
  const sales = useStore((s) => s.sales);
  return bountyId ? sales.filter((s) => s.bountyId === bountyId) : [];
}

export function useBountyApplications(bountyId?: string) {
  const apps = useStore((s) => s.applications);
  return bountyId ? apps.filter((a) => a.bountyId === bountyId) : [];
}

export function useVendorBounties(vendorAddress?: string) {
  return useBounties({ vendorAddress });
}

export function useVendorPendingCount(vendorAddress?: string) {
  const bounties = useStore((s) => s.bounties);
  const sales = useStore((s) => s.sales);
  if (!vendorAddress) return 0;
  const owned = new Set(
    bounties.filter((b) => b.vendorAddress === vendorAddress).map((b) => b.id),
  );
  return sales.filter((s) => owned.has(s.bountyId) && s.status === 'pending').length;
}

export function useVendorInbox(vendorAddress?: string) {
  const bounties = useStore((s) => s.bounties);
  const sales = useStore((s) => s.sales);
  const empty = { pending: [] as Sale[], history: [] as Sale[] };
  if (!vendorAddress) return empty;
  const owned = new Set(
    bounties.filter((b) => b.vendorAddress === vendorAddress).map((b) => b.id),
  );
  const mine = sales.filter((s) => owned.has(s.bountyId));
  return {
    pending: mine.filter((s) => s.status === 'pending').sort((a, b) => b.createdAt - a.createdAt),
    history: mine.filter((s) => s.status !== 'pending').sort((a, b) => b.createdAt - a.createdAt),
  };
}

export function useScoutLeaderboardForBounty(bountyId?: string) {
  const sales = useBountySales(bountyId);
  const apps = useBountyApplications(bountyId);
  const scouts = useStore((s) => s.scouts);

  const verifiedByScout = new Map<string, number>();
  for (const s of sales) {
    if (s.status !== 'verified') continue;
    verifiedByScout.set(s.scoutAddress, (verifiedByScout.get(s.scoutAddress) ?? 0) + 1);
  }

  return apps
    .map((a) => {
      const profile = scouts[a.scoutAddress];
      return {
        scoutAddress: a.scoutAddress,
        displayName: profile?.displayName ?? a.scoutAddress.slice(0, 8),
        salesId: a.salesId,
        verifiedSales: verifiedByScout.get(a.scoutAddress) ?? 0,
      };
    })
    .sort((a, b) => b.verifiedSales - a.verifiedSales);
}

// ---------- Mutations ----------

export function upsertVendor(input: {
  address: string;
  brandName: string;
  bio: string;
  website?: string;
  contactX?: string;
  contactTelegram?: string;
}): VendorProfile {
  const profile: VendorProfile = {
    address: input.address,
    brandName: input.brandName,
    bio: input.bio,
    website: input.website,
    contactX: input.contactX,
    contactTelegram: input.contactTelegram,
    createdAt: state.vendors[input.address]?.createdAt ?? Date.now(),
  };
  set((s) => ({ ...s, vendors: { ...s.vendors, [input.address]: profile } }));
  return profile;
}

export function upsertScout(input: {
  address: string;
  displayName: string;
  bio: string;
  socialX?: string;
  socialTelegram?: string;
  region: string;
  walletProvider: WalletProvider;
  sbtMint?: string;
}): ScoutProfile {
  const existing = state.scouts[input.address];
  const sbtMint = input.sbtMint ?? existing?.sbtMint ?? mockSbtMintAddress(input.address);
  // If the SBT was minted with an embedded wallet, payout is locked to that wallet.
  const payoutLocked = existing?.payoutLocked ?? input.walletProvider === 'embedded';
  const profile: ScoutProfile = {
    address: input.address,
    displayName: input.displayName,
    bio: input.bio,
    socialX: input.socialX,
    socialTelegram: input.socialTelegram,
    region: input.region,
    walletProvider: input.walletProvider,
    payoutLocked,
    sbtMint,
    reputation: existing?.reputation ?? 50,
    totalEarned: existing?.totalEarned ?? 0,
    createdAt: existing?.createdAt ?? Date.now(),
  };
  set((s) => ({ ...s, scouts: { ...s.scouts, [input.address]: profile } }));
  return profile;
}

export function createBounty(input: {
  vendorAddress: string;
  title: string;
  description: string;
  productKind: Bounty['productKind'];
  productName: string;
  rewardAmount: number;
  rewardToken: 'USDC' | 'SOL';
  targetSales: number;
  region: string;
  escrowDeposited: number;
}): Bounty {
  const b: Bounty = {
    id: newId('bnt'),
    vendorAddress: input.vendorAddress,
    title: input.title,
    description: input.description,
    productKind: input.productKind,
    productName: input.productName,
    rewardAmount: input.rewardAmount,
    rewardToken: input.rewardToken,
    escrowDeposited: input.escrowDeposited,
    targetSales: input.targetSales,
    region: input.region,
    status: 'active',
    createdAt: Date.now(),
  };
  set((s) => ({ ...s, bounties: [b, ...s.bounties] }));
  return b;
}

export function applyToBounty(scoutAddress: string, bounty: Bounty): ApplyResult {
  const scout = state.scouts[scoutAddress];
  if (!scout?.sbtMint) return { ok: false, reason: 'NO_SBT' };
  if (bounty.status !== 'active') return { ok: false, reason: 'BOUNTY_NOT_ACTIVE' };

  const myActive = state.applications.filter(
    (a) => a.scoutAddress === scoutAddress && a.status !== 'rejected',
  );
  if (myActive.some((a) => a.bountyId === bounty.id)) {
    return { ok: false, reason: 'ALREADY_APPLIED' };
  }
  const verifiedSet = new Set(
    state.sales.filter((s) => s.scoutAddress === scoutAddress && s.status === 'verified').map((s) => s.bountyId),
  );
  const open = myActive.filter((a) => !verifiedSet.has(a.bountyId)).length;
  if (open >= APPLICATION_CAP) return { ok: false, reason: 'CAP_REACHED' };

  const application: Application = {
    id: newId('app'),
    bountyId: bounty.id,
    bountyTitle: bounty.title,
    scoutAddress,
    sbtMint: scout.sbtMint,
    salesId: generateSalesId(scout.sbtMint, bounty.id),
    status: 'approved',
    createdAt: Date.now(),
  };
  set((s) => ({ ...s, applications: [application, ...s.applications] }));
  return { ok: true, application };
}

export function recordSale(input: {
  application: Application;
  buyerNote: string;
  txHash: string;
  payoutAmount: number;
}): Sale {
  const sale: Sale = {
    id: newId('sale'),
    salesId: input.application.salesId,
    bountyId: input.application.bountyId,
    bountyTitle: input.application.bountyTitle,
    scoutAddress: input.application.scoutAddress,
    sbtMint: input.application.sbtMint,
    buyerNote: input.buyerNote,
    txHash: input.txHash,
    payoutAmount: input.payoutAmount,
    status: 'pending',
    createdAt: Date.now(),
  };
  set((s) => ({ ...s, sales: [sale, ...s.sales] }));
  return sale;
}

export function reviewSale(saleId: string, decision: 'verified' | 'rejected') {
  let updated: Sale | undefined;
  set((s) => {
    const next = s.sales.map((sale) => {
      if (sale.id !== saleId) return sale;
      updated = { ...sale, status: decision };
      return updated;
    });
    let scouts = s.scouts;
    if (updated && decision === 'verified') {
      const u = scouts[updated.scoutAddress];
      if (u) {
        scouts = {
          ...scouts,
          [updated.scoutAddress]: {
            ...u,
            totalEarned: u.totalEarned + updated.payoutAmount,
            reputation: Math.min(100, u.reputation + 1),
          },
        };
      }
    }
    return { ...s, sales: next, scouts };
  });
}

export function pauseBounty(id: string) {
  set((s) => ({
    ...s,
    bounties: s.bounties.map((b) =>
      b.id === id ? { ...b, status: b.status === 'active' ? 'paused' : 'active' } : b,
    ),
  }));
}

export function addEscrow(id: string, delta: number) {
  set((s) => ({
    ...s,
    bounties: s.bounties.map((b) =>
      b.id === id ? { ...b, escrowDeposited: b.escrowDeposited + delta } : b,
    ),
  }));
}

export function removeBounty(id: string) {
  set((s) => ({
    ...s,
    bounties: s.bounties.filter((b) => b.id !== id),
    applications: s.applications.filter((a) => a.bountyId !== id),
    sales: s.sales.filter((sale) => sale.bountyId !== id),
  }));
}

export function findApplicationBySalesId(salesId: string) {
  return state.applications.find((a) => a.salesId === salesId);
}

export const APPLICATION_CAP_VALUE = APPLICATION_CAP;
