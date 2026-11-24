import { useEffect, useState } from 'react'
import { DiscountSticker, OFF_TEXTURE } from './DiscountSticker'
import { festivalBannerUrl, type FestivalInfo } from '@/lib/festival'

// Same box as the news banner it stands in for (see NewsSlide), so the
// dashboard keeps its layout while the festival is on.
const FRAME = 'h-36 w-full sm:h-44 md:h-52 lg:h-60'

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹'
const fa = (n: number, pad = 2) => String(n).padStart(pad, '0').replace(/\d/g, (d) => FA_DIGITS[Number(d)])

function useRemaining(endsAt: string) {
    const end = Date.parse(endsAt)
    const [now, setNow] = useState(() => Date.now())
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000)
        return () => clearInterval(timer)
    }, [])
    if (isNaN(end)) return null
    const total = Math.max(0, Math.floor((end - now) / 1000))
    return {
        days: Math.floor(total / 86400),
        hours: Math.floor((total % 86400) / 3600),
        minutes: Math.floor((total % 3600) / 60),
        seconds: total % 60,
    }
}

function Unit({ value, label }: { value: string; label: string }) {
    return (
        <div className="flex flex-col items-center">
            <div className="tabular flex h-11 min-w-[2.75rem] items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-1.5 text-xl font-black leading-none text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:h-14 sm:min-w-[4rem] sm:px-2 sm:text-3xl md:h-16 md:min-w-[4.75rem] md:text-4xl">
                {value}
            </div>
            <span className="mt-1.5 text-[11px] font-medium text-white/55 sm:text-xs">{label}</span>
        </div>
    )
}

function Colon() {
    return <span className="pb-6 text-lg font-black text-[#ff2d3d] sm:text-2xl md:text-3xl">:</span>
}

function CountdownSlide({ endsAt }: { endsAt: string }) {
    const left = useRemaining(endsAt)

    return (
        <div className={`relative overflow-hidden rounded-lg bg-[#060606] ${FRAME}`} dir="rtl">
            {/* Diagonal OFF texture, as on the login page. */}
            <div
                aria-hidden="true"
                className="pointer-events-none absolute left-1/2 top-1/2 h-[260%] w-[260%] -translate-x-1/2 -translate-y-1/2 -rotate-[28deg]"
                style={{ backgroundImage: OFF_TEXTURE, backgroundSize: '300px 150px' }}
            />
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0"
                style={{
                    background:
                        'radial-gradient(ellipse 45% 70% at 50% 50%, rgba(6,6,6,.9), rgba(6,6,6,.5) 60%, rgba(6,6,6,.15) 100%), radial-gradient(ellipse 50% 60% at 100% 120%, rgba(255,45,61,.22), transparent 70%)',
                }}
            />
            {/* Red glow along the top and bottom edges. */}
            <div aria-hidden="true" className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-transparent via-[#ff2d3d] to-transparent shadow-[0_0_18px_1px_rgba(255,45,61,.45)]" />
            <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[3px] bg-gradient-to-r from-transparent via-[#ff2d3d] to-transparent shadow-[0_0_18px_1px_rgba(255,45,61,.45)]" />

            <DiscountSticker className="absolute left-2 top-2 h-9 w-9 rotate-[-12deg] drop-shadow-[0_6px_14px_rgba(255,45,61,.45)] sm:left-5 sm:top-4 sm:h-14 sm:w-14" />
            {/* Hidden on phones, where it would run into the heading. */}
            <div className="absolute right-4 top-3 hidden items-center gap-2 sm:flex text-[10px] font-black uppercase tracking-[0.28em] text-white/60 sm:right-6 sm:top-4" dir="ltr">
                <span className="h-2 w-2 animate-pulse rounded-full bg-[#ff2d3d] shadow-[0_0_10px_2px_rgba(255,45,61,.6)]" />
                Black <span className="text-[#ff2d3d]">Friday</span>
            </div>

            <div className="relative flex h-full flex-col items-center justify-center gap-2 px-4 sm:gap-3">
                <span className="text-xs font-medium text-white/70 sm:text-sm">زمان باقی‌مانده</span>
                {left ? (
                    <div className="flex items-start gap-1 sm:gap-3" dir="ltr">
                        <Unit value={fa(left.days)} label="روز" />
                        <Colon />
                        <Unit value={fa(left.hours)} label="ساعت" />
                        <Colon />
                        <Unit value={fa(left.minutes)} label="دقیقه" />
                        <Colon />
                        <Unit value={fa(left.seconds)} label="ثانیه" />
                    </div>
                ) : null}
                <span className="text-sm font-black text-white sm:text-base md:text-lg">
                    تا پایان جشنواره <span className="text-[#ff2d3d]">بلک فرایدی</span>
                </span>
            </div>
        </div>
    )
}

/** The festival's dashboard slider: the countdown, then the banner uploaded in
 * Settings if there is one. Turns by itself; no dots or arrows. */
export function FestivalSlider({ festival }: { festival: FestivalInfo }) {
    const slides = ['countdown', ...(festival.has_banner ? ['banner'] : [])]
    const [index, setIndex] = useState(0)

    useEffect(() => {
        setIndex((i) => (i >= slides.length ? 0 : i))
        if (slides.length < 2) return
        const timer = setInterval(() => setIndex((i) => (i + 1) % slides.length), 7000)
        return () => clearInterval(timer)
    }, [slides.length])

    return (
        <div className="overflow-hidden rounded-lg">
            <div className="flex transition-transform duration-700 ease-out" style={{ transform: `translateX(-${index * 100}%)` }}>
                {slides.map((slide) => (
                    <div key={slide} className="w-full flex-shrink-0">
                        {slide === 'countdown' ? (
                            <CountdownSlide endsAt={festival.ends_at} />
                        ) : (
                            <img
                                src={festivalBannerUrl(festival.banner_version)}
                                alt="Black Friday"
                                className={`rounded-lg object-cover ${FRAME}`}
                            />
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}
