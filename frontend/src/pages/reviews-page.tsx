import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { lazy, Suspense, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  type ArticleRevision,
  type ReviewQueueItem,
  approveRevision,
  articleKeys,
  listPendingReviews,
  rejectRevision,
  rollbackArticle,
} from '../api/articles'
import { useCurrentUser } from '../api/auth'
import { ApiError } from '../api/client'
import {
  type AdminArticle,
  type ReviewerApplication,
  decideReviewerApplication,
  governanceKeys,
  listAdminArticles,
  listAdminRevisions,
  listReviewerApplications,
  reviewerApplicationKeys,
} from '../api/governance'
import { notificationKeys } from '../api/notifications'
import { ErrorState, ListSkeleton } from '../components/request-state'
import styles from './workflow-page.module.css'

const RevisionDiff = lazy(() =>
  import('../components/revision-diff').then((module) => ({
    default: module.RevisionDiff,
  })),
)

function ReviewItem({ item }: { item: ReviewQueueItem }) {
  const { revision, base_revision: baseRevision } = item
  const queryClient = useQueryClient()
  const [note, setNote] = useState('')
  const decision = useMutation({
    mutationFn: (action: 'approve' | 'reject') =>
      action === 'approve'
        ? approveRevision(revision.id, note)
        : rejectRevision(revision.id, note),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: articleKeys.reviews })
      void queryClient.invalidateQueries({
        queryKey: articleKeys.published(revision.symptom_id),
      })
      void queryClient.invalidateQueries({
        queryKey: articleKeys.versions(revision.symptom_id),
      })
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all })
    },
  })

  return (
    <li id={`revision-${revision.id}`} className={styles.reviewItem}>
      <header>
        <div>
          <h2>{revision.title}</h2>
          <p>
            v{revision.version_number} · 修改者 {revision.author_name} ·{' '}
            {new Date(
              revision.submitted_at ?? revision.updated_at,
            ).toLocaleString('zh-CN')}
          </p>
        </div>
        <Link to={`/articles/${revision.symptom_id}`}>查看公开版本</Link>
      </header>
      <Suspense fallback={<ListSkeleton rows={4} />}>
        <RevisionDiff baseRevision={baseRevision} revision={revision} />
      </Suspense>
      <label>
        审核意见
        <textarea
          rows={3}
          value={note}
          placeholder="通过时可选；驳回时必填"
          onChange={(event) => setNote(event.target.value)}
        />
      </label>
      {decision.isError ? (
        <p className={styles.errorText} role="alert">
          {decision.error instanceof ApiError ? decision.error.message : '审核失败'}
        </p>
      ) : null}
      <div className={styles.formActions}>
        <button
          className={styles.secondaryButton}
          type="button"
          disabled={decision.isPending}
          onClick={() => decision.mutate('reject')}
        >
          驳回
        </button>
        <button
          className={styles.primaryButton}
          type="button"
          disabled={decision.isPending}
          onClick={() => decision.mutate('approve')}
        >
          通过并发布
        </button>
      </div>
    </li>
  )
}

function ApplicationItem({ item }: { item: ReviewerApplication }) {
  const queryClient = useQueryClient()
  const [note, setNote] = useState('')
  const decision = useMutation({
    mutationFn: (action: 'approve' | 'reject') =>
      decideReviewerApplication(item.id, action, note),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: reviewerApplicationKeys.pending,
      })
    },
  })
  return (
    <li className={styles.applicationItem}>
      <div>
        <strong>{item.username}</strong>
        <time dateTime={item.created_at}>
          {new Date(item.created_at).toLocaleString('zh-CN')}
        </time>
      </div>
      <p>{item.statement}</p>
      <label>
        处理意见
        <textarea
          rows={2}
          value={note}
          placeholder="驳回时请说明原因"
          onChange={(event) => setNote(event.target.value)}
        />
      </label>
      {decision.isError ? (
        <p className={styles.errorText} role="alert">
          {decision.error instanceof ApiError
            ? decision.error.message
            : '处理失败'}
        </p>
      ) : null}
      <div className={styles.formActions}>
        <button
          className={styles.secondaryButton}
          type="button"
          disabled={decision.isPending}
          onClick={() => decision.mutate('reject')}
        >
          驳回
        </button>
        <button
          className={styles.primaryButton}
          type="button"
          disabled={decision.isPending}
          onClick={() => decision.mutate('approve')}
        >
          授予审核权
        </button>
      </div>
    </li>
  )
}

