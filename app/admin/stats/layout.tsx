import { pageTitle } from '@/components/app/page-title'

export const generateMetadata = pageTitle('admin.nav_stats')

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
