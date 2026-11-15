'use client'
// i18n-content-file: etichetele panoului WordPress și WooCommerce, din traducerile lor oficiale (ro, en) și din capturile unui panou real

import type { CSSProperties, ReactNode } from 'react'
import {
  Archive, ChartColumnIncreasing, ChevronDown, ChevronUp, CircleChevronLeft, CircleHelp, Files, Gauge, Images, MapPin, Megaphone,
  MessageSquare, Paintbrush, Pin, Plug, Plus, RefreshCw, Search, SlidersVertical, User, Wrench, X,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { useT } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'
import { CLICK_AT, Frame, HontrioCard, Page, Screen, Typed, hit, hover } from './parts'
import type { Beat, Scene, SceneProps } from './player'

// =============================================
// Ghidul WooCommerce, după capturile unui panou real (WordPress cu schema de
// culori „Modern", WooCommerce la zi): Panou control → WooCommerce → Setări →
// Avansate → Chei REST API → „Creează o cheie API" cu „Citește" → cheile,
// copiate pe rând în Hontrio. Totul la mărime reală, într-o fereastră de 1280 px;
// din panoul real lipsesc doar extensiile altor firme și datele magazinului.
// =============================================

const TEXT = {
  ro: {
    site: 'Magazinul tău', newItem: 'Nou', howdy: 'Bună, admin',
    dashboard: 'Panou control', home: 'Prima pagină', updates: 'Actualizări',
    posts: 'Articole', media: 'Media', pages: 'Pagini', comments: 'Comentarii', products: 'Produse', payments: 'Plăți', analytics: 'Analytics', marketing: 'Marketing',
    appearance: 'Aspect', plugins: 'Module', users: 'Utilizatori', tools: 'Unelte', settings: 'Setări', collapse: 'Restrânge meniul',
    wooSub: ['Prima pagină', 'Comenzi', 'Clienți', 'Cupoane', 'Rapoarte', 'Setări', 'Stare', 'Extensii'],
    screenOptions: 'Opțiuni ecran', help: 'Ajutor',
    setup: 'Inițializare WooCommerce', setupStep: 'Pas 5 din 5', setupCta: 'Începe vânzarea',
    setupText: 'Aproape ai terminat! După ce finalizezi inițializarea magazinului, poți începe să primești comenzi.',
    glance: 'Dintr-o privire', glanceItems: ['3 articole', '6 pagini', '1 comentariu'],
    draft: 'Ciornă rapidă', draftTitle: 'Titlu', draftContent: 'Conținut', draftPlaceholder: 'Ce-ai vrea să faci?', draftSave: 'Salvează ciorna',
    events: 'Evenimente și știri WordPress', eventsIntro: 'Participă la un eveniment viitor din apropiere.', eventsLocation: 'Selectează locația',
    event: 'WordCamp Europe', eventPlace: 'WordCamp • Málaga', eventDate: '27 - 29 mai 2027',
    tabs: ['Generale', 'Produse', 'Livrare', 'Plăți', 'Conturi și confidențialitate', 'Emailuri', 'Integrare', 'Vizibilitate site', 'Punct de vânzare (POS)', 'Avansate'],
    storeAddress: 'Adresă magazin', storeAddressDesc: 'Acesta e locul unde este localizată afacerea ta. Cotele de impozitare și tarifele de livrare vor folosi această adresă.',
    addressRows: ['Primul rând pentru adresă', 'Al doilea rând pentru adresă', 'Localitate', 'Țară/județ', 'Cod poștal'],
    sections: ['Inițializare pagină', 'Chei REST API', 'Cârlige web', 'API moștenit', 'WooCommerce.com', 'Blueprint (beta)', 'Funcționalități'],
    pageSetup: 'Inițializare pagină', pageSetupDesc: 'Aceste pagini trebuie să fie setate astfel încât WooCommerce să știe unde să trimită utilizatorii pentru finalizare.',
    pageRows: [['Pagină coș', 'Coș (ID: 9)'], ['Pagină finalizare comandă', 'Finalizare comandă (ID: 10)'], ['Pagină Contul meu', 'Contul meu (ID: 11)'], ['Termeni și condiții', '']],
    searchPage: 'Caută o pagină...',
    endpoints: 'Puncte-finale de finalizare', endpointsDesc: 'Punctele-finale sunt adăugate la URL-urile paginilor tale pentru a gestiona acțiuni specifice în timpul procesului de finalizare. Ele ar trebui să fie unice.',
    restApi: 'REST API', addKey: 'Adaugă cheie',
    intro: 'REST API WooCommerce permite aplicații externe pentru a vizualiza și administra datele magazinului. Accesul este acordat numai celor cu chei API valide.',
    create: 'Creează o cheie API', details: 'Detalii cheie',
    notes: [
      'Cheile API deschid accesul la informații care pot fi sensibile. Partajează-le numai cu organizațiile în care ai încredere.',
      'O cheie pentru fiecare client: acest lucru facilitează revocarea accesului în viitor pentru un singur client, fără să provoace perturbări pentru ceilalți.',
    ],
    description: 'Descriere', descriptionHelp: 'Adaugă o descriere semnificativă, inclusiv o notă despre persoana, compania sau aplicația cu care partajezi cheia.',
    user: 'Utilizator', userValue: 'admin (#1 – admin@magazinul-tau.ro)', permissions: 'Permisiuni', perms: ['Citește', 'Scrie', 'Citește/scrie'],
    generate: 'Generează cheia API',
    success: 'Cheie API generată cu succes. Asigură-te să copiezi noile chei acum, deoarece cheia secretă va fi ascunsă după ce părăsești această pagină.',
    ck: 'Cheie client', cs: 'Secret client', copy: 'Copiază', copied: 'Copiat!', qr: 'Cod QR', revoke: 'Revocare cheie',
  },
  en: {
    site: 'Your Store', newItem: 'New', howdy: 'Howdy, admin',
    dashboard: 'Dashboard', home: 'Home', updates: 'Updates',
    posts: 'Posts', media: 'Media', pages: 'Pages', comments: 'Comments', products: 'Products', payments: 'Payments', analytics: 'Analytics', marketing: 'Marketing',
    appearance: 'Appearance', plugins: 'Plugins', users: 'Users', tools: 'Tools', settings: 'Settings', collapse: 'Collapse Menu',
    wooSub: ['Home', 'Orders', 'Customers', 'Coupons', 'Reports', 'Settings', 'Status', 'Extensions'],
    screenOptions: 'Screen Options', help: 'Help',
    setup: 'WooCommerce Setup', setupStep: 'Step 5 of 5', setupCta: 'Start selling',
    setupText: 'You’re almost there! Once you complete store setup you can start receiving orders.',
    glance: 'At a Glance', glanceItems: ['3 Posts', '6 Pages', '1 Comment'],
    draft: 'Quick Draft', draftTitle: 'Title', draftContent: 'Content', draftPlaceholder: 'What’s on your mind?', draftSave: 'Save Draft',
    events: 'WordPress Events and News', eventsIntro: 'Attend an upcoming event near you.', eventsLocation: 'Select location',
    event: 'WordCamp Europe', eventPlace: 'WordCamp • Málaga', eventDate: 'May 27 - 29, 2027',
    tabs: ['General', 'Products', 'Shipping', 'Payments', 'Accounts & Privacy', 'Emails', 'Integration', 'Site visibility', 'Point of Sale', 'Advanced'],
    storeAddress: 'Store Address', storeAddressDesc: 'This is where your business is located. Tax rates and shipping rates will use this address.',
    addressRows: ['Address line 1', 'Address line 2', 'City', 'Country / State', 'Postcode / ZIP'],
    sections: ['Page setup', 'REST API keys', 'Webhooks', 'Legacy API', 'WooCommerce.com', 'Blueprint (beta)', 'Features'],
    pageSetup: 'Page setup', pageSetupDesc: 'These pages need to be set so that WooCommerce knows where to send users to checkout.',
    pageRows: [['Cart page', 'Cart (ID: 9)'], ['Checkout page', 'Checkout (ID: 10)'], ['My account page', 'My account (ID: 11)'], ['Terms and conditions', '']],
    searchPage: 'Search for a page…',
    endpoints: 'Checkout endpoints', endpointsDesc: 'Endpoints are appended to your page URLs to handle specific actions during the checkout process. They should be unique.',
    restApi: 'REST API', addKey: 'Add key',
    intro: 'The WooCommerce REST API allows external apps to view and manage store data. Access is granted only to those with valid API keys.',
    create: 'Create an API key', details: 'Key details',
    notes: [
      'API keys open up access to potentially sensitive information. Only share them with organizations you trust.',
      'Stick to one key per client: this makes it easier to revoke access in the future for a single client, without causing disruption for others.',
    ],
    description: 'Description', descriptionHelp: 'Add a meaningful description, including a note of the person, company or app you are sharing the key with.',
    user: 'User', userValue: 'admin (#1 – admin@your-store.com)', permissions: 'Permissions', perms: ['Read', 'Write', 'Read/Write'],
    generate: 'Generate API key',
    success: 'API Key generated successfully. Make sure to copy your new keys now as the secret key will be hidden once you leave this page.',
    ck: 'Consumer key', cs: 'Consumer secret', copy: 'Copy', copied: 'Copied!', qr: 'QRCode', revoke: 'Revoke key',
  },
}
type Text = (typeof TEXT)['ro']

// Chei de exemplu (inventate), în formatul WooCommerce
const CK = 'ck_7d2f9a61c3e84b05f1a6c9d2e7b4083f5a1c6e92'
const CS = 'cs_41d90b7e2a5f8c63d1e09a4b7c2f6e85d3a10b9c'

const ADMIN = '{shop}/wp-admin/admin.php?page=wc-settings'
const BEATS: Beat[] = [
  /* 0 */ { ms: 1600, step: 0, cam: { z: 1 }, url: '{shop}/wp-admin/' },
  /* 1 */ { ms: 1350, step: 1, to: 'w-woo', cam: { on: 'f-menu' } },
  /* 2 */ { ms: 1100, step: 1, to: 'w-fly-settings', click: true },
  /* 3 */ { ms: 1350, step: 1, to: 'w-tab-adv', click: true, cam: { on: 'f-tabs' }, url: ADMIN },
  /* 4 */ { ms: 1350, step: 1, to: 'w-sec-keys', click: true, cam: { on: 'f-sections' }, url: `${ADMIN}&tab=advanced` },
  /* 5 */ { ms: 1450, step: 2, to: 'w-create', click: true, cam: { on: 'f-empty' }, url: `${ADMIN}&tab=advanced&section=keys` },
  /* 6 */ { ms: 1050, step: 2, to: 'w-desc', click: true, cam: { on: 'f-form' }, url: `${ADMIN}&tab=advanced&section=keys&create-key=1` },
  /* 7 */ { ms: 1150, step: 2 },
  /* 8 */ { ms: 950, step: 2, to: 'w-perm', click: true, cam: { on: 'f-form-low' } },
  /* 9 */ { ms: 950, step: 2, to: 'w-opt-read', click: true },
  /* 10 */ { ms: 1150, step: 2, to: 'w-generate', click: true },
  /* 11 */ { ms: 1400, step: 3, to: 'w-copy-ck', click: true, cam: { on: 'f-keys' } },
  /* 12 */ { ms: 1400, step: 3, to: 'h-ck', click: true, cam: { on: 'h-card', z: 1.12 }, url: 'app.hontrio.com/onboarding' },
  /* 13 */ { ms: 1300, step: 3, to: 'w-copy-cs', click: true, cam: { on: 'f-keys' }, url: `${ADMIN}&tab=advanced&section=keys&create-key=1` },
  /* 14 */ { ms: 1300, step: 3, to: 'h-cs', click: true, cam: { on: 'h-card', z: 1.12 }, url: 'app.hontrio.com/onboarding' },
  /* 15 */ { ms: 1150, step: 3, to: 'h-connect', click: true },
  /* 16 */ { ms: 1900, step: 3 },
]

// Culorile panoului (schema „Modern" din WordPress), măsurate pe capturi
const C = {
  bar: '#1e1e1e', menu: '#1e1e1e', sub: '#0c0c0c', subText: '#bcbcbc', icon: '#f3f1f1',
  blue: '#3858e9', blueDark: '#2145e6', bg: '#f0f0f1', title: '#1d2327', text: '#3c434a', muted: '#646970', border: '#c3c4c7',
}

function WooScreen({ beat, hot }: SceneProps) {
  const { locale, t } = useT()
  const L = TEXT[locale]
  const page = beat <= 2 ? 'dash' : 'settings'

  return (
    <div className="absolute inset-0" style={{ background: C.bg }}>
      <Page>
        <div className="absolute inset-0 text-[13px] leading-[1.4]" style={{ color: C.text }}>
          <AdminBar L={L} />
          <Sidebar L={L} page={page} beat={beat} hot={hot} />
          <Screen on={page === 'dash'}><Dashboard L={L} /></Screen>
          <Screen on={page === 'settings'}><Settings L={L} beat={beat} hot={hot} /></Screen>

          {/* Cadrele camerei (în pixeli ai panoului) */}
          <Frame id="f-menu" x={0} y={250} w={330} h={310} />
          <Frame id="f-tabs" x={600} y={40} w={610} h={200} />
          <Frame id="f-sections" x={180} y={140} w={580} h={190} />
          <Frame id="f-empty" x={470} y={250} w={505} h={390} />
          <Frame id="f-form" x={180} y={190} w={660} h={340} />
          <Frame id="f-form-low" x={180} y={300} w={660} h={350} />
          <Frame id="f-keys" x={180} y={200} w={740} h={320} />
        </div>
      </Page>

      <HontrioCard on={beat === 12 || beat >= 14} hot={hot} connected={beat >= 16}
        title={t('onboarding.form_title_key', { platform: 'WooCommerce' })}
        fields={[
          { id: 'h-url', label: t('onboarding.store_url'), value: locale === 'ro' ? 'https://magazinul-tau.ro' : 'https://your-store.com', pasted: true },
          { id: 'h-ck', label: t('onboarding.api_key'), value: CK, pasted: beat >= 12, mono: true, delay: beat === 12 ? CLICK_AT : 0 },
          { id: 'h-cs', label: t('onboarding.api_secret'), value: CS, pasted: beat >= 14, mono: true, delay: beat === 14 ? CLICK_AT : 0 },
        ]} />
    </div>
  )
}

// ——— Bara de sus ———

function AdminBar({ L }: { L: Text }) {
  return (
    <div className="absolute inset-x-0 top-0 flex h-[32px] items-center text-[13px] text-white" style={{ background: C.bar }}>
      <span className="grid h-full w-[34px] place-items-center"><WpLogo /></span>
      <span className="flex h-full items-center gap-[7px] px-[8px]"><HomeIcon />{L.site}</span>
      <span className="-ml-[2px] mr-[6px] rounded-[2px] bg-[#e6f2e8] px-[6px] text-[12px] font-medium leading-[20px] text-[#00450c]">Live</span>
      <BarItem icon={<RefreshCw className="size-[17px]" strokeWidth={2.6} />}>2</BarItem>
      <BarItem icon={<Search className="size-[17px]" strokeWidth={2.8} />}>Ctrl+K</BarItem>
      <BarItem icon={<MessageSquare className="size-[17px]" fill="currentColor" strokeWidth={2} />}>1</BarItem>
      <BarItem icon={<Plus className="size-[17px]" strokeWidth={3.2} />}>{L.newItem}</BarItem>
      <span className="ml-auto flex h-full items-center gap-[8px] px-[8px]">{L.howdy}<Avatar size={18} /></span>
    </div>
  )
}

function BarItem({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return <span className="flex h-full items-center gap-[8px] px-[9px]">{icon}{children}</span>
}

// ——— Meniul din stânga ———

function Sidebar({ L, page, beat, hot }: { L: Text; page: 'dash' | 'settings'; beat: number; hot: string | undefined }) {
  const onDash = page === 'dash'
  // Pe Panou control, cursorul stă pe WooCommerce: submeniul se deschide alături
  const flyout = onDash && (beat === 1 || beat === 2)
  return (
    <nav className="absolute bottom-0 left-0 top-[32px] w-[160px] pt-[11px]" style={{ background: C.menu }}>
      <MenuItem label={L.dashboard} icon={<Gauge />} current={onDash} />
      {onDash && (
        <SubMenu>
          <SubItem label={L.home} current />
          <SubItem label={L.updates} badge={2} />
        </SubMenu>
      )}
      <Separator />
      <MenuItem label={L.posts} icon={<Pin className="rotate-45" fill="currentColor" />} />
      <MenuItem label={L.media} icon={<Images />} />
      <MenuItem label={L.pages} icon={<Files />} />
      <MenuItem label={L.comments} icon={<MessageSquare fill="currentColor" />} badge={1} />
      <Separator />
      <div className="relative">
        <MenuItem label="WooCommerce" icon={<WooIcon />} current={!onDash} open={flyout} late={beat === 1} {...hit('w-woo', hot)} />
        {/* Submeniul se deschide când ajunge cursorul pe WooCommerce */}
        {flyout && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.1, delay: beat === 1 ? 0.52 : 0 }}
            className="absolute left-full top-[-1px] z-10 w-[162px] py-[7px] shadow-[0_3px_5px_rgba(0,0,0,0.2)]" style={{ background: C.sub }}>
            {L.wooSub.map((label, i) => (
              <span key={label} {...(i === 5 ? hit('w-fly-settings', hot) : {})}
                className="flex h-[28px] items-center pl-[16px] text-[13px] text-[#bcbcbc] transition-colors duration-150 data-hot:delay-[520ms] data-hot:text-[#33f078]">
                {label}{i === 0 && <Bubble n={1} />}{i === 1 && <Bubble n={4} />}
              </span>
            ))}
          </motion.div>
        )}
      </div>
      {!onDash && (
        <SubMenu>
          {L.wooSub.map((label, i) => <SubItem key={label} label={label} current={i === 5} badge={i === 0 ? 1 : i === 1 ? 4 : undefined} />)}
        </SubMenu>
      )}
      <MenuItem label={L.products} icon={<Archive fill="currentColor" stroke={C.menu} />} />
      <MenuItem label={L.payments} icon={<PaymentsIcon />} />
      <MenuItem label={L.analytics} icon={<ChartColumnIncreasing />} />
      <MenuItem label={L.marketing} icon={<Megaphone fill="currentColor" />} />
      <Separator />
      <MenuItem label={L.appearance} icon={<Paintbrush fill="currentColor" />} />
      <MenuItem label={L.plugins} icon={<Plug fill="currentColor" />} />
      <MenuItem label={L.users} icon={<User fill="currentColor" />} />
      <MenuItem label={L.tools} icon={<Wrench fill="currentColor" />} />
      <MenuItem label={L.settings} icon={<SlidersVertical />} />
      <Separator />
      <span className="flex h-[34px] items-center gap-[10px] pl-[9px] text-[13px]" style={{ color: C.subText }}><CircleChevronLeft className="size-[19px]" fill={C.icon} stroke={C.menu} />{L.collapse}</span>
    </nav>
  )
}

