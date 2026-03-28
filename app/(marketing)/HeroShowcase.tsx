'use client'

import { useState, useEffect } from 'react'

type Locale = 'en' | 'ro'

const SLIDE_DURATION = 3200
const SLIDES = 4

const CONTENT = {
  en: {
    labels: ['AI Images', 'SEO Optimizer', 'AI Agent', 'Risk Shield'],
    seoAfter: 'Matte white wall-mounted bathroom cabinet with decorative niche',
    agentUser: 'Do you have this cabinet in matte white?',
    agentBot: 'Yes! Available in matte white. 899 RON, in stock.',
    before: 'Before',
    after: 'After',
    generated: 'Generated in 4s',
    scoreLabel: 'SEO Score',
    improved: 'Improved',
    alertHigh: 'High risk — 5 undelivered orders',
    alertMed: 'Review — duplicate phone numbers',
    detected: '2 suspicious orders detected today',
  },
  ro: {
    labels: ['Imagini AI', 'SEO Optimizer', 'Agent AI', 'Risk Shield'],
    seoAfter: 'Dulap baie suspendat alb mat, modern, cu nișă decorativă',
    agentUser: 'Aveți dulapul acesta în alb mat?',
    agentBot: 'Da! Disponibil în alb mat. 899 RON, în stoc.',
    before: 'Înainte',
    after: 'După',
    generated: 'Generat în 4s',
    scoreLabel: 'Scor SEO',
    improved: 'Îmbunătățit',
    alertHigh: 'Risc ridicat — 5 comenzi neridicate',
    alertMed: 'Atenție — numere de telefon duplicate',
    detected: '2 comenzi suspecte detectate azi',
  },
}

