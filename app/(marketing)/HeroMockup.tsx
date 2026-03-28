'use client'

import { useState, useEffect, useRef } from 'react'

type Locale = 'en' | 'ro'

const CONTENT = {
  en: {
    agentLabel: 'AI Agent',
    imagesLabel: 'AI Images',
    seoLabel: 'SEO Score',
    riskLabel: 'Risk Shield',
    imagesUnit: 'generated this month',
    seoUnit: 'avg. across 148 products',
    riskUnit: 'suspicious orders blocked',
    connected: 'WooCommerce connected',
    synced: '148 products synced',
    userMsg: 'Do you have this in matte white?',
    botMsg: 'Yes! Available in matte white. 899 RON · In stock ✓',
    placeholder: 'Ask about your store…',
    badge18: '+18%',
    improved: 'Improved',
  },
  ro: {
    agentLabel: 'Agent AI',
    imagesLabel: 'Imagini AI',
    seoLabel: 'Scor SEO',
    riskLabel: 'Risk Shield',
    imagesUnit: 'generate luna aceasta',
    seoUnit: 'medie pe 148 produse',
    riskUnit: 'comenzi suspecte blocate',
    connected: 'WooCommerce conectat',
    synced: '148 produse sincronizate',
    userMsg: 'Aveți dulapul acesta în alb mat?',
    botMsg: 'Da! Disponibil în alb mat. 899 RON · În stoc ✓',
    placeholder: 'Întreabă despre magazinul tău…',
    badge18: '+18%',
    improved: 'Îmbunătățit',
  },
}

function useCountUp(target: number, duration: number, active: boolean) {
  const [value, setValue] = useState(0)
  const ref = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    if (!active) return
    setValue(0)
    let cur = 0
    const steps = Math.ceil(duration / 16)
    const inc = target / steps
    ref.current = setInterval(() => {
      cur += inc
      if (cur >= target) { setValue(target); clearInterval(ref.current!) }
      else setValue(Math.floor(cur))
    }, 16)
    return () => clearInterval(ref.current!)
  }, [target, duration, active])
  return value
}