function MenuItem({ label, icon, current, open, late, badge, ...rest }: {
  label: string; icon: ReactNode; current?: boolean; open?: boolean; late?: boolean; badge?: number; 'data-t'?: string; 'data-hot'?: string
}) {
  const lit = current || open
  return (
    <span {...rest} className={cn('relative flex h-[34px] items-center text-[14px] text-white transition-colors duration-150', late && 'delay-[520ms]')}
      style={{ background: lit ? C.blue : undefined }}>
      <span className="grid w-[36px] shrink-0 place-items-center [&>svg]:size-[19px] [&>svg]:stroke-[2.2]" style={{ color: lit ? '#fff' : C.icon }}>{icon}</span>
      {label}{badge !== undefined && <Bubble n={badge} />}
      {/* Săgeata spre pagină (meniul curent) sau spre submeniul deschis */}
      {lit && <span className={cn('absolute right-0 top-1/2 size-0 -translate-y-1/2 border-y-[8px] border-r-[8px] border-y-transparent transition-colors duration-150', late && 'delay-[520ms]')}
        style={{ borderRightColor: open ? C.sub : C.bg }} />}
    </span>
  )
}

function SubMenu({ children }: { children: ReactNode }) {
  return <div className="pb-[8px] pt-[7px]" style={{ background: C.sub }}>{children}</div>
}