function TakenDownArticleItem({ item }: { item: AdminArticle }) {
  const queryClient = useQueryClient()
  const [reason, setReason] = useState('')
  const [selectedRevisionId, setSelectedRevisionId] = useState<number | null>(
    null,
  )
  const revisions = useQuery({
    queryKey: governanceKeys.revisions(item.id),
    queryFn: ({ signal }) => listAdminRevisions(item.id, signal),
  })
  const restorable =
    revisions.data?.items.filter((revision: ArticleRevision) =>
      ['approved', 'superseded'].includes(revision.status),
    ) ?? []
  const revisionId = selectedRevisionId ?? restorable[0]?.id ?? 0
  const rollback = useMutation({
    mutationFn: () => rollbackArticle(item.id, revisionId, reason.trim()),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: governanceKeys.articles })
      void queryClient.invalidateQueries({
        queryKey: articleKeys.published(item.id),
      })
      void queryClient.invalidateQueries({
        queryKey: articleKeys.versions(item.id),
      })
    },
  })

  return (
    <li className={styles.applicationItem}>
      <div>
        <strong>{item.name}</strong>
        <span>已紧急撤下</span>
      </div>
      <p>{item.description}</p>
      <label>
        恢复来源
        <select
          value={revisionId || ''}
          disabled={revisions.isLoading || rollback.isPending}
          onChange={(event) => setSelectedRevisionId(Number(event.target.value))}
        >
          {restorable.map((revision) => (
            <option key={revision.id} value={revision.id}>
              v{revision.version_number} · {revision.author_name}
            </option>
          ))}
        </select>
      </label>
      <label>
        回滚原因
        <textarea
          rows={2}
          value={reason}
          placeholder="说明为什么恢复这个版本"
          onChange={(event) => setReason(event.target.value)}
        />
      </label>
      {rollback.isError ? (
        <p className={styles.errorText} role="alert">
          {rollback.error instanceof ApiError
            ? rollback.error.message
            : '恢复失败'}
        </p>
      ) : null}
      <div className={styles.formActions}>
        <button
          className={styles.primaryButton}
          type="button"
          disabled={!revisionId || reason.trim().length < 3 || rollback.isPending}
          onClick={() => rollback.mutate()}
        >
          生成回滚版本并恢复
        </button>
      </div>
    </li>
  )
}

export default function ReviewsPage() {
  const currentUser = useCurrentUser()
  const [searchParams] = useSearchParams()
  const isReviewer =
    currentUser.data?.role === 'reviewer' || currentUser.data?.role === 'admin'
  const requestedTab = searchParams.get('tab')
  const activeTab =
    currentUser.data?.role === 'admin' &&
    (requestedTab === 'permissions' || requestedTab === 'governance')
      ? requestedTab
      : 'content'
  const reviews = useQuery({
    queryKey: articleKeys.reviews,
    queryFn: ({ signal }) => listPendingReviews(signal),
    enabled: isReviewer,
  })
  const applications = useQuery({
    queryKey: reviewerApplicationKeys.pending,
    queryFn: ({ signal }) => listReviewerApplications(signal),
    enabled: currentUser.data?.role === 'admin',
  })
  const adminArticles = useQuery({
    queryKey: governanceKeys.articles,
    queryFn: ({ signal }) => listAdminArticles(signal),
    enabled: currentUser.data?.role === 'admin',
  })
  const takenDownArticles =
    adminArticles.data?.items.filter((item) => item.is_taken_down) ?? []

  if (!currentUser.isPending && !isReviewer) {
    return (
      <main id="main-content" className={styles.narrowPage}>
        <h1>审核队列</h1>
        <p>这个页面仅审核员可访问。</p>
      </main>
    )
  }

  return (
    <main id="main-content" className={styles.listPage}>
      <header className={styles.pageTitle}>
        <h1>审核</h1>
      </header>
      {currentUser.data?.role === 'admin' ? (
        <nav className={styles.queueTabs} aria-label="审核工作">
          <Link
            to="/reviews"
            aria-current={activeTab === 'content' ? 'page' : undefined}
          >
            待审内容 <span>{reviews.data?.total ?? '…'}</span>
          </Link>
          <Link
            to="/reviews?tab=permissions"
            aria-current={activeTab === 'permissions' ? 'page' : undefined}
          >
            审核权申请 <span>{applications.data?.total ?? '…'}</span>
          </Link>
          <Link
            to="/reviews?tab=governance"
            aria-current={activeTab === 'governance' ? 'page' : undefined}
          >
            已撤下 <span>{adminArticles.data ? takenDownArticles.length : '…'}</span>
          </Link>
        </nav>
      ) : null}

      {activeTab === 'content' ? (
        <>
          {reviews.isLoading ? <ListSkeleton rows={4} /> : null}
          {reviews.isError ? <ErrorState description="审核队列加载失败。" /> : null}
          {reviews.data?.total === 0 ? (
            <p className={styles.emptyText}>当前没有待审核版本。</p>
          ) : null}
          <ul className={styles.reviewList}>
            {reviews.data?.items.map((item) => (
              <ReviewItem key={item.revision.id} item={item} />
            ))}
          </ul>
        </>
      ) : activeTab === 'permissions' ? (
        <>
          {applications.isLoading ? <ListSkeleton rows={3} /> : null}
          {applications.isError ? (
            <ErrorState description="审核权申请加载失败。" />
          ) : null}
          {applications.data?.total === 0 ? (
            <p className={styles.emptyText}>当前没有待处理申请。</p>
          ) : null}
          <ul className={styles.applicationList}>
            {applications.data?.items.map((item) => (
              <ApplicationItem key={item.id} item={item} />
            ))}
          </ul>
        </>
      ) : (
        <>
          {adminArticles.isLoading ? <ListSkeleton rows={3} /> : null}
          {adminArticles.isError ? (
            <ErrorState description="撤下内容加载失败。" />
          ) : null}
          {adminArticles.data && takenDownArticles.length === 0 ? (
            <p className={styles.emptyText}>当前没有已撤下文章。</p>
          ) : null}
          <ul className={styles.applicationList}>
            {takenDownArticles.map((item) => (
              <TakenDownArticleItem key={item.id} item={item} />
            ))}
          </ul>
        </>
      )}
    </main>
  )
}
