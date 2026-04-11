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
    remotePatterns: [
      { protocol: "https", hostname: "*.s3.amazonaws.com" },
      { protocol: "https", hostname: "uploadthing.com" },
      { protocol: "https", hostname: "*.supabase.co" },
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
