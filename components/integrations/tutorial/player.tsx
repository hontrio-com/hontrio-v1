'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { AnimatePresence, MotionConfig, animate, motion, useInView, useMotionValue, useReducedMotion, useTransform, type AnimationPlaybackControls } from 'framer-motion'
import { Lock, Pause, Play } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'

// =============================================
// Ghidul animat din „Cum obții datele de conectare?": panoul platformei, refăcut
// alb-negru într-un cadru de browser, iar un cursor face pașii pe rând. Scena se
// desenează pe o pânză fixă (480 × 300) și se scalează la lățimea coloanei;
// camera se apropie de ce contează, ca într-un clip motion design.
//
// O scenă = o listă de „bătăi" (cât ține fiecare, ce pas din listă ilustrează,
// unde merge cursorul, unde se uită camera) și un ecran care se desenează din
// numărul bătăii. Ținta cursorului e un element cu `data-t`, măsurat în pagină,
// așa că textele pot avea orice lungime, în orice limbă.
// =============================================

/** Lățimea pânzei și înălțimea ecranului de sub bara browserului. */
export const W = 480
export const VIEW = 274
const BAR = 26
/** Cât durează drumul cursorului până la țintă (s); clicul vine imediat după. */
const MOVE = 0.62

export type Cam = { on?: string; z: number }
export type Beat = {
  /** cât ține bătaia (ms) */
  ms: number
  /** pasul din listă pe care îl arată (de la 0) */
  step: number
  /** unde merge cursorul: `data-t` al elementului */
  to?: string
  /** clic la capătul drumului; efectul se vede din bătaia următoare */
  click?: boolean
  /** încotro se uită camera (`data-t`, altfel centrul) și cât de aproape */
  cam?: Cam
  /** adresa din bara browserului (rămâne până la următoarea) */
  url?: string
}
export type SceneProps = { beat: number; hot: string | undefined }
export type Scene = { beats: Beat[]; Screen: (props: SceneProps) => ReactNode }

type Resolved = Beat & { url: string; from: number; till: number }

