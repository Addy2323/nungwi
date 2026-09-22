'use client'

import { useEffect, useState } from 'react'
import LoadingScreen from './loading-screen'

export default function StartupLoader() {
  const [ready, setReady] = useState(false)
  // The server and first client render agree. No timer delays an already-ready app.
  useEffect(() => { setReady(true) }, [])
  if (ready) return null
  return <div id="startup-loader"><LoadingScreen /></div>
}
