// Testele rulează TypeScript direct cu Node (fără build): aliasul `@/` și
// importurile fără extensie se rezolvă aici, ca în Next.
// Folosit de `npm test` (node --experimental-transform-types --import ./scripts/test-hooks.mjs).
import { register } from 'node:module'

register('./test-resolve.mjs', import.meta.url)