function SubItem({ label, current, badge }: { label: string; current?: boolean; badge?: number }) {
  return (
    <span className={cn('flex h-[28px] items-center pl-[12px] text-[13px]', current && 'font-semibold')} style={{ color: current ? '#fff' : C.subText }}>
      {label}{badge !== undefined && <Bubble n={badge} />}
    </span>
  )
}

function Separator() {
  return <span className="block h-[11px]" />
}

/** Bulina cu numărul (actualizări, comentarii, comenzi). */
function Bubble({ n }: { n: number }) {
  return <span className="ml-[6px] grid h-[18px] min-w-[18px] place-items-center rounded-full px-[5px] text-[11px] font-semibold leading-none text-white" style={{ background: C.blue }}>{n}</span>
}

// ——— Panou control ———

function Dashboard({ L }: { L: Text }) {
  return (
    <div className="absolute inset-0 left-[160px]">
      {/* Opțiuni ecran / Ajutor, atârnate de bara de sus */}
      <div className="absolute right-[20px] top-[32px] flex gap-[6px]">
        {[L.screenOptions, L.help].map(label => (
          <span key={label} className="flex h-[31px] items-center gap-[6px] rounded-b-[4px] border border-t-0 bg-white pl-[16px] pr-[10px] text-[13px]" style={{ borderColor: C.border, color: C.muted }}>
            {label}<Caret />
          </span>
        ))}
      </div>
      <h1 className="absolute left-[22px] top-[46px] text-[23px] font-normal leading-[30px]" style={{ color: C.title }}>{L.dashboard}</h1>

      <div className="absolute left-[22px] top-[96px] w-[526px] space-y-[20px]">
        <Postbox title={L.setup}>
          <div className="flex gap-[16px] pt-[12px]">
            <div className="flex-1">
              <span className="inline-flex h-[28px] items-center gap-[6px] rounded-full border px-[8px] text-[12px]" style={{ borderColor: C.border, color: '#50575e' }}>
                <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="5.6" fill="none" stroke="#c3c4c7" strokeWidth="1.6" /><path d="M7 1.4a5.6 5.6 0 0 1 5.6 5.6" fill="none" stroke="#50575e" strokeWidth="1.6" /></svg>
                {L.setupStep}
              </span>
              <p className="mt-[12px] text-[13px] leading-[18px]" style={{ color: C.text }}>{L.setupText}</p>
              <span className="mt-[12px] flex h-[40px] w-fit items-center rounded-[2px] px-[16px] text-[13px] font-semibold text-white" style={{ background: C.blue }}>{L.setupCta}</span>
            </div>
            <SetupArt />
          </div>
        </Postbox>
        <Postbox title={L.glance}>
          <div className="grid grid-cols-2 gap-x-[16px] gap-y-[10px] pt-[12px]">
            {L.glanceItems.map((item, i) => (
              <span key={item} className="flex items-center gap-[8px] text-[13px]" style={{ color: C.blue }}>
                <span style={{ color: '#8c8f94' }}>{[<Pin key="p" className="size-[16px] rotate-45" fill="currentColor" />, <Files key="f" className="size-[16px]" />, <MessageSquare key="c" className="size-[16px]" fill="currentColor" />][i]}</span>
                {item}
              </span>
            ))}
          </div>
        </Postbox>
      </div>

      <div className="absolute left-[564px] top-[96px] w-[536px] space-y-[20px]">
        <Postbox title={L.draft}>
          <div className="pt-[12px]">
            <span className="block text-[13px]">{L.draftTitle}</span>
            <span className="mt-[6px] block h-[40px] rounded-[2px] border bg-white" style={{ borderColor: '#949494' }} />
            <span className="mt-[16px] block text-[13px]">{L.draftContent}</span>
            <span className="mt-[6px] block h-[90px] rounded-[2px] border bg-white px-[12px] pt-[10px] text-[13px]" style={{ borderColor: '#949494', color: C.muted }}>{L.draftPlaceholder}</span>
            <span className="mt-[12px] flex h-[40px] w-fit items-center rounded-[2px] px-[16px] text-[13px] font-semibold text-white" style={{ background: C.blue }}>{L.draftSave}</span>
          </div>
        </Postbox>
        <Postbox title={L.events} flush>
          <div className="px-[12px] py-[12px]">
            <p>{L.eventsIntro}</p>
            <span className="mt-[2px] flex items-center gap-[4px]" style={{ color: C.blue }}><MapPin className="size-[16px]" fill="currentColor" stroke="#fff" />{L.eventsLocation}</span>
          </div>
          <div className="flex items-start gap-[10px] border-t bg-[#f6f7f7] px-[12px] py-[10px]" style={{ borderColor: '#dcdcde' }}>
            <span className="mt-[2px] size-[16px] rounded-[3px] bg-[#8c8f94]" />
            <span className="flex-1">
              <span className="block" style={{ color: C.blue }}>{L.event}</span>
              <span className="block">{L.eventPlace}</span>
            </span>
            <span>{L.eventDate}</span>
          </div>
        </Postbox>
      </div>
    </div>
  )
}

