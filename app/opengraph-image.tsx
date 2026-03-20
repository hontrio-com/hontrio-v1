import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Hontrio — A complete ecosystem for your online store'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
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
        {/* Background grid */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />

        {/* Glow */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 700,
            height: 400,
            background: 'radial-gradient(ellipse, rgba(99,102,241,0.15) 0%, transparent 70%)',
            borderRadius: '50%',
          }}
        />

        {/* Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(99,102,241,0.15)',
            border: '1px solid rgba(99,102,241,0.4)',
            borderRadius: 100,
            padding: '6px 16px',
            marginBottom: 32,
          }}
        >
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#818cf8' }} />
          <span style={{ color: '#a5b4fc', fontSize: 16, fontWeight: 600 }}>
            Powered by AI &amp; Smart Automation
          </span>
        </div>

        {/* Logo / Brand name */}
        <div
          style={{
            fontSize: 88,
            fontWeight: 800,
            color: '#ffffff',
            letterSpacing: -3,
            lineHeight: 1,
            marginBottom: 24,
          }}
        >
          HONTRIO
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 24,
            color: 'rgba(255,255,255,0.5)',
            textAlign: 'center',
            maxWidth: 780,
            lineHeight: 1.6,
          }}
        >
          A complete ecosystem for your online store,
          <br />
          powered by artificial intelligence and smart automation.
        </div>

        {/* Features row */}
        <div
          style={{
            display: 'flex',
            gap: 16,
            marginTop: 48,
          }}
        >
          {['AI Text', 'SEO Optimizer', 'AI Images', 'Risk Shield', 'AI Agent'].map((f) => (
            <div
              key={f}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8,
                padding: '8px 16px',
                color: 'rgba(255,255,255,0.7)',
                fontSize: 15,
                fontWeight: 500,
              }}
            >
              {f}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  )
}
