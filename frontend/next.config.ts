import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Security headers - enforced on every response
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=(self)",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline' fonts.googleapis.com",
              "font-src 'self' fonts.gstatic.com",
              "img-src 'self' blob: data: *.tile.openstreetmap.org *.supabase.co",
              "connect-src 'self' *.supabase.co wss://*.supabase.co",
              "worker-src 'self' blob:",
              "frame-src 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },

  // Allow OSM tile images
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.tile.openstreetmap.org",
      },
    ],
  },
};

export default nextConfig;
