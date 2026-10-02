import type { NextConfig } from 'next';
// TypeScript runs as an explicit CI step; Next's CLI showConfig subprocess is unreliable in WSL.
const nextConfig: NextConfig = { transpilePackages: ['@dara/shared'], output: 'standalone', typescript: { ignoreBuildErrors: true } };
export default nextConfig;
