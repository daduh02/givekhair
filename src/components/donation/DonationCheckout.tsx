"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";

interface Props {
  pageId: string;
  charityId: string;
  charityName: string;
  pageName: string;
}

const PRESET_AMOUNTS = [5, 10, 25, 50, 100];

const GIFT_AID_MULTIPLIER = 0.25;

export function DonationCheckout({ pageId, charityId, charityName, pageName }: Props) {
  const [step, setStep] = useState<"amount" | "details" | "giftaid">("amount");
  const [amount, setAmount] = useState<number>(10);
  const [customAmount, setCustomAmount] = useState("");
  const [donorCoversFees, setDonorCoversFees] = useState(true);
  const [isAnonymous, setIsAnonymous] = useState(false);
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
      // TODO: redirect to Stripe hosted checkout URL
      // router.push(data.checkoutUrl)
      alert(`Donation intent created! ID: ${data.donationId}\nDonor pays: £${data.donorPays}\nCharity receives: £${data.netToCharity}\n\n(Stripe redirect not yet wired — add STRIPE_SECRET_KEY)`);
    },
  });

  function selectPreset(val: number) {
    setAmount(val);
    setCustomAmount("");
  }

  async function handleSubmit() {
    if (effectiveAmount <= 0) return;
    await createIntent.mutateAsync({
      pageId,
      amount: effectiveAmount,
      donorCoversFees,
      isAnonymous,
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

  const giftAidBoost = claimGiftAid
    ? (effectiveAmount * GIFT_AID_MULTIPLIER).toFixed(2)
    : null;

  return (
    <div className="card max-w-md w-full mx-auto">
      {/* Step indicator */}
      <div className="mb-6 flex items-center gap-1.5">
        {(["amount", "details", "giftaid"] as const).map((s, i) => (
          <div
            key={s}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              step === s
                ? "bg-green-600"
                : i < ["amount", "details", "giftaid"].indexOf(step)
                ? "bg-green-300"
                : "bg-gray-200"
            }`}
          />
        ))}
      </div>

      <p className="mb-1 text-sm text-gray-500">{charityName}</p>
      <h2 className="mb-5 text-base font-medium text-gray-900">{pageName}</h2>

      {/* ── Step 1: Amount ── */}
      {step === "amount" && (
        <>
          <p className="mb-3 text-sm font-medium text-gray-700">Choose an amount</p>

          <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {PRESET_AMOUNTS.map((p) => (
              <button
                key={p}
                onClick={() => selectPreset(p)}
                className={`rounded-lg border py-2.5 text-sm font-medium transition-colors ${
                  amount === p && !customAmount
                    ? "border-green-600 bg-green-50 text-green-800"
                    : "border-gray-200 text-gray-700 hover:border-green-400"
                }`}
              >
                £{p}
              </button>
            ))}
          </div>

          <input
            type="number"
            placeholder="Other amount"
            value={customAmount}
            onChange={(e) => { setCustomAmount(e.target.value); setAmount(0); }}
            className="input mb-4"
            min="1"
            step="0.01"
            aria-label="Enter a custom donation amount"
          />

          {/* Fee breakdown */}
          {fees && effectiveAmount > 0 && (
            <div className="mb-4 rounded-lg bg-gray-50 p-3 text-sm">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-gray-600">Platform fee (1.5%)</span>
                <span className="text-gray-700">£{fees.platformFeeAmount}</span>
              </div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-gray-600">Processing fee (1.4% + 20p)</span>
                <span className="text-gray-700">£{fees.processingFeeAmount}</span>
              </div>
              <div className="mb-3 flex items-center justify-between font-medium text-green-700">
                <span>Charity receives</span>
                <span>£{fees.netToCharity}</span>
              </div>

              {/* Cover fees toggle */}
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-3">
                <div
                  role="switch"
                  aria-checked={donorCoversFees}
                  onClick={() => setDonorCoversFees(!donorCoversFees)}
                  className={`relative mt-0.5 h-5 w-9 flex-shrink-0 cursor-pointer rounded-full transition-colors ${
                    donorCoversFees ? "bg-green-600" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                      donorCoversFees ? "translate-x-4" : "translate-x-0.5"
                    }`}
                  />
                </div>
                <span className="text-xs text-green-800">
                  Cover the fees so <strong>{charityName}</strong> receives the full
                  £{effectiveAmount.toFixed(2)}{" "}
                  {donorCoversFees && (
                    <span className="text-gray-500">(you pay £{fees.donorPays})</span>
                  )}
                </span>
              </label>
            </div>
          )}

          {feesLoading && effectiveAmount > 0 && (
            <div className="mb-4 h-20 animate-pulse rounded-lg bg-gray-100" />
          )}

          <button
            className="btn-primary w-full"
            disabled={effectiveAmount <= 0}
            onClick={() => setStep("details")}
          >
            Continue →
          </button>
        </>
      )}

      {/* ── Step 2: Donor details ── */}
      {step === "details" && (
        <>
          <div className="mb-5 flex items-center justify-between rounded-lg bg-gray-50 p-3 text-sm">
            <span className="text-gray-600">Donating</span>
            <span className="font-medium text-gray-900">
              £{fees?.donorPays ?? effectiveAmount.toFixed(2)}{" "}
              {donorCoversFees && <span className="text-xs text-gray-500">(incl. fees)</span>}
            </span>
          </div>

          <label className="mb-4 flex cursor-pointer items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={isAnonymous}
              onChange={(e) => setIsAnonymous(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-green-600"
            />
            Donate anonymously
          </label>

          <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="message">
            Leave a message (optional)
          </label>
          <textarea
            id="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="input mb-5 resize-none"
            rows={3}
            maxLength={500}
            placeholder="A message to the fundraiser..."
          />

          <div className="flex gap-3">
            <button className="btn-ghost flex-1" onClick={() => setStep("amount")}>← Back</button>
            <button className="btn-primary flex-1" onClick={() => setStep("giftaid")}>Continue →</button>
          </div>
        </>
      )}

      {/* ── Step 3: Gift Aid ── */}
      {step === "giftaid" && (
        <>
          {/* Gift Aid callout */}
          <div className="mb-5 rounded-xl border border-green-200 bg-green-50 p-4">
            <p className="mb-1 text-sm font-medium text-green-800">
              Boost your gift by 25% with Gift Aid — at no cost to you
            </p>
            <p className="text-xs text-green-700">
              If you're a UK taxpayer, {charityName} can reclaim 25p for every £1 you donate.
              Your £{effectiveAmount.toFixed(2)} becomes{" "}
              <strong>£{(effectiveAmount * 1.25).toFixed(2)}</strong>.
            </p>
          </div>

          <label className="mb-4 flex cursor-pointer items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={claimGiftAid}
              onChange={(e) => setClaimGiftAid(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-green-600"
            />
            <span>I'm a UK taxpayer — claim Gift Aid on this donation</span>
          </label>

          {claimGiftAid && (
            <div className="mb-4 space-y-3">
              <input
                className="input"
                placeholder="Full name"
                value={giftAidDetails.donorFullName}
                onChange={(e) => setGiftAidDetails({ ...giftAidDetails, donorFullName: e.target.value })}
                aria-label="Full name for Gift Aid"
              />
              <input
                className="input"
                placeholder="Address line 1"
                value={giftAidDetails.addressLine1}
                onChange={(e) => setGiftAidDetails({ ...giftAidDetails, addressLine1: e.target.value })}
                aria-label="Address line 1"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  className="input"
                  placeholder="Town/City"
                  value={giftAidDetails.city}
                  onChange={(e) => setGiftAidDetails({ ...giftAidDetails, city: e.target.value })}
                  aria-label="Town or city"
                />
                <input
                  className="input"
                  placeholder="Postcode"
                  value={giftAidDetails.postcode}
                  onChange={(e) => setGiftAidDetails({ ...giftAidDetails, postcode: e.target.value })}
                  aria-label="Postcode"
                />
              </div>
              <p className="text-xs text-gray-500">
                I am a UK taxpayer and understand that if I pay less Income Tax and/or Capital Gains Tax than
                the amount of Gift Aid claimed on all my donations in that tax year it is my responsibility
                to pay any difference.
              </p>
            </div>
          )}

          <div className="mb-5 rounded-lg bg-gray-50 p-3 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>You pay</span>
              <span className="font-medium text-gray-900">£{fees?.donorPays ?? effectiveAmount.toFixed(2)}</span>
            </div>
            {claimGiftAid && (
              <div className="flex justify-between text-green-700 mt-1">
                <span>Gift Aid boost</span>
                <span className="font-medium">+£{giftAidBoost}</span>
              </div>
            )}
            <div className="mt-2 flex justify-between border-t border-gray-200 pt-2 font-medium text-green-800">
              <span>Total charity receives</span>
              <span>£{claimGiftAid
                ? (parseFloat(fees?.netToCharity ?? "0") + parseFloat(giftAidBoost ?? "0")).toFixed(2)
                : fees?.netToCharity ?? effectiveAmount.toFixed(2)
              }</span>
            </div>
          </div>

          <div className="flex gap-3">
            <button className="btn-ghost flex-1" onClick={() => setStep("details")}>← Back</button>
            <button
              className="btn-primary flex-1"
              onClick={handleSubmit}
              disabled={createIntent.isPending}
              aria-busy={createIntent.isPending}
            >
              {createIntent.isPending ? "Processing…" : `Donate £${fees?.donorPays ?? effectiveAmount.toFixed(2)}`}
            </button>
          </div>

          <p className="mt-3 text-center text-xs text-gray-400">
            🔒 Secure hosted checkout · PCI-DSS Level 1 · TLS 1.3
          </p>
        </>
      )}
    </div>
  );
}
