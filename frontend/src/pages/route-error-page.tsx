import { ArrowLeft, RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import styles from './not-found-page.module.css'

export default function RouteErrorPage() {
  return (
    <main id="main-content" className={styles.page}>
      <span className={styles.code}>加载失败</span>
      <h1>页面暂时没有加载成功</h1>
      <p>网络可能刚刚中断，或者页面资源已经更新。重新加载通常可以恢复。</p>
      <div className={styles.actions}>
        <button
          className={styles.primaryAction}
          type="button"
          onClick={() => window.location.reload()}
        >
          <RefreshCw aria-hidden="true" size={18} />
          重新加载
        </button>
        <Link className={styles.secondaryAction} to="/">
          <ArrowLeft aria-hidden="true" size={18} />
          返回首页
        </Link>
      </div>
    </main>
  )
}
