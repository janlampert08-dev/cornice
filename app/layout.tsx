import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Inter } from "next/font/google";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// Für tabellarische Zahlen (Ränge, km, Höhenmeter) — Instrument-Cluster-artige
// Präzision statt Inter als De-facto-Mono-Attrappe (siehe globals.css).
const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["500", "600"],
});

// Für die Auflösung relativer URLs in opengraph-image/twitter-image nötig
// (sonst Next-Build-Warnung, Fallback auf localhost). VERCEL_PROJECT_PRODUCTION_URL
// ist die stabile Produktions-Domain, von Vercel automatisch gesetzt.
const metadataBase = new URL(
  process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000",
);

export const metadata: Metadata = {
  metadataBase,
  title: "Cornice",
  description: "Kuratierte Fahrstrecken für Auto und Motorrad",
  appleWebApp: {
    // "standalone" entfernt die Safari-Chrome, sobald die Seite via
    // "Zum Home-Bildschirm" installiert ist — Grundvoraussetzung dafür,
    // dass sich die App wie eine native iOS-App anfühlt statt wie eine
    // im Browser geöffnete Website.
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Cornice",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Lässt den Seiteninhalt bis unter Notch/Dynamic Island bzw. Home-Indicator
  // laufen — erst dadurch greifen die env(safe-area-inset-*)-Werte, die
  // globals.css und die Bottom-Nav für Abstände dort nutzen.
  viewportFit: "cover",
  themeColor: "#FAFAFA",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="de"
      className={`${inter.variable} ${ibmPlexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
