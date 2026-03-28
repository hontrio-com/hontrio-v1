'use client'

import { useEffect } from 'react'
import { Twitter, Linkedin, Link as LinkIcon } from 'lucide-react'

// ─── ShareButtons ─────────────────────────────────────────────────────────────

export function ShareButtons({ title, url }: { title: string; url: string }) {
  const twitterHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`
  const linkedinHref = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      // silently fail
    }
  }

  return (
    <div className="flex items-center flex-wrap gap-2.5">
      <a
        href={twitterHref}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-neutral-200 text-[13px] font-medium text-neutral-700 hover:bg-neutral-50 hover:border-neutral-400 transition-all"
      >
        <Twitter className="h-3.5 w-3.5" />
        Twitter
      </a>
      <a
        href={linkedinHref}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-neutral-200 text-[13px] font-medium text-neutral-700 hover:bg-neutral-50 hover:border-neutral-400 transition-all"
      >
        <Linkedin className="h-3.5 w-3.5" />
        LinkedIn
      </a>
      <button
        onClick={copyLink}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-neutral-200 text-[13px] font-medium text-neutral-700 hover:bg-neutral-50 hover:border-neutral-400 transition-all"
      >
        <LinkIcon className="h-3.5 w-3.5" />
        Copy Link
      </button>
    </div>
  )
}

// ─── ViewTracker ──────────────────────────────────────────────────────────────

export function ViewTracker({ slug }: { slug: string }) {
  useEffect(() => {
    fetch(`/api/blog/views/${slug}`, { method: 'POST' }).catch(() => undefined)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}