export default function HeroMockup({ locale = 'en' }: { locale?: Locale }) {
  const c = CONTENT[locale]
  const [active, setActive] = useState(false)
  const [seoWidth, setSeoWidth] = useState(0)
  const [chatStep, setChatStep] = useState(0)

  const images = useCountUp(2481, 1400, active)
  const seoNum = useCountUp(94, 1600, active)
  const risk   = useCountUp(12, 900, active)

  useEffect(() => {
    const t0 = setTimeout(() => setActive(true), 300)
    const t1 = setTimeout(() => setSeoWidth(78), 700)
    const t2 = setTimeout(() => setChatStep(1), 700)
    const t3 = setTimeout(() => setChatStep(2), 1600)
    return () => [t0, t1, t2, t3].forEach(clearTimeout)
  }, [])

  const sparkline = [28, 44, 36, 58, 48, 72, 60, 88, 74, 100]

  return (
    <div className="w-full max-w-[680px] mx-auto select-none">
      <div
        style={{
          background: '#fff',
          border: '1px solid #e0e0e0',
          borderRadius: 14,
          overflow: 'hidden',
          boxShadow: '0 2px 4px rgba(0,0,0,0.04), 0 12px 40px rgba(0,0,0,0.09), 0 40px 80px rgba(0,0,0,0.06)',
        }}
      >
        {/* Title bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '11px 16px',
            background: '#f5f5f5',
            borderBottom: '1px solid #e8e8e8',
          }}
        >
          <div style={{ display: 'flex', gap: 6 }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#FF5F57' }} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#FEBC2E' }} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#28C840' }} />
          </div>
          <span style={{ marginLeft: 12, fontSize: 12, fontWeight: 500, color: '#aaa' }}>
            Hontrio — Dashboard
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
            {['Images', 'SEO', 'Agent', 'Risk'].map((tab, i) => (
              <div
                key={tab}
                style={{
                  fontSize: 11,
                  padding: '3px 10px',
                  borderRadius: 6,
                  background: i === 0 ? '#111' : 'transparent',
                  color: i === 0 ? '#fff' : '#aaa',
                  fontWeight: 500,
                }}
              >
                {tab}
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: 16 }}>

          {/* Left — stats */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

            {/* Images */}
            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={label}>{c.imagesLabel}</span>
                <span style={badgeGreen}>{c.badge18} ↑</span>
              </div>
              <span style={{ fontSize: 30, fontWeight: 700, color: '#111', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                {images.toLocaleString('en-US')}
              </span>
              <div style={{ fontSize: 11, color: '#bbb', marginTop: 4 }}>{c.imagesUnit}</div>
              {/* Sparkline */}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 24, marginTop: 10 }}>
                {sparkline.map((h, i) => (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      borderRadius: 2,
                      background: active ? (i === sparkline.length - 1 ? '#111' : '#e0e0e0') : '#f0f0f0',
                      height: active ? `${h}%` : '20%',
                      transition: active ? `height 0.5s ${i * 0.04}s ease, background 0.3s ease` : 'none',
                    }}
                  />
                ))}
              </div>
            </div>

            {/* SEO */}
            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={label}>{c.seoLabel}</span>
                <span style={{ fontSize: 22, fontWeight: 700, color: '#111', lineHeight: 1 }}>
                  {seoNum}
                  <span style={{ fontSize: 12, color: '#ccc', fontWeight: 400 }}>/100</span>
                </span>
              </div>
              <div style={{ height: 5, borderRadius: 99, background: '#f0f0f0', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${seoWidth}%`,
                    borderRadius: 99,
                    background: '#111',
                    transition: 'width 1.2s cubic-bezier(0.4,0,0.2,1)',
                  }}
                />
              </div>
              <div style={{ fontSize: 11, color: '#bbb', marginTop: 5 }}>{c.seoUnit}</div>
            </div>

            {/* Risk */}
            <div
              style={{
                ...card,
                background: active ? '#fff8f8' : '#fafafa',
                borderColor: active ? '#f5d0d0' : '#ebebeb',
                transition: 'background 0.5s ease, border-color 0.5s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#e44', flexShrink: 0 }} />
                <span style={label}>{c.riskLabel}</span>
              </div>
              <span style={{ fontSize: 30, fontWeight: 700, color: '#111', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                {risk}
              </span>
              <div style={{ fontSize: 11, color: '#e44', marginTop: 4, opacity: active ? 1 : 0, transition: 'opacity 0.5s ease' }}>
                {c.riskUnit}
              </div>
            </div>
          </div>

          {/* Right — AI Agent */}
          <div
            style={{
              borderRadius: 10,
              border: '1px solid #ebebeb',
              background: '#fafafa',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: '11px 14px',
                borderBottom: '1px solid #ebebeb',
                background: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span style={label}>{c.agentLabel}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div
                  style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: '#22c55e',
                    animation: 'blink 2s ease-in-out infinite',
                  }}
                />
                <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 600 }}>Live</span>
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, padding: '14px 14px 10px', display: 'flex', flexDirection: 'column', gap: 10, justifyContent: 'flex-end' }}>
              {chatStep === 0 && (
                <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-start' }}>
                  {[0, 120, 240].map((d) => (
                    <div key={d} style={{ width: 6, height: 6, borderRadius: '50%', background: '#ddd', animation: `blink 1s ${d}ms ease-in-out infinite` }} />
                  ))}
                </div>
              )}
              {chatStep >= 1 && (
                <div
                  style={{
                    alignSelf: 'flex-end',
                    maxWidth: '90%',
                    padding: '9px 13px',
                    borderRadius: '14px 14px 3px 14px',
                    background: '#111',
                    color: '#fff',
                    fontSize: 12.5,
                    lineHeight: 1.5,
                    animation: 'heroFadeUp 0.3s ease both',
                  }}
                >
                  {c.userMsg}
                </div>
              )}
              {chatStep >= 2 && (
                <div
                  style={{
                    alignSelf: 'flex-start',
                    maxWidth: '90%',
                    padding: '9px 13px',
                    borderRadius: '14px 14px 14px 3px',
                    background: '#fff',
                    border: '1px solid #e8e8e8',
                    color: '#111',
                    fontSize: 12.5,
                    lineHeight: 1.5,
                    animation: 'heroFadeUp 0.3s ease both',
                  }}
                >
                  {c.botMsg}
                </div>
              )}
            </div>

            {/* Input */}
            <div style={{ padding: '0 14px 14px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  borderRadius: 8,
                  background: '#fff',
                  border: '1px solid #e8e8e8',
                }}
              >
                <span style={{ fontSize: 12, color: '#ccc', flex: 1 }}>{c.placeholder}</span>
                <div
                  style={{
                    width: 22, height: 22, borderRadius: '50%',
                    background: '#111',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}
                >
                  <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                    <path d="M1.5 4.5h6M4.5 1.5l3 3-3 3" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Status bar */}
        <div
          style={{
            padding: '9px 16px',
            borderTop: '1px solid #f0f0f0',
            background: '#fafafa',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Dot color="#22c55e" label={c.connected} />
            <Dot color="#3b82f6" label={c.synced} />
          </div>
          <span style={{ fontSize: 11, color: '#ccc', fontWeight: 500 }}>hontrio.com</span>
        </div>
      </div>
    </div>
  )
}

const card: React.CSSProperties = {
  borderRadius: 10,
  padding: '13px 14px',
  background: '#fafafa',
  border: '1px solid #ebebeb',
}

const label: React.CSSProperties = {
  fontSize: 10.5,
  fontWeight: 600,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: '#bbb',
}

const badgeGreen: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  padding: '2px 8px',
  borderRadius: 99,
  background: '#f0faf4',
  color: '#16a34a',
  border: '1px solid #bbf7d0',
}

function Dot({ color, label: lbl }: { color: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{ width: 5, height: 5, borderRadius: '50%', background: color }} />
      <span style={{ fontSize: 11, color: '#bbb' }}>{lbl}</span>
    </div>
  )
}
