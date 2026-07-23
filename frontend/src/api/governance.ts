import { apiRequest } from './client'
import type { RevisionListResponse } from './articles'

export type ReviewerApplication = {
  id: number
  user_id: number
  username: string
  statement: string
  status: 'pending' | 'approved' | 'rejected'
  reviewed_by_id: number | null
  reviewed_by_name: string | null
  review_note: string
  created_at: string
  updated_at: string
  reviewed_at: string | null
}

export type ReviewerApplicationList = {
  items: ReviewerApplication[]
  total: number
}

export const reviewerApplicationKeys = {
  all: ['reviewer-applications'] as const,
  mine: ['reviewer-applications', 'mine'] as const,
  pending: ['reviewer-applications', 'pending'] as const,
}

export type AdminArticle = {
  id: number
  name: string
  description: string
  is_published: boolean
  is_taken_down: boolean
}

export type AdminArticleList = {
  items: AdminArticle[]
  total: number
}

export const governanceKeys = {
  articles: ['governance', 'articles'] as const,
  revisions: (symptomId: number) =>
    ['governance', 'articles', symptomId, 'revisions'] as const,
}

export function getMyReviewerApplication(signal?: AbortSignal) {
  return apiRequest<ReviewerApplication | null>(
    '/reviewer-applications/me',
    { signal },
  )
}

export function applyForReviewer(statement: string) {
  return apiRequest<ReviewerApplication>('/reviewer-applications', {
    method: 'POST',
    body: { statement },
  })
}

export function listReviewerApplications(signal?: AbortSignal) {
  return apiRequest<ReviewerApplicationList>(
    '/admin/reviewer-applications?status=pending',
    { signal },
  )
}

export function decideReviewerApplication(
  applicationId: number,
  action: 'approve' | 'reject',
  note: string,
) {
  return apiRequest<ReviewerApplication>(
    `/admin/reviewer-applications/${applicationId}/${action}`,
    {
      method: 'POST',
      body: { note },
    },
  )
}

export function listAdminArticles(signal?: AbortSignal) {
  return apiRequest<AdminArticleList>('/admin/articles', { signal })
}

export function listAdminRevisions(
  symptomId: number,
  signal?: AbortSignal,
) {
  return apiRequest<RevisionListResponse>(
    `/admin/articles/${symptomId}/revisions`,
    { signal },
  )
}
