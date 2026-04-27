export type CharityProductIcon =
  | "campaign"
  | "checkout"
  | "reporting"
  | "qr"
  | "fundraiser"
  | "team"
  | "ramadan"
  | "mosque"
  | "event"
  | "crm"
  | "whiteLabel";

export type ProductCapability =
  | "donations"
  | "fundraising"
  | "reporting"
  | "qr"
  | "ramadan"
  | "mosques"
  | "events";

export type CharityProduct = {
  title: string;
  slug: string;
  shortDescription: string;
  longDescription: string;
  icon: CharityProductIcon;
  category: string;
  features: string[];
  primaryCta: string;
  href: string;
  capabilities: ProductCapability[];
};

export const PRODUCT_CAPABILITY_COLUMNS: Array<{ key: ProductCapability; label: string }> = [
  { key: "donations", label: "Donations" },
  { key: "fundraising", label: "Fundraising" },
  { key: "reporting", label: "Reporting" },
  { key: "qr", label: "QR" },
  { key: "ramadan", label: "Ramadan" },
  { key: "mosques", label: "Mosques" },
  { key: "events", label: "Events" },
];

export const charityProducts: CharityProduct[] = [
  {
    title: "Campaign Pages",
    slug: "campaign-pages",
    shortDescription:
      "Launch beautiful appeal hubs for Ramadan, emergency relief, Zakat, Sadaqah, water, orphan and mosque campaigns.",
    longDescription:
      "Use GiveKhair's existing appeal experience to publish campaign hubs that combine story, charity trust signals, progress, fundraiser activity, and direct donation journeys in one polished destination.",
    icon: "campaign",
    category: "Core giving",
    features: ["Appeal storytelling", "Live progress and leaderboard context", "Verified charity visibility"],
    primaryCta: "Explore appeals",
    href: "/appeals",
    capabilities: ["donations", "fundraising", "ramadan", "mosques", "events"],
  },
  {
    title: "Donation Checkout",
    slug: "donation-checkout",
    shortDescription:
      "A fast, mobile-friendly giving journey with one-off, recurring, Gift Aid and Islamic donation types.",
    longDescription:
      "GiveKhair's checkout flow is already connected to live appeal and fundraising pages, helping charities offer clear pricing, donor support options, recurring giving, and Gift Aid-aware journeys without sending supporters through a confusing flow.",
    icon: "checkout",
    category: "Core giving",
    features: ["One-off and recurring giving", "Gift Aid support", "Mobile-first donation flow"],
    primaryCta: "See how it works",
    href: "/how-it-works",
    capabilities: ["donations", "ramadan", "mosques", "events"],
  },
  {
    title: "Reporting & Insights",
    slug: "reporting-insights",
    shortDescription:
      "Track donations, fundraisers, Gift Aid, offline donations, fees, transfers and campaign performance from one dashboard.",
    longDescription:
      "GiveKhair's admin surface already brings together operational reporting across donations, appeal performance, fundraiser pages, transfers, fee visibility, and offline donation workflows so finance and fundraising teams stay aligned.",
    icon: "reporting",
    category: "Operations",
    features: ["Admin reporting area", "Offline donation tracking", "Gift Aid and payout visibility"],
    primaryCta: "View reporting tools",
    href: "/dashboard",
    capabilities: ["donations", "fundraising", "reporting", "ramadan", "mosques", "events"],
  },
  {
    title: "QR Giving",
    slug: "qr-giving",
    shortDescription:
      "Create appeal-specific QR codes for Jummah collections, events, posters, mosque screens and community campaigns.",
    longDescription:
      "QR Giving is positioned for campaigns that need a fast bridge from physical spaces to GiveKhair's existing appeal and checkout journeys, with appeal-specific destinations that can support Jummah, events, posters, and screen-driven fundraising.",
    icon: "qr",
    category: "Acquisition",
    features: ["Appeal-specific QR destinations", "Poster and event-ready journeys", "Works with existing appeal pages"],
    primaryCta: "Speak to us",
    href: "/contact",
    capabilities: ["donations", "qr", "ramadan", "mosques", "events"],
  },
  {
    title: "Fundraising Pages",
    slug: "fundraising-pages",
    shortDescription:
      "Let supporters create personal fundraising pages with stories, targets, progress and social sharing.",
    longDescription:
      "The existing fundraiser page system already lets supporters build personal pages tied to live appeals, making it easier for charities to mobilise communities while keeping every page connected to the right campaign and donation flow.",
    icon: "fundraiser",
    category: "Community fundraising",
    features: ["Personal stories and targets", "Appeal-linked fundraising pages", "Built-in social sharing"],
    primaryCta: "Start fundraising",
    href: "/fundraise/new",
    capabilities: ["donations", "fundraising", "ramadan", "events"],
  },
  {
    title: "Team Pages",
    slug: "team-pages",
    shortDescription:
      "Enable families, schools, masjids, volunteers and community groups to fundraise together.",
    longDescription:
      "GiveKhair's appeal and team model supports group fundraising around a shared appeal, so charities can organise masjid communities, school efforts, family drives, and volunteer-led campaigns without losing individual page ownership.",
    icon: "team",
    category: "Community fundraising",
    features: ["Shared team fundraising", "Appeal-linked team standings", "Individual and group accountability"],
    primaryCta: "Explore team fundraising",
    href: "/teams",
    capabilities: ["fundraising", "ramadan", "mosques", "events"],
  },
  {
    title: "Ramadan Toolkit",
    slug: "ramadan-toolkit",
    shortDescription:
      "Support daily giving, last 10 nights campaigns, Zakat, Fidya, Fitrana and scheduled Ramadan donations.",
    longDescription:
      "Ramadan Toolkit brings together the parts of GiveKhair that matter most during the giving season: campaign pages, recurring giving, fundraising pages, fee clarity, and the operational reporting charities need when Ramadan activity moves fast.",
    icon: "ramadan",
    category: "Seasonal campaigns",
    features: ["Daily and scheduled giving", "Zakat and Ramadan campaign support", "Built on existing giving flows"],
    primaryCta: "Plan your Ramadan setup",
    href: "/contact",
    capabilities: ["donations", "fundraising", "reporting", "qr", "ramadan"],
  },
  {
    title: "Mosque Giving",
    slug: "mosque-giving",
    shortDescription:
      "Tools for masjid appeals, building funds, Jummah collections, project fundraising and community giving.",
    longDescription:
      "Mosque Giving is designed around recurring masjid needs like Jummah appeals, building projects, local community fundraising, and trust-rich giving flows that can move smoothly between mosque announcements, screens, print, and mobile.",
    icon: "mosque",
    category: "Community giving",
    features: ["Masjid campaign journeys", "Jummah and community fundraising", "Supports physical and digital giving"],
    primaryCta: "Speak to us",
    href: "/contact",
    capabilities: ["donations", "fundraising", "qr", "ramadan", "mosques", "events"],
  },
  {
    title: "Event Fundraising",
    slug: "event-fundraising",
    shortDescription:
      "Power charity dinners, sponsored walks, challenges, bike rides, hikes and community events.",
    longDescription:
      "Event Fundraising is a natural extension of GiveKhair's existing appeal, fundraiser, and team structures, giving charities a way to organise event-linked donation journeys and supporter pages without spinning up a separate toolset.",
    icon: "event",
    category: "Campaign activation",
    features: ["Event-linked fundraising pages", "Works with teams and personal pages", "Built for sponsor and challenge campaigns"],
    primaryCta: "Start an event campaign",
    href: "/fundraise/new",
    capabilities: ["donations", "fundraising", "qr", "events"],
  },
  {
    title: "Donor CRM Lite",
    slug: "donor-crm-lite",
    shortDescription:
      "View donor history, lifetime giving, donation preferences and supporter activity.",
    longDescription:
      "Donor CRM Lite sits closest to GiveKhair's existing donation and reporting data, helping charities review giving history, understand supporter activity, and build better follow-up processes from the operational tools they already use.",
    icon: "crm",
    category: "Operations",
    features: ["Donation history visibility", "Supporter activity context", "Built from live platform records"],
    primaryCta: "View your dashboard",
    href: "/dashboard",
    capabilities: ["donations", "reporting", "ramadan", "mosques", "events"],
  },
  {
    title: "White-label Giving Pages",
    slug: "white-label-giving-pages",
    shortDescription:
      "Let charities create branded donation journeys with custom styling, campaign branding and optional custom domains.",
    longDescription:
      "White-label Giving Pages extend GiveKhair's existing appeal and checkout foundations for charities that want stronger brand presence while keeping the same trusted giving infrastructure, reporting backbone, and campaign controls.",
    icon: "whiteLabel",
    category: "Brand experience",
    features: ["Branded campaign surfaces", "Optional custom-domain direction", "Keeps existing giving infrastructure"],
    primaryCta: "Book a demo",
    href: "/contact",
    capabilities: ["donations", "fundraising", "reporting", "ramadan", "mosques", "events"],
  },
];

export const forCharitiesNavLinks = [
  { href: "/for-charities/products", label: "Products" },
  { href: "/pricing", label: "Pricing" },
  { href: "/contact", label: "Contact" },
] as const;
