import apiClient from './client'
import type { User } from '../types'

export interface AuthResponse {
  token: string
  user: User
}

export interface RegisterPayload {
  email: string
  name: string
  password: string
}

export interface LoginPayload {
  email: string
  password: string
}

export async function register(
  email: string,
  name: string,
  password: string,
): Promise<AuthResponse> {
  const payload: RegisterPayload = { email, name, password }
  const { data } = await apiClient.post<AuthResponse>('/auth/register', payload)
  return data
}

export async function login(
  email: string,
  password: string,
): Promise<AuthResponse> {
  const payload: LoginPayload = { email, password }
  const { data } = await apiClient.post<AuthResponse>('/auth/login', payload)
  return data
}
