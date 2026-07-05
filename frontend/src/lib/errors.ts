// Turn any API/axios error into a human-readable "Error <code> — <reason>" string,
// preferring the reason returned by the server so the user sees the real cause.

const HTTP_REASONS: Record<number, string> = {
    400: 'Bad request',
    401: 'Session expired — please log in again',
    403: 'Forbidden (access denied or limit reached)',
    404: 'Not found',
    405: 'Method not allowed',
    408: 'Request timeout',
    409: 'Conflict (already exists)',
    413: 'Payload too large',
    422: 'Invalid data',
    429: 'Too many requests',
    500: 'Server error',
    501: 'Not implemented',
    502: 'Bad gateway (target panel unreachable)',
    503: 'Service unavailable (target panel is down)',
    504: 'Gateway timeout (target panel did not respond)',
}

export function formatApiError(error: any): string {
    // No response at all (DNS/offline/CORS/timeout)
    if (error?.code === 'ERR_NETWORK' || (error?.request && !error?.response)) {
        return 'Network error — could not reach the server'
    }

    const status: number | undefined = error?.response?.status
    const data = error?.response?.data

    let serverMsg = ''
    if (data && typeof data === 'object') {
        if (typeof data.message === 'string') {
            serverMsg = data.message
        } else if (typeof data.detail === 'string') {
            serverMsg = data.detail
        } else if (Array.isArray(data.detail)) {
            serverMsg = data.detail
                .map((d: any) => d?.msg || '')
                .filter(Boolean)
                .join('; ')
        }
    } else if (typeof data === 'string' && data) {
        serverMsg = data
    }

    const reason = status ? HTTP_REASONS[status] || 'Error' : ''

    if (status && serverMsg) return `Error ${status} — ${serverMsg}`
    if (status) return `Error ${status} — ${reason}`
    if (serverMsg) return serverMsg
    return error?.message || 'Unknown error'
}
