/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow importing the Howler audio library which uses browser globals
  // eslint-disable-next-line no-unused-vars
  webpack(config, { isServer }) {
    if (isServer) {
      // Howler and audio APIs are browser-only – never bundle for the server
      config.externals = [
        ...(config.externals || []),
        { howler: 'Howl' },
      ];
    }
    return config;
  },

  // Expose environment variables to the browser bundle
  env: {
    NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL || '',
  },

  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
