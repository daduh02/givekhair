/**
 * Ledger Service
 * Creates double-entry journal entries per the flows defined in spec §7.1.
 * All entries are immutable once written — never update, only reverse.
 *
 * Account codes (spec appendix 16.B):
 *   1010  ExternalBank
 *   1100  DonorClearing
 *   1300  GiftAidReceivable
 *   2100  CharityPayable
 *   4100  PlatformRevenue
 *   5200  ProcessingFees
 *   6900  FXGainLoss
 *   3900  Adjustments
 */

import { db } from "@/lib/db";
import Decimal from "decimal.js";
import { randomUUID } from "crypto";

export const ACCOUNTS = {
  EXTERNAL_BANK: "1010-ExternalBank",
  DONOR_CLEARING: "1100-DonorClearing",
  GIFT_AID_RECEIVABLE: "1300-GiftAidReceivable",
  CHARITY_PAYABLE: "2100-CharityPayable",
  PLATFORM_REVENUE: "4100-PlatformRevenue",
  PROCESSING_FEES: "5200-ProcessingFees",
  FX_GAIN_LOSS: "6900-FXGainLoss",
  ADJUSTMENTS: "3900-Adjustments",
} as const;

type AccountCode = (typeof ACCOUNTS)[keyof typeof ACCOUNTS];

interface LedgerLineInput {
  accountCode: AccountCode;
  debit: Decimal;
  credit: Decimal;
  currency?: string;
  fxRate?: Decimal;
  description?: string;
}

async function createEntry(
  lines: LedgerLineInput[],
  opts: {
    description: string;
    donationId?: string;
    refundId?: string;
    payoutBatchId?: string;
    correlationId?: string;
  }
) {
  // Validate double-entry: sum(debits) must equal sum(credits)
  const totalDebits = lines.reduce((s, l) => s.plus(l.debit), new Decimal(0));
  const totalCredits = lines.reduce((s, l) => s.plus(l.credit), new Decimal(0));

  if (!totalDebits.equals(totalCredits)) {
    throw new Error(
      `Ledger imbalance: debits=${totalDebits} credits=${totalCredits}`
    );
  }

  const correlationId = opts.correlationId ?? randomUUID();

  return db.journalEntry.create({
    data: {
      correlationId,
      description: opts.description,
      donationId: opts.donationId,
      refundId: opts.refundId,
      payoutBatchId: opts.payoutBatchId,
      lines: {
        create: lines.map((l) => ({
          accountCode: l.accountCode,
          debit: l.debit.toFixed(2),
          credit: l.credit.toFixed(2),
          currency: l.currency ?? "GBP",
          fxRate: (l.fxRate ?? new Decimal(1)).toFixed(6),
          description: l.description,
        })),
      },
    },
    include: { lines: true },
  });
}

// ── Donation authorised ───────────────────────────────────────────────────────
// Dr DonorClearing / Cr CharityPayable

export async function recordDonationAuthorised(opts: {
  donationId: string;
  amount: Decimal;
  currency?: string;
}) {
  return createEntry(
    [
      {
        accountCode: ACCOUNTS.DONOR_CLEARING,
        debit: opts.amount,
        credit: new Decimal(0),
        description: `Donation authorised ${opts.amount.toFixed(2)}`,
      },
      {
        accountCode: ACCOUNTS.CHARITY_PAYABLE,
        debit: new Decimal(0),
        credit: opts.amount,
        description: `Donation authorised ${opts.amount.toFixed(2)}`,
      },
    ],
    {
      donationId: opts.donationId,
      description: `Donation authorised £${opts.amount.toFixed(2)}`,
    }
  );
}

// ── Fees recognised ───────────────────────────────────────────────────────────
// Dr CharityPayable / Cr PlatformRevenue + ProcessingFees

