export type ShareCauseInput = {
  title: string;
  url: string;
  description?: string | null;
};

export type ShareTarget = {
  key: string;
  label: string;
  href: string;
  iconLabel: string;
};

export type SecondaryShareTarget = {
  key: string;
  label: string;
  href?: string;
  action: "open" | "copy";
  iconLabel: string;
};

function textWithUrl(input: ShareCauseInput) {
  return `${input.title} ${input.url}`.trim();
}

export function buildPrimaryShareTargets(input: ShareCauseInput): ShareTarget[] {
  const encodedUrl = encodeURIComponent(input.url);
  const encodedTitle = encodeURIComponent(input.title);
  const encodedDescription = encodeURIComponent(input.description ?? input.title);
  const encodedEmailBody = encodeURIComponent(`${input.title}\n\n${input.description ?? ""}\n\n${input.url}`.trim());

  return [
    {
      key: "whatsapp",
      label: "WhatsApp",
      href: `https://wa.me/?text=${encodeURIComponent(textWithUrl(input))}`,
      iconLabel: "WA",
    },
    {
      key: "facebook",
      label: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      iconLabel: "f",
    },
    {
      key: "messenger",
      label: "Messenger",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      iconLabel: "M",
    },
    {
      key: "linkedin",
      label: "LinkedIn",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      iconLabel: "in",
    },
    {
      key: "x",
      label: "X",
      href: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
      iconLabel: "X",
    },
    {
      key: "email",
      label: "Email",
      href: `mailto:?subject=${encodedTitle}&body=${encodedEmailBody}`,
      iconLabel: "@",
    },
    {
      key: "print",
      label: "Print",
      href: input.url,
      iconLabel: "P",
    },
  ];
}

export function buildSecondaryShareTargets(input: ShareCauseInput): SecondaryShareTarget[] {
  const encodedUrl = encodeURIComponent(input.url);
  const encodedTitle = encodeURIComponent(input.title);

  return [
    {
      key: "youtube",
      label: "YouTube",
      action: "copy",
      iconLabel: "YT",
    },
    {
      key: "slack",
      label: "Slack",
      action: "copy",
      iconLabel: "S",
    },
    {
      key: "teams",
      label: "Microsoft Teams",
      action: "open",
      href: `https://teams.microsoft.com/share?href=${encodedUrl}&msgText=${encodedTitle}`,
      iconLabel: "T",
    },
    {
      key: "linktree",
      label: "Linktree",
      action: "copy",
      iconLabel: "L",
    },
    {
      key: "reddit",
      label: "Reddit",
      action: "open",
      href: `https://www.reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}`,
      iconLabel: "R",
    },
    {
      key: "twitch",
      label: "Twitch",
      action: "copy",
      iconLabel: "Tw",
    },
  ];
}

export async function copyShareUrl(
  clipboard: { writeText(text: string): Promise<void> },
  url: string,
) {
  await clipboard.writeText(url);
}

export function runPrint(target: { print(): void }) {
  target.print();
}
