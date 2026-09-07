import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Setu - Smart Logistics & Accessibility Platform",
    short_name: "Setu",
    description:
      "AI-powered road risk monitoring and safe routing for India's North Eastern Region",
    start_url: "/",
    display: "standalone",
    background_color: "#F8FAFC",
    theme_color: "#0A6847",
    orientation: "any",
    categories: ["navigation", "government", "utilities"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
