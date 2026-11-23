import { useEffect, useState } from 'react'
import { currentFestival, isFestivalLive } from '@/lib/festival'

type Theme = 'light' | 'dark'

// While the festival is on, the choice is kept under its own key: everyone
// starts on the black festival look, and someone who picks light for it
// still gets their usual theme back once it is over.
const FESTIVAL_KEY = 'nx-festival-theme'
const NORMAL_KEY = 'theme'

const listeners = new Set<() => void>()

function festivalLive(): boolean {
    return isFestivalLive(currentFestival())
}

function readTheme(): Theme {
    const live = festivalLive()
    try {
        const saved = localStorage.getItem(live ? FESTIVAL_KEY : NORMAL_KEY)
        if (saved === 'light' || saved === 'dark') return saved
    } catch {
        // Storage blocked: fall through to the default.
    }
    if (live) return 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** Puts the classes for the current theme (and festival) on <html> and tells
 * every mounted useTheme. Shared, so the header and sidebar toggles agree. */
export function applyTheme(): void {
    const root = document.documentElement
    root.classList.toggle('festival', festivalLive())
    root.classList.toggle('dark', readTheme() === 'dark')
    listeners.forEach((l) => l())
}

export function useTheme() {
    const [theme, setThemeState] = useState<Theme>(readTheme)

    useEffect(() => {
        const sync = () => setThemeState(readTheme())
        listeners.add(sync)
        return () => {
            listeners.delete(sync)
        }
    }, [])

    const setTheme = (next: Theme) => {
        try {
            localStorage.setItem(festivalLive() ? FESTIVAL_KEY : NORMAL_KEY, next)
        } catch {
            // Not remembered, but still applied for this page.
        }
        const root = document.documentElement
        root.classList.toggle('dark', next === 'dark')
        listeners.forEach((l) => l())
        setThemeState(next)
    }

    const toggleTheme = () => setTheme(theme === 'light' ? 'dark' : 'light')

    return { theme, toggleTheme, setTheme }
}
