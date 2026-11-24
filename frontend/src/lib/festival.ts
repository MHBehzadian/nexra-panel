import { isWhiteLabel } from '@/lib/auth'

/** The Black Friday festival, as the panel's public branding reports it. */
export interface FestivalInfo {
    enabled: boolean
    /** ISO time with offset; empty for no end. */
    ends_at: string
    /** Enabled and not yet over, by the server's clock. */
    active: boolean
    has_banner: boolean
    banner_version: number
}

const CACHE_KEY = 'nx-festival'

/** Whether the festival is on right now. Checked against the browser's clock
 * too, so a page left open switches back by itself when the time runs out. */
export function isFestivalLive(f: FestivalInfo | null | undefined, now = Date.now()): boolean {
    // The festival is Nexra's: a reseller's white-label panel never shows it.
    if (!f?.active || isWhiteLabel()) return false
    if (!f.ends_at) return true
    const end = Date.parse(f.ends_at)
    return isNaN(end) || end > now
}

/** The last festival state seen, so the login page can paint the right look
 * before the branding request answers. */
export function cachedFestival(): FestivalInfo | null {
    try {
        const raw = localStorage.getItem(CACHE_KEY)
        return raw ? (JSON.parse(raw) as FestivalInfo) : null
    } catch {
        return null
    }
}

export function rememberFestival(f: FestivalInfo | null | undefined): void {
    try {
        if (f) localStorage.setItem(CACHE_KEY, JSON.stringify(f))
        else localStorage.removeItem(CACHE_KEY)
    } catch {
        // Private mode or blocked storage: the page just paints a moment later.
    }
}

export function festivalBannerUrl(version: number): string {
    const prefix = import.meta.env.VITE_URL_PREFIX || 'dashboard'
    return `/${prefix}/dashboard/festival-banner?v=${version}`
}

// ------------------------------------------------------------ shared state
// One copy for the whole app, so the theme, the sidebar and the dashboard all
// agree on whether the festival is on without each asking the server.

let current: FestivalInfo | null = cachedFestival()
let loading: Promise<void> | null = null
const listeners = new Set<() => void>()

export function currentFestival(): FestivalInfo | null {
    return current
}

export function setFestival(f: FestivalInfo | null | undefined): void {
    current = f ?? null
    rememberFestival(current)
    listeners.forEach((l) => l())
}

export function subscribeFestival(listener: () => void): () => void {
    listeners.add(listener)
    return () => {
        listeners.delete(listener)
    }
}

/** Ask the server once per page load; later callers share the answer. */
export function loadFestival(fetchBranding: () => Promise<{ festival?: FestivalInfo }>): Promise<void> {
    if (!loading) {
        loading = fetchBranding()
            .then((b) => setFestival(b.festival))
            .catch(() => {
                // Keep whatever was cached: a failed request is no reason to
                // drop the festival look mid-session.
            })
    }
    return loading
}
