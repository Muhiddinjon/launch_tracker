import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable React Strict Mode for better development experience
  reactStrictMode: true,

  // Optimize images
  images: {
    formats: ['image/avif', 'image/webp'],
  },

  // Production optimizations
  poweredByHeader: false,

  // TypeScript configuration
  typescript: {
    // Set to true to ignore build errors (not recommended for production)
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
