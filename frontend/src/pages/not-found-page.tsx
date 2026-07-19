import { ArrowLeft, Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import styles from './not-found-page.module.css'

export default function NotFoundPage() {
  return (
    <main id="main-content" className={styles.page}>
      <span className={styles.code}>404</span>
      <h1>没有找到这个页面</h1>
      <p>链接可能已经变更。你可以返回首页，或继续搜索故障现象。</p>
      <div className={styles.actions}>
        <Link className={styles.primaryAction} to="/explore">
          <Search aria-hidden="true" size={18} />
          搜索知识库
        </Link>
        <Link className={styles.secondaryAction} to="/">
          <ArrowLeft aria-hidden="true" size={18} />
          返回首页
        </Link>
      </div>
    </main>
  )
}
