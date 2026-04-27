import test, { after } from "node:test";
import assert from "node:assert/strict";
import { POST as stripeWebhookPost } from "@/app/api/webhooks/stripe/route";
import { db } from "@/lib/db";
import { hasCharityAccess } from "@/server/lib/access-control";
import {
  isFundraisingPageDonationEligible,
  isFundraisingPagePubliclyAccessible,
} from "@/server/lib/public-access";
import { closeRateLimitConnections, enforceRateLimitResponse } from "@/server/lib/rate-limit";

after(async () => {
  await closeRateLimitConnections();
  await db.$disconnect();
});

function buildEligibilityFixture(overrides?: Partial<Parameters<typeof isFundraisingPageDonationEligible>[0]>) {
  return {
    status: "ACTIVE",
    visibility: "PUBLIC",
    teamId: "team_123",
    team: {
      status: "ACTIVE",
      visibility: "PUBLIC",
    },
    appeal: {
      status: "ACTIVE",
      visibility: "PUBLIC",
      charity: {
        isActive: true,
        status: "ACTIVE",
      },
    },
    ...overrides,
  };
}

test("invalid Stripe webhook signature is rejected", async () => {
  const response = await stripeWebhookPost(
    new Request("http://localhost:3000/api/webhooks/stripe", {
      method: "POST",
      body: JSON.stringify({ type: "payment_intent.succeeded", data: { object: {} } }),
      headers: {
        "Content-Type": "application/json",
      },
    }) as any,
  );

  assert.equal(response.status, 400);
});

test("charity admin cannot access another charity scope", () => {
  assert.equal(hasCharityAccess(["charity-a"], "charity-b"), false);
  assert.equal(hasCharityAccess(["charity-a"], "charity-a"), true);
});

test("inactive or hidden fundraiser pages are not publicly accessible or donation eligible", () => {
  const hiddenPage = buildEligibilityFixture({ visibility: "HIDDEN" });
  const pausedAppeal = buildEligibilityFixture({
    appeal: {
      status: "PAUSED",
      visibility: "PUBLIC",
      charity: { isActive: true, status: "ACTIVE" },
    },
  });
  const inactiveCharity = buildEligibilityFixture({
    appeal: {
      status: "ACTIVE",
      visibility: "PUBLIC",
      charity: { isActive: false, status: "ACTIVE" },
    },
  });

  assert.equal(isFundraisingPagePubliclyAccessible(hiddenPage), false);
  assert.equal(isFundraisingPageDonationEligible(hiddenPage), false);
  assert.equal(isFundraisingPageDonationEligible(pausedAppeal), false);
  assert.equal(isFundraisingPageDonationEligible(inactiveCharity), false);
});

test("hidden direct checkout pages remain donation-eligible but not publicly visible", () => {
  const directCheckoutPage = buildEligibilityFixture({
    visibility: "HIDDEN",
    teamId: null,
    team: undefined,
  });

  assert.equal(isFundraisingPagePubliclyAccessible(directCheckoutPage), false);
  assert.equal(isFundraisingPageDonationEligible(directCheckoutPage), true);
});

test("rate-limited responses return 429", async () => {
  const key = `test-${Date.now()}`;

  const first = await enforceRateLimitResponse({
    namespace: "test:endpoint",
    key,
    limit: 1,
    windowSec: 60,
  });
  const second = await enforceRateLimitResponse({
    namespace: "test:endpoint",
    key,
    limit: 1,
    windowSec: 60,
  });

  assert.equal(first, null);
  assert.equal(second?.status, 429);
});
