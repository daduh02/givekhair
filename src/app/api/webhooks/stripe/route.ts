import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { markDonationCaptured, markDonationFailed } from "@/server/lib/donation-processing";

// Stub: replace with `import Stripe from 'stripe'` once key is set
async function constructStripeEvent(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature") ?? "";
  // TODO: Stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  return JSON.parse(body) as { type: string; data: { object: Record<string, unknown> } };
}

export async function POST(req: NextRequest) {
  let event: Awaited<ReturnType<typeof constructStripeEvent>>;

  try {
    event = await constructStripeEvent(req);
  } catch (err) {
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
        // TODO: ingest dispute, create moderation log entry, enqueue evidence workflow
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
