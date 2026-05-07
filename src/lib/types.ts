export type UserRole = 'scout' | 'vendor';

export type WalletProvider = 'phantom' | 'solflare' | 'embedded' | 'manual' | 'mock';

export type ProductKind = 'digital' | 'service' | 'physical';

export type BountyStatus = 'draft' | 'active' | 'paused' | 'completed';

export type Bounty = {
  id: string;
  vendorAddress: string;
  title: string;
  description: string;
  productKind: ProductKind;
  productName: string;
  rewardAmount: number;
  rewardToken: 'USDC' | 'SOL';
  escrowDeposited: number;
  targetSales: number;
  region: string;
  status: BountyStatus;
  createdAt: number;
};

export type ApplicationStatus = 'pending' | 'approved' | 'rejected';

export type Application = {
  id: string;
  bountyId: string;
  bountyTitle: string;
  scoutAddress: string;
  sbtMint: string;
  salesId: string;
  status: ApplicationStatus;
  createdAt: number;
};

export type SaleStatus = 'pending' | 'verified' | 'rejected';

export type Sale = {
  id: string;
  salesId: string;
  bountyId: string;
  bountyTitle: string;
  scoutAddress: string;
  sbtMint: string;
  buyerNote: string;
  txHash: string;
  payoutAmount: number;
  status: SaleStatus;
  createdAt: number;
};

export type VendorProfile = {
  address: string;
  brandName: string;
  bio: string;
  website?: string;
  contactX?: string;
  contactTelegram?: string;
  createdAt: number;
};

export type ScoutProfile = {
  address: string;
  displayName: string;
  bio: string;
  socialX?: string;
  socialTelegram?: string;
  region: string;
  walletProvider: WalletProvider;
  payoutLocked: boolean;
  sbtMint: string;
  reputation: number;
  totalEarned: number;
  createdAt: number;
};

export type ApplyResult =
  | { ok: true; application: Application }
  | { ok: false; reason: 'CAP_REACHED' | 'ALREADY_APPLIED' | 'NO_SBT' | 'BOUNTY_NOT_ACTIVE' };
