import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  experimental: {
    serverActions: {
      // Next's default (1 MB) is below the 4 MB limit uploadAvatar() itself
      // enforces (lib/actions/profile.ts), so any real photo over ~1 MB was
      // rejected with a raw 413 before that friendlier check ever ran.
      bodySizeLimit: "5mb",
    },
  },
  images: {
    // Hochgeladene Fotos/Avatare liegen in Supabase Storage (öffentliche
    // Bucket-URLs) — auf den Storage-Pfad eingeschränkt statt den ganzen
    // Host freizugeben.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
