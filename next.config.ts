import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // images: {
  //   domains: ['res.cloudinary.com'], //  Allow Cloudinary images
  // },
 eslint: {
    ignoreDuringBuilds: true,
  },
  serverExternalPackages: ["puppeteer-core", "@sparticuz/chromium"],
};

export default nextConfig;
