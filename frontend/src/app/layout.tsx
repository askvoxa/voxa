import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

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
      <body className="font-sans overflow-x-hidden antialiased bg-[#0e0e0e] sm:bg-[#080808] flex justify-center text-gray-900 min-h-screen">
        <div className="hidden sm:block fixed inset-0 z-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[-10%] left-[10%] w-[40vw] h-[40vh] bg-pink-600/10 blur-[120px] rounded-full" />
          <div className="absolute bottom-[-10%] right-[10%] w-[40vw] h-[40vh] bg-orange-500/10 blur-[120px] rounded-full" />
        </div>
        
        <main className="w-full sm:max-w-[480px] min-h-screen bg-white relative z-10 shadow-2xl flex flex-col">
          {children}
        </main>
      </body>
    </html>
  )
}
