import { useEffect, useState } from 'react'
import { getApiClient } from '@/lib/api-client'

// Banner images are served behind auth (unlike the login logo, which has to
// be public since it's shown before sign-in), so a plain <img src> can't
// carry the bearer token. Fetched as a blob through the authenticated client
// instead and exposed as an object URL.
//
// Cached module-wide by news id: the carousel and the settings preview can
// both mount the same banner without refetching it, and a remount (e.g. the
// carousel looping back to a slide) reuses the existing object URL rather
// than creating a new one.
const cache = new Map<number, string>()
const inFlight = new Map<number, Promise<string>>()

async function fetchBannerUrl(newsId: number): Promise<string> {
    const cached = cache.get(newsId)
    if (cached) return cached

    const pending = inFlight.get(newsId)
    if (pending) return pending

    const promise = getApiClient()
        .get(`/dashboard/banner/${newsId}`, { responseType: 'blob' })
        .then((res) => {
            const url = URL.createObjectURL(res.data)
            cache.set(newsId, url)
            inFlight.delete(newsId)
            return url
        })
        .catch((err) => {
            inFlight.delete(newsId)
            throw err
        })

    inFlight.set(newsId, promise)
    return promise
}

/** Object URL for a news item's banner image, or null while loading / absent / failed. */
export function useBannerImage(newsId: number, hasBanner: boolean): string | null {
    const [url, setUrl] = useState<string | null>(() => (hasBanner ? cache.get(newsId) || null : null))

    useEffect(() => {
        if (!hasBanner) {
            setUrl(null)
            return
        }

        let cancelled = false
        fetchBannerUrl(newsId)
            .then((resolved) => {
                if (!cancelled) setUrl(resolved)
            })
            .catch(() => {
                if (!cancelled) setUrl(null)
            })

        return () => {
            cancelled = true
        }
    }, [newsId, hasBanner])

    return url
}
