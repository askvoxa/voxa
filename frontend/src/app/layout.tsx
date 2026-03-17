import type { Metadata, Viewport } from 'next'
import './globals.css'

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
  themeColor: '#050505',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-gray-50">{children}</body>
    </html>
  )
}
