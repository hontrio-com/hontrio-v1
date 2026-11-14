// =============================================
// Arhivele extensiei Hontrio pentru OpenCart, servite din public/downloads
// (construite de scripts/build-opencart.mjs din integrations/opencart).
// OpenCart 4 face codul extensiei din numele fișierului urcat, deci arhiva lui
// trebuie să se numească exact `hontrio.ocmod.zip` (de aici dosarul separat).
// Modul pur: îl folosesc și formularele din browser.
// =============================================

// i18n-ignore-start (numele produsului și versiunea)
export const OPENCART_DOWNLOADS = [
  { version: '3', label: 'OpenCart 3.x', href: '/downloads/hontrio-opencart-3.ocmod.zip' },
  { version: '4', label: 'OpenCart 4.x', href: '/downloads/opencart-4/hontrio.ocmod.zip' },
] as const
// i18n-ignore-end
