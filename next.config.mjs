/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['pg'],
  // Runtime storage and credentials are provisioned on the host, never bundled.
  outputFileTracingExcludes: {
    '/*': ['./backups/**/*', './data/**/*', './.env*'],
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