export async function recordFeesRecognised(opts: {
  donationId: string;
  platformFee: Decimal;
  processingFee: Decimal;
  currency?: string;
}) {
  const totalFees = opts.platformFee.plus(opts.processingFee);

  return createEntry(
    [
      {
        accountCode: ACCOUNTS.CHARITY_PAYABLE,
        debit: totalFees,
        credit: new Decimal(0),
        description: `Fees recognised £${totalFees.toFixed(2)}`,
      },
      {
        accountCode: ACCOUNTS.PLATFORM_REVENUE,
        debit: new Decimal(0),
        credit: opts.platformFee,
        description: `Platform fee £${opts.platformFee.toFixed(2)}`,
      },
      {
        accountCode: ACCOUNTS.PROCESSING_FEES,
        debit: new Decimal(0),
        credit: opts.processingFee,
        description: `Processing fee £${opts.processingFee.toFixed(2)}`,
      },
    ],
    {
      donationId: opts.donationId,
      description: `Fees recognised £${totalFees.toFixed(2)}`,
    }
  );
}

// ── Payout paid ───────────────────────────────────────────────────────────────
// Dr CharityPayable / Cr ExternalBank

export async function recordPayoutPaid(opts: {
  payoutBatchId: string;
  amount: Decimal;
  currency?: string;
}) {
  return createEntry(
    [
      {
        accountCode: ACCOUNTS.CHARITY_PAYABLE,
        debit: opts.amount,
        credit: new Decimal(0),
        description: `Payout £${opts.amount.toFixed(2)}`,
      },
      {
        accountCode: ACCOUNTS.EXTERNAL_BANK,
        debit: new Decimal(0),
        credit: opts.amount,
        description: `Payout £${opts.amount.toFixed(2)}`,
      },
    ],
    {
      payoutBatchId: opts.payoutBatchId,
      description: `Payout to charity £${opts.amount.toFixed(2)}`,
    }
  );
}

// ── Gift Aid paid ─────────────────────────────────────────────────────────────
// Dr GiftAidReceivable / Cr CharityPayable

export async function recordGiftAidPaid(opts: {
  amount: Decimal;
  correlationId?: string;
}) {
  return createEntry(
    [
      {
        accountCode: ACCOUNTS.GIFT_AID_RECEIVABLE,
        debit: opts.amount,
        credit: new Decimal(0),
        description: `Gift Aid reclaim £${opts.amount.toFixed(2)}`,
      },
      {
        accountCode: ACCOUNTS.CHARITY_PAYABLE,
        debit: new Decimal(0),
        credit: opts.amount,
        description: `Gift Aid reclaim £${opts.amount.toFixed(2)}`,
      },
    ],
    {
      correlationId: opts.correlationId,
      description: `Gift Aid paid £${opts.amount.toFixed(2)}`,
    }
  );
}

// ── Refund ────────────────────────────────────────────────────────────────────
// Reverse donation entries

export async function recordRefund(opts: {
  donationId: string;
  refundId: string;
  amount: Decimal;
  platformFee: Decimal;
  processingFee: Decimal;
  clawbackFees: boolean;
}) {
  const lines: LedgerLineInput[] = [
    // Reverse donation authorised
    {
      accountCode: ACCOUNTS.CHARITY_PAYABLE,
      debit: opts.amount,
      credit: new Decimal(0),
      description: `Refund reversal £${opts.amount.toFixed(2)}`,
    },
    {
      accountCode: ACCOUNTS.DONOR_CLEARING,
      debit: new Decimal(0),
      credit: opts.amount,
      description: `Refund reversal £${opts.amount.toFixed(2)}`,
    },
  ];

  if (opts.clawbackFees) {
    const totalFees = opts.platformFee.plus(opts.processingFee);
    lines.push(
      {
        accountCode: ACCOUNTS.PLATFORM_REVENUE,
        debit: opts.platformFee,
        credit: new Decimal(0),
        description: `Fee clawback £${opts.platformFee.toFixed(2)}`,
      },
      {
        accountCode: ACCOUNTS.PROCESSING_FEES,
        debit: opts.processingFee,
        credit: new Decimal(0),
        description: `Processing fee clawback £${opts.processingFee.toFixed(2)}`,
      },
      {
        accountCode: ACCOUNTS.CHARITY_PAYABLE,
        debit: new Decimal(0),
        credit: totalFees,
        description: `Fee clawback reversal £${totalFees.toFixed(2)}`,
      }
    );
  }

  return createEntry(lines, {
    donationId: opts.donationId,
    refundId: opts.refundId,
    description: `Refund £${opts.amount.toFixed(2)}`,
  });
}
