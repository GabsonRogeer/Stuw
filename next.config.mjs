/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ['@sparticuz/chromium', 'puppeteer-core'],
  outputFileTracingIncludes: {
    '/api/jobs/email': ['./node_modules/@sparticuz/chromium/bin/**'],
  },
};

export default nextConfig;
