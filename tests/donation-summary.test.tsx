import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DonationSummary } from "@/components/appeal/DonationSummary";
import { buildAppealDonationSummary } from "@/lib/appeal-donation-summary";

test("donation summary calculation uses real channel breakdowns", () => {
  const summary = buildAppealDonationSummary({
    onlineDirect: 50,
    offlineDirect: 10,
    onlineFundraisers: 25,
    offlineFundraisers: 5,
  });

  assert.deepEqual(summary, {
    total: 90,
    online: 75,
    offline: 15,
    direct: 60,
    fundraisers: 30,
  });
});

test("donation summary renders all sections", () => {
  const html = renderToStaticMarkup(
    React.createElement(DonationSummary, {
      summary: {
        total: 90,
        online: 75,
        offline: 15,
        direct: 60,
        fundraisers: 30,
      },
    }),
  );

  assert.match(html, /Donation breakdown/);
  assert.match(html, /Total raised/);
  assert.match(html, /Online/);
  assert.match(html, /Offline/);
  assert.match(html, /Fundraisers/);
  assert.match(html, /Learn more about fees/);
});

test("donation summary zero state shows £0.00 values", () => {
  const html = renderToStaticMarkup(
    React.createElement(DonationSummary, {
      summary: {
        total: 0,
        online: 0,
        offline: 0,
        direct: 0,
        fundraisers: 0,
      },
    }),
  );

  const zeroMatches = html.match(/£0\.00/g) ?? [];
  assert.equal(zeroMatches.length >= 4, true);
});

test("donation summary loading state renders skeleton cards", () => {
  const html = renderToStaticMarkup(
    React.createElement(DonationSummary, {
      summary: {
        total: 0,
        online: 0,
        offline: 0,
        direct: 0,
        fundraisers: 0,
      },
      loading: true,
    }),
  );

  const skeletonMatches = html.match(/animate-pulse/g) ?? [];
  assert.equal(skeletonMatches.length, 4);
});
