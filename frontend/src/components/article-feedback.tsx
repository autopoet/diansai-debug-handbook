import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  articleKeys,
  clearArticleFeedback,
  getArticleFeedback,
  setArticleFeedback,
} from '../api/articles'
import { useCurrentUser } from '../api/auth'
import styles from './article-feedback.module.css'

export function ArticleFeedback({ symptomId }: { symptomId: number }) {
  const currentUser = useCurrentUser()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const feedback = useQuery({
    queryKey: articleKeys.feedback(symptomId),
    queryFn: ({ signal }) => getArticleFeedback(symptomId, signal),
  })
  const vote = useMutation({
    mutationFn: (value: 'solved' | 'not_solved') =>
      feedback.data?.my_vote === value
        ? clearArticleFeedback(symptomId)
        : setArticleFeedback(symptomId, value),
    onSuccess: (result) => {
      queryClient.setQueryData(articleKeys.feedback(symptomId), result)
    },
  })

  function submit(value: 'solved' | 'not_solved') {
    if (!currentUser.data) {
      navigate(
        `/login?from=${encodeURIComponent(`/articles/${symptomId}`)}`,
      )
      return
    }
    vote.mutate(value)
  }

  return (
    <section className={styles.feedback} aria-label="文档解决反馈">
      <strong>这篇排查帮你解决问题了吗？</strong>
      <div>
        <button
          type="button"
          aria-pressed={feedback.data?.my_vote === 'solved'}
          disabled={vote.isPending}
          onClick={() => submit('solved')}
        >
          <Check aria-hidden="true" size={16} />
          解决了
          <span>{feedback.data?.solved ?? '—'}</span>
        </button>
        <button
          type="button"
          aria-pressed={feedback.data?.my_vote === 'not_solved'}
          disabled={vote.isPending}
          onClick={() => submit('not_solved')}
        >
          <X aria-hidden="true" size={16} />
          没解决
          <span>{feedback.data?.not_solved ?? '—'}</span>
        </button>
      </div>
    </section>
  )
}
