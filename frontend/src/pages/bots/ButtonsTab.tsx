import { useState } from 'react'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Eye, EyeOff, Plus, RotateCcw } from 'lucide-react'
import { BotAPI, BotButtons } from '@/lib/bots-api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorBox, Field, Loading, Notice, Spinner, selectClass, useAction, useLoad } from './common'

type Style = { style?: string; emoji?: string; hidden?: boolean }

const STYLE_LABEL: Record<string, string> = { '': 'پیش‌فرض', primary: 'آبی', success: 'سبز', danger: 'قرمز' }
const STYLE_CLASS: Record<string, string> = {
    '': 'bg-[#e7edf3] text-[#2b5278] dark:bg-[#2b3b4c] dark:text-white',
    primary: 'bg-[#3390ec] text-white',
    success: 'bg-[#31b545] text-white',
    danger: 'bg-[#e53935] text-white',
}
// Labels of these come from the bot's text table and can be renamed here.
const RENAMEABLE = (k: string) => k.startsWith('text_')
const DEFAULT_LAYOUT = [
    ['text_sell', 'text_usertest'],
    ['text_Purchased_services', 'text_Tariff_list'],
    ['text_account', 'text_Add_Balance'],
    ['affiliates'],
    ['text_support', 'text_help'],
]

export function ButtonsTab({ api }: { api: BotAPI }) {
    const remote = useLoad(() => api.get<BotButtons>('buttons'), [api])
    if (remote.loading && !remote.data) return <Loading />
    if (!remote.data) return <ErrorBox error={remote.error} />
    return <ButtonsEditor api={api} d={remote.data} onSaved={remote.setData} />
}