function Postbox({ title, flush, children }: { title: string; flush?: boolean; children: ReactNode }) {
  return (
    <div className="border bg-white" style={{ borderColor: C.border }}>
      <div className="flex h-[43px] items-center border-b pl-[16px] pr-[8px] text-[14px] font-semibold" style={{ borderColor: C.border, color: C.title }}>
        <span className="flex-1">{title}</span>
        <span className="flex items-center gap-[10px]" style={{ color: '#787c82' }}>
          <ChevronUp className="size-[16px]" strokeWidth={2.4} /><ChevronDown className="size-[16px]" strokeWidth={2.4} />
          <svg width="10" height="7" viewBox="0 0 10 7"><path d="M5 0 10 7H0Z" fill="currentColor" /></svg>
        </span>
      </div>
      <div className={flush ? '' : 'px-[12px] pb-[12px]'}>{children}</div>
    </div>
  )
}

/** Ilustrația din „Inițializare WooCommerce" (omul la laptop), simplificată. */
function SetupArt() {
  return (
    <svg width="118" height="72" viewBox="0 0 118 72" className="mt-[24px] shrink-0">
      <ellipse cx="66" cy="44" rx="50" ry="26" fill="#e9eefb" />
      <path d="M86 18 108 6" stroke="#3858e9" strokeWidth="1.5" strokeDasharray="3 3" />
      <circle cx="30" cy="14" r="2" fill="#3858e9" /><circle cx="44" cy="8" r="1.5" fill="#9fb0f3" /><circle cx="100" cy="30" r="1.5" fill="#9fb0f3" />
      <circle cx="52" cy="30" r="7" fill="#f2d3b9" /><path d="M45 28c1-6 13-7 14 0" fill="#1e1e1e" />
      <path d="M40 66c0-14 6-24 12-24s12 10 12 24Z" fill="#3858e9" />
      <rect x="62" y="48" width="28" height="18" rx="2" fill="#bfc9f7" /><rect x="58" y="65" width="38" height="3" rx="1" fill="#9fb0f3" />
    </svg>
  )
}

