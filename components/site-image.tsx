'use client'

import Image, { type ImageProps } from 'next/image'
import { useState } from 'react'

const hosts = ['vunjabeiliquorzanzibar.co.tz', ...(process.env.NEXT_PUBLIC_IMAGE_HOSTS || '').split(',').map(s => s.trim()).filter(Boolean)]

export default function SiteImage({ src, alt, width = 640, height = 640, sizes = '(max-width: 760px) 50vw, 320px', ...props }: ImageProps) {
  const [failedSource, setFailedSource] = useState<ImageProps['src'] | null>(null)
  const legacyPlaceholder = typeof src === 'string' && (/^\/placeholder(?:-logo|-user)?\.(svg|png|jpg)$/.test(src))
  const source = failedSource === src || !src || legacyPlaceholder ? '/logo.png' : src
  let direct = typeof source === 'string' && /^(data:|blob:)|\.svg(?:\?|$)/i.test(source)
  if (typeof source === 'string' && /^https?:\/\//i.test(source)) {
    const url = new URL(source)
    direct ||= url.protocol !== 'https:' || !hosts.includes(url.hostname)
  }
  return <Image {...props} src={source} alt={alt} width={props.fill ? undefined : width} height={props.fill ? undefined : height} sizes={sizes} unoptimized={props.unoptimized || direct} onError={event => { setFailedSource(src); props.onError?.(event) }}/>
}
