import { useState } from 'react'
import { X } from 'lucide-react'
import { BotAPI, BotButtons, BotText } from '@/lib/bots-api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorBox, Field, Loading, Notice, Spinner, useAction, useLoad } from './common'
import { EmojiBoard, EmojiTextarea, useEmojiBoard } from './EmojiTextarea'
import { PremiumEmoji } from './emoji'

export function TextsTab({ api }: { api: BotAPI }) {
    const remote = useLoad(() => api.get<BotText[]>('texts'), [api])
    // a button label's premium emoji is the button's icon (Telegram shows no
    // custom emoji inside button text); icons live with the button settings
    const buttons = useLoad(() => api.get<BotButtons>('buttons'), [api])
    // only what the user changed; everything else shows the stored text
    const [edits, setEdits] = useState<Record<string, string>>({})
    const [icons, setIcons] = useState<Record<string, string>>({})
    const act = useAction()

    if (remote.loading && !remote.data) return <Loading />
    if (!remote.data) return <ErrorBox error={remote.error} />

    const value = (t: { id: string; text: string }) => edits[t.id] ?? t.text
    const setValue = (id: string, v: string) => setEdits((e) => ({ ...e, [id]: v }))
    const changed = remote.data.filter((t) => value(t) !== t.text)
    const styled = new Set([...(buttons.data?.main_keys || []), ...(buttons.data?.extra_keys || [])])
    const storedIcon = (id: string) => buttons.data?.buttons[id]?.emoji || ''
    const icon = (id: string) => icons[id] ?? storedIcon(id)
    const iconChanged = Object.keys(icons).filter((id) => icons[id] !== storedIcon(id))
    const count = changed.length + iconChanged.filter((id) => !changed.some((t) => t.id === id)).length

    return (
        <Card>
            <CardHeader>
                <CardTitle>متن‌های ربات</CardTitle>
                <CardDescription className="leading-6">
                    متن پیام‌ها و برچسب دکمه‌ها. HTML تلگرام (مثل &lt;b&gt; برای متن پررنگ) پشتیبانی می‌شود. برای ایموجی پریمیوم، روی یک متن بزنید و از پنل
                    «ایموجی پریمیوم» کنار متن‌ها ایموجی را انتخاب کنید؛ همان‌جای مکان‌نما در متن قرار می‌گیرد. برای رنگ و آیکون دکمه‌ها به بخش «دکمه‌ها» بروید.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <EmojiBoard api={api}>
                    <div className="space-y-4">
                        {remote.data.map((t) => (
                            <Field
                                key={t.id}
                                label={t.label}
                                hint={
                                    t.button
                                        ? 'برچسب دکمه — ایموجی پریمیومی که برایش انتخاب کنید آیکون جلوی دکمه می‌شود. کاربران با /start بعدی دکمه‌ی جدید را می‌گیرند.'
                                        : undefined
                                }
                            >
                                {t.button ? (
                                    <LabelInput
                                        api={api}
                                        name={t.label}
                                        value={value(t)}
                                        onChange={(v) => setValue(t.id, v)}
                                        icon={styled.has(t.id) ? icon(t.id) : null}
                                        onIcon={(v) => setIcons((x) => ({ ...x, [t.id]: v }))}
                                    />
                                ) : (
                                    <EmojiTextarea api={api} name={t.label} rows={4} value={value(t)} onChange={(v) => setValue(t.id, v)} />
                                )}
                            </Field>
                        ))}
                    </div>
                </EmojiBoard>
                <ErrorBox error={act.error} />
                <Notice text={act.notice} />
                <div className="sticky bottom-2 flex gap-2 rounded-xl bg-card/90 backdrop-blur p-2 border border-border">
                    <Button
                        disabled={act.busy || count === 0}
                        onClick={async () => {
                            const r = await act.run(async () => {
                                if (changed.length) {
                                    remote.setData(await api.put<BotText[]>('texts', Object.fromEntries(changed.map((t) => [t.id, value(t)]))))
                                    setEdits({})
                                }
                                if (iconChanged.length && buttons.data) {
                                    const merged = { ...buttons.data.buttons }
                                    for (const id of iconChanged) merged[id] = { ...(merged[id] || {}), emoji: icons[id] }
                                    buttons.setData(await api.put<BotButtons>('buttons', { buttons: merged }))
                                    setIcons({})
                                }
                            }, 'ذخیره شد')
                            return r
                        }}
                    >
                        {act.busy && <Spinner className="ml-2" />} ذخیره {count ? `(${count})` : ''}
                    </Button>
                    <Button
                        variant="outline"
                        disabled={!count}
                        onClick={() => {
                            setEdits({})
                            setIcons({})
                        }}
                    >
                        برگرداندن
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}

// A button label, with its premium icon in front: while the field is the
// target, a pick on the emoji panel becomes the icon.
function LabelInput({
    api,
    name,
    value,
    onChange,
    icon,
    onIcon,
}: {
    api: BotAPI
    name: string
    value: string
    onChange: (v: string) => void
    icon: string | null
    onIcon: (v: string) => void
}) {
    const board = useEmojiBoard()
    return (
        <div className="flex items-center gap-2">
            {icon !== null && (
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/30">
                    {icon ? (
                        <PremiumEmoji api={api} botKey={String(api.id)} id={icon} className="h-6 w-6" />
                    ) : (
                        <span className="text-[10px] text-muted-foreground">آیکون</span>
                    )}
                </span>
            )}
            <Input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onFocus={() => board?.focus(`${name} (آیکون دکمه)`, icon !== null ? (id) => onIcon(id) : null)}
            />
            {icon && (
                <Button type="button" size="icon" variant="ghost" title="برداشتن آیکون" onClick={() => onIcon('')}>
                    <X className="h-4 w-4 text-destructive" />
                </Button>
            )}
        </div>
    )
}
