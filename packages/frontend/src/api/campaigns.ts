import apiClient from './client'
import type { Campaign, CampaignStats, PaginatedResponse } from '../types'

export interface GetCampaignsParams {
  page?: number
  limit?: number
  status?: string
}

export interface CreateCampaignPayload {
  name: string
  subject: string
  body: string
  recipientIds: string[]
}

export type UpdateCampaignPayload = Partial<{
  name: string
  subject: string
  body: string
  recipientIds: string[]
}>

export async function getCampaigns(
  params: GetCampaignsParams = {},
): Promise<PaginatedResponse<Campaign>> {
  const { data } = await apiClient.get<{ campaigns: Campaign[]; total: number; page: number; totalPages: number }>(
    '/campaigns',
    { params },
  )
  return { data: data.campaigns, total: data.total, page: data.page, totalPages: data.totalPages }
}

export async function getCampaign(id: string): Promise<Campaign> {
  const { data } = await apiClient.get<{ campaign: Campaign }>(`/campaigns/${id}`)
  return data.campaign
}

export async function createCampaign(
  payload: CreateCampaignPayload,
): Promise<Campaign> {
  const { data } = await apiClient.post<{ campaign: Campaign }>('/campaigns', payload)
  return data.campaign
}

export async function updateCampaign(
  id: string,
  payload: UpdateCampaignPayload,
): Promise<Campaign> {
  const { data } = await apiClient.patch<{ campaign: Campaign }>(`/campaigns/${id}`, payload)
  return data.campaign
}

export async function deleteCampaign(id: string): Promise<void> {
  await apiClient.delete(`/campaigns/${id}`)
}

export async function scheduleCampaign(
  id: string,
  scheduled_at: string,
): Promise<Campaign> {
  const { data } = await apiClient.post<{ campaign: Campaign }>(
    `/campaigns/${id}/schedule`,
    { scheduled_at },
  )
  return data.campaign
}

export async function sendCampaign(id: string): Promise<Campaign> {
  const { data } = await apiClient.post<{ campaign: Campaign }>(`/campaigns/${id}/send`)
  return data.campaign
}

export async function getCampaignStats(id: string): Promise<CampaignStats> {
  const { data } = await apiClient.get<CampaignStats>(
    `/campaigns/${id}/stats`,
  )
  return data
}
