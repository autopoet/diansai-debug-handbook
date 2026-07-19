import { apiRequest } from './client'

export type Symptom = {
  id: number
  name: string
  description: string
}

export type SymptomListResponse = {
  items: Symptom[]
  total: number
}

export const symptomKeys = {
  all: ['symptoms'] as const,
  list: (keyword?: string) => [...symptomKeys.all, 'list', keyword ?? 'all'] as const,
  detail: (id: number) => [...symptomKeys.all, 'detail', id] as const,
}

export function listSymptoms(keyword?: string, signal?: AbortSignal) {
  const params = new URLSearchParams()
  if (keyword) {
    params.set('keyword', keyword)
  }

  const query = params.toString()
  return apiRequest<SymptomListResponse>(
    `/symptoms${query ? `?${query}` : ''}`,
    { signal },
  )
}

export function getSymptom(id: number, signal?: AbortSignal) {
  return apiRequest<Symptom>(`/symptoms/${id}`, { signal })
}
