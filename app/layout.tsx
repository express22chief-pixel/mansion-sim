import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'マンション購入 vs 賃貸＋投資 シミュレーター',
  description: '東京のマンション購入と賃貸＋インデックス投資を10年間で徹底比較',
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
