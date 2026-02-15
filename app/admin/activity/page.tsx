'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Activity,
  ImageIcon,
  FileText,
  UserPlus,
  Store,
  Send,
  CreditCard,
  Clock,
  RefreshCw,
  Loader2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

type ActivityItem = {
  id: string
  type: string
  description: string
  user_email: string
  user_name: string | null
  created_at: string
  metadata: any
}

const fadeInUp = {
  initial: { opacity: 0, y: 15 },
  animate: { opacity: 1, y: 0 },
}

const getActivityIcon = (type: string) => {
  switch (type) {
    case 'user_registered': return { icon: UserPlus, bg: 'bg-green-100', color: 'text-green-600' }
    case 'store_connected': return { icon: Store, bg: 'bg-blue-100', color: 'text-blue-600' }
    case 'products_synced': return { icon: RefreshCw, bg: 'bg-indigo-100', color: 'text-indigo-600' }
    case 'text_generated': return { icon: FileText, bg: 'bg-blue-100', color: 'text-blue-600' }
    case 'image_generated': return { icon: ImageIcon, bg: 'bg-purple-100', color: 'text-purple-600' }
    case 'product_published': return { icon: Send, bg: 'bg-green-100', color: 'text-green-600' }
    case 'credits_added': return { icon: CreditCard, bg: 'bg-yellow-100', color: 'text-yellow-600' }
    default: return { icon: Activity, bg: 'bg-gray-100', color: 'text-gray-600' }
  }
}

export default function AdminActivityPage() {
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    fetchActivity()
  }, [])

  const fetchActivity = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    try {
      const res = await fetch('/api/admin/activity')
      const data = await res.json()
      setActivities(data.activities || [])
    } catch {
      console.error('Error loading activity')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-gray-200 rounded-lg animate-pulse" />
        <div className="space-y-3">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="h-16 bg-white rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  // Group activities by date
  const groupedActivities: Record<string, ActivityItem[]> = {}
  activities.forEach(a => {
    const date = new Date(a.created_at).toLocaleDateString('ro-RO', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    })
    if (!groupedActivities[date]) groupedActivities[date] = []
    groupedActivities[date].push(a)
  })

  return (
    <div className="space-y-6">
      <motion.div {...fadeInUp} transition={{ duration: 0.3 }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Activitate</h1>
            <p className="text-gray-500 text-sm mt-0.5">Tot ce se întâmplă pe platformă</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchActivity(true)}
            disabled={refreshing}
            className="rounded-xl border-gray-200"
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
            Reîmprospătează
          </Button>
        </div>
      </motion.div>

      {activities.length === 0 ? (
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Activity className="h-12 w-12 text-gray-300 mb-4" />
            <p className="text-gray-500 font-medium">Nicio activitate înregistrată</p>
            <p className="text-sm text-gray-400 mt-1">Activitățile vor apărea aici pe măsură ce utilizatorii interacționează</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedActivities).map(([date, items], groupIndex) => (
            <motion.div
              key={date}
              {...fadeInUp}
              transition={{ duration: 0.3, delay: groupIndex * 0.05 }}
            >
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3 capitalize">{date}</p>

              <Card className="rounded-2xl border-0 shadow-sm">
                <CardContent className="p-0">
                  {items.map((activity, i) => {
                    const iconConfig = getActivityIcon(activity.type)
                    const IconComponent = iconConfig.icon

                    return (
                      <div key={activity.id}>
                        <div className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50/50 transition-colors">
                          {/* Timeline connector */}
                          <div className="relative flex flex-col items-center">
                            <div className={`h-9 w-9 rounded-xl ${iconConfig.bg} flex items-center justify-center shrink-0`}>
                              <IconComponent className={`h-4 w-4 ${iconConfig.color}`} />
                            </div>
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-900">{activity.description}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[11px] text-gray-400">
                                {activity.user_name || activity.user_email}
                              </span>
                              <span className="text-gray-200">·</span>
                              <span className="text-[11px] text-gray-400">
                                {new Date(activity.created_at).toLocaleTimeString('ro-RO', {
                                  hour: '2-digit', minute: '2-digit'
                                })}
                              </span>
                            </div>
                          </div>

                          {/* Type badge */}
                          <Badge variant="secondary" className="bg-gray-100 text-gray-500 border-0 text-[10px] shrink-0">
                            {activity.type.replace(/_/g, ' ')}
                          </Badge>
                        </div>
                        {i < items.length - 1 && <div className="border-b border-gray-50 ml-[4.5rem]" />}
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}