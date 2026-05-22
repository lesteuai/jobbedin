import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // output: 'export'
  serverExternalPackages: ['pdf-parse', 'pdfjs-dist'],
};

export default nextConfig;
