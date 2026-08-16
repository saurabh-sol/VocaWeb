import type { NextConfig } from 'next';

const crossOriginIsolationHeaders = [
  { key: 'Cross-Origin-Embedder-Policy', value: 'credentialless' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
];

const nextConfig: NextConfig = {
  webpack: (config, { webpack }) => {
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ['**/node_modules/**', '**/.git/**'],
    };
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(
        /@solana-program\/(memo|token)/,
        require.resolve('./src/lib/solana-shim.js'),
      ),
    );
    return config;
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: crossOriginIsolationHeaders,
      },
    ];
  },
};

export default nextConfig;
