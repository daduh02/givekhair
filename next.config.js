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
};

module.exports = nextConfig;
