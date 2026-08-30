import type { MetadataRoute } from "next";
import { getOrigin } from "@/lib/utils/url";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const origin = await getOrigin();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Auth-/Einstellungs-/Moderationsbereiche sind nicht öffentlich
      // teilbar und bringen für die Indexierung keinen Wert.
      disallow: ["/profil", "/moderation", "/api"],
    },
    sitemap: `${origin}/sitemap.xml`,
  };
}
