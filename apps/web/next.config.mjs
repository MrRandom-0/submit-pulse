/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: [
    "@submitpulse/ui",
    "@submitpulse/config",
    "@submitpulse/auth",
    "@submitpulse/database",
    "@submitpulse/validation",
    "@submitpulse/billing",
  ],
  typedRoutes: true,
  webpack(config) {
    // Workspace packages author imports with NodeNext-style ".js"
    // specifiers that point at ".ts" sources; teach webpack that mapping.
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
};
export default nextConfig;
