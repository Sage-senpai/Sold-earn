use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("3MRSRqfA7GovGkcLU5GjNrEmn5s8UEUQJW4mMrPL9gjm");

// SOLd · Earn — bounty escrow.
//
// Each bounty holds an SPL token vault owned by a Bounty PDA. The vendor
// (signer that initialised the bounty) is the only authority that can
// release funds to a scout's ATA or close the bounty and refund the
// remainder. There is no on-chain sale record — the on-chain `release`
// IS the verified payout. Off-chain Sales IDs map to releases.

#[program]
pub mod sold_earn_escrow {
    use super::*;

    pub fn initialize_bounty(
        ctx: Context<InitializeBounty>,
        bounty_seed: [u8; 16],
        reward_per_sale: u64,
        target_sales: u32,
    ) -> Result<()> {
        require!(reward_per_sale > 0, EscrowError::InvalidReward);
        require!(target_sales > 0, EscrowError::InvalidTarget);

        let bounty = &mut ctx.accounts.bounty;
        bounty.vendor = ctx.accounts.vendor.key();
        bounty.mint = ctx.accounts.mint.key();
        bounty.vault = ctx.accounts.vault.key();
        bounty.reward_per_sale = reward_per_sale;
        bounty.target_sales = target_sales;
        bounty.sales_paid = 0;
        bounty.total_deposited = 0;
        bounty.total_released = 0;
        bounty.status = BountyStatus::Active as u8;
        bounty.bounty_seed = bounty_seed;
        bounty.bump = ctx.bumps.bounty;
        Ok(())
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        require!(amount > 0, EscrowError::InvalidAmount);
        require!(
            ctx.accounts.bounty.status == BountyStatus::Active as u8,
            EscrowError::BountyNotActive
        );

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vendor_token_account.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                    authority: ctx.accounts.vendor.to_account_info(),
                },
            ),
            amount,
        )?;

        let bounty = &mut ctx.accounts.bounty;
        bounty.total_deposited = bounty
            .total_deposited
            .checked_add(amount)
            .ok_or(EscrowError::Overflow)?;
        Ok(())
    }

    pub fn release(ctx: Context<Release>, amount: u64) -> Result<()> {
        require!(amount > 0, EscrowError::InvalidAmount);
        let bounty = &ctx.accounts.bounty;
        require!(
            bounty.status == BountyStatus::Active as u8,
            EscrowError::BountyNotActive
        );
        require!(
            ctx.accounts.vault.amount >= amount,
            EscrowError::InsufficientVault
        );

        let seeds = &[
            b"bounty".as_ref(),
            bounty.bounty_seed.as_ref(),
            &[bounty.bump],
        ];
        let signer = &[&seeds[..]];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.scout_token_account.to_account_info(),
                    authority: ctx.accounts.bounty.to_account_info(),
                },
                signer,
            ),
            amount,
        )?;

        let bounty = &mut ctx.accounts.bounty;
        bounty.total_released = bounty
            .total_released
            .checked_add(amount)
            .ok_or(EscrowError::Overflow)?;
        bounty.sales_paid = bounty.sales_paid.saturating_add(1);
        Ok(())
    }

    pub fn close_bounty(ctx: Context<CloseBounty>) -> Result<()> {
        let bounty = &ctx.accounts.bounty;
        let remaining = ctx.accounts.vault.amount;

        if remaining > 0 {
            let seeds = &[
                b"bounty".as_ref(),
                bounty.bounty_seed.as_ref(),
                &[bounty.bump],
            ];
            let signer = &[&seeds[..]];

            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.vault.to_account_info(),
                        to: ctx.accounts.vendor_token_account.to_account_info(),
                        authority: ctx.accounts.bounty.to_account_info(),
                    },
                    signer,
                ),
                remaining,
            )?;
        }

        let bounty = &mut ctx.accounts.bounty;
        bounty.status = BountyStatus::Closed as u8;
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(bounty_seed: [u8; 16])]
pub struct InitializeBounty<'info> {
    #[account(mut)]
    pub vendor: Signer<'info>,

    #[account(
        init,
        payer = vendor,
        space = 8 + Bounty::SIZE,
        seeds = [b"bounty", bounty_seed.as_ref()],
        bump,
    )]
    pub bounty: Account<'info, Bounty>,

    pub mint: Account<'info, Mint>,

    #[account(
        init,
        payer = vendor,
        seeds = [b"vault", bounty.key().as_ref()],
        bump,
        token::mint = mint,
        token::authority = bounty,
    )]
    pub vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut, address = bounty.vendor @ EscrowError::Unauthorized)]
    pub vendor: Signer<'info>,

    #[account(
        mut,
        seeds = [b"bounty", bounty.bounty_seed.as_ref()],
        bump = bounty.bump,
    )]
    pub bounty: Account<'info, Bounty>,

    #[account(
        mut,
        constraint = vendor_token_account.mint == bounty.mint @ EscrowError::WrongMint,
        constraint = vendor_token_account.owner == vendor.key() @ EscrowError::Unauthorized,
    )]
    pub vendor_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        address = bounty.vault @ EscrowError::WrongVault,
    )]
    pub vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Release<'info> {
    #[account(mut, address = bounty.vendor @ EscrowError::Unauthorized)]
    pub vendor: Signer<'info>,

    #[account(
        mut,
        seeds = [b"bounty", bounty.bounty_seed.as_ref()],
        bump = bounty.bump,
    )]
    pub bounty: Account<'info, Bounty>,

    #[account(
        mut,
        address = bounty.vault @ EscrowError::WrongVault,
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = scout_token_account.mint == bounty.mint @ EscrowError::WrongMint,
    )]
    pub scout_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct CloseBounty<'info> {
    #[account(mut, address = bounty.vendor @ EscrowError::Unauthorized)]
    pub vendor: Signer<'info>,

    #[account(
        mut,
        seeds = [b"bounty", bounty.bounty_seed.as_ref()],
        bump = bounty.bump,
    )]
    pub bounty: Account<'info, Bounty>,

    #[account(
        mut,
        address = bounty.vault @ EscrowError::WrongVault,
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = vendor_token_account.mint == bounty.mint @ EscrowError::WrongMint,
        constraint = vendor_token_account.owner == vendor.key() @ EscrowError::Unauthorized,
    )]
    pub vendor_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[account]
