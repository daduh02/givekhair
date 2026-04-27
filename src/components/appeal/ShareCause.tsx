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

  function openShareUrl(href: string) {
    if (typeof window === "undefined") {
      return;
    }

    window.open(href, "_blank", "noopener,noreferrer");
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
      if (channel.id === "messenger") {
        const popup = window.open(channel.href, "_blank", "noopener,noreferrer");
        if (!popup) {
          void handleCopy();
        }
        return;
      }

      openShareUrl(channel.href);
    }
  }

  function renderChannelIcon(channel: ShareChannel) {
    const Icon = iconByChannel[channel.icon];
    return <Icon className="h-[1.05rem] w-[1.05rem] flex-shrink-0" aria-hidden />;
  }

  function renderPrimaryChannel(channel: ShareChannel) {
    const buttonClassName = `inline-flex min-h-[3rem] items-center justify-center gap-2 rounded-[999px] border border-[rgba(15,118,110,0.18)] bg-[rgba(255,255,255,0.82)] px-4 py-3 text-sm font-semibold text-[color:var(--color-ink-soft)] shadow-[0_8px_20px_rgba(15,23,42,0.05)] transition duration-200 hover:-translate-y-[1px] ${brandHoverClassByChannel[channel.id]}`;

    if (channel.action === "open" && channel.href && channel.id !== "messenger") {
      return (
        <a
          key={channel.id}
          href={channel.href}
          target={channel.id === "email" ? undefined : "_blank"}
          rel={channel.id === "email" ? undefined : "noopener noreferrer"}
          className={buttonClassName}
          aria-label={`Share this cause on ${channel.label}`}
        >
          {renderChannelIcon(channel)}
          <span className="truncate">{channel.label}</span>
        </a>
      );
    }

    return (
      <button
        key={channel.id}
        type="button"
        className={buttonClassName}
        onClick={() => handleChannelAction(channel)}
        aria-label={
          channel.id === "copy"
            ? "Copy appeal link"
            : channel.id === "print"
              ? "Print this appeal"
              : `Share this cause on ${channel.label}`
        }
      >
        {renderChannelIcon(channel)}
        <span className="truncate">
          {channel.id === "copy" && copied ? "Copied!" : channel.label}
        </span>
      </button>
    );
  }

  function handleSecondaryAction(target: ShareChannel) {
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
        {primaryChannels.map((channel) => renderPrimaryChannel(channel))}
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
          <button
            type="button"
            className="btn-primary sm:min-w-[9rem]"
            onClick={() => void handleCopy()}
            aria-label="Copy appeal link"
          >
            <HiOutlineLink className="h-[1.05rem] w-[1.05rem]" aria-hidden />
            {copied ? "Copied!" : "Copy link"}
          </button>
        </div>
      </div>

      <div className="mt-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--color-ink-muted)]">More channels</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {secondaryChannels.map((target) => {
            const Icon = iconByChannel[target.icon];

            return (
            <button
              key={target.id}
              type="button"
              className={`admin-nav-chip min-h-[2.9rem] ${brandHoverClassByChannel[target.id]}`}
              aria-label={target.label}
              title={target.action === "copy" ? `${target.label} copies the appeal link` : target.label}
              onClick={() => handleSecondaryAction(target)}
            >
              <span className="admin-nav-chip-icon flex items-center justify-center" aria-hidden="true">
                <Icon className="h-[1rem] w-[1rem]" />
              </span>
            </button>
          )})}
        </div>
      </div>
    </section>
  );
}
