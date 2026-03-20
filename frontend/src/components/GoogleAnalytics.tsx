'use client'

import Script from 'next/script'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'
import { GA_ID } from '@/lib/analytics'

/**
 * Rastreia page_view em cada navegação SPA (soft navigation do App Router).
 * O gtag config inicial cobre a primeira página; este componente cobre as demais.
 */
function AnalyticsPageView() {
  const pathname = usePathname()

  useEffect(() => {
    if (typeof window.gtag !== 'function') return
    window.gtag('config', GA_ID, { page_path: pathname })
  }, [pathname])

  return null
}

export default function GoogleAnalytics() {
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}');
        `}
      </Script>
      <AnalyticsPageView />
    </>
  )
}
