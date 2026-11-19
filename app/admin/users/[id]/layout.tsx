import { pageTitle } from '@/components/app/page-title'

export const generateMetadata = pageTitle('admin.account_page_title')

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
