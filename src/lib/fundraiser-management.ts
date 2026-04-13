import type { PageStatus, PageVisibility } from "@prisma/client";

type FundraiserStateTone = "teal" | "gold" | "slate" | "red";

export type FundraiserStateSummary = {
  label: string;
  title: string;
  description: string;
  tone: FundraiserStateTone;
  canManageContent: boolean;
};

export type FundraiserAnalyticsSummary = {
  totalRaised: number;
  onlineRaised: number;
  offlineRaised: number;
  donorCount: number;
  updateCount: number;
  recentDonationsCount: number;
  goalProgress: number;
};

export function formatCurrency(amount: number, currency = "GBP", maximumFractionDigits = 0) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits,
  }).format(amount);
}

export function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function decimalToNumber(value: { toString(): string } | null | undefined) {
  return value ? Number.parseFloat(value.toString()) : 0;
}

export function getGoalProgress(totalRaised: number, targetAmount: number) {
  if (targetAmount <= 0) {
    return 0;
  }

  return Math.min(Math.round((totalRaised / targetAmount) * 100), 100);
}

/*
  Fundraiser owners need plain-language status guidance rather than raw enum
  values. This mapping keeps the owner dashboard, edit page, and any future
  management views aligned around the same explanations.
*/
export function getFundraiserStateSummary(input: {
  status: PageStatus;
  visibility: PageVisibility;
  reviewNotes?: string | null;
}): FundraiserStateSummary & { reviewNote?: string | null } {
  const visibilityNote =
    input.visibility === "UNLISTED"
      ? "Anyone with the direct link can still view it."
      : input.visibility === "HIDDEN"
        ? "It is currently hidden from public view."
        : "It is visible on the public site.";

  switch (input.status) {
    case "ACTIVE":
      return {
        label: input.visibility === "UNLISTED" ? "Live but unlisted" : "Live",
        title: "Your fundraiser is accepting support",
        description: `Supporters can donate right now, and any new updates or gallery items will show publicly. ${visibilityNote}`,
        tone: "teal",
        canManageContent: true,
        reviewNote: input.reviewNotes,
      };
    case "PENDING_APPROVAL":
      return {
        label: "Pending approval",
        title: "Your page is waiting for review",
        description:
          "The page is saved and linked to its appeal, but it is not public yet. You can still improve the story, add media, and prepare updates while the review is pending.",
        tone: "gold",
        canManageContent: true,
        reviewNote: input.reviewNotes,
      };
    case "REJECTED":
      return {
        label: "Needs changes",
        title: "This fundraiser needs updates before it can go live",
        description:
          "The page is hidden until the requested changes are made and reviewed again. Update the content below, then ask your charity team or platform admin to review it.",
        tone: "red",
        canManageContent: true,
        reviewNote: input.reviewNotes,
      };
    case "SUSPENDED":
      return {
        label: "Temporarily paused",
        title: "This fundraiser is under review",
        description:
          "The page is currently paused from public view while a review takes place. You can still adjust the content so it is ready if the review is cleared.",
        tone: "gold",
        canManageContent: true,
        reviewNote: input.reviewNotes,
      };
    case "BANNED":
      return {
        label: "Removed",
        title: "This fundraiser has been removed",
        description:
          "This page is no longer available publicly and owner content tools are locked. Contact support if you believe this action was made in error.",
        tone: "red",
        canManageContent: false,
        reviewNote: input.reviewNotes,
      };
    case "ENDED":
      return {
        label: "Ended",
        title: "This fundraiser has finished its active run",
        description:
          "Supporters can still view the page history, but it is no longer actively raising in the same way. You can keep the story and updates tidy for supporters looking back.",
        tone: "slate",
        canManageContent: true,
        reviewNote: input.reviewNotes,
      };
    case "DRAFT":
    default:
      return {
        label: "Draft",
        title: "Your fundraiser is still in draft",
        description:
          "Finish the story, media, and target details before sharing it. Draft pages stay out of the public experience until they move into review.",
        tone: "slate",
        canManageContent: true,
        reviewNote: input.reviewNotes,
      };
  }
}

export function getStateToneStyles(tone: FundraiserStateTone) {
  if (tone === "teal") {
    return {
      borderColor: "rgba(15,118,110,0.16)",
      background: "rgba(204,251,241,0.48)",
      badgeBackground: "rgba(15,118,110,0.16)",
      badgeColor: "#115E59",
    };
  }

  if (tone === "gold") {
    return {
      borderColor: "rgba(212,160,23,0.18)",
      background: "rgba(254,243,199,0.58)",
      badgeBackground: "rgba(212,160,23,0.16)",
      badgeColor: "#8A6200",
    };
  }

  if (tone === "red") {
    return {
      borderColor: "rgba(239,68,68,0.18)",
      background: "rgba(254,226,226,0.72)",
      badgeBackground: "rgba(239,68,68,0.12)",
      badgeColor: "#991B1B",
    };
  }

  return {
    borderColor: "rgba(15,23,42,0.1)",
    background: "rgba(255,255,255,0.78)",
    badgeBackground: "rgba(15,23,42,0.08)",
    badgeColor: "#334155",
  };
}
