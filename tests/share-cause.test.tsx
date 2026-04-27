import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ShareCause } from "@/components/appeal/ShareCause";
import {
  buildPrimaryShareChannels,
  buildSecondaryShareChannels,
  copyShareUrl,
  runPrint,
} from "@/lib/share-cause";

test("share helpers build real share urls", () => {
  const targets = buildPrimaryShareChannels({
    title: "Trek 4 Africa 2026",
    url: "https://givekhair.vercel.app/appeals/trek-4-africa-2026",
    description: "Support the appeal",
  });

  assert.equal(targets.find((item) => item.id === "whatsapp")?.href?.includes("wa.me"), true);
  assert.equal(targets.find((item) => item.id === "facebook")?.href?.includes("facebook.com"), true);
  assert.equal(targets.find((item) => item.id === "linkedin")?.href?.includes("linkedin.com"), true);
  assert.equal(targets.find((item) => item.id === "x")?.href?.includes("twitter.com"), true);
  assert.equal(targets.find((item) => item.id === "email")?.href?.startsWith("mailto:"), true);
  assert.equal(targets.find((item) => item.id === "copy")?.action, "copy");
});

test("share component renders core buttons and copy field", () => {
  const html = renderToStaticMarkup(
    React.createElement(ShareCause, {
      title: "Trek 4 Africa 2026",
      description: "Support the appeal",
      url: "https://givekhair.vercel.app/appeals/trek-4-africa-2026",
    }),
  );

  assert.match(html, /Share this cause/);
  assert.match(html, /WhatsApp/);
  assert.match(html, /Facebook/);
  assert.match(html, /Copy link/);
  assert.match(html, /Appeal share link/);
});

test("copy helper writes the supplied url", async () => {
  let copied = "";
  await copyShareUrl(
    {
      writeText: async (value: string) => {
        copied = value;
      },
    },
    "https://givekhair.vercel.app/appeals/trek-4-africa-2026",
  );

  assert.equal(copied, "https://givekhair.vercel.app/appeals/trek-4-africa-2026");
});

test("print helper calls print", () => {
  let printed = false;
  runPrint({
    print() {
      printed = true;
    },
  });

  assert.equal(printed, true);
});

test("secondary share targets fallback or open safely", () => {
  const targets = buildSecondaryShareChannels({
    title: "Trek 4 Africa 2026",
    url: "https://givekhair.vercel.app/appeals/trek-4-africa-2026",
  });

  assert.equal(targets.find((item) => item.id === "reddit")?.action, "open");
  assert.equal(targets.find((item) => item.id === "slack")?.action, "copy");
  assert.equal(targets.find((item) => item.id === "teams")?.href?.includes("teams.microsoft.com/share"), true);
});
