'use client'

import { motion } from 'framer-motion'

function LiquidBg() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      <motion.div className="absolute rounded-full" style={{ width: '55vw', height: '55vw', maxWidth: 700, maxHeight: 700, left: '-8%', top: '-12%', background: 'radial-gradient(circle, rgba(0,0,0,0.045) 0%, rgba(0,0,0,0.02) 40%, transparent 70%)', filter: 'blur(80px)' }}
        animate={{ x: [0, 60, -30, 40, 0], y: [0, -40, 50, -20, 0] }} transition={{ duration: 28, repeat: Infinity, ease: 'easeInOut' }} />
      <motion.div className="absolute rounded-full" style={{ width: '50vw', height: '50vw', maxWidth: 650, maxHeight: 650, right: '-10%', bottom: '-8%', background: 'radial-gradient(circle, rgba(0,0,0,0.04) 0%, rgba(0,0,0,0.015) 45%, transparent 70%)', filter: 'blur(70px)' }}
        animate={{ x: [0, -50, 35, -25, 0], y: [0, 45, -35, 20, 0] }} transition={{ duration: 32, repeat: Infinity, ease: 'easeInOut' }} />
      <motion.div className="absolute rounded-full" style={{ width: '40vw', height: '40vw', maxWidth: 500, maxHeight: 500, left: '30%', top: '40%', background: 'radial-gradient(circle, rgba(0,0,0,0.035) 0%, rgba(0,0,0,0.01) 50%, transparent 70%)', filter: 'blur(90px)' }}
        animate={{ x: [0, 40, -50, 20, 0], y: [0, -35, 30, -15, 0], scale: [1, 1.08, 0.95, 1.03, 1] }} transition={{ duration: 24, repeat: Infinity, ease: 'easeInOut' }} />
      <motion.div className="absolute rounded-full" style={{ width: '25vw', height: '25vw', maxWidth: 350, maxHeight: 350, right: '15%', top: '15%', background: 'radial-gradient(circle, rgba(0,0,0,0.03) 0%, transparent 65%)', filter: 'blur(60px)' }}
        animate={{ x: [0, -30, 20, -10, 0], y: [0, 25, -20, 10, 0] }} transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }} />
    </div>
  )
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-white relative overflow-x-hidden">
      <LiquidBg />
      {children}
    </div>
  )
}