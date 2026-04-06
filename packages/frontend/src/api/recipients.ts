import apiClient from './client'
import type { Recipient, PaginatedResponse } from '../types'

export interface GetRecipientsParams {
  page?: number
  limit?: number
  search?: string
}

export interface CreateRecipientPayload {
  email: string
  name: string
}

export async function getRecipients(
  params: GetRecipientsParams = {},
): Promise<PaginatedResponse<Recipient>> {
  const { data } = await apiClient.get<{ recipients: Recipient[]; total: number; page: number; totalPages: number }>(
    '/recipients',
    { params },
  )
  return { data: data.recipients, total: data.total, page: data.page, totalPages: data.totalPages }
}

export async function createRecipient(
  payload: CreateRecipientPayload,
): Promise<Recipient> {
  const { data } = await apiClient.post<{ recipient: Recipient }>('/recipients', payload)
  return data.recipient
}
