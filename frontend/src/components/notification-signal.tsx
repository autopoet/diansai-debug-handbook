import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCheck, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCurrentUser } from '../api/auth'
import {
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  notificationKeys,
  type NotificationItem,
} from '../api/notifications'
import styles from './notification-signal.module.css'

function notificationLabel(item: NotificationItem) {
  if (item.kind === 'review_pending') return '待审核'
  if (item.kind === 'comment_reply') return '评论回复'
  return item.outcome === 'approved' ? '投稿通过' : '投稿驳回'
}

export function NotificationSignal() {
  const currentUser = useCurrentUser()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const unread = useQuery({
    queryKey: notificationKeys.unread,
    queryFn: ({ signal }) => getUnreadNotificationCount(signal),
    enabled: Boolean(currentUser.data),
    refetchInterval: 60_000,
  })
  const notifications = useQuery({
    queryKey: notificationKeys.list,
    queryFn: ({ signal }) => listNotifications(signal),
    enabled: Boolean(currentUser.data) && open,
  })
  const readMutation = useMutation({
    mutationFn: (notificationId: number) =>
      markNotificationRead(notificationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all })
    },
  })
  const readAllMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all })
    },
  })

  if (!currentUser.data) return null
  const count = unread.data?.count ?? 0

  function openNotification(item: NotificationItem) {
    if (!item.is_read) readMutation.mutate(item.id)
    setOpen(false)
    navigate(item.target_path)
  }

  return (
    <>
      <button
        ref={triggerRef}
        className={styles.signal}
        type="button"
        aria-label={count ? `${count} 条未读通知` : '通知'}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <Bell aria-hidden="true" size={15} />
        {count ? <span>{count > 99 ? '99+' : count}</span> : null}
      </button>
      {open ? (
        <aside className={styles.drawer} aria-label="通知">
          <header>
            <strong>通知</strong>
            <div>
              {count ? (
                <button
                  type="button"
                  disabled={readAllMutation.isPending}
                  onClick={() => readAllMutation.mutate()}
                >
                  <CheckCheck aria-hidden="true" size={16} />
                  全部已读
                </button>
              ) : null}
              <button
                type="button"
                aria-label="关闭通知"
                onClick={() => {
                  setOpen(false)
                  triggerRef.current?.focus()
                }}
              >
                <X aria-hidden="true" size={17} />
              </button>
            </div>
          </header>
          {notifications.isLoading ? <p>正在读取…</p> : null}
          {notifications.isError ? <p>通知暂时无法加载。</p> : null}
          {notifications.data?.items.length === 0 ? <p>没有新通知。</p> : null}
          <ol>
            {notifications.data?.items.map((item) => (
              <li key={item.id} data-read={item.is_read}>
                <button type="button" onClick={() => openNotification(item)}>
                  <span>{notificationLabel(item)}</span>
                  <strong>{item.title}</strong>
                  <p>{item.message}</p>
                  <time dateTime={item.created_at}>
                    {new Date(item.created_at).toLocaleString('zh-CN')}
                  </time>
                </button>
              </li>
            ))}
          </ol>
        </aside>
      ) : null}
    </>
  )
}
