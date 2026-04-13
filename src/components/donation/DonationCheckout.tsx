"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";

interface Props {
  pageId: string;
  charityId: string;
  charityName: string;
  pageName: string;
}

const PRESET_AMOUNTS = [5, 10, 25, 50, 100];
const STEPS = ["amount", "details", "giftaid"] as const;
const GIFT_AID_MULTIPLIER = 0.25;

export function DonationCheckout({ pageId, charityId, charityName, pageName }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<(typeof STEPS)[number]>("amount");
  const [amount, setAmount] = useState<number>(10);
  const [customAmount, setCustomAmount] = useState("");
  const [donorCoversFees, setDonorCoversFees] = useState(true);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [donorName, setDonorName] = useState("");
  const [donorEmail, setDonorEmail] = useState("");
  const [message, setMessage] = useState("");
  const [claimGiftAid, setClaimGiftAid] = useState(false);
  const [giftAidDetails, setGiftAidDetails] = useState({
    donorFullName: "",
    addressLine1: "",
    city: "",
    postcode: "",
  });

  const effectiveAmount = customAmount ? parseFloat(customAmount) || 0 : amount;

  const { data: fees, isLoading: feesLoading } = trpc.fees.preview.useQuery(
    { amount: effectiveAmount, charityId, donorCoversFees },
    { enabled: effectiveAmount > 0 }
  );

  const createIntent = trpc.donations.createIntent.useMutation({
    onSuccess: (data) => {
      router.push(data.checkoutUrl);
    },
  });

  function selectPreset(value: number) {
    setAmount(value);
    setCustomAmount("");
  }

  async function handleSubmit() {
    if (effectiveAmount <= 0) {
      return;
    }

    await createIntent.mutateAsync({
      pageId,
      amount: effectiveAmount,
      donorCoversFees,
      isAnonymous,
      isRecurring,
      donorName: donorName || undefined,
      donorEmail,
      message: message || undefined,
      giftAid: claimGiftAid
        ? {
            donorFullName: giftAidDetails.donorFullName,
            addressLine1: giftAidDetails.addressLine1,
            city: giftAidDetails.city,
            postcode: giftAidDetails.postcode,
          }
        : undefined,
    });
  }

  const giftAidBoost = claimGiftAid ? (effectiveAmount * GIFT_AID_MULTIPLIER).toFixed(2) : null;

  return (
    <div className="surface-card mx-auto w-full max-w-md overflow-hidden p-6 sm:p-7">
      <div className="mb-6 flex items-center gap-2">
        {STEPS.map((item, index) => {
          const activeIndex = STEPS.indexOf(step);
          const isComplete = index < activeIndex;
          const isCurrent = item === step;

          return (
            <div
              key={item}
              className="h-2 flex-1 rounded-full"
              style={{
                background: isCurrent
                  ? "var(--color-primary)"
                  : isComplete
                    ? "rgba(15, 118, 110, 0.35)"
                    : "rgba(15, 23, 42, 0.08)",
              }}
            />
          );
        })}
      </div>

      <p className="text-sm font-semibold text-[color:var(--color-ink-muted)]">{charityName}</p>
      <h2 className="mt-1 text-2xl font-bold tracking-[-0.03em] text-[color:var(--color-ink)]">{pageName}</h2>

      {step === "amount" ? (
        <>
          <p className="mt-6 text-sm font-semibold text-[color:var(--color-ink-soft)]">Choose an amount</p>

          <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {PRESET_AMOUNTS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => selectPreset(preset)}
                className="rounded-2xl border px-3 py-3 text-sm font-bold transition-colors"
                style={{
                  borderColor: amount === preset && !customAmount ? "rgba(15, 118, 110, 0.5)" : "rgba(15, 23, 42, 0.1)",
                  background: amount === preset && !customAmount ? "rgba(204, 251, 241, 0.65)" : "rgba(255, 255, 255, 0.85)",
                  color: amount === preset && !customAmount ? "var(--color-primary-dark)" : "var(--color-ink-soft)",
                }}
              >
                £{preset}
              </button>
            ))}
          </div>

          <input
            type="number"
            min="1"
            step="0.01"
            placeholder="Other amount"
            value={customAmount}
            onChange={(event) => {
              setCustomAmount(event.target.value);
              setAmount(0);
            }}
            className="input mt-4"
            aria-label="Enter a custom donation amount"
          />

          {feesLoading && effectiveAmount > 0 ? (
            <div className="mt-5 h-28 animate-pulse rounded-[1.25rem] bg-[rgba(15,23,42,0.05)]" />
          ) : null}

          {fees && effectiveAmount > 0 ? (
            <div className="surface-muted mt-5 p-4">
              <FeeRow label="Platform fee (1.5%)" value={`£${fees.platformFeeAmount}`} />
              <FeeRow label="Processing fee (1.4% + 20p)" value={`£${fees.processingFeeAmount}`} />
              <FeeRow label="Charity receives" value={`£${fees.netToCharity}`} emphasis />

              {/* The fee toggle stays inside the breakdown because it changes every
                  number around it. Grouping the logic here keeps the mental model obvious. */}
              <div className="mt-4 grid grid-cols-[auto_1fr] items-start gap-4 rounded-[1.2rem] border border-[rgba(15,118,110,0.16)] bg-[rgba(204,251,241,0.45)] p-4">
                <button
                  type="button"
                  onClick={() => setDonorCoversFees(!donorCoversFees)}
                  aria-pressed={donorCoversFees}
                  aria-label={donorCoversFees ? "Turn off cover fees" : "Turn on cover fees"}
                  className="relative mt-1 h-6 w-11 flex-shrink-0 rounded-full"
                  style={{ background: donorCoversFees ? "var(--color-primary)" : "rgba(15, 23, 42, 0.18)" }}
                >
                  <span
                    className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow"
                    style={{ left: donorCoversFees ? "1.35rem" : "0.15rem", transition: "left 0.2s ease" }}
                  />
                </button>
                <p className="min-w-0 text-sm leading-7 text-[color:var(--color-primary-dark)]">
                  Cover the fees so <strong>{charityName}</strong> receives the full £{effectiveAmount.toFixed(2)}{" "}
                  {donorCoversFees ? <span className="text-[color:var(--color-ink-muted)]">(you pay £{fees.donorPays})</span> : null}
                </p>
              </div>
            </div>
          ) : null}

          <label className="mt-5 flex items-start gap-3 text-sm text-[color:var(--color-ink-soft)]">
            <input
              type="checkbox"
              checked={isRecurring}
              onChange={(event) => setIsRecurring(event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-[color:var(--color-line-strong)]"
            />
            Make this a recurring monthly donation when supported
          </label>

          <button className="btn-primary mt-6 w-full" disabled={effectiveAmount <= 0} onClick={() => setStep("details")}>
            Continue →
          </button>
        </>
      ) : null}

      {step === "details" ? (
        <>
          <div className="mt-6 grid gap-4">
            <input className="input" placeholder="Your name" value={donorName} onChange={(event) => setDonorName(event.target.value)} />
            <input className="input" type="email" placeholder="Email for receipt" value={donorEmail} onChange={(event) => setDonorEmail(event.target.value)} />
          </div>

          <div className="surface-muted mt-5 flex items-center justify-between p-4 text-sm">
            <span className="text-[color:var(--color-ink-muted)]">Donating</span>
            <span className="font-bold text-[color:var(--color-ink)]">
              £{fees?.donorPays ?? effectiveAmount.toFixed(2)} {donorCoversFees ? <span className="text-xs text-[color:var(--color-ink-muted)]">(incl. fees)</span> : null}
            </span>
          </div>

          <label className="mt-5 flex items-start gap-3 text-sm text-[color:var(--color-ink-soft)]">
            <input
              type="checkbox"
              checked={isAnonymous}
              onChange={(event) => setIsAnonymous(event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-[color:var(--color-line-strong)]"
            />
            Donate anonymously
          </label>

          <label className="mt-5 grid gap-2">
            <span className="text-sm font-semibold text-[color:var(--color-ink-soft)]">Leave a message (optional)</span>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              className="input min-h-[7rem] resize-y"
              rows={3}
              maxLength={500}
              placeholder="A message to the fundraiser..."
            />
          </label>

          <div className="mt-6 flex gap-3">
            <button className="btn-ghost flex-1" onClick={() => setStep("amount")}>← Back</button>
            <button className="btn-primary flex-1" onClick={() => setStep("giftaid")} disabled={!donorEmail}>Continue →</button>
          </div>
        </>
      ) : null}

      {step === "giftaid" ? (
        <>
          <div className="mt-6 rounded-[1.4rem] border border-[rgba(15,118,110,0.16)] bg-[rgba(204,251,241,0.45)] p-4">
            <p className="text-sm font-bold text-[color:var(--color-primary-dark)]">
              Boost your gift by 25% with Gift Aid — at no cost to you
            </p>
            <p className="mt-2 text-sm leading-6 text-[color:var(--color-primary-dark)]">
              If you&apos;re a UK taxpayer, {charityName} can reclaim 25p for every £1 you donate. Your £{effectiveAmount.toFixed(2)} becomes <strong>£{(effectiveAmount * 1.25).toFixed(2)}</strong>.
            </p>
          </div>

          <label className="mt-5 flex items-start gap-3 text-sm text-[color:var(--color-ink-soft)]">
            <input
              type="checkbox"
              checked={claimGiftAid}
              onChange={(event) => setClaimGiftAid(event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-[color:var(--color-line-strong)]"
            />
            I&apos;m a UK taxpayer — claim Gift Aid on this donation
          </label>

          {claimGiftAid ? (
            <div className="mt-5 grid gap-4">
              <input className="input" placeholder="Full name" value={giftAidDetails.donorFullName} onChange={(event) => setGiftAidDetails({ ...giftAidDetails, donorFullName: event.target.value })} />
              <input className="input" placeholder="Address line 1" value={giftAidDetails.addressLine1} onChange={(event) => setGiftAidDetails({ ...giftAidDetails, addressLine1: event.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <input className="input" placeholder="Town/City" value={giftAidDetails.city} onChange={(event) => setGiftAidDetails({ ...giftAidDetails, city: event.target.value })} />
                <input className="input" placeholder="Postcode" value={giftAidDetails.postcode} onChange={(event) => setGiftAidDetails({ ...giftAidDetails, postcode: event.target.value })} />
              </div>
              <p className="text-xs leading-6 text-[color:var(--color-ink-muted)]">
                I am a UK taxpayer and understand that if I pay less Income Tax and/or Capital Gains Tax than the amount of Gift Aid claimed on all my donations in that tax year it is my responsibility to pay any difference.
              </p>
            </div>
          ) : null}

          <div className="surface-muted mt-5 p-4 text-sm">
            <div className="flex justify-between text-[color:var(--color-ink-muted)]">
              <span>You pay</span>
              <span className="font-bold text-[color:var(--color-ink)]">£{fees?.donorPays ?? effectiveAmount.toFixed(2)}</span>
            </div>
            {claimGiftAid ? (
              <div className="mt-2 flex justify-between text-[color:var(--color-primary-dark)]">
                <span>Gift Aid boost</span>
                <span className="font-bold">+£{giftAidBoost}</span>
              </div>
            ) : null}
            <div className="mt-3 flex justify-between border-t border-[color:var(--color-line)] pt-3 font-bold text-[color:var(--color-primary-dark)]">
              <span>Total charity receives</span>
              <span>
                £{claimGiftAid
                  ? (parseFloat(fees?.netToCharity ?? "0") + parseFloat(giftAidBoost ?? "0")).toFixed(2)
                  : fees?.netToCharity ?? effectiveAmount.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <button className="btn-ghost flex-1" onClick={() => setStep("details")}>← Back</button>
            <button className="btn-primary flex-1" onClick={handleSubmit} disabled={createIntent.isPending} aria-busy={createIntent.isPending}>
              {createIntent.isPending ? "Processing…" : `Donate £${fees?.donorPays ?? effectiveAmount.toFixed(2)}`}
            </button>
          </div>

          <p className="mt-4 text-center text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-ink-muted)]">
            Secure hosted checkout · PCI-DSS Level 1 · TLS 1.3
          </p>
        </>
      ) : null}
    </div>
  );
}

function FeeRow({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className={emphasis ? "font-semibold text-[color:var(--color-primary-dark)]" : "text-[color:var(--color-ink-muted)]"}>
        {label}
      </span>
      <span className={emphasis ? "font-bold text-[color:var(--color-primary-dark)]" : "font-semibold text-[color:var(--color-ink)]"}>
        {value}
      </span>
    </div>
  );
}
