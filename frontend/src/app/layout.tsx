import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Setu - Smart Logistics & Accessibility Platform",
    template: "%s | Setu",
  },
  description:
    "AI-powered logistics intelligence platform for India's North Eastern Region. Real-time road risk monitoring, safe routing, and accessibility tracking for NER districts.",
  keywords: [
    "logistics",
    "NER",
    "North East India",
    "road safety",
    "GIS",
    "accessibility",
    "Meghalaya",
    "smart transport",
  ],
  authors: [{ name: "Setu Team" }],
  openGraph: {
    title: "Setu - Smart Logistics & Accessibility Platform",
    description:
      "Real-time road risk monitoring and safe routing for India's North Eastern Region.",
    type: "website",
    locale: "en_IN",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0A6847" },
    { media: "(prefers-color-scheme: dark)", color: "#064E3B" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
