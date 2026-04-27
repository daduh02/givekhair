export type ShareCauseInput = {
  title: string;
  url: string;
  description?: string | null;
};

export type ShareChannelId =
  | "whatsapp"
  | "facebook"
  | "messenger"
  | "x"
  | "linkedin"
  | "email"
  | "print"
  | "copy"
  | "youtube"
  | "slack"
  | "teams"
  | "linktree"
  | "reddit"
  | "twitch";

export type ShareChannel = {
  id: ShareChannelId;
  label: string;
  icon: ShareChannelId;
  action: "open" | "copy" | "print";
  href?: string;
};

function textWithUrl(input: ShareCauseInput) {
  return `${input.title} ${input.url}`.trim();
}

export function buildPrimaryShareChannels(input: ShareCauseInput): ShareChannel[] {
  const encodedUrl = encodeURIComponent(input.url);
  const encodedTitle = encodeURIComponent(input.title);
  const encodedEmailBody = encodeURIComponent(`${input.title}\n\n${input.description ?? ""}\n\n${input.url}`.trim());

  return [
    {
      id: "whatsapp",
      label: "WhatsApp",
      icon: "whatsapp",
      action: "open",
      href: `https://wa.me/?text=${encodeURIComponent(textWithUrl(input))}`,
    },
    {
      id: "facebook",
      label: "Facebook",
      icon: "facebook",
      action: "open",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    },
    {
      id: "messenger",
      label: "Messenger",
      icon: "messenger",
      action: "open",
      href: `fb-messenger://share/?link=${encodedUrl}`,
    },
    {
      id: "x",
      label: "X",
      icon: "x",
      action: "open",
      href: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
    },
    {
      id: "linkedin",
      label: "LinkedIn",
      icon: "linkedin",
      action: "open",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    },
    {
      id: "email",
      label: "Email",
      icon: "email",
      action: "open",
      href: `mailto:?subject=${encodedTitle}&body=${encodedEmailBody}`,
    },
    {
      id: "print",
      label: "Print",
      icon: "print",
      action: "print",
    },
    {
      id: "copy",
      label: "Copy link",
      icon: "copy",
      action: "copy",
    },
  ];
}

export function buildSecondaryShareChannels(input: ShareCauseInput): ShareChannel[] {
  const encodedUrl = encodeURIComponent(input.url);
  const encodedTitle = encodeURIComponent(input.title);

  return [
    {
      id: "youtube",
      label: "YouTube",
      icon: "youtube",
      action: "copy",
    },
    {
      id: "slack",
      label: "Slack",
      icon: "slack",
      action: "copy",
    },
    {
      id: "teams",
      label: "Microsoft Teams",
      icon: "teams",
      action: "open",
      href: `https://teams.microsoft.com/share?href=${encodedUrl}&msgText=${encodedTitle}`,
    },
    {
      id: "linktree",
      label: "Linktree",
      icon: "linktree",
      action: "copy",
    },
    {
      id: "reddit",
      label: "Reddit",
      icon: "reddit",
      action: "open",
      href: `https://www.reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}`,
    },
    {
      id: "twitch",
      label: "Twitch",
      icon: "twitch",
      action: "copy",
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
