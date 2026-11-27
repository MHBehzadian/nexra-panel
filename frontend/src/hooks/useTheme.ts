import { useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

export function useTheme() {
    const [theme, setTheme] = useState<Theme>(() => {
        // Dark is the theme's own look, so it is the default; light only when
        // someone has picked it.
        try {
            return localStorage.getItem('theme') === 'light' ? 'light' : 'dark'
        } catch {
            return 'dark'
        }
    })

    useEffect(() => {
        const root = document.documentElement

        if (theme === 'dark') {
            root.classList.add('dark')
        } else {
            root.classList.remove('dark')
        }

        localStorage.setItem('theme', theme)
    }, [theme])

    const toggleTheme = () => {
        setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))
    }

    return { theme, toggleTheme, setTheme }
}
