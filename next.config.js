/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // Privy lists @farcaster/mini-app-solana and @abstract-foundation/agw-client
    // as optional peer deps. We don't use Farcaster mini-apps or Abstract chain,
    // so stub them out to keep the bundle resolvable.
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@farcaster/mini-app-solana': false,
      '@abstract-foundation/agw-client': false,
      permissionless: false,
    };
    return config;
  },
};

module.exports = nextConfig;