// ——— Setări WooCommerce ———

function Settings({ L, beat, hot }: { L: Text; beat: number; hot: string | undefined }) {
  const advanced = beat >= 4
  const view = !advanced ? 'general' : beat === 4 ? 'pages' : beat === 5 ? 'empty' : beat <= 10 ? 'form' : 'keys'

  return (
    <div className="absolute inset-0 left-[160px] top-[32px]">
      {/* Antetul: „Setări" și filele */}
      <div className="absolute inset-x-0 top-0 h-[101px] border-b border-[#ebebeb] bg-white">
        <p className="absolute left-[29px] top-[20px] text-[15px] font-semibold leading-[20px] text-[#1e1e1e]">{L.settings}</p>
        <div className="absolute bottom-[-1px] left-[29px] flex gap-[23px] whitespace-nowrap">
          {L.tabs.map((tab, i) => {
            const active = advanced ? i === 9 : i === 0
            return (
              <span key={tab} {...(i === 9 ? hit('w-tab-adv', hot) : {})}
                className={cn('border-b-2 pb-[10px] text-[13px] font-medium leading-[20px]', hover, active ? 'border-[#3858e9] text-[#1e1e1e]' : 'border-transparent text-[#50575e] data-hot:text-[#1e1e1e]')}>
                {tab}
              </span>
            )
          })}
        </div>
      </div>

      {view === 'general' && (
        <div className="absolute left-[29px] top-[120px] w-[1060px]">
          <h2 className="text-[17px] font-semibold leading-[22px]" style={{ color: C.title }}>{L.storeAddress}</h2>
          <p className="mt-[12px]">{L.storeAddressDesc}</p>
          <div className="mt-[18px] space-y-[32px]">
            {L.addressRows.map(label => (
              <Row key={label} label={label} help><Input w={400} /></Row>
            ))}
          </div>
        </div>
      )}

      {advanced && (
        <>
          {/* Secțiunile filei Avansate */}
          <p className="absolute left-[29px] top-[118px] flex whitespace-nowrap text-[13px] leading-[18px]">
            {L.sections.map((s, i) => {
              const current = view === 'pages' ? i === 0 : i === 1
              return (
                <span key={s} className="flex">
                  {i > 0 && <span className="px-[7px]" style={{ color: C.muted }}>|</span>}
                  <span {...(i === 1 ? hit('w-sec-keys', hot) : {})}
                    className={cn(hover, current ? 'font-semibold text-black' : 'text-[#3858e9] data-hot:text-[#2145e6] data-hot:underline')}>{s}</span>
                </span>
              )
            })}
          </p>

          {view === 'pages' && (
            <div className="absolute left-[29px] top-[156px] w-[1060px]">
              <h2 className="text-[17px] font-semibold leading-[22px]" style={{ color: C.title }}>{L.pageSetup}</h2>
              <p className="mt-[13px]">{L.pageSetupDesc}</p>
              <div className="mt-[31px] space-y-[42px]">
                {L.pageRows.map(([label, value]) => (
                  <Row key={label} label={label} help>
                    <Select2 value={value} placeholder={L.searchPage} />
                  </Row>
                ))}
              </div>
              <h2 className="mt-[44px] text-[17px] font-semibold leading-[22px]" style={{ color: C.title }}>{L.endpoints}</h2>
              <p className="mt-[13px]">{L.endpointsDesc}</p>
            </div>
          )}

          {view === 'empty' && (
            <>
              <div className="absolute left-[29px] top-[152px] flex items-center gap-[9px]">
                <h2 className="text-[17px] font-semibold leading-[22px]" style={{ color: C.title }}>{L.restApi}</h2>
                <span className="flex h-[32px] items-center rounded-[3px] border px-[12px] text-[13px]" style={{ borderColor: C.blue, color: C.blue }}>{L.addKey}</span>
              </div>
              <div className="absolute inset-x-0 top-[253px] flex flex-col items-center text-center">
                <Gear />
                <p className="mt-[34px] max-w-[400px] text-[15.6px] leading-[23.4px] text-[#aaa]">{L.intro}</p>
                <span {...hit('w-create', hot)} className={cn('mt-[20px] rounded-[3px] px-[24px] py-[23px] text-[16.9px] font-semibold leading-[24px] text-white', hover, 'bg-[#3858e9] data-hot:bg-[#2145e6]')}>{L.create}</span>
              </div>
            </>
          )}

          {(view === 'form' || view === 'keys') && (
            <div className="absolute left-[29px] top-[156px] w-[1060px]">
              <h2 className="text-[17px] font-semibold leading-[22px]" style={{ color: C.title }}>{L.details}</h2>
              {view === 'keys' && (
                <p className="mt-[10px] border-l-4 border-[#4ab866] bg-[#eff9f1] px-[12px] py-[14px] text-[13px] font-semibold leading-[18px] text-[#1e1e1e]">{L.success}</p>
              )}
              <ul className={cn('list-[square] border-l-4 bg-white py-[12px] pl-[34px] pr-[12px] shadow-[0_1px_1px_rgba(0,0,0,0.04)]', view === 'keys' ? 'mt-[18px]' : 'mt-[14px]')} style={{ borderColor: C.border }}>
                {L.notes.map(note => <li key={note} className="py-[3px] leading-[18px]">{note}</li>)}
              </ul>

              {view === 'form' && <KeyForm L={L} beat={beat} hot={hot} />}
              {view === 'keys' && <Keys L={L} beat={beat} hot={hot} />}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function KeyForm({ L, beat, hot }: { L: Text; beat: number; hot: string | undefined }) {
  const open = beat === 9
  const focused = beat >= 8 && beat <= 9
  return (
    <div className="relative mt-[31px]">
      <Row label={L.description} help>
        <span {...hit('w-desc', hot)} className={cn('flex h-[40px] w-[400px] items-center rounded-[2px] border bg-white px-[12px] text-[14px] text-[#1e1e1e]', beat === 7 && 'shadow-[0_0_0_1px_#3858e9]')}
          style={{ borderColor: beat === 7 ? C.blue : '#949494' }}>
          <Typed text="Hontrio" typing={beat === 7} done={beat > 7} />
        </span>
      </Row>
      <p className="ml-[234px] mt-[8px]" style={{ color: C.muted }}>{L.descriptionHelp}</p>

      <div className="mt-[37px]">
        <Row label={L.user} help><Select2 value={L.userValue} /></Row>
      </div>

      <div className="relative mt-[41px]">
        <Row label={L.permissions} help>
          <span {...hit('w-perm', hot)} className={cn('flex h-[31px] w-[400px] items-center justify-between rounded-[3px] border bg-white pl-[8px] pr-[8px] text-[14px]', hover,
            focused ? 'border-[#3858e9] text-[#3858e9] shadow-[0_0_0_1px_#3858e9]' : 'border-[#8c8f94] text-[#2c3338] data-hot:border-[#3858e9]')}>
            {L.perms[0]}<ChevronDown className="size-[16px]" strokeWidth={2} />
          </span>
        </Row>
        {/* Lista deschisă a câmpului (ca în Chrome) */}
        {open && (
          <div className="absolute left-[234px] top-[31px] z-10 w-[400px] border-2 border-t-0 bg-white" style={{ borderColor: C.blue }}>
            {L.perms.map((p, i) => (
              <span key={p} {...(i === 0 ? hit('w-opt-read', hot) : {})} className="flex h-[35px] items-center px-[8px] text-[13px]"
                style={i === 0 ? { background: C.blue, color: '#fff' } : { color: '#000' }}>{p}</span>
            ))}
          </div>
        )}
      </div>

      <span {...hit('w-generate', hot)} className={cn('mt-[72px] flex h-[40px] w-fit items-center rounded-[2px] px-[16px] text-[13px] font-semibold text-white', hover, 'bg-[#3858e9] data-hot:bg-[#2145e6]')}>{L.generate}</span>
    </div>
  )
}

function Keys({ L, beat, hot }: { L: Text; beat: number; hot: string | undefined }) {
  const rows = [['ck', L.ck, CK, 11], ['cs', L.cs, CS, 13]] as const
  return (
    <div className="mt-[27px] space-y-[40px]">
      {rows.map(([id, label, value, at]) => (
        <Row key={id} label={label}>
          <span className="flex h-[39px] w-[400px] items-center overflow-hidden rounded-[2px] border bg-[#f0f0f0] px-[8px] text-[14px] text-[#1e1e1e]" style={{ borderColor: '#949494' }}>
            <span className="truncate">{value}</span>
          </span>
          <span className="relative ml-[5px]">
            <span {...hit(`w-copy-${id}`, hot)} className={cn('flex h-[39px] items-center rounded-[2px] border px-[16px] text-[13px]', hover, 'bg-transparent data-hot:bg-[#f6f7fe]')} style={{ borderColor: C.blue, color: C.blue }}>
              {L.copy}
            </span>
            {/* „Copiat!" deasupra butonului, imediat după clic (animat de Framer: apare și când cheile tocmai s-au afișat) */}
            <motion.span initial={{ opacity: 0 }} animate={{ opacity: beat === at || beat === at + 1 ? 1 : 0 }} transition={{ duration: 0.15, delay: beat === at ? CLICK_AT : 0 }}
              className="absolute bottom-full left-1/2 mb-[6px] -translate-x-1/2 whitespace-nowrap rounded-[3px] bg-[#1e1e1e] px-[8px] py-[4px] text-[12px] text-white">{L.copied}</motion.span>
          </span>
        </Row>
      ))}
      <Row label={L.qr}><QrCode /></Row>
      <span className="block text-[13px] text-[#aa0000] underline-offset-2">{L.revoke}</span>
    </div>
  )
}

// ——— Piese de formular ———

function Row({ label, help, children }: { label: string; help?: boolean; children: ReactNode }) {
  return (
    <div className="flex items-start">
      <span className="w-[210px] shrink-0 pt-[7px] text-[14px] font-semibold leading-[18px]" style={{ color: C.title }}>{label}</span>
      <span className="grid w-[24px] shrink-0 place-items-start pt-[8px]">{help && <CircleHelp className="size-[13px]" fill="#666" stroke="#fff" strokeWidth={2.4} />}</span>
      <span className="flex items-start">{children}</span>
    </div>
  )
}

function Input({ w }: { w: number }) {
  return <span className="block h-[40px] rounded-[2px] border bg-white" style={{ width: w, borderColor: '#949494' }} />
}

/** Câmpul de căutare al WooCommerce (selectWoo), cu „×" și săgeată. */
function Select2({ value, placeholder }: { value: string; placeholder?: string }) {
  return (
    <span className="flex h-[30px] w-[400px] items-center rounded-[4px] border bg-white pl-[8px] pr-[6px] text-[14px]" style={{ borderColor: '#7e8993', color: value ? '#444' : '#999' }}>
      <span className="flex-1 truncate">{value || placeholder}</span>
      {value && <X className="mr-[6px] size-[12px] text-[#888]" strokeWidth={2.6} />}
      <ChevronDown className="size-[16px] text-[#50575e]" strokeWidth={2.2} />
    </span>
  )
}

function Caret() {
  return <svg width="9" height="6" viewBox="0 0 9 6"><path d="M0 0h9L4.5 6Z" fill="currentColor" /></svg>
}

// ——— Iconițe care nu există în setul nostru ———

function WpLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20">
      <circle cx="10" cy="10" r="9" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <text x="10" y="14.6" textAnchor="middle" fontFamily="Georgia, 'Times New Roman', serif" fontWeight="700" fontSize="13" fill="currentColor">W</text>
    </svg>
  )
}

function HomeIcon() {
  return <svg width="18" height="18" viewBox="0 0 20 20"><path d="M10 2 1.5 9.5h2.5V18h4.5v-5h3v5H16V9.5h2.5Z" fill="currentColor" /></svg>
}

/** Semnul WooCommerce din meniu: un „W" plin, cu capete rotunjite. */
function WooIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M2.2 5.6 4.6 14.6 8.4 7.8 11.6 14.6 15 5.6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function PaymentsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect x="2.2" y="3.2" width="15.6" height="13.6" rx="1.6" stroke="currentColor" strokeWidth="2" />
      <text x="10" y="14.2" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="11" fill="currentColor">$</text>
    </svg>
  )
}

function Avatar({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" className="rounded-full">
      <rect width="18" height="18" fill="#c3c4c7" />
      <circle cx="9" cy="7" r="3.4" fill="#fff" /><path d="M2.5 18c.6-4 3.2-6 6.5-6s5.9 2 6.5 6Z" fill="#fff" />
    </svg>
  )
}

/** Rotița mare din „Chei REST API" când nu există încă nicio cheie. */
function Gear() {
  const teeth = Array.from({ length: 10 }, (_, i) => i * 36)
  return (
    <svg width="128" height="128" viewBox="0 0 128 128">
      <g fill="#dcdcde">{teeth.map(a => <rect key={a} x="55" y="0" width="18" height="22" rx="3" transform={`rotate(${a} 64 64)`} />)}</g>
      <circle cx="64" cy="64" r="48" fill="#dcdcde" />
      <circle cx="64" cy="64" r="30" fill={C.bg} />
    </svg>
  )
}

// Un cod QR de formă (nu codifică nimic): cele trei pătrate de colț și puncte fixe
const QR = (() => {
  const n = 29
  const cells: boolean[][] = Array.from({ length: n }, () => Array<boolean>(n).fill(false))
  let seed = 20261115
  const rand = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648
    return seed / 2147483648
  }
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) cells[y][x] = rand() < 0.47
  const finder = (ox: number, oy: number) => {
    for (let y = -1; y <= 7; y++) {
      for (let x = -1; x <= 7; x++) {
        const X = ox + x
        const Y = oy + y
        if (X < 0 || Y < 0 || X >= n || Y >= n) continue
        const ring = Math.max(Math.abs(x - 3), Math.abs(y - 3))
        cells[Y][X] = ring === 3 || ring <= 1
      }
    }
  }
  finder(0, 0)
  finder(n - 7, 0)
  finder(0, n - 7)
  for (let i = 8; i < n - 8; i++) {
    cells[6][i] = i % 2 === 0
    cells[i][6] = i % 2 === 0
  }
  let d = ''
  cells.forEach((row, y) => row.forEach((on, x) => { if (on) d += `M${x} ${y}h1v1h-1z` }))
  return { n, d }
})()

function QrCode() {
  const style: CSSProperties = { shapeRendering: 'crispEdges' }
  return (
    <svg width="120" height="120" viewBox={`-1 -1 ${QR.n + 2} ${QR.n + 2}`} className="mt-[-12px] bg-white" style={style}>
      <path d={QR.d} fill="#000" />
    </svg>
  )
}

export const WOOCOMMERCE: Scene = { beats: BEATS, Screen: WooScreen }
