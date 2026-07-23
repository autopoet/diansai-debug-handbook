import { apiRequest } from './client'

export type NotificationKind =
  | 'review_pending'
  | 'submission_result'
  | 'comment_reply'

export type NotificationItem = {
  id: number
  kind: NotificationKind
  outcome: '' | 'approved' | 'rejected'
  actor_id: number | null
  actor_name: string | null
  revision_id: number | null
  symptom_id: number | null
  thread_id: number | null
  title: string
  message: string
  target_path: string
  is_read: boolean
  created_at: string
  read_at: string | null
}

export type NotificationList = {
  items: NotificationItem[]
  total: number
  unread: number
}

export type NotificationUnreadCount = {
  count: number
}

export const notificationKeys = {
  all: ['notifications'] as const,
  list: ['notifications', 'list'] as const,
  unread: ['notifications', 'unread'] as const,
}

export function listNotifications(signal?: AbortSignal) {
  return apiRequest<NotificationList>('/notifications?unread_only=false', {
    signal,
  })
}

export function getUnreadNotificationCount(signal?: AbortSignal) {
  return apiRequest<NotificationUnreadCount>('/notifications/unread-count', {
    signal,
  })
}

export function markNotificationRead(notificationId: number) {
  return apiRequest<NotificationItem>(
    `/notifications/${notificationId}/read`,
    { method: 'POST' },
  )
}

export function markAllNotificationsRead() {
  return apiRequest<void>('/notifications/read-all', { method: 'POST' })
}
