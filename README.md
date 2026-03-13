# HONTRIO.COM — AI Growth Engine pentru eCommerce

Platformă SaaS care conectează magazine WooCommerce și oferă unelte AI pentru optimizarea produselor: generare imagini, optimizare SEO, AI Agent conversational.

## Stack Tehnologic

- **Frontend + Backend:** Next.js 16 (App Router) + React 19 + TypeScript
- **UI:** Tailwind CSS v4 + shadcn/ui + Framer Motion
- **Bază de date:** Supabase (PostgreSQL + Auth + Storage + Realtime)
- **Generare imagini:** KIE API (Nano Banana Pro)
- **Generare text:** OpenAI (GPT-4o / GPT-4o-mini)
- **Plăți:** Stripe (abonamente + credite)
- **Autentificare:** NextAuth v4 (credentials + Google OAuth)
- **Rate Limiting:** Upstash Redis
- **Hosting:** Vercel

## Setup Local

```bash
# 1. Clonează repo-ul
git clone https://github.com/hontrio-com/hontrio-v1.git
cd hontrio-v1

# 2. Instalează dependențele
npm install

# 3. Configurează variabilele de mediu
cp .env.example .env.local
# Completează valorile în .env.local

# 4. Rulează migrările DB (în Supabase SQL Editor)
# Copiază conținutul din migrations/001_add_indexes.sql

# 5. Pornește serverul
npm run dev
```

## Structura Proiectului

```
app/
├── (auth)/          # Login, Register, Forgot/Reset Password
├── (dashboard)/     # Dashboard, Products, Images, SEO, Settings, etc.
├── admin/           # Admin panel (stats, users, costs, tickets)
├── api/             # API routes
├── onboarding/      # Onboarding flow (6 pași)
├── page.tsx         # Landing page
│
lib/
├── auth/            # NextAuth config
├── security/        # Rate limit (Redis), CSRF, encryption, sanitize
├── supabase/        # Supabase clients (admin, server, client)
├── openai/          # OpenAI client + text generation
├── kie/             # KIE API client (image generation)
├── stripe/          # Stripe client + plans config
├── woocommerce/     # WooCommerce API adapter
├── risk/            # Fraud detection engine
├── seo/             # SEO score calculator
├── credits.ts       # Centralized credit costs
│
migrations/
├── 001_add_indexes.sql  # DB indexes + atomic credit function
```

## Variabile de Mediu Necesare

Vezi `.env.example` pentru lista completă.

## Deployment

Proiectul e configurat pentru Vercel cu cron jobs definite în `vercel.json`.
