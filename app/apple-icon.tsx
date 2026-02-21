import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const contentType = 'image/png'
export const size = { width: 180, height: 180 }

export default function AppleTouchIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          background: 'linear-gradient(135deg, #1a1a2e 0%, #0d0d16 100%)',
          borderRadius: 40,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* 家のシルエット */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          position: 'absolute',
          top: 24,
          left: 18,
        }}>
          {/* 屋根 */}
          <div style={{
            width: 0, height: 0,
            borderLeft: '38px solid transparent',
            borderRight: '38px solid transparent',
            borderBottom: '32px solid rgba(255,255,255,0.95)',
          }} />
          {/* 壁 */}
          <div style={{
            width: 60, height: 44,
            background: 'rgba(255,255,255,0.95)',
            borderRadius: '0 0 3px 3px',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            paddingBottom: 0,
          }}>
            <div style={{
              width: 16, height: 22,
              background: '#1a1a2e',
              borderRadius: '4px 4px 0 0',
            }} />
          </div>
        </div>

        {/* グラフライン */}
        <svg
          style={{ position: 'absolute', bottom: 28, right: 12 }}
          width="90" height="70"
          viewBox="0 0 90 70"
        >
          <polyline
            points="5,62 25,48 45,36 65,22 85,8"
            fill="none"
            stroke="#30d158"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="85" cy="8" r="5" fill="#30d158" />
        </svg>

        {/* テキスト */}
        <div style={{
          position: 'absolute',
          bottom: 14,
          left: 0, right: 0,
          textAlign: 'center',
          color: '#fff',
          fontSize: 20,
          fontWeight: 700,
          letterSpacing: '-0.5px',
        }}>
          BuyRent
        </div>
      </div>
    ),
    { ...size }
  )
}
