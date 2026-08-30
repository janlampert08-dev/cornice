import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
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
