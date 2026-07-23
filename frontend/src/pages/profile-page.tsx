import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowRight,
  Bookmark,
  FilePenLine,
  LogOut,
  ShieldCheck,
  ShieldPlus,
} from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import {
  articleKeys,
  getContributionOverview,
  listFavorites,
  type ContributionItem,
} from '../api/articles'
import { authKeys, logout, useCurrentUser } from '../api/auth'
import { ApiError } from '../api/client'
import {
  applyForReviewer,
  getMyReviewerApplication,
  reviewerApplicationKeys,
} from '../api/governance'
import { ErrorState, ListSkeleton } from '../components/request-state'
import styles from './profile-page.module.css'

const statusText: Record<ContributionItem['status'], string> = {
  draft: '草稿',
  pending: '审核中',
  approved: '已发布',
  rejected: '需修改',
  superseded: '历史版本',
  withdrawn: '已撤回',
}

export default function ProfilePage() {
  const currentUser = useCurrentUser()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [applicationOpen, setApplicationOpen] = useState(false)
  const [statement, setStatement] = useState('')
  const activeTab =
    searchParams.get('tab') === 'favorites' ? 'favorites' : 'contributions'
  const overview = useQuery({
    queryKey: articleKeys.overview,
    queryFn: ({ signal }) => getContributionOverview(signal),
    enabled: Boolean(currentUser.data),
  })
  const favorites = useQuery({
    queryKey: articleKeys.favorites,
    queryFn: ({ signal }) => listFavorites(signal),
    enabled: Boolean(currentUser.data),
  })
  const reviewerApplication = useQuery({
    queryKey: reviewerApplicationKeys.mine,
    queryFn: ({ signal }) => getMyReviewerApplication(signal),
    enabled: currentUser.data?.role === 'contributor',
    refetchInterval: (query) =>
      query.state.data?.status === 'pending' ? 60_000 : false,
  })
  const applicationMutation = useMutation({
    mutationFn: () => applyForReviewer(statement),
    onSuccess: (application) => {
      queryClient.setQueryData(reviewerApplicationKeys.mine, application)
      setApplicationOpen(false)
      setStatement('')
    },
  })
  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.setQueryData(authKeys.currentUser, null)
      navigate('/')
    },
  })

  if (!currentUser.isPending && !currentUser.data) {
    return <Navigate replace to="/login?from=/profile" />
  }

  if (currentUser.isPending) {
    return (
      <main id="main-content" className={styles.page}>
        <ListSkeleton rows={4} />
      </main>
    )
  }

  if (!currentUser.data) return null

  const initial = currentUser.data.username.slice(0, 1).toLocaleUpperCase()
  const canReview =
    currentUser.data.role === 'admin' ||
    currentUser.data.role === 'reviewer' ||
    reviewerApplication.data?.status === 'approved'

  return (
    <main id="main-content" className={styles.page}>
      <header className={styles.identity}>
        <div className={styles.avatar} aria-hidden="true">
          {initial}
          <i />
        </div>
        <h1>{currentUser.data.username}</h1>
        <div className={styles.identityActions}>
          {canReview ? (
            <Link to="/reviews">
              <ShieldCheck aria-hidden="true" size={17} />
              审核队列
            </Link>
          ) : null}
          {currentUser.data.role === 'contributor' &&
          !reviewerApplication.data ? (
            <button type="button" onClick={() => setApplicationOpen(true)}>
              <ShieldPlus aria-hidden="true" size={17} />
              申请审核权
            </button>
          ) : null}
          <button
            type="button"
            disabled={logoutMutation.isPending}
            onClick={() => logoutMutation.mutate()}
          >
            <LogOut aria-hidden="true" size={17} />
            退出登录
          </button>
        </div>
      </header>

      <div className={styles.roleLine}>
        <span>
          {currentUser.data.role === 'admin'
            ? '管理员'
            : currentUser.data.role === 'reviewer'
              ? '审核员'
              : reviewerApplication.data?.status === 'approved'
                ? '审核员'
              : reviewerApplication.data?.status === 'pending'
                ? '审核权申请中'
                : '贡献者'}
        </span>
        {reviewerApplication.data?.status === 'rejected' ? (
          <button type="button" onClick={() => setApplicationOpen(true)}>
            重新申请
          </button>
        ) : null}
      </div>

      {reviewerApplication.data?.status === 'rejected' &&
      reviewerApplication.data.review_note ? (
        <p className={styles.applicationNote}>
          上次申请未通过：{reviewerApplication.data.review_note}
        </p>
      ) : null}

      {applicationOpen ? (
        <section className={styles.applicationForm} aria-label="申请审核权">
          <label>
            说明你熟悉的方向与审核经验
            <textarea
              rows={4}
              minLength={10}
              maxLength={1000}
              value={statement}
              placeholder="例如：熟悉开关电源和 STM32，愿意核对测量条件与修复验证。"
              onChange={(event) => setStatement(event.target.value)}
            />
          </label>
          {applicationMutation.isError ? (
            <p role="alert">
              {applicationMutation.error instanceof ApiError
                ? applicationMutation.error.message
                : '申请提交失败'}
            </p>
          ) : null}
          <div>
            <button type="button" onClick={() => setApplicationOpen(false)}>
              取消
            </button>
            <button
              type="button"
              disabled={
                statement.trim().length < 10 || applicationMutation.isPending
              }
              onClick={() => applicationMutation.mutate()}
            >
              提交申请
            </button>
          </div>
        </section>
      ) : null}

      <nav className={styles.tabs} aria-label="个人内容">
        <Link
          to="/profile?tab=contributions"
          aria-current={activeTab === 'contributions' ? 'page' : undefined}
        >
          <FilePenLine aria-hidden="true" size={18} />
          贡献
          <strong>{overview.data?.total ?? '…'}</strong>
        </Link>
        <Link
          to="/profile?tab=favorites"
          aria-current={activeTab === 'favorites' ? 'page' : undefined}
        >
          <Bookmark aria-hidden="true" size={18} />
          收藏
          <strong>{favorites.data?.total ?? '…'}</strong>
        </Link>
      </nav>

      {activeTab === 'contributions' ? (
        <section className={styles.content} aria-labelledby="contributions-title">
          <h2 id="contributions-title" className="sr-only">我的贡献</h2>
          {overview.isLoading ? <ListSkeleton rows={4} /> : null}
          {overview.isError ? (
            <ErrorState
              description="个人贡献暂时无法加载。"
              onRetry={() => void overview.refetch()}
            />
          ) : null}
          {overview.data ? (
            <dl className={styles.summary}>
              <div><dt>已发布</dt><dd>{overview.data.published}</dd></div>
              <div><dt>审核中</dt><dd>{overview.data.pending}</dd></div>
              <div><dt>草稿 / 修改</dt><dd>{overview.data.drafts}</dd></div>
            </dl>
          ) : null}
          {overview.data?.recent.length === 0 ? (
            <div className={styles.empty}>
              <p>还没有贡献记录。</p>
              <Link to="/explore">选择一篇文档开始修改</Link>
            </div>
          ) : null}
          {overview.data?.recent.length ? (
            <ol className={styles.list}>
              {overview.data.recent.map((item) => (
                <li key={item.id}>
                  <Link to={`/articles/${item.symptom_id}`}>
                    <span>{statusText[item.status]}</span>
                    <strong>{item.title}</strong>
                    <time dateTime={item.updated_at}>
                      {new Date(item.updated_at).toLocaleDateString('zh-CN')}
                    </time>
                    <ArrowRight aria-hidden="true" size={19} />
                  </Link>
                </li>
              ))}
            </ol>
          ) : null}
        </section>
      ) : (
        <section className={styles.content} aria-labelledby="favorites-title">
          <h2 id="favorites-title" className="sr-only">我的收藏</h2>
          {favorites.isLoading ? <ListSkeleton rows={4} /> : null}
          {favorites.isError ? (
            <ErrorState
              description="收藏暂时无法加载。"
              onRetry={() => void favorites.refetch()}
            />
          ) : null}
          {favorites.data?.items.length === 0 ? (
            <div className={styles.empty}>
              <p>还没有收藏文档。</p>
              <Link to="/explore">去查 BUG</Link>
            </div>
          ) : null}
          {favorites.data?.items.length ? (
            <ol className={styles.list}>
              {favorites.data.items.map((item) => (
                <li key={item.symptom_id}>
                  <Link to={`/articles/${item.symptom_id}`}>
                    <span>
                      <Bookmark aria-hidden="true" size={15} />
                      收藏
                    </span>
                    <strong>{item.name}</strong>
                    <span>{item.description}</span>
                    <ArrowRight aria-hidden="true" size={19} />
                  </Link>
                </li>
              ))}
            </ol>
          ) : null}
        </section>
      )}
    </main>
  )
}
