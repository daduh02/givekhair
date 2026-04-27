import { type NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { db } from "@/lib/db";
import { markDonationCaptured, markDonationFailed } from "@/server/lib/donation-processing";
import { createDisputeRecord } from "@/server/lib/donation-exceptions";

function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY.");
  }

  return new Stripe(secretKey);
}

export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "Webhook misconfigured" }, { status: 500 });
  }

  let event: Stripe.Event;

  try {
    const body = await req.text();
    event = getStripeClient().webhooks.constructEvent(body, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const pi = event.data.object as { id: string; metadata: { donationId?: string } };
        const donationId = pi.metadata?.donationId;
        if (!donationId) break;

        const donation = await db.donation.findUnique({
          where: { id: donationId },
          select: { id: true, status: true },
        });
        if (!donation || donation.status !== "PENDING") break;

        await markDonationCaptured({
          donationId,
          provider: "stripe",
          providerRef: pi.id,
        });

        // TODO: enqueue email receipt via BullMQ or Resend
        break;
      }

      case "payment_intent.payment_failed": {
        const pi = event.data.object as { metadata: { donationId?: string }; id?: string; last_payment_error?: { message?: string } };
        const donationId = pi.metadata?.donationId;
        if (!donationId) break;
        await markDonationFailed({
          donationId,
          providerRef: pi.id,
          failureReason: pi.last_payment_error?.message ?? "Payment failed at checkout.",
        });
        break;
      }

      case "charge.dispute.created": {
        const dispute = event.data.object as {
          id?: string;
          amount?: number;
          currency?: string;
          reason?: string;
          evidence_details?: { due_by?: number };
          metadata?: { donationId?: string };
          payment_intent?: string;
        };

        const donationId =
          dispute.metadata?.donationId ??
          (dispute.payment_intent
            ? (await db.payment.findFirst({
                where: { provider: "stripe", providerRef: dispute.payment_intent },
                select: { donationId: true },
              }))?.donationId
            : null);

        if (!donationId) {
          break;
        }

        await createDisputeRecord({
          donationId,
          amount: ((dispute.amount ?? 0) / 100) || 0,
          currency: (dispute.currency ?? "gbp").toUpperCase(),
          reason: dispute.reason ?? "Stripe dispute created.",
          providerRef: dispute.id,
          evidenceDueAt: dispute.evidence_details?.due_by ? new Date(dispute.evidence_details.due_by * 1000) : null,
          notes: "Recorded from Stripe dispute webhook.",
        });
        break;
      }

      default:
        // Unhandled event type — log and ignore
        console.log(`Unhandled Stripe event: ${event.type}`);
    }
  } catch (err) {
    console.error("Webhook handler error:", err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
