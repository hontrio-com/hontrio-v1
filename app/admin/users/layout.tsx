import { pageTitle } from '@/components/app/page-title'

export const generateMetadata = pageTitle('admin.nav_users')

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
