// The one place that knows about CSRF, credentials, JSON encoding, and the
// error envelope. Nothing else in the app calls fetch.

import type { ApiErrorBody } from './models'

/** Every failed request throws one of these, so components have one catch shape. */
export class ApiError extends Error {
  readonly status: number
  readonly fields: Record<string, string[]>

  constructor(status: number, body: Partial<ApiErrorBody> | null) {
    super(body?.error ?? 'Something went wrong. Please try again.')
    this.name = 'ApiError'
    this.status = status
    this.fields = body?.fields ?? {}
  }
}

/** A thrown value of unknown type, narrowed to something a component can render. */
export function asApiError(reason: unknown): ApiError {
  if (reason instanceof ApiError) {
    return reason
  }
  // A network failure or a stopped server lands here — fetch rejects with a
  // TypeError, which has no status and no fields.
  return new ApiError(0, { error: "Couldn't reach the server. Is it running?" })
}

// Django sets this cookie on any response from a view wrapped in
// @ensure_csrf_cookie — GET /api/auth/me/, which the auth context calls on
// mount. CSRF_COOKIE_HTTPONLY defaults to False, which is the only reason
// this is readable from JavaScript at all; nothing in settings.py overrides
// it, and nothing should.
function csrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]*)/)
  return match ? decodeURIComponent(match[1]) : ''
}

async function readBody(response: Response): Promise<ApiErrorBody | null> {
  // Django can still answer with an HTML page — a 500 with DEBUG on, or the
  // default 404 page — so parsing the body must never be what throws.
  try {
    return (await response.json()) as ApiErrorBody
  } catch {
    return null
  }
}

type Payload = Record<string, unknown> | FormData

async function request<T>(method: string, url: string, payload?: Payload): Promise<T> {
  const headers: Record<string, string> = {}
  if (method !== 'GET') {
    headers['X-CSRFToken'] = csrfToken()
  }

  let body: BodyInit | undefined
  if (payload instanceof FormData) {
    // Deliberately no Content-Type: the browser must add the multipart
    // boundary itself, and setting it by hand breaks the upload.
    body = payload
  } else if (payload !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(payload)
  }

  // same-origin is fetch's default in every current browser, and is written
  // out anyway because "the session cookie is sent" is the whole
  // authentication story and shouldn't be an implicit default a reader has to
  // already know.
  const response = await fetch(url, { method, headers, body, credentials: 'same-origin' })

  if (!response.ok) {
    throw new ApiError(response.status, await readBody(response))
  }
  return (await response.json()) as T
}

export const get = <T>(url: string) => request<T>('GET', url)
export const post = <T>(url: string, payload?: Payload) => request<T>('POST', url, payload)
export const patch = <T>(url: string, payload: Payload) => request<T>('PATCH', url, payload)
export const put = <T>(url: string, payload: Payload) => request<T>('PUT', url, payload)
export const del = <T>(url: string) => request<T>('DELETE', url) // `delete` is a keyword
