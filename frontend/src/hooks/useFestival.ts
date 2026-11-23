import { useEffect, useState } from 'react'
import { settingsAPI } from '@/lib/api'
import { currentFestival, isFestivalLive, loadFestival, subscribeFestival, type FestivalInfo } from '@/lib/festival'

/** The festival and whether it is on right now. Re-checks every 30 seconds,
 * so the dashboard and the theme let go of it by themselves when it ends. */
export function useFestival(): { festival: FestivalInfo | null; live: boolean } {
    const [festival, setFestival] = useState(currentFestival)
    const [now, setNow] = useState(() => Date.now())

    useEffect(() => {
        const off = subscribeFestival(() => setFestival(currentFestival()))
        loadFestival(settingsAPI.getBranding)
        return off
    }, [])

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 30_000)
        return () => clearInterval(timer)
    }, [])

    return { festival, live: isFestivalLive(festival, now) }
}
