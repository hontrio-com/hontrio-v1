'use client'

import { motion } from 'framer-motion'

const orbs = [
  // Large primary orbs
  { size: 380, x: '12%', y: '18%', dur: 22, dx: 45, dy: -35, delay: 0, opacity: 0.07 },
  { size: 320, x: '65%', y: '55%', dur: 26, dx: -40, dy: 50, delay: 2, opacity: 0.06 },
  { size: 260, x: '40%', y: '75%', dur: 20, dx: 35, dy: -45, delay: 4, opacity: 0.055 },
  // Medium accent orbs
  { size: 200, x: '80%', y: '15%', dur: 18, dx: -30, dy: 40, delay: 1, opacity: 0.05 },
  { size: 180, x: '25%', y: '45%', dur: 24, dx: 25, dy: -30, delay: 3, opacity: 0.045 },
  // Small detail orbs
  { size: 120, x: '55%', y: '25%', dur: 16, dx: -20, dy: 25, delay: 5, opacity: 0.04 },
  { size: 100, x: '85%', y: '70%', dur: 19, dx: 15, dy: -20, delay: 2, opacity: 0.035 },
]

export default function LiquidGlassBg() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* Subtle noise texture overlay */}
      <div className="absolute inset-0 opacity-[0.012]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: '200px 200px',
        }}
      />

      {/* Glass orbs */}
      {orbs.map((orb, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: orb.size,
            height: orb.size,
            left: orb.x,
            top: orb.y,
            background: `radial-gradient(circle at 35% 35%, rgba(255,255,255,${orb.opacity * 3}), rgba(0,0,0,${orb.opacity}) 60%, transparent 70%)`,
            boxShadow: `inset 0 0 ${orb.size * 0.3}px rgba(255,255,255,${orb.opacity * 2}), 0 0 ${orb.size * 0.5}px rgba(0,0,0,${orb.opacity * 0.5})`,
            backdropFilter: 'blur(1px)',
            WebkitBackdropFilter: 'blur(1px)',
          }}
          initial={{ opacity: 0 }}
          animate={{
            opacity: 1,
            x: [0, orb.dx, -orb.dx * 0.6, orb.dx * 0.3, 0],
            y: [0, orb.dy, -orb.dy * 0.7, orb.dy * 0.4, 0],
            scale: [1, 1.05, 0.97, 1.02, 1],
          }}
          transition={{
            opacity: { duration: 1.5, delay: orb.delay * 0.2 },
            x: { duration: orb.dur, repeat: Infinity, ease: 'easeInOut', delay: orb.delay },
            y: { duration: orb.dur * 1.1, repeat: Infinity, ease: 'easeInOut', delay: orb.delay },
            scale: { duration: orb.dur * 0.8, repeat: Infinity, ease: 'easeInOut', delay: orb.delay },
          }}
        >
          {/* Inner highlight — glass refraction effect */}
          <div
            className="absolute rounded-full"
            style={{
              width: '45%',
              height: '35%',
              top: '15%',
              left: '20%',
              background: `radial-gradient(ellipse, rgba(255,255,255,${orb.opacity * 4}) 0%, transparent 70%)`,
              filter: 'blur(4px)',
              transform: 'rotate(-15deg)',
            }}
          />
          {/* Bottom edge light */}
          <div
            className="absolute rounded-full"
            style={{
              width: '55%',
              height: '20%',
              bottom: '18%',
              right: '15%',
              background: `radial-gradient(ellipse, rgba(255,255,255,${orb.opacity * 2}) 0%, transparent 70%)`,
              filter: 'blur(6px)',
              transform: 'rotate(10deg)',
            }}
          />
        </motion.div>
      ))}

      {/* Ambient shimmer lines — very subtle moving highlights */}
      <motion.div
        className="absolute"
        style={{
          width: '150%',
          height: '1px',
          top: '30%',
          left: '-25%',
          background: 'linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.02) 20%, rgba(0,0,0,0.04) 50%, rgba(0,0,0,0.02) 80%, transparent 100%)',
          transformOrigin: 'center',
        }}
        animate={{ rotate: [0, 3, -2, 1, 0], y: [0, 50, -30, 20, 0] }}
        transition={{ duration: 30, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute"
        style={{
          width: '1px',
          height: '150%',
          left: '60%',
          top: '-25%',
          background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.015) 30%, rgba(0,0,0,0.03) 50%, rgba(0,0,0,0.015) 70%, transparent 100%)',
        }}
        animate={{ rotate: [0, -2, 3, -1, 0], x: [0, -40, 30, -15, 0] }}
        transition={{ duration: 35, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  )
}