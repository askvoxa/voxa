import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import GoogleAnalytics from '@/components/GoogleAnalytics'

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'VOXA | Monetize sua Influência',
  description: 'Fãs pagam para enviar perguntas a criadores de conteúdo com garantia de resposta. Monetize sua audiência com a VOXA.',
  openGraph: {
    title: 'VOXA | Monetize sua Influência',
    description: 'Fãs pagam para enviar perguntas a criadores de conteúdo com garantia de resposta.',
    siteName: 'VOXA',
    locale: 'pt_BR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VOXA | Monetize sua Influência',
    description: 'Fãs pagam para enviar perguntas a criadores de conteúdo com garantia de resposta.',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export const viewport: Viewport = {
  themeColor: '#0A0A0F',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className="min-h-screen font-sans overflow-x-hidden antialiased bg-gray-50 text-gray-900 flex flex-col">
        <GoogleAnalytics />
        {children}
      </body>
    </html>
  )
}
