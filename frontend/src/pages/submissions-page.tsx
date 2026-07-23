import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  type ArticleRevision,
  articleKeys,
  deleteDraft,
  listMyRevisions,
  withdrawRevision,
} from '../api/articles'
import { useCurrentUser } from '../api/auth'
import { ErrorState, ListSkeleton } from '../components/request-state'
import styles from './workflow-page.module.css'

const statusText = {
  draft: '草稿',
  pending: '待审核',
  approved: '已发布',
  rejected: '未通过',
  superseded: '历史版本',
  withdrawn: '已撤回',
}

export default function SubmissionsPage() {
  const currentUser = useCurrentUser()
  const queryClient = useQueryClient()
  const revisions = useQuery({
    queryKey: articleKeys.mine,
    queryFn: ({ signal }) => listMyRevisions(signal),
    enabled: Boolean(currentUser.data),
  })
  const revisionAction = useMutation({
    mutationFn: async ({
      action,
      revision,
    }: {
      action: 'withdraw' | 'delete'
      revision: ArticleRevision
    }) => {
      if (action === 'withdraw') {
        await withdrawRevision(revision.symptom_id)
      } else {
        await deleteDraft(revision.symptom_id)
      }
    },
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: articleKeys.mine })
      void queryClient.invalidateQueries({ queryKey: articleKeys.overview })
      void queryClient.invalidateQueries({ queryKey: articleKeys.reviews })
      void queryClient.invalidateQueries({
        queryKey: articleKeys.draft(variables.revision.symptom_id),
      })
    },
  })

  function deleteRevision(revision: ArticleRevision) {
    if (!window.confirm('删除这份未提交草稿？此操作无法撤销。')) return
    revisionAction.mutate({ action: 'delete', revision })
  }

  function withdrawSubmission(revision: ArticleRevision) {
    if (!window.confirm('撤回这份待审核版本并继续编辑？')) return
    revisionAction.mutate({ action: 'withdraw', revision })
  }

  if (!currentUser.data && !currentUser.isPending) {
    return (
      <main id="main-content" className={styles.narrowPage}>
        <h1>我的提交</h1>
        <Link className={styles.primaryLink} to="/login?from=/submissions">登录后查看</Link>
      </main>
    )
  }

  return (
    <main id="main-content" className={styles.listPage}>
      <header className={styles.pageTitle}>
        <div className={styles.titleLine}>
          <h1>我的提交</h1>
          <Link className={styles.primaryLink} to="/articles/new">
            新建条目
          </Link>
        </div>
      </header>
      {revisions.isLoading ? <ListSkeleton rows={4} /> : null}
      {revisions.isError ? <ErrorState description="提交记录加载失败。" /> : null}
      {revisions.data?.total === 0 ? (
        <p className={styles.emptyText}>还没有提交记录，可以从一个具体故障现象开始。</p>
      ) : null}
      <ul className={styles.workflowList}>
        {revisions.data?.items.map((revision) => (
          <li id={`revision-${revision.id}`} key={revision.id}>
            <div>
              <strong>{revision.title}</strong>
              <span>
                v{revision.version_number} · {statusText[revision.status]} · 修改者{' '}
                {revision.author_name} ·{' '}
                {new Date(revision.updated_at).toLocaleString('zh-CN')}
              </span>
              {revision.reviewer_name && revision.reviewed_at ? (
                <p>
                  审核者 {revision.reviewer_name} ·{' '}
                  {new Date(revision.reviewed_at).toLocaleString('zh-CN')}
                </p>
              ) : null}
              {revision.review_note ? <p>审核意见：{revision.review_note}</p> : null}
            </div>
            <div className={styles.rowActions}>
              {revision.status === 'pending' ? (
                <button
                  type="button"
                  disabled={revisionAction.isPending}
                  onClick={() => withdrawSubmission(revision)}
                >
                  撤回
                </button>
              ) : null}
              {revision.status === 'draft' ? (
                <button
                  type="button"
                  disabled={revisionAction.isPending}
                  onClick={() => deleteRevision(revision)}
                >
                  删除
                </button>
              ) : null}
              {revision.status === 'draft' || revision.status === 'rejected' ? (
                <Link to={`/articles/${revision.symptom_id}?edit=1`}>继续编辑</Link>
              ) : (
                <Link to={`/articles/${revision.symptom_id}`}>查看文档</Link>
              )}
            </div>
          </li>
        ))}
      </ul>
    </main>
  )
}
