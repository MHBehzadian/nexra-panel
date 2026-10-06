import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Smile } from 'lucide-react'
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
    /** shown on the shared emoji panel while this box is the target */
    name?: string
}

type Insert = (id: string, fallback: string) => void
type Board = { focus: (name: string, insert: Insert) => void }
const BoardContext = createContext<Board | null>(null)

// EmojiBoard puts one emoji panel beside a page of text boxes (sticky on wide
// screens): a pick goes into the box that was clicked last.
export function EmojiBoard({ api, children }: { api: BotAPI; children: React.ReactNode }) {
    const target = useRef<Insert | null>(null)
    const [name, setName] = useState('')
    const board = useMemo<Board>(
        () => ({
            focus: (n, insert) => {
                target.current = insert
                setName(n)
            },
        }),
        []
    )
    return (
        <BoardContext.Provider value={board}>
            <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
                <div className="min-w-0">{children}</div>
                <aside className="order-first lg:order-none">
                    <div className="space-y-2 lg:sticky lg:top-4">
                        <b className="flex items-center gap-1.5 text-sm">
                            <Smile className="h-4 w-4 text-amber-500" /> ایموجی پریمیوم
                        </b>
                        <p className="text-xs text-muted-foreground">
                            {name ? (
                                <>
                                    درج در: <b className="text-foreground">{name}</b>
                                </>
                            ) : (
                                'اول روی یک متن بزنید، بعد ایموجی را انتخاب کنید.'
                            )}
                        </p>
                        <Palette api={api} botKey={String(api.id)} onPick={(id, f) => target.current?.(id, f)} disabled={!name} />
                    </div>
                </aside>
            </div>
        </BoardContext.Provider>
    )
}

export function EmojiTextarea({ api, value, onChange, className, name, ...rest }: Props) {
    const ref = useRef<HTMLTextAreaElement>(null)
    const board = useContext(BoardContext)
    const botKey = String(api.id)
    // the board keeps the insert function; read the latest text through refs
    const latest = useRef({ value, onChange })
    useEffect(() => {
        latest.current = { value, onChange }
    })

    const insert: Insert = (id, fallback) => {
        const el = ref.current
        const { value: v, onChange: set } = latest.current
        const tag = `<tg-emoji emoji-id="${id}">${fallback || '⭐'}</tg-emoji>`
        const start = el?.selectionStart ?? v.length
        const end = el?.selectionEnd ?? v.length
        set(v.slice(0, start) + tag + v.slice(end))
        requestAnimationFrame(() => {
            if (!el) return
            el.focus()
            el.setSelectionRange(start + tag.length, start + tag.length)
        })
    }

    const box = (
        <Textarea
            ref={ref}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => board?.focus(name || 'این متن', insert)}
            className={className}
            {...rest}
        />
    )
    const preview = HAS_EMOJI.test(value) && <Preview api={api} botKey={botKey} text={value} />
    if (board)
        return (
            <div className="space-y-2">
                {box}
                {preview}
            </div>
        )
    // on its own: the packs stay open right beside the box
    return (
        <div className="grid gap-3 lg:grid-cols-[1fr_280px]">
            <div className="min-w-0 space-y-2">
                {box}
                {preview}
            </div>
            <div className="space-y-1.5">
                <b className="flex items-center gap-1.5 text-xs">
                    <Smile className="h-3.5 w-3.5 text-amber-500" /> ایموجی پریمیوم
                </b>
                <Palette api={api} botKey={botKey} onPick={insert} />
            </div>
        </div>
    )
}

function Palette({ api, botKey, onPick, disabled }: { api: BotAPI; botKey: string; onPick: Insert; disabled?: boolean }) {
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
                <div className={cn('grid max-h-64 grid-cols-7 gap-1 overflow-y-auto', disabled && 'pointer-events-none opacity-50')}>
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
