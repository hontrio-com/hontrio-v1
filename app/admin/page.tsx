import { redirect } from 'next/navigation'

// /admin nu are o pagină a lui: duce la Statistici, prima din meniul de administrare
export default function AdminIndexPage() {
  redirect('/admin/stats')
}
