import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    serverActions: {
      bodySizeLimit: "15mb"
    },
    staleTimes: {
      dynamic: 30,
      static: 180
    }
  }
};

export default nextConfig;