/** Adresa fiecărei bătăi și cât din pasul ei s-a scurs la început și la sfârșit. */
function resolve(beats: Beat[]): Resolved[] {
  const total = new Map<number, number>()
  for (const b of beats) total.set(b.step, (total.get(b.step) ?? 0) + b.ms)
  const spent = new Map<number, number>()
  let url = ''
  return beats.map(b => {
    url = b.url ?? url
    const before = spent.get(b.step) ?? 0
    spent.set(b.step, before + b.ms)
    const all = total.get(b.step) ?? 1
    return { ...b, url, from: before / all, till: (before + b.ms) / all }
  })
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

/** Centrul unui element față de stratul scenei, din poziția lui în pagină (fără transformări). */
function centerOf(root: HTMLElement, el: HTMLElement) {
  let x = el.offsetWidth / 2
  let y = el.offsetHeight / 2
  let node: HTMLElement | null = el
  while (node && node !== root) {
    x += node.offsetLeft
    y += node.offsetTop
    node = node.offsetParent as HTMLElement | null
  }
  return { x, y }
}

const find = (root: HTMLElement, id: string | undefined) => (id ? root.querySelector<HTMLElement>(`[data-t="${id}"]`) : null)

// Fila ascunsă nu are ce anima
const subscribeVisibility = (onChange: () => void) => {
  document.addEventListener('visibilitychange', onChange)
  return () => document.removeEventListener('visibilitychange', onChange)
}
const pageShown = () => document.visibilityState === 'visible'
const shownOnServer = () => true

/** Cursorul (săgeata clasică), cu vârful în colțul din stânga sus. */
function Arrow() {
  return (
    <svg width="15" height="21" viewBox="0 0 15 21" fill="none" className="drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.3)]">
      <path d="M1.2 1.2v15.9l3.9-3.7 2.6 5.8 2.5-1.1-2.5-5.7h5.4L1.2 1.2Z" fill="#0a0a0a" stroke="#fff" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  )
}

/** Camera și cursorul: se mută la fiecare bătaie, direct pe valori (fără randări în plus). */
function Lens({ beats, beat, reduced, children }: { beats: Resolved[]; beat: number; reduced: boolean; children: ReactNode }) {
  const layer = useRef<HTMLDivElement>(null)
  const first = useRef(true)
  const camX = useMotionValue(0)
  const camY = useMotionValue(0)
  const camZ = useMotionValue(1)
  const curX = useMotionValue(W * 0.76)
  const curY = useMotionValue(VIEW * 0.72)
  const press = useMotionValue(1)
  const ripX = useMotionValue(0)
  const ripY = useMotionValue(0)
  const ripZ = useMotionValue(0.3)
  const ripO = useMotionValue(0)
  const ripLeft = useTransform(ripX, v => v - 14)
  const ripTop = useTransform(ripY, v => v - 14)

  useLayoutEffect(() => {
    const root = layer.current
    if (!root) return
    const b = beats[beat]
    // La începutul unei bucle (sau fără mișcare) totul stă direct pe loc
    const instant = reduced || first.current
    first.current = false
    const runs: AnimationPlaybackControls[] = []

    const target = find(root, b.to)
    if (target) {
      const p = centerOf(root, target)
      if (instant) {
        curX.set(p.x)
        curY.set(p.y)
      } else {
        // Ușinguri diferite pe cele două axe: drumul iese ușor curbat, ca al unei mâini
        runs.push(animate(curX, p.x, { duration: MOVE, ease: [0.42, 0, 0.22, 1] }))
        runs.push(animate(curY, p.y, { duration: MOVE, ease: [0.3, 0, 0.12, 1] }))
        if (b.click) {
          ripX.set(p.x)
          ripY.set(p.y)
          const at = MOVE + 0.06
          runs.push(animate(press, [1, 1, 0.8, 1], { duration: at + 0.24, times: [0, at / (at + 0.24), (at + 0.07) / (at + 0.24), 1] }))
          runs.push(animate(ripZ, [0.3, 0.3, 1.9], { duration: at + 0.5, times: [0, at / (at + 0.5), 1], ease: 'easeOut' }))
          runs.push(animate(ripO, [0, 0, 0.42, 0], { duration: at + 0.5, times: [0, at / (at + 0.5), (at + 0.02) / (at + 0.5), 1] }))
        }
      }
    }

    if (b.cam) {
      const focus = find(root, b.cam.on)
      const f = focus ? centerOf(root, focus) : { x: W / 2, y: VIEW / 2 }
      const z = b.cam.z
      const x = clamp(W / 2 - f.x * z, W - W * z, 0)
      const y = clamp(VIEW / 2 - f.y * z, VIEW - VIEW * z, 0)
      if (instant) {
        camX.set(x)
        camY.set(y)
        camZ.set(z)
      } else {
        const glide = { type: 'spring', stiffness: 85, damping: 23, mass: 1 } as const
        runs.push(animate(camX, x, glide), animate(camY, y, glide), animate(camZ, z, glide))
      }
    }

    return () => {
      runs.forEach(r => r.stop())
      press.set(1)
      ripO.set(0)
    }
  }, [beat, beats, reduced, camX, camY, camZ, curX, curY, press, ripX, ripY, ripZ, ripO])

  return (
    // will-change rămâne „auto": textul se redesenează clar după fiecare apropiere a camerei
    <motion.div ref={layer} className="absolute left-0 top-0" style={{ width: W, height: VIEW, x: camX, y: camY, scale: camZ, originX: 0, originY: 0, willChange: 'auto' }}>
      {children}
      <motion.span aria-hidden className="pointer-events-none absolute left-0 top-0 size-7 rounded-full bg-black" style={{ x: ripLeft, y: ripTop, scale: ripZ, opacity: ripO }} />
      <motion.span aria-hidden className="pointer-events-none absolute left-0 top-0" style={{ x: curX, y: curY, scale: press, originX: 0, originY: 0 }}>
        <Arrow />
      </motion.span>
    </motion.div>
  )
}

/** Bara browserului: cele trei puncte și adresa paginii. */
function Bar({ url }: { url: string }) {
  return (
    <div className="flex items-center gap-2.5 border-b border-[#ececec] bg-[#f6f6f6] px-2.5" style={{ height: BAR }}>
      <span className="flex gap-[5px]">
        {[0, 1, 2].map(i => <span key={i} className="size-[7px] rounded-full bg-[#d9d9d9]" />)}
      </span>
      <span className="flex h-[17px] min-w-0 flex-1 items-center gap-1.5 rounded-full bg-white px-2.5 ring-1 ring-[#e6e6e6]">
        <Lock className="size-[8px] shrink-0 text-neutral-400" strokeWidth={2.6} />
        <span className="truncate text-[9px] tracking-[0.01em] text-neutral-500">{url}</span>
      </span>
      <span className="w-[26px]" />
    </div>
  )
}

/**
 * Ghidul: cadrul cu scena, bara de progres pe pași (cu pauză) și lista pașilor,
 * care merge cu animația; un clic pe un pas o mută acolo.
 */
export function GuidePlayer({ scene, steps }: { scene: Scene; steps: { title: string; desc: string }[] }) {
  const { t, locale } = useT()
  // Adresa magazinului din bara browserului, ca exemplu în limba paginii
  const shop = locale === 'ro' ? 'magazinul-tau.ro' : 'your-store.com' // i18n-ignore
  const reduced = useReducedMotion() === true
  const beats = useMemo(() => resolve(scene.beats), [scene.beats])
  const firstOf = (step: number) => Math.max(0, beats.findIndex(b => b.step === step))
  const lastOf = (step: number) => Math.max(0, beats.findLastIndex(b => b.step === step))

  // Cine cere mai puțină mișcare vede fiecare pas gata făcut și îl schimbă din listă
  const [beat, setBeat] = useState(() => (reduced ? lastOf(0) : 0))
  const [cycle, setCycle] = useState(0)
  const [playing, setPlaying] = useState(!reduced)

  const box = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState<number | null>(null)
  const inView = useInView(box, { amount: 0.35 })
  const shown = useSyncExternalStore(subscribeVisibility, pageShown, shownOnServer)
  const running = playing && inView && shown && !reduced

  // Pânza se scalează la lățimea coloanei
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const observer = new ResizeObserver(entries => setFit(entries[0].contentRect.width / W))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Ceasul: bătaia următoare, apoi bucla de la capăt (cu o trecere în alb)
  useEffect(() => {
    if (!running) return
    const id = setTimeout(() => {
      if (beat >= beats.length - 1) {
        setCycle(c => c + 1)
        setBeat(0)
      } else {
        setBeat(beat + 1)
      }
    }, beats[beat].ms)
    return () => clearTimeout(id)
  }, [beat, beats, running])

  // Bara pasului curent se umple cât ține pasul
  const fill = useMotionValue(0)
  const width = useTransform(fill, v => `${v * 100}%`)
  useEffect(() => {
    fill.set(reduced ? 1 : beats[beat].from)
  }, [beat, beats, fill, reduced])
  useEffect(() => {
    if (!running) return
    const run = animate(fill, beats[beat].till, { duration: beats[beat].ms / 1000, ease: 'linear' })
    return () => run.stop()
  }, [beat, beats, fill, running])

  const step = beats[beat].step
  const go = (i: number) => {
    setBeat(reduced ? lastOf(i) : firstOf(i))
    setPlaying(!reduced)
  }
  const Screen = scene.Screen

  return (
    <MotionConfig reducedMotion="user">
      <div ref={box} className="relative w-full overflow-hidden rounded-[14px] bg-white shadow-[0_12px_32px_-20px_rgba(0,0,0,0.45)] ring-1 ring-black/[0.08]" style={{ aspectRatio: `${W} / ${VIEW + BAR}` }}>
        {fit !== null && (
          <div aria-hidden className="absolute left-0 top-0 origin-top-left select-none [font-family:-apple-system,BlinkMacSystemFont,'Segoe_UI',Roboto,'Helvetica_Neue',Arial,sans-serif]" style={{ width: W, height: VIEW + BAR, transform: `scale(${fit})` }}>
            <Bar url={beats[beat].url.replace('{shop}', shop)} />
            <div className="relative overflow-hidden" style={{ height: VIEW }}>
              <AnimatePresence initial={false}>
                <motion.div key={cycle} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.45 }}>
                  <Lens beats={beats} beat={beat} reduced={reduced}>
                    <Screen beat={beat} hot={beats[beat].to} />
                  </Lens>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>

      <div className="mt-2.5 flex items-center gap-2">
        <div aria-hidden className="flex flex-1 gap-1">
          {steps.map((s, i) => (
            <button key={s.title} type="button" tabIndex={-1} onClick={() => go(i)} className="h-4 flex-1 cursor-pointer py-1.5">
              <span className="block h-1 overflow-hidden rounded-full bg-neutral-200">
                {i < step && <span className="block h-full bg-neutral-900" />}
                {i === step && <motion.span className="block h-full bg-neutral-900" style={{ width }} />}
              </span>
            </button>
          ))}
        </div>
        {!reduced && (
          <button type="button" onClick={() => setPlaying(p => !p)} aria-label={playing ? t('integrations.tutorial_pause') : t('integrations.tutorial_play')}
            className="grid size-7 shrink-0 place-items-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-black">
            {playing ? <Pause className="size-3.5" fill="currentColor" strokeWidth={0} /> : <Play className="size-3.5" fill="currentColor" strokeWidth={0} />}
          </button>
        )}
      </div>

      <ol className="mt-1.5 space-y-0.5">
        {steps.map((s, i) => (
          <li key={s.title}>
            <button type="button" onClick={() => go(i)} aria-current={i === step ? 'step' : undefined}
              aria-label={t('integrations.tutorial_step', { step: String(i + 1), title: s.title })}
              className={cn('flex w-full gap-3 rounded-xl px-2 py-2 text-left transition-colors', i === step ? 'bg-neutral-50' : 'hover:bg-neutral-50')}>
              <span className={cn('grid size-5 shrink-0 place-items-center rounded-full font-mono text-[10px] font-semibold transition-colors duration-300',
                i === step ? 'bg-black text-white' : 'bg-neutral-100 text-neutral-500')}>{i + 1}</span>
              <span className="text-[13px] leading-relaxed text-neutral-600">
                <span className={cn('block font-semibold transition-colors duration-300', i === step ? 'text-neutral-950' : 'text-neutral-800')}>{s.title}</span>
                {s.desc}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </MotionConfig>
  )
}
