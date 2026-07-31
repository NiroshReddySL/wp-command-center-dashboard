import axios from 'axios'
import { getToken, clearSession } from './auth'

/** axios's default array serialization uses bracket notation
 * (`key[]=a&key[]=b`), which FastAPI's `list[str]` query params do NOT
 * recognize — it only matches repeated same-name keys (`key=a&key=b`).
 * Without this, any array-valued filter would silently reach the backend
 * as an empty list instead of erroring, since FastAPI just sees zero
 * `key`-named params and applies the field's default. */
function serializeParams(params: Record<string, unknown>): string {
  const searchParams = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue
    if (Array.isArray(value)) {
      for (const item of value) searchParams.append(key, String(item))
    } else {
      searchParams.append(key, String(value))
    }
  }
  return searchParams.toString()
}

const apiClient = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  paramsSerializer: { serialize: serializeParams },
})

apiClient.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !window.location.pathname.startsWith('/login')) {
      clearSession()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const response = await apiClient.get<T>(url, { params })
  return response.data
}

export async function post<T>(
  url: string, data?: unknown, params?: Record<string, unknown>,
): Promise<T> {
  const response = await apiClient.post<T>(url, data, params ? { params } : undefined)
  return response.data
}

/** For multipart/form-data uploads (e.g. CSV). The client's default JSON
 * Content-Type must be cleared so axios/the browser can set the correct
 * multipart boundary header instead. */
export async function postForm<T>(url: string, formData: FormData, params?: Record<string, unknown>): Promise<T> {
  const response = await apiClient.post<T>(url, formData, {
    params,
    headers: { 'Content-Type': undefined },
  })
  return response.data
}

export async function put<T>(url: string, data?: unknown): Promise<T> {
  const response = await apiClient.put<T>(url, data)
  return response.data
}

export async function patch<T>(url: string, data?: unknown): Promise<T> {
  const response = await apiClient.patch<T>(url, data)
  return response.data
}

export async function del<T>(url: string): Promise<T> {
  const response = await apiClient.delete<T>(url)
  return response.data
}

export default apiClient
