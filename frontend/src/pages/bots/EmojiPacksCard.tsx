import { useMemo, useState } from 'react'
import { Plus, RefreshCw, Sparkles, Trash2 } from 'lucide-react'
import { botAPI, botsAPI, EmojiPack, PushResult, TelegramBot } from '@/lib/bots-api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorBox, Loading, Notice, Spinner, useAction, useLoad } from './common'
import { PremiumEmoji } from './emoji'
import { loadPacks } from './ButtonsTab'

// Superadmin only: the premium emoji packs every bot may use. The panel sends
// their emoji ids to each bot, which then refuses any other premium emoji.
export function EmojiPacksCard({ bots }: { bots: TelegramBot[] }) {
    const packs = useLoad(() => loadPacks(true), [])
    const act = useAction()
    const [link, setLink] = useState('')
    const [pushed, setPushed] = useState<PushResult[] | null>(null)
    const viaBot = bots.find((b) => b.is_active) || bots[0]
    const api = useMemo(() => (viaBot ? botAPI(viaBot.id) : null), [viaBot])

    const after = (r: { packs?: EmojiPack[]; pushed: PushResult[] } | true | null) => {
        if (r && r !== true) {
            setPushed(r.pushed)
            loadPacks(true).then((p) => packs.setData(p))
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-amber-500" /> پک‌های ایموجی پریمیوم
                </CardTitle>
                <CardDescription className="leading-6">
                    فقط ایموجی‌های همین پک‌ها روی دکمه‌ها و در متن‌های ربات‌ها قابل استفاده‌اند (در پنل و در منوی خود ربات). لینک پک را از تلگرام کپی
                    کنید: روی یک ایموجی پریمیوم بزنید ← نام پک ← اشتراک‌گذاری.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                {!viaBot ? (
                    <p className="text-sm text-muted-foreground">اول یک ربات وصل کنید؛ پک‌ها از طریق ربات خوانده می‌شوند.</p>
                ) : (
                    <form
                        className="flex gap-2"
                        onSubmit={async (e) => {
                            e.preventDefault()
                            const r = await act.run(() => botsAPI.addPack(link.trim()), 'پک اضافه شد و برای ربات‌ها فرستاده شد')
                            if (r) setLink('')
                            after(r)
                        }}
                    >
                        <Input dir="ltr" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://t.me/addemoji/…" />
                        <Button type="submit" disabled={!link.trim() || act.busy}>
                            {act.busy ? <Spinner className="ml-1" /> : <Plus className="h-4 w-4 ml-1" />} افزودن
                        </Button>
                    </form>
                )}
                <ErrorBox error={act.error || packs.error} />
                <Notice text={act.notice} />
                {packs.loading && !packs.data ? (
                    <Loading />
                ) : !packs.data?.packs.length ? (
                    <p className="text-sm text-muted-foreground">
                        {packs.data?.configured
                            ? 'هیچ پکی مجاز نیست؛ ربات‌ها ایموجی پریمیوم استفاده نمی‌کنند.'
                            : 'هنوز پکی اضافه نشده. تا اولین پک را اضافه نکنید، ربات‌ها مثل قبل محدودیتی ندارند.'}
                    </p>
                ) : (
                    packs.data.packs.map((p) => (
                        <div key={p.name} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
                            <div className="min-w-0 space-y-1">
                                <div className="flex items-center gap-2">
                                    <b>{p.title}</b>
                                    <Badge variant="outline">{p.emojis.length.toLocaleString('fa-IR')} ایموجی</Badge>
                                </div>
                                <a className="text-xs text-primary" dir="ltr" href={`https://t.me/addemoji/${p.name}`} target="_blank" rel="noopener noreferrer">
                                    t.me/addemoji/{p.name}
                                </a>
                                {api && viaBot && (
                                    <div className="flex flex-wrap gap-1 text-xl">
                                        {p.emojis.slice(0, 12).map((e) => (
                                            <PremiumEmoji key={e.id} api={api} botKey={String(viaBot.id)} id={e.id} fallback={e.emoji} className="h-6 w-6" />
                                        ))}
                                    </div>
                                )}
                            </div>
                            <Button
                                size="sm"
                                variant="outline"
                                disabled={act.busy}
                                onClick={async () => {
                                    if (!confirm(`پک «${p.title}» حذف شود؟ آیکون‌های این پک روی دکمه‌ها دیگر نمایش داده نمی‌شوند.`)) return
                                    after(await act.run(() => botsAPI.removePack(p.name), 'پک حذف شد'))
                                }}
                            >
                                <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                        </div>
                    ))
                )}
                {!!bots.length && (
                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            size="sm"
                            variant="outline"
                            disabled={act.busy}
                            onClick={async () => {
                                const r = await act.run(() => botsAPI.syncPacks(), 'برای ربات‌ها فرستاده شد')
                                if (r && r !== true) setPushed(r.pushed)
                            }}
                        >
                            <RefreshCw className="h-4 w-4 ml-1" /> ارسال دوباره به همه‌ی ربات‌ها
                        </Button>
                        {pushed?.map((x) => (
                            <Badge key={x.bot} variant={x.ok ? 'success' : 'destructive'} title={x.error || ''}>
                                {x.bot}: {x.ok ? 'اعمال شد' : 'نرسید'}
                            </Badge>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
