import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Default is 1MB, too small once sign-up carries an ID copy, a CAA
    // licence PDF and a profile picture in one submit. 25MB covers three
    // uploads comfortably under the 10MB-per-file cap in lib/uploads.ts.
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
