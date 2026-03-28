import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Hontrio — Platforma AI pentru magazine online'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#0a0a0a',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Subtle grid */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />

        {/* Top accent line */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: '20%',
            right: '20%',
            height: 2,
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
          }}
        />

        {/* Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 100,
            padding: '6px 20px',
            marginBottom: 36,
          }}
        >
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />
          <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15, fontWeight: 500 }}>
            AI Growth Platform pentru eCommerce
          </span>
        </div>

        {/* Brand name */}
        <div
          style={{
            fontSize: 96,
            fontWeight: 800,
            color: '#ffffff',
            letterSpacing: -4,
            lineHeight: 1,
            marginBottom: 20,
          }}
        >
          HONTRIO
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 22,
            color: 'rgba(255,255,255,0.4)',
            textAlign: 'center',
            maxWidth: 700,
            lineHeight: 1.5,
            marginBottom: 56,
          }}
        >
          Imagini AI · SEO automat · Agent de vanzari · Protectie comenzi
        </div>

        {/* Feature pills */}
        <div style={{ display: 'flex', gap: 12 }}>
          {['AI Images', 'SEO Optimizer', 'AI Agent', 'Risk Shield'].map((f) => (
            <div
              key={f}
              style={{
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10,
                padding: '10px 20px',
                color: 'rgba(255,255,255,0.65)',
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              {f}
            </div>
          ))}
        </div>

        {/* Bottom: hontrio.com */}
        <div
          style={{
            position: 'absolute',
            bottom: 32,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgba(255,255,255,0.2)' }} />
          <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>hontrio.com</span>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgba(255,255,255,0.2)' }} />
        </div>
      </div>
    ),
    { ...size }
  )
}
