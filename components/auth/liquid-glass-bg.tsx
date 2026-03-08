'use client'

import { motion } from 'framer-motion'

export default function LiquidGlassBg() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* Base: very subtle noise grain */}
      <div className="absolute inset-0 opacity-[0.018]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: '256px 256px',
        }}
      />

      {/* Liquid mesh — ultra-large blurred shapes that blend into background */}
      {/* These are NOT visible as shapes — they create ambient light variation on white */}
      <motion.div
        className="absolute"
        style={{
          width: '120vw', height: '120vh',
          left: '-10vw', top: '-10vh',
          background: 'radial-gradient(ellipse 50% 40% at 30% 40%, rgba(0,0,0,0.022) 0%, transparent 70%)',
        }}
        animate={{ x: [0, 30, -20, 10, 0], y: [0, -20, 15, -8, 0] }}
        transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut' }}
      />

      <motion.div
        className="absolute"
        style={{
          width: '120vw', height: '120vh',
          left: '-10vw', top: '-10vh',
          background: 'radial-gradient(ellipse 45% 50% at 70% 60%, rgba(0,0,0,0.018) 0%, transparent 70%)',
        }}
        animate={{ x: [0, -25, 18, -12, 0], y: [0, 25, -18, 10, 0] }}
        transition={{ duration: 30, repeat: Infinity, ease: 'easeInOut' }}
      />

      <motion.div
        className="absolute"
        style={{
          width: '120vw', height: '120vh',
          left: '-10vw', top: '-10vh',
          background: 'radial-gradient(ellipse 55% 35% at 50% 25%, rgba(0,0,0,0.015) 0%, transparent 65%)',
        }}
        animate={{ x: [0, 20, -15, 8, 0], y: [0, 15, -25, 12, 0] }}
        transition={{ duration: 35, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Light caustic — simulates light refracting through liquid */}
      <motion.div
        className="absolute"
        style={{
          width: '100vw', height: '100vh',
          background: 'radial-gradient(ellipse 30% 25% at 45% 50%, rgba(255,255,255,0.6) 0%, transparent 70%)',
        }}
        animate={{ x: [0, 15, -10, 5, 0], y: [0, -12, 8, -5, 0], scale: [1, 1.04, 0.98, 1.01, 1] }}
        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  )
}