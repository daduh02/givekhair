"use client";

import React from "react";
import { useEffect, useMemo, useState } from "react";
import { HiOutlineLink, HiOutlineMail, HiOutlinePrinter } from "react-icons/hi";
import {
  FaFacebookF,
  FaFacebookMessenger,
  FaLinkedinIn,
  FaMicrosoft,
  FaRedditAlien,
  FaSlack,
  FaTwitch,
  FaWhatsapp,
  FaYoutube,
} from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import { SiLinktree } from "react-icons/si";
import {
  buildPrimaryShareChannels,
  buildSecondaryShareChannels,
  copyShareUrl,
  runPrint,
  type ShareChannel,
  type ShareChannelId,
} from "@/lib/share-cause";

type ShareCauseProps = {
  title: string;
  description?: string | null;
  url: string;
};

const brandHoverClassByChannel: Record<ShareChannelId, string> = {
  whatsapp: "hover:border-[rgba(37,211,102,0.35)] hover:text-[#1f8f4c]",
  facebook: "hover:border-[rgba(24,119,242,0.35)] hover:text-[#1877F2]",
  messenger: "hover:border-[rgba(0,132,255,0.35)] hover:text-[#0084FF]",
  x: "hover:border-[rgba(15,23,42,0.24)] hover:text-[color:var(--color-ink)]",
  linkedin: "hover:border-[rgba(10,102,194,0.35)] hover:text-[#0A66C2]",
  email: "hover:border-[rgba(15,118,110,0.28)] hover:text-[color:var(--color-primary-dark)]",
  print: "hover:border-[rgba(100,116,139,0.3)] hover:text-[color:var(--color-ink)]",
  copy: "hover:border-[rgba(15,118,110,0.28)] hover:text-[color:var(--color-primary-dark)]",
  youtube: "hover:border-[rgba(255,0,0,0.28)] hover:text-[#FF0000]",
  slack: "hover:border-[rgba(74,21,75,0.28)] hover:text-[#4A154B]",
  teams: "hover:border-[rgba(98,100,167,0.3)] hover:text-[#6264A7]",
  linktree: "hover:border-[rgba(57,255,20,0.28)] hover:text-[#1D9E4A]",
  reddit: "hover:border-[rgba(255,69,0,0.28)] hover:text-[#FF4500]",
  twitch: "hover:border-[rgba(145,70,255,0.28)] hover:text-[#9146FF]",
};

const iconByChannel: Record<ShareChannelId, React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>> = {
  whatsapp: FaWhatsapp,
  facebook: FaFacebookF,
  messenger: FaFacebookMessenger,
  x: FaXTwitter,
  linkedin: FaLinkedinIn,
  email: HiOutlineMail,
  print: HiOutlinePrinter,
  copy: HiOutlineLink,
  youtube: FaYoutube,
  slack: FaSlack,
  teams: FaMicrosoft,
  linktree: SiLinktree,
  reddit: FaRedditAlien,
  twitch: FaTwitch,
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

  const primaryChannels = useMemo(() => buildPrimaryShareChannels(shareInput), [shareInput]);
  const secondaryChannels = useMemo(() => buildSecondaryShareChannels(shareInput), [shareInput]);

  async function handleCopy() {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      return;
    }

    await copyShareUrl(navigator.clipboard, currentUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function handlePrint() {
    if (typeof window !== "undefined") {
      runPrint(window);
    }
  }

  function handleChannelAction(channel: ShareChannel) {
    if (channel.action === "print") {
      handlePrint();
      return;
    }

    if (channel.action === "copy") {
      void handleCopy();
      return;
    }

    if (channel.href) {
      window.open(channel.href, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <section id="share-this-cause" className="surface-card p-5 sm:p-6">
      <div>
        <p className="section-kicker">Share this cause</p>
        <h2 className="mt-3 text-[1.4rem] font-bold tracking-[-0.03em] text-[color:var(--color-ink)]">Help this appeal reach more people</h2>
        <p className="mt-2 max-w-[40rem] text-sm leading-6 text-[color:var(--color-ink-muted)]">
          Share the live appeal link with people who may want to support, donate, or pass the cause on.
        </p>
      </div>

      <div className="mt-5 flex flex-wrap gap-2.5">
        {primaryChannels.map((channel) => {
          const Icon = iconByChannel[channel.icon];
          const buttonClassName = `inline-flex min-h-[2.85rem] items-center justify-center gap-2 rounded-[999px] border border-[rgba(15,118,110,0.18)] bg-[rgba(255,255,255,0.82)] px-4 py-3 text-sm font-semibold text-[color:var(--color-ink-soft)] shadow-[0_8px_20px_rgba(15,23,42,0.05)] transition duration-200 hover:-translate-y-[1px] ${brandHoverClassByChannel[channel.id]}`;

          if (channel.action === "open" && channel.href) {
            return (
              <a
                key={channel.id}
                href={channel.href}
                target={channel.id === "email" ? undefined : "_blank"}
                rel={channel.id === "email" ? undefined : "noopener noreferrer"}
                className={buttonClassName}
                aria-label={`Share this cause on ${channel.label}`}
              >
                <Icon className="h-[1rem] w-[1rem]" aria-hidden />
                <span>{channel.label}</span>
              </a>
            );
          }

          return (
            <button
              key={channel.id}
              type="button"
              className={buttonClassName}
              onClick={() => handleChannelAction(channel)}
              aria-label={channel.id === "copy" ? "Copy appeal link" : "Print this appeal"}
            >
              <Icon className="h-[1rem] w-[1rem]" aria-hidden />
              <span>{channel.id === "copy" && copied ? "Copied!" : channel.label}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 rounded-[1rem] border border-[color:var(--color-line)] bg-[rgba(248,245,239,0.78)] p-4">
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
          <button
            type="button"
            className="btn-primary sm:min-w-[8.5rem]"
            onClick={() => void handleCopy()}
            aria-label="Copy appeal link"
          >
            <HiOutlineLink className="h-[1rem] w-[1rem]" aria-hidden />
            {copied ? "Copied!" : "Copy link"}
          </button>
        </div>
      </div>

      <details className="summary-details mt-4">
        <summary className="flex items-center justify-between gap-4">
          <span className="text-sm font-semibold text-[color:var(--color-ink)]">More options</span>
          <span className="text-sm text-[color:var(--color-ink-muted)]">Open</span>
        </summary>
        <div className="flex flex-wrap gap-2 border-t border-[color:var(--color-line)] p-4">
          {secondaryChannels.map((channel) => {
            const Icon = iconByChannel[channel.icon];

            return (
              <button
                key={channel.id}
                type="button"
                className={`inline-flex min-h-[2.7rem] items-center justify-center gap-2 rounded-[999px] border border-[rgba(15,118,110,0.14)] bg-white px-3 py-2 text-sm font-medium text-[color:var(--color-ink-soft)] transition ${brandHoverClassByChannel[channel.id]}`}
                onClick={() => handleChannelAction(channel)}
                aria-label={channel.label}
              >
                <Icon className="h-[1rem] w-[1rem]" aria-hidden />
                <span>{channel.label}</span>
              </button>
            );
          })}
        </div>
      </details>
    </section>
  );
}
