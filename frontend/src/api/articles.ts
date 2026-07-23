import { apiRequest } from './client'
import type { Symptom } from './symptoms'

export type ArticleDraft = {
  title: string
  summary: string
  applicability: string
  safety: string
  checklist: string[]
  body: string
  edit_summary: string
}

export type ArticleRevision = ArticleDraft & {
  id: number
  symptom_id: number
  author_id: number
  author_name: string
  reviewer_id: number | null
  reviewer_name: string | null
  base_revision_id: number | null
  version_number: number
  status:
    | 'draft'
    | 'pending'
    | 'approved'
    | 'rejected'
    | 'superseded'
    | 'withdrawn'
  review_note: string
  created_at: string
  updated_at: string
  submitted_at: string | null
  reviewed_at: string | null
  published_at: string | null
  origin?: 'community' | 'official_seed' | 'rollback' | 'withdrawal'
  source_revision_id?: number | null
}

export type RevisionListResponse = {
  items: ArticleRevision[]
  total: number
}

export type ContributionItem = {
  id: number
  symptom_id: number
  version_number: number
  status: ArticleRevision['status']
  title: string
  edit_summary: string
  updated_at: string
}

export type ContributionOverview = {
  total: number
  published: number
  pending: number
  drafts: number
  recent: ContributionItem[]
}

export type FavoriteItem = {
  symptom_id: number
  name: string
  description: string
  created_at: string
}

export type FavoriteListResponse = {
  items: FavoriteItem[]
  total: number
}

export type FavoriteState = {
  favorited: boolean
}

export type ReviewQueueItem = {
  revision: ArticleRevision
  base_revision: ArticleRevision | null
}

export type ReviewQueueResponse = {
  items: ReviewQueueItem[]
  total: number
}

export type NewArticlePayload = {
  name: string
  description: string
}

export type NewArticleResponse = {
  symptom: Symptom
  draft: ArticleRevision
}

export const articleKeys = {
  published: (symptomId: number) => ['articles', symptomId, 'published'] as const,
  versions: (symptomId: number) => ['articles', symptomId, 'versions'] as const,
  draft: (symptomId: number) => ['articles', symptomId, 'draft'] as const,
  mine: ['articles', 'mine'] as const,
  overview: ['articles', 'mine', 'overview'] as const,
  favorites: ['articles', 'favorites'] as const,
  favorite: (symptomId: number) =>
    ['articles', symptomId, 'favorite'] as const,
  reviews: ['reviews'] as const,
  feedback: (symptomId: number) =>
    ['articles', symptomId, 'feedback'] as const,
}

export function createArticle(payload: NewArticlePayload) {
  return apiRequest<NewArticleResponse>('/articles', {
    method: 'POST',
    body: payload,
  })
}

export function getPublishedArticle(symptomId: number, signal?: AbortSignal) {
  return apiRequest<ArticleRevision>(`/articles/${symptomId}`, { signal })
}

export function listPublishedRevisions(
  symptomId: number,
  signal?: AbortSignal,
) {
  return apiRequest<RevisionListResponse>(
    `/articles/${symptomId}/revisions`,
    { signal },
  )
}

export function getDraft(symptomId: number, signal?: AbortSignal) {
  return apiRequest<ArticleRevision>(`/articles/${symptomId}/draft`, { signal })
}

export function saveDraft(symptomId: number, draft: ArticleDraft) {
  return apiRequest<ArticleRevision>(`/articles/${symptomId}/draft`, {
    method: 'PUT',
    body: draft,
  })
}

export function submitDraft(symptomId: number) {
  return apiRequest<ArticleRevision>(`/articles/${symptomId}/submit`, {
    method: 'POST',
  })
}

export function withdrawRevision(symptomId: number) {
  return apiRequest<ArticleRevision>(`/articles/${symptomId}/withdraw`, {
    method: 'POST',
  })
}

export function deleteDraft(symptomId: number) {
  return apiRequest<void>(`/articles/${symptomId}/draft`, {
    method: 'DELETE',
  })
}

export function publishOfficialSeed(revisionId: number, note: string) {
  return apiRequest<ArticleRevision>(
    `/admin/revisions/${revisionId}/publish-official`,
    { method: 'POST', body: { note } },
  )
}

export type ArticleFeedback = {
  revision_id: number
  solved: number
  not_solved: number
  my_vote: 'solved' | 'not_solved' | null
}

export function getArticleFeedback(
  symptomId: number,
  signal?: AbortSignal,
) {
  return apiRequest<ArticleFeedback>(`/articles/${symptomId}/feedback`, {
    signal,
  })
}

export function setArticleFeedback(
  symptomId: number,
  vote: 'solved' | 'not_solved',
) {
  return apiRequest<ArticleFeedback>(`/articles/${symptomId}/feedback`, {
    method: 'PUT',
    body: { vote },
  })
}

export function clearArticleFeedback(symptomId: number) {
  return apiRequest<ArticleFeedback>(`/articles/${symptomId}/feedback`, {
    method: 'DELETE',
  })
}

export function unpublishArticle(symptomId: number, reason: string) {
  return apiRequest<void>(`/admin/articles/${symptomId}/unpublish`, {
    method: 'POST',
    body: { reason },
  })
}

export function rollbackArticle(
  symptomId: number,
  revisionId: number,
  reason: string,
) {
  return apiRequest<ArticleRevision>(
    `/admin/articles/${symptomId}/rollback/${revisionId}`,
    {
      method: 'POST',
      body: { reason },
    },
  )
}

export function listMyRevisions(signal?: AbortSignal) {
  return apiRequest<RevisionListResponse>('/articles/mine', { signal })
}

export function getContributionOverview(signal?: AbortSignal) {
  return apiRequest<ContributionOverview>('/articles/mine/overview', { signal })
}

export function listFavorites(signal?: AbortSignal) {
  return apiRequest<FavoriteListResponse>('/articles/favorites', { signal })
}

export function getFavoriteState(symptomId: number, signal?: AbortSignal) {
  return apiRequest<FavoriteState>(`/articles/${symptomId}/favorite`, { signal })
}

export function addFavorite(symptomId: number) {
  return apiRequest<FavoriteState>(`/articles/${symptomId}/favorite`, {
    method: 'POST',
  })
}

export function removeFavorite(symptomId: number) {
  return apiRequest<FavoriteState>(`/articles/${symptomId}/favorite`, {
    method: 'DELETE',
  })
}

export function listPendingReviews(signal?: AbortSignal) {
  return apiRequest<ReviewQueueResponse>('/reviews', { signal })
}

export function approveRevision(revisionId: number, note: string) {
  return apiRequest<ArticleRevision>(`/reviews/${revisionId}/approve`, {
    method: 'POST',
    body: { note },
  })
}

export function rejectRevision(revisionId: number, note: string) {
  return apiRequest<ArticleRevision>(`/reviews/${revisionId}/reject`, {
    method: 'POST',
    body: { note },
  })
}
