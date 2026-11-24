import Cookies from 'js-cookie'
import { jwtDecode } from 'jwt-decode'
import { DecodedToken } from '@/types'

const TOKEN_KEY = 'access_token'

export function getToken(): string | undefined {
    return Cookies.get(TOKEN_KEY)
}

export function setToken(token: string): void {
    Cookies.set(TOKEN_KEY, token, {
        httpOnly: false, // Note: httpOnly is not supported in browser cookies via JS
        secure: window.location.protocol === 'https:',
        sameSite: 'strict',
        expires: 7,
    })
}

export function removeToken(): void {
    Cookies.remove(TOKEN_KEY)
}

export function getDecodedToken(): DecodedToken | null {
    try {
        const token = getToken()
        if (!token) return null
        return jwtDecode<DecodedToken>(token)
    } catch (error) {
        console.error('Failed to decode token:', error)
        return null
    }
}

export function isTokenValid(): boolean {
    try {
        const decoded = getDecodedToken()
        if (!decoded || !decoded.exp) return false

        // Check if token is expired
        const now = Math.floor(Date.now() / 1000)
        return decoded.exp > now
    } catch {
        return false
    }
}

export function getUserRole(): 'admin' | 'superadmin' | null {
    const decoded = getDecodedToken()
    return decoded?.role || null
}

export function getUsername(): string | null {
    const decoded = getDecodedToken()
    return decoded?.sub || null
}

export function getPanel(): string | null {
    const decoded = getDecodedToken()
    return decoded?.panel || null
}

// A white-label panel is handed out with its own login link (login?wl=1), which
// shows a plain login page. Remembered here so logging out, or being sent back
// by an expired session, lands on that page again rather than on ours.
const WHITE_LABEL_KEY = 'nx_white_label'

function storeWhiteLabel(on: boolean): void {
    try {
        if (on) localStorage.setItem(WHITE_LABEL_KEY, '1')
        else localStorage.removeItem(WHITE_LABEL_KEY)
    } catch {
        // storage blocked: the flag in the token still covers the open session
    }
}

/** Whether the login page should be the plain one. */
export function isWhiteLabelLogin(): boolean {
    const param = new URLSearchParams(window.location.search).get('wl')
    if (param === '1') {
        storeWhiteLabel(true)
        return true
    }
    if (param === '0') {
        storeWhiteLabel(false)
        return false
    }
    try {
        return localStorage.getItem(WHITE_LABEL_KEY) === '1'
    } catch {
        return false
    }
}

/** Whether the signed-in admin's panel must show nothing of Nexra. */
export function isWhiteLabel(): boolean {
    const decoded = getDecodedToken()
    if (decoded) return decoded.role === 'admin' && !!decoded.white_label
    return isWhiteLabelLogin()
}

/** Called after a successful login, so the next logout returns to the right page. */
export function rememberLoginKind(): void {
    const decoded = getDecodedToken()
    storeWhiteLabel(decoded?.role === 'admin' && !!decoded.white_label)
}

export function loginPath(): string {
    return import.meta.env.BASE_URL + 'login' + (isWhiteLabelLogin() ? '?wl=1' : '')
}

export function logout(): void {
    const target = loginPath()
    removeToken()
    window.location.href = target
}