function ButtonsEditor({ api, d, onSaved }: { api: BotAPI; d: BotButtons; onSaved: (b: BotButtons) => void }) {
    const [layout, setLayout] = useState<string[][]>(() => d.layout.map((r) => [...r]))
    const [styles, setStyles] = useState<Record<string, Style>>(() => JSON.parse(JSON.stringify(d.buttons || {})))
    const [labels, setLabels] = useState<Record<string, string>>(() => ({ ...d.labels }))
    const [selected, setSelected] = useState<string | null>(null)
    const act = useAction()

    const reset = (x: BotButtons) => {
        setLayout(x.layout.map((r) => [...r]))
        setStyles(JSON.parse(JSON.stringify(x.buttons || {})))
        setLabels({ ...x.labels })
    }

    const st = (k: string): Style => styles[k] || {}
    const setSt = (k: string, v: Partial<Style>) => setStyles((s) => ({ ...s, [k]: { ...(s[k] || {}), ...v } }))

    const find = (k: string): [number, number] => {
        for (let r = 0; r < layout.length; r++) {
            const c = layout[r].indexOf(k)
            if (c >= 0) return [r, c]
        }
        return [-1, -1]
    }
    const move = (k: string, dr: number, dc: number) => {
        const [r, c] = find(k)
        if (r < 0) return
        const next = layout.map((row) => [...row])
        if (dc !== 0) {
            const to = c + dc
            if (to < 0 || to >= next[r].length) return
            ;[next[r][c], next[r][to]] = [next[r][to], next[r][c]]
        } else {
            const to = r + dr
            if (to < 0) return
            next[r].splice(c, 1)
            if (to >= next.length) next.push([])
            if (next[to].length >= 4) return
            next[to].push(k)
        }
        setLayout(next.filter((row) => row.length > 0))
    }

    const changedLabels = () => {
        const out: Record<string, string> = {}
        for (const [k, v] of Object.entries(labels)) {
            if (RENAMEABLE(k) && v !== d.labels[k] && v.trim()) out[k] = v
        }
        return out
    }

    const save = async () => {
        const res = await act.run(async () => {
            const lbl = changedLabels()
            if (Object.keys(lbl).length) await api.put('texts', lbl)
            const clean: Record<string, Style> = {}
            for (const [k, v] of Object.entries(styles)) {
                const s: Style = {}
                if (v.style) s.style = v.style
                if (v.emoji && v.emoji.trim()) s.emoji = v.emoji.trim()
                if (v.hidden) s.hidden = true
                if (Object.keys(s).length) clean[k] = s
            }
            return api.put<BotButtons>('buttons', { layout, buttons: clean })
        }, 'ذخیره شد؛ کاربران با /start بعدی دکمه‌های جدید را می‌بینند')
        if (res && res !== true) onSaved(res as BotButtons)
    }

    const sel = selected

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle>دکمه‌های منوی اصلی</CardTitle>
                    <CardDescription className="leading-6">
                        روی هر دکمه بزنید تا رنگ، ایموجی پریمیوم، متن یا جایش را عوض کنید. رنگ برای همه‌ی ربات‌ها کار می‌کند؛ آیکون ایموجی
                        پریمیوم را تلگرام فقط وقتی نشان می‌دهد که صاحب ربات (اکانتی که ربات را در BotFather ساخته) پریمیوم داشته باشد.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* preview, Telegram-like */}
                    <div className="mx-auto max-w-md rounded-2xl bg-[#d5e3ee] dark:bg-[#17212b] p-2 space-y-1.5">
                        {layout.map((row, r) => (
                            <div key={r} className="flex gap-1.5">
                                {row.map((k) => (
                                    <button
                                        key={k}
                                        onClick={() => setSelected(k === sel ? null : k)}
                                        className={cn(
                                            'flex-1 min-w-0 truncate rounded-lg px-2 py-2.5 text-sm font-medium shadow-sm transition',
                                            STYLE_CLASS[st(k).style || ''],
                                            st(k).hidden && 'opacity-35 line-through',
                                            sel === k && 'ring-2 ring-offset-1 ring-amber-400'
                                        )}
                                    >
                                        {st(k).emoji && <span className="ml-1">✦</span>}
                                        {labels[k] || k}
                                    </button>
                                ))}
                            </div>
                        ))}
                        <div className="rounded-lg bg-[#e7edf3] dark:bg-[#2b3b4c] px-2 py-2.5 text-center text-sm text-muted-foreground">
                            (دکمه‌ی مدیریت فقط برای ادمین‌ها)
                        </div>
                    </div>

                    {sel && (
                        <div className="rounded-xl border border-border p-4 space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <b>{labels[sel] || sel}</b>
                                <div className="flex gap-1" dir="ltr">
                                    <Button size="xs" variant="outline" onClick={() => move(sel, -1, 0)} aria-label="ردیف بالا">
                                        <ArrowUp className="h-4 w-4" />
                                    </Button>
                                    <Button size="xs" variant="outline" onClick={() => move(sel, 1, 0)} aria-label="ردیف پایین">
                                        <ArrowDown className="h-4 w-4" />
                                    </Button>
                                    <Button size="xs" variant="outline" onClick={() => move(sel, 0, 1)} aria-label="چپ">
                                        <ArrowLeft className="h-4 w-4" />
                                    </Button>
                                    <Button size="xs" variant="outline" onClick={() => move(sel, 0, -1)} aria-label="راست">
                                        <ArrowRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                            <StyleEditor
                                k={sel}
                                style={st(sel)}
                                label={labels[sel] || ''}
                                renameable={RENAMEABLE(sel)}
                                onStyle={(v) => setSt(sel, v)}
                                onLabel={(v) => setLabels((l) => ({ ...l, [sel]: v }))}
                                canHide
                            />
                        </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                const k = sel || layout[layout.length - 1]?.[0]
                                if (k) move(k, layout.length, 0)
                            }}
                        >
                            <Plus className="h-4 w-4 ml-1" /> انتقال به ردیف تازه
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setLayout(DEFAULT_LAYOUT.map((r) => r.filter((k) => d.main_keys.includes(k))))}>
                            <RotateCcw className="h-4 w-4 ml-1" /> چیدمان پیش‌فرض
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>دکمه‌های دیگر</CardTitle>
                    <CardDescription>رنگ و ایموجی دکمه‌هایی که خارج از منوی اصلی‌اند.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    {d.extra_keys.map((k) => (
                        <div key={k} className="rounded-xl border border-border p-3 space-y-2">
                            <div className="flex items-center gap-2">
                                <span className={cn('rounded-lg px-3 py-1.5 text-sm', STYLE_CLASS[st(k).style || ''])}>{labels[k] || k}</span>
                            </div>
                            <StyleEditor
                                k={k}
                                style={st(k)}
                                label={labels[k] || ''}
                                renameable={RENAMEABLE(k)}
                                onStyle={(v) => setSt(k, v)}
                                onLabel={(v) => setLabels((l) => ({ ...l, [k]: v }))}
                            />
                        </div>
                    ))}
                </CardContent>
            </Card>

            <Card>
                <CardContent className="pt-6 space-y-3">
                    <div className="text-sm text-muted-foreground leading-6 space-y-1">
                        <p>
                            <b>شناسه ایموجی پریمیوم چیست؟</b> در ربات به منوی مدیریت بروید، دکمه‌ی «🆔 شناسه ایموجی پریمیوم» را بزنید و ایموجی
                            را بفرستید؛ ربات شناسه‌ی عددی‌اش را برمی‌گرداند.
                        </p>
                        <p>اگر متن یک دکمه را با یک ایموجی پریمیوم شروع کنید (در خود ربات)، همان ایموجی آیکون دکمه می‌شود.</p>
                    </div>
                    <ErrorBox error={act.error} />
                    <Notice text={act.notice} />
                    <div className="flex gap-2">
                        <Button onClick={save} disabled={act.busy}>
                            {act.busy && <Spinner className="ml-2" />} ذخیره دکمه‌ها
                        </Button>
                        <Button variant="outline" onClick={() => reset(d)} disabled={act.busy}>
                            برگرداندن تغییرات
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

