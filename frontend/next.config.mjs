import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: process.env.CAPACITOR_BUILD === '1' ? 'export' : 'standalone',
  images: {
    unoptimized: process.env.CAPACITOR_BUILD === '1',
  },
};

export default nextConfig;
