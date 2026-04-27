"use client";

import React from "react";
import { useEffect, useMemo, useState } from "react";
import { buildPrimaryShareTargets, buildSecondaryShareTargets, copyShareUrl, runPrint } from "@/lib/share-cause";

type ShareCauseProps = {
  title: string;
  description?: string | null;
  url: string;
};

export function ShareCause({ title, description, url }: ShareCauseProps) {
  const [currentUrl, setCurrentUrl] = useState(url);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setCurrentUrl(window.location.href);
    }
  }, []);

  const shareInput = useMemo(
    () => ({
      title,
      description,
      url: currentUrl,
    }),
    [currentUrl, description, title],
  );

  const primaryTargets = useMemo(() => buildPrimaryShareTargets(shareInput), [shareInput]);
  const secondaryTargets = useMemo(() => buildSecondaryShareTargets(shareInput), [shareInput]);

  async function handleCopy() {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      return;
    }

    await copyShareUrl(navigator.clipboard, currentUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function handlePrint() {
    if (typeof window === "undefined") {
      return;
    }

    runPrint(window);
  }

  function handleSecondaryAction(target: (typeof secondaryTargets)[number]) {
    if (target.action === "open" && target.href) {
      window.open(target.href, "_blank", "noopener,noreferrer");
      return;
    }

    void handleCopy();
  }

  return (
    <section id="share-this-cause" className="surface-card p-7 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="section-kicker">Share this cause</p>
          <h2 className="mt-4 text-2xl font-bold tracking-[-0.03em] text-[color:var(--color-ink)]">Help this appeal travel further</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[color:var(--color-ink-muted)]">
            Share the real appeal link, invite supporters into the story, and make it easy for teams, donors, and communities to pass the cause on.
          </p>
        </div>
        <a href="#share-link-field" className="btn-outline" style={{ padding: "0.75rem 1rem" }}>
          Share
        </a>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        {primaryTargets.map((target) =>
          target.key === "print" ? (
            <button
              key={target.key}
              type="button"
              className="btn-outline"
              style={{ padding: "0.8rem 1rem" }}
              onClick={handlePrint}
            >
              <span className="trust-chip bg-transparent px-0 py-0 border-none">{target.iconLabel}</span>
              {target.label}
            </button>
          ) : (
            <a
              key={target.key}
              href={target.href}
              target={target.key === "email" ? undefined : "_blank"}
              rel={target.key === "email" ? undefined : "noopener noreferrer"}
              className="btn-outline"
              style={{ padding: "0.8rem 1rem" }}
            >
              <span className="trust-chip bg-transparent px-0 py-0 border-none">{target.iconLabel}</span>
              {target.label}
            </a>
          ),
        )}
      </div>

      <div className="mt-6 rounded-[1.5rem] border border-[color:var(--color-line)] bg-[rgba(248,245,239,0.78)] p-4 sm:p-5">
        <label id="share-link-field" className="block text-sm font-semibold text-[color:var(--color-ink-soft)]">
          Copy appeal link
        </label>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <input
            readOnly
            value={currentUrl}
            className="input"
            aria-label="Appeal share link"
          />
          <button type="button" className="btn-primary sm:min-w-[9rem]" onClick={() => void handleCopy()}>
            {copied ? "Copied!" : "Copy link"}
          </button>
        </div>
      </div>

      <div className="mt-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--color-ink-muted)]">More channels</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {secondaryTargets.map((target) => (
            <button
              key={target.key}
              type="button"
              className="admin-nav-chip"
              aria-label={target.label}
              title={target.action === "copy" ? `${target.label} copies the appeal link` : target.label}
              onClick={() => handleSecondaryAction(target)}
            >
              <span className="admin-nav-chip-icon" aria-hidden="true">
                {target.iconLabel}
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