function StyleEditor({
    k,
    style,
    label,
    renameable,
    onStyle,
    onLabel,
    canHide,
}: {
    k: string
    style: Style
    label: string
    renameable: boolean
    onStyle: (v: Partial<Style>) => void
    onLabel: (v: string) => void
    canHide?: boolean
}) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            {renameable ? (
                <Field label="متن دکمه">
                    <Input value={label} onChange={(e) => onLabel(e.target.value)} />
                </Field>
            ) : (
                <Field label="متن دکمه" hint="این متن ثابت است.">
                    <Input value={label} disabled />
                </Field>
            )}
            <Field label="رنگ">
                <select className={selectClass} value={style.style || ''} onChange={(e) => onStyle({ style: e.target.value })}>
                    {Object.entries(STYLE_LABEL).map(([v, l]) => (
                        <option key={v} value={v}>
                            {l}
                        </option>
                    ))}
                </select>
            </Field>
            <Field label="شناسه ایموجی پریمیوم">
                <Input
                    dir="ltr"
                    inputMode="numeric"
                    placeholder="خالی = بدون آیکون"
                    value={style.emoji || ''}
                    onChange={(e) => onStyle({ emoji: e.target.value.replace(/[^\d]/g, '') })}
                    name={`emoji-${k}`}
                />
            </Field>
            {canHide && (
                <Button variant="outline" size="sm" className="sm:col-span-3 justify-self-start" onClick={() => onStyle({ hidden: !style.hidden })}>
                    {style.hidden ? <Eye className="h-4 w-4 ml-1" /> : <EyeOff className="h-4 w-4 ml-1" />}
                    {style.hidden ? 'نمایش دوباره' : 'مخفی کردن از منو'}
                </Button>
            )}
        </div>
    )
}
