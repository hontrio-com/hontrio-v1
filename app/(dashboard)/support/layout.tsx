import { pageTitle } from '@/components/app/page-title'

export const generateMetadata = pageTitle('sidebar.support')

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