export default function HeroShowcase({ locale }: { locale: Locale }) {
  const [slide, setSlide]       = useState(0)
  const [visible, setVisible]   = useState(true)
  const [progress, setProgress] = useState(0)
  const [seoScore, setSeoScore] = useState(62)

  const c = CONTENT[locale]

  // Cycle slides with fade transition
  useEffect(() => {
    const timer = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setSlide(s => (s + 1) % SLIDES)
        setProgress(0)
        setVisible(true)
      }, 350)
    }, SLIDE_DURATION)
    return () => clearInterval(timer)
  }, [])

  // Progress bar
  useEffect(() => {
    setProgress(0)
    const tick = 50
    const steps = SLIDE_DURATION / tick
    let current = 0
    const id = setInterval(() => {
      current++
      setProgress(Math.min((current / steps) * 100, 100))
    }, tick)
    return () => clearInterval(id)
  }, [slide])

  // SEO score animation on slide 1
  useEffect(() => {
    if (slide !== 1) return
    setSeoScore(62)
    let val = 62
    const id = setInterval(() => {
      val = Math.min(val + 1, 91)
      setSeoScore(val)
      if (val >= 91) clearInterval(id)
    }, 28)
    return () => clearInterval(id)
  }, [slide])

  return (
    <div className="w-full max-w-[420px] mx-auto select-none">

      {/* Card */}
      <div
        className="rounded-2xl border border-neutral-200 bg-white shadow-[0_8px_32px_rgba(0,0,0,0.07)] overflow-hidden transition-all duration-350"
        style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(6px)', transition: 'opacity 0.35s ease, transform 0.35s ease' }}
      >
        {/* Feature label */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-neutral-100">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-neutral-900" />
            <span className="text-[13px] font-semibold text-neutral-900">{c.labels[slide]}</span>
          </div>
          <span className="text-[11px] font-medium text-neutral-400">{slide + 1} / {SLIDES}</span>
        </div>

        {/* Slide content */}
        <div className="px-5 py-5 min-h-[200px] flex flex-col justify-center">

          {/* Slide 0 — AI Images */}
          {slide === 0 && (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                {/* Before */}
                <div className="relative rounded-xl overflow-hidden aspect-[4/3] bg-neutral-100 border border-neutral-200">
                  <span className="absolute top-2 left-2 text-[10px] font-semibold px-2 py-0.5 bg-white/90 border border-neutral-200 rounded-full text-neutral-600">{c.before}</span>
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="w-10 h-14 rounded-lg bg-neutral-300/70" />
                  </div>
                </div>
                {/* After */}
                <div className="relative rounded-xl overflow-hidden aspect-[4/3] bg-gradient-to-br from-neutral-50 to-white border border-neutral-200">
                  <span className="absolute top-2 left-2 text-[10px] font-semibold px-2 py-0.5 bg-white/90 border border-neutral-200 rounded-full text-neutral-600">{c.after}</span>
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="w-10 h-14 rounded-lg bg-white shadow-[0_6px_18px_rgba(0,0,0,0.13)]" />
                  </div>
                </div>
              </div>
              <p className="text-[12px] text-neutral-400 text-center">{c.generated}</p>
            </div>
          )}

          {/* Slide 1 — SEO */}
          {slide === 1 && (
            <div className="flex flex-col gap-4">
              <div className="flex items-end gap-2">
                <span className="text-[52px] font-black leading-none tracking-tighter text-neutral-900">{seoScore}</span>
                <span className="text-[14px] text-neutral-400 mb-2">/100</span>
                <span className="ml-auto text-[11px] font-semibold px-2.5 py-1 rounded-full bg-neutral-100 text-neutral-600 mb-2">{c.improved}</span>
              </div>
              <div className="w-full h-2 rounded-full bg-neutral-100 overflow-hidden">
                <div
                  className="h-full bg-neutral-900 rounded-full transition-[width] duration-300 ease-out"
                  style={{ width: `${seoScore}%` }}
                />
              </div>
              <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-1">{c.scoreLabel}</p>
                <p className="text-[13px] font-semibold text-neutral-900 leading-snug">{c.seoAfter}</p>
              </div>
            </div>
          )}

          {/* Slide 2 — AI Agent */}
          {slide === 2 && (
            <div className="flex flex-col gap-2.5">
              <div className="self-end max-w-[85%] px-3.5 py-2.5 rounded-2xl rounded-br-sm bg-neutral-900 text-white text-[13px] leading-snug">
                {c.agentUser}
              </div>
              <div className="self-start max-w-[85%] px-3.5 py-2.5 rounded-2xl rounded-bl-sm bg-neutral-100 text-neutral-800 text-[13px] leading-snug">
                {c.agentBot}
              </div>
              <div className="mt-1 flex items-center gap-2 self-start px-3 py-2 rounded-xl bg-neutral-50 border border-neutral-200">
                <div className="w-7 h-7 rounded-lg bg-neutral-200 shrink-0" />
                <div>
                  <p className="text-[12px] font-semibold text-neutral-900">899 RON</p>
                  <p className="text-[10.5px] text-green-600 font-medium">In stock</p>
                </div>
              </div>
            </div>
          )}

          {/* Slide 3 — Risk Shield */}
          {slide === 3 && (
            <div className="flex flex-col gap-2.5">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-red-50 border border-red-100">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 mt-1 shrink-0" />
                <p className="text-[12.5px] font-medium text-neutral-800 leading-snug">{c.alertHigh}</p>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 border border-amber-100">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 mt-1 shrink-0" />
                <p className="text-[12.5px] font-medium text-neutral-800 leading-snug">{c.alertMed}</p>
              </div>
              <p className="text-[11.5px] text-neutral-400 pl-1 mt-1">{c.detected}</p>
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div className="h-[3px] bg-neutral-100">
          <div
            className="h-full bg-neutral-900 transition-none"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Dots indicator */}
      <div className="flex items-center justify-center gap-1.5 mt-4">
        {Array.from({ length: SLIDES }).map((_, i) => (
          <button
            key={i}
            onClick={() => { setVisible(false); setTimeout(() => { setSlide(i); setProgress(0); setVisible(true) }, 350) }}
            className={`h-1.5 rounded-full transition-all duration-300 ${i === slide ? 'w-6 bg-neutral-900' : 'w-1.5 bg-neutral-300'}`}
          />
        ))}
      </div>
    </div>
  )
}
