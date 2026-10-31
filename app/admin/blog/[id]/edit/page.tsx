'use client'

import { useParams } from 'next/navigation'
import { BlogEditor } from '@/components/admin/blog-editor'

export default function AdminBlogEditPage() {
  const { id } = useParams<{ id: string }>()
  return <BlogEditor key={id} postId={id} />
}
