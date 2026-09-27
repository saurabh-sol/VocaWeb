import type { NextConfig } from 'next';
import path from 'path';

/**
 * The in-browser sandbox (WebContainer) needs cross-origin isolation. It is scoped to the
 * app so the landing and sign-in pages stay free to load third-party frames.
 */
const crossOriginIsolationHeaders = [
  { key: 'Cross-Origin-Embedder-Policy', value: 'credentialless' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
];

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname, '../../'),
  webpack: (config) => {
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ['**/node_modules/**', '**/.git/**'],
    };
    return config;
  },
  async headers() {
    return [
      { source: '/app', headers: crossOriginIsolationHeaders },
      { source: '/app/:path*', headers: crossOriginIsolationHeaders },
    ];
  },
};

export default nextConfig;
