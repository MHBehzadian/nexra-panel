import { useRef, useState } from 'react'
import { ChevronDown, Smile } from 'lucide-react'
import { BotAPI } from '@/lib/bots-api'
import { getUserRole } from '@/lib/auth'
import { cn } from '@/lib/utils'
import { Textarea, TextareaProps } from '@/components/ui/textarea'
import { ErrorBox, Loading, useLoad } from './common'
import { PremiumEmoji } from './emoji'
import { loadPacks } from './ButtonsTab'

// A text box for a bot message with the allowed premium emoji packs next to
// it: picking an emoji puts <tg-emoji emoji-id="…">…</tg-emoji> at the cursor
// (the bot sends its texts as Telegram HTML), and a preview shows the result.

const TG_EMOJI = /<tg-emoji emoji-id="(\d+)">([\s\S]*?)<\/tg-emoji>/g
const HAS_EMOJI = /<tg-emoji emoji-id="\d+">/

type Props = Omit<TextareaProps, 'value' | 'onChange'> & {
    api: BotAPI
    value: string
    onChange: (v: string) => void
}

export function EmojiTextarea({ api, value, onChange, className, ...rest }: Props) {
    const ref = useRef<HTMLTextAreaElement>(null)
    const [open, setOpen] = useState(false)
    const botKey = String(api.id)

    const insert = (id: string, fallback: string) => {
        const el = ref.current
        const tag = `<tg-emoji emoji-id="${id}">${fallback || '⭐'}</tg-emoji>`
        const start = el?.selectionStart ?? value.length
        const end = el?.selectionEnd ?? value.length
        onChange(value.slice(0, start) + tag + value.slice(end))
        requestAnimationFrame(() => {
            if (!el) return
            el.focus()
            el.setSelectionRange(start + tag.length, start + tag.length)
        })
    }

    return (
        <div className="space-y-2">
            <Textarea ref={ref} value={value} onChange={(e) => onChange(e.target.value)} className={className} {...rest} />
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className={cn(
                    'flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition',
                    open ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-accent'
                )}
            >
                <Smile className="h-3.5 w-3.5" /> ایموجی پریمیوم
                <ChevronDown className={cn('h-3.5 w-3.5 transition', open && 'rotate-180')} />
            </button>
            {open && <Palette api={api} botKey={botKey} onPick={insert} />}
            {HAS_EMOJI.test(value) && <Preview api={api} botKey={botKey} text={value} />}
        </div>
    )
}

function Palette({ api, botKey, onPick }: { api: BotAPI; botKey: string; onPick: (id: string, fallback: string) => void }) {
    const packs = useLoad(() => loadPacks(), [])
    const [tab, setTab] = useState(0)
    const list = packs.data?.packs || []
    const pack = list[Math.min(tab, Math.max(0, list.length - 1))]
    if (packs.loading && !packs.data) return <Loading />
    if (!list.length)
        return (
            <p className="rounded-lg bg-muted/40 p-2 text-xs text-muted-foreground">
                هنوز پک ایموجی‌ای تعریف نشده است.{' '}
                {getUserRole() === 'superadmin' ? 'از بخش «پک‌های ایموجی پریمیوم» بالای صفحه اضافه کنید.' : 'برای افزودن، لطفاً با پشتیبانی تماس بگیرید.'}
            </p>
        )
    return (
        <div className="space-y-2 rounded-xl border border-border p-2">
            {list.length > 1 && (
                <div className="flex gap-1 overflow-x-auto pb-1">
                    {list.map((p, i) => (
                        <button
                            type="button"
                            key={p.name}
                            onClick={() => setTab(i)}
                            className={cn(
                                'shrink-0 rounded-lg px-3 py-1 text-xs',
                                pack?.name === p.name ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                            )}
                        >
                            {p.title}
                        </button>
                    ))}
                </div>
            )}
            {pack && (
                <div className="grid max-h-48 grid-cols-8 gap-1 overflow-y-auto sm:grid-cols-12">
                    {pack.emojis.map((e) => (
                        <button
                            type="button"
                            key={e.id}
                            title={e.emoji}
                            onClick={() => onPick(e.id, e.emoji)}
                            className="flex aspect-square items-center justify-center rounded-lg bg-muted/30 text-xl hover:ring-2 hover:ring-primary"
                        >
                            <PremiumEmoji api={api} botKey={botKey} id={e.id} fallback={e.emoji} className="h-6 w-6" />
                        </button>
                    ))}
                </div>
            )}
            <p className="text-[11px] text-muted-foreground">روی هر ایموجی بزنید تا همان‌جای مکان‌نما در متن قرار بگیرد.</p>
            <ErrorBox error={packs.error} />
        </div>
    )
}

function Preview({ api, botKey, text }: { api: BotAPI; botKey: string; text: string }) {
    const parts: Array<string | { id: string; fallback: string }> = []
    let last = 0
    for (const m of text.matchAll(TG_EMOJI)) {
        parts.push(text.slice(last, m.index))
        parts.push({ id: m[1], fallback: m[2] })
        last = (m.index ?? 0) + m[0].length
    }
    parts.push(text.slice(last))
    return (
        <div className="space-y-1 rounded-xl bg-muted/30 p-3">
            <span className="text-[11px] text-muted-foreground">پیش‌نمایش</span>
            <div className="whitespace-pre-wrap text-sm leading-7">
                {parts.map((p, i) =>
                    typeof p === 'string' ? <span key={i}>{p}</span> : <PremiumEmoji key={i} api={api} botKey={botKey} id={p.id} fallback={p.fallback} />
                )}
            </div>
        </div>
    )
}