pub struct Bounty {
    pub vendor: Pubkey,           // 32
    pub mint: Pubkey,             // 32
    pub vault: Pubkey,            // 32
    pub reward_per_sale: u64,     // 8
    pub target_sales: u32,        // 4
    pub sales_paid: u32,          // 4
    pub total_deposited: u64,     // 8
    pub total_released: u64,      // 8
    pub status: u8,               // 1
    pub bounty_seed: [u8; 16],    // 16
    pub bump: u8,                 // 1
}

impl Bounty {
    pub const SIZE: usize = 32 + 32 + 32 + 8 + 4 + 4 + 8 + 8 + 1 + 16 + 1;
}

#[repr(u8)]
pub enum BountyStatus {
    Active = 0,
    Closed = 1,
}

#[error_code]
pub enum EscrowError {
    #[msg("Reward per sale must be greater than zero.")]
    InvalidReward,
    #[msg("Target sales must be greater than zero.")]
    InvalidTarget,
    #[msg("Amount must be greater than zero.")]
    InvalidAmount,
    #[msg("Bounty is not active.")]
    BountyNotActive,
    #[msg("Vault has insufficient balance for this release.")]
    InsufficientVault,
    #[msg("Token account mint does not match bounty mint.")]
    WrongMint,
    #[msg("Vault account does not match bounty vault.")]
    WrongVault,
    #[msg("Caller is not authorised for this bounty.")]
    Unauthorized,
    #[msg("Arithmetic overflow.")]
    Overflow,
}
