/** @type {import('next').NextConfig} */
const nextConfig = {
    typescript: {
        ignoreBuildErrors: true,
    },
    transpilePackages: ['@privy-io/react-auth'],
    serverExternalPackages: ['pino', 'pino-pretty'],
    webpack: (config, { isServer }) => {
        if (!isServer) {
            config.resolve.fallback = {
                ...config.resolve.fallback,
                'pino': false,
                'pino-pretty': false,
            };
        }
        return config;
    },
}

module.exports = nextConfig
