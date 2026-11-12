import { pageTitle } from '@/components/app/page-title'

export const generateMetadata = pageTitle('sidebar.reports')

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
