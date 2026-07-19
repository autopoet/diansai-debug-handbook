import { CircleAlert, RefreshCw, SearchX } from 'lucide-react'
import styles from './request-state.module.css'

type ErrorStateProps = {
  title?: string
  description?: string
  onRetry?: () => void
}

type EmptyStateProps = {
  title: string
  description: string
  action?: React.ReactNode
}

export function ErrorState({
  title = '暂时无法加载内容',
  description = '请检查网络连接，稍后再试。',
  onRetry,
}: ErrorStateProps) {
  return (
    <div className={styles.state} role="alert">
      <CircleAlert aria-hidden="true" size={24} />
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {onRetry ? (
        <button className={styles.retryButton} type="button" onClick={onRetry}>
          <RefreshCw aria-hidden="true" size={17} />
          重新加载
        </button>
      ) : null}
    </div>
  )
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className={styles.state}>
      <SearchX aria-hidden="true" size={24} />
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {action}
    </div>
  )
}

export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className={styles.skeleton} aria-busy="true">
      <span className="sr-only">正在加载内容</span>
      {Array.from({ length: rows }, (_, index) => (
        <div className={styles.skeletonRow} key={index} aria-hidden="true">
          <span className={styles.skeletonTitle} />
          <span className={styles.skeletonLine} />
        </div>
      ))}
    </div>
  )
}
