'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'
import { DotField } from '../fx'
import { primaryPill, Shine } from '../header'
import { BrandList } from '../hero'
import { GOOGLE, STORES } from '../brands'
import { TITLE, TwoTone } from '../section'

// =============================================
// „Despre Hontrio” · începutul paginii: ce este Hontrio, butoanele și cu ce se
// conectează. Pagina este „App home page” în verificarea aplicației OAuth la
// Google (17.11.2026), deci tot textul vine vizibil de la server, fără animații
// de apariție. Câmpul de puncte din spate este doar decor, ca pe prima pagină.
// =============================================

export function AboutHero() {
  const { t } = useT()
  return (
    <section className="relative px-5 pb-20 pt-14 sm:pt-20 md:pb-28">
      <div className="absolute inset-x-0 top-0 h-[640px] overflow-hidden opacity-80 [mask-image:radial-gradient(ellipse_70%_60%_at_50%_32%,black_30%,transparent_75%)]">
        <DotField />
      </div>

      <div className="relative mx-auto max-w-6xl text-center">
        <h1 className={cn('mx-auto max-w-6xl text-balance text-[2.45rem] sm:text-[3.3rem] md:text-[3.7rem] xl:text-[4rem]', TITLE)}>
          <TwoTone a={t('site.about_title_a')} b={t('site.about_title_b')} lineBreak="sm" />
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-pretty text-[16.5px] leading-relaxed text-neutral-500 sm:text-lg">{t('site.about_intro')}</p>

        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/register" className={cn(primaryPill, 'h-12 px-7 text-[15px]')}>
            <Shine /><span className="relative">{t('site.hero_cta')}</span><ArrowRight className="relative size-4 transition group-hover:translate-x-0.5" />
          </Link>
          <Link href="/#how" className="inline-flex h-12 items-center rounded-full border border-line bg-white/80 px-7 text-[15px] font-semibold text-neutral-900 backdrop-blur transition hover:border-black">
            {t('site.hero_cta_alt')}
          </Link>
        </div>

        <div className="mt-16">
          <p className="text-sm text-neutral-500">{t('site.logos_label')}</p>
          <BrandList brands={STORES} className="mt-6" />
          <BrandList brands={GOOGLE} className="mt-7 sm:mt-5" />
        </div>
      </div>
    </section>
  )
}
