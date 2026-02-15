import { getServerSession } from 'next-auth'
import { authOptions } from './auth.config'

export async function getSession() {
  return await getServerSession(authOptions)
}

export async function getCurrentUser() {
  const session = await getSession()

  if (!session?.user) {
    return null
  }

  return session.user
}