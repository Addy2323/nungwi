/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['pg'],
  // Runtime storage and credentials are provisioned on the host, never bundled.
  outputFileTracingExcludes: {
    '/*': ['./backups/**/*', './data/**/*', './.env*'],
  },
  images: {
    localPatterns: [{ pathname: '/images/**' }, { pathname: '/uploads/**' }, { pathname: '/placeholder.svg' }],
    remotePatterns: ['vunjabeiliquorzanzibar.co.tz', ...(process.env.NEXT_PUBLIC_IMAGE_HOSTS || '').split(',').map(value => value.trim()).filter(Boolean)].map(hostname => ({ protocol: 'https', hostname })),
  },
  async headers() {
    return [{ source: '/:path(dashboard|customer|hotel|checkout|auth|login|signup|accept-invitation|reset-password|forgot-password|delivery|api)/:rest*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] }]
  },
}

export default nextConfig
