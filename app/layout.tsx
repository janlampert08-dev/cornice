import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cornice",
  description: "Kuratierte Fahrstrecken für Auto und Motorrad",
  manifest: "/manifest.json",
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
    <html lang="de" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
