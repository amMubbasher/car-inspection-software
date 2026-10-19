import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  // images: {
  //   domains: ['res.cloudinary.com'], //  Allow Cloudinary images
  // },
 eslint: {
    ignoreDuringBuilds: true,
  },
  poweredByHeader: false,
  serverExternalPackages: ["puppeteer-core", "@sparticuz/chromium"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async redirects() {
    return [
      { source: "/admin/dashboard/add-user", destination: "/dashboard/users", permanent: true },
      { source: "/admin/dashboard", destination: "/dashboard", permanent: true },
      { source: "/admin/dashboard/:path*", destination: "/dashboard/:path*", permanent: true },
      { source: "/team/dashboard", destination: "/dashboard", permanent: true },
      { source: "/team/dashboard/:path*", destination: "/dashboard", permanent: true },
    ];
  },
};

export default nextConfig;
