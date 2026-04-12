/**
 * Donations API stub
 * Implements the external Donations API v1 interface with in-memory responses.
 * Replace each method body with a real fetch() call once credentials are available.
 *
 * Usage:
 *   import { donationsApi } from "@/server/lib/donations-api-stub"
 *   const page = await donationsApi.createPage({ ... })
 */

import { randomUUID } from "crypto";

const BASE_URL = process.env.DONATIONS_API_URL ?? "http://localhost:4000";
const API_KEY = process.env.DONATIONS_API_KEY ?? "stub-key";

const IS_STUB = !process.env.DONATIONS_API_REAL;

async function apiRequest<T>(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
  idempotencyKey?: string
): Promise<T> {
  if (IS_STUB) {
    throw new Error(
      `[DonationsAPI stub] ${method} ${path} — set DONATIONS_API_REAL=1 and configure DONATIONS_API_URL/KEY to use the real API.`
    );
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(`DonationsAPI ${method} ${path} failed: ${err.message ?? res.status}`);
  }

  return res.json() as Promise<T>;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ApiPage {
  id: string;
  shortName: string;
  title: string;
  status: string;
  externalUrl: string;
}

export interface ApiCheckoutSession {
  id: string;
  checkoutUrl: string;
  expiresAt: string;
}

export interface ApiDonation {
  id: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
}

export interface ApiCharity {
  id: string;
  name: string;
  slug: string;
  registrationNo: string;
}

// ── Stub implementations ──────────────────────────────────────────────────────

export const donationsApi = {
  /** Create a fundraising page via external API */
  async createPage(input: {
    title: string;
    appealExternalId: string;
    userId: string;
  }): Promise<ApiPage> {
    if (IS_STUB) {
      return {
        id: `ext-page-${randomUUID().slice(0, 8)}`,
        shortName: input.title.toLowerCase().replace(/\s+/g, "-").slice(0, 30),
        title: input.title,
        status: "active",
        externalUrl: `https://stub.donations-api.dev/pages/${randomUUID()}`,
      };
    }
    return apiRequest("POST", "/v1/pages", input);
  },

  /** Create a hosted checkout session */
  async createCheckout(input: {
    donationId: string;
    pageExternalId: string;
    amount: number;
    currency: string;
    returnUrl: string;
    cancelUrl: string;
    idempotencyKey: string;
  }): Promise<ApiCheckoutSession> {
    if (IS_STUB) {
      return {
        id: `sess-${randomUUID().slice(0, 8)}`,
        checkoutUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/checkout/test/${input.donationId}`,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      };
    }
    return apiRequest("POST", "/v1/checkout/sessions", input, input.idempotencyKey);
  },

  /** Retrieve charity details by slug */
  async getCharity(slug: string): Promise<ApiCharity> {
    if (IS_STUB) {
      return { id: `ext-charity-${slug}`, name: slug, slug, registrationNo: "000000" };
    }
    return apiRequest("GET", `/v1/charities/${slug}`);
  },

  /** List donations for a page */
  async listDonations(pageExternalId: string): Promise<ApiDonation[]> {
    if (IS_STUB) {
      return [];
    }
    return apiRequest("GET", `/v1/pages/${pageExternalId}/donations`);
  },
};
