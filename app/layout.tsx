import type { Metadata, Viewport } from 'next'
import './globals.css'

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export const metadata: Metadata = {
  title: 'BuyRent',
  description: 'マンション購入 vs 賃貸＋投資シミュレーター。東京23区の高騰するマンション市況で、購入と賃貸＋インデックス投資どちらが有利かを計算。',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'BuyRent',
  },
  openGraph: {
    title: 'BuyRent',
    description: 'マンション購入 vs 賃貸＋投資シミュレーター',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  )
}
