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
  experimental: { typedRoutes: true },
};
export default nextConfig;
