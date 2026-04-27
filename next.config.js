const isDev = process.env.NODE_ENV !== "production";

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://js.stripe.com${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.s3.amazonaws.com https://uploadthing.com https://*.supabase.co https://images.unsplash.com https://awet.org.uk https://lh3.googleusercontent.com https://*.googleusercontent.com https://*.stripe.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  `connect-src 'self' https://api.stripe.com https://js.stripe.com https://uploadthing.com https://*.uploadthing.com https://*.googleapis.com https://*.gstatic.com${isDev ? " ws: http://localhost:*" : ""}`,
  "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com https://accounts.google.com",
  "form-action 'self' https://checkout.stripe.com https://accounts.google.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: [
      "@prisma/client",
      "bullmq",
      "ioredis",
      "bcryptjs",
    ],
  },
  images: {
    // Public fundraising pages rely on remotely hosted assets that charities
    // enter in admin. We keep this list explicit so the image optimizer stays
    // predictable, while still covering the providers used across seeded data
    // and current charity content.
    remotePatterns: [
      { protocol: "https", hostname: "*.s3.amazonaws.com" },
      { protocol: "https", hostname: "uploadthing.com" },
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "awet.org.uk" },
    ],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push("bullmq", "ioredis");
    }
    return config;
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: contentSecurityPolicy.replace(/\s{2,}/g, " ").trim(),
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
