/** @type {import('next').NextConfig} */
const nextConfig = {
  // The SDK (public/sdk/bugreplay.js) is consumed by third-party demo sites,
  // so it must never be optimized or cached opaquely.
  async headers() {
    return [
      {
        source: "/sdk/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=300" },
          { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
