import { useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Copy, Download, KeyRound, Smartphone, Upload, Github } from 'lucide-react'
import { BotAPI, BotAutopay, botsAPI } from '@/lib/bots-api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Empty, ErrorBox, Loading, Notice, Spinner, Switch, money, useAction, useLoad } from './common'

const SMS_STATUS: Record<string, string> = {
    matched: 'شارژ شد',
    new: 'در حال بررسی',
    unmatched: 'سفارشی با این مبلغ نبود',
    ignored: 'واریز نبود',
    unreadable: 'خوانده نشد',
    skipped: 'قبلاً بررسی شده',
}

function size(bytes: number): string {
    return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

function lastSeen(v: string): { text: string; ok: boolean } {
    if (!v) return { text: 'هنوز وصل نشده', ok: false }
    const t = Date.parse(v.replace(' ', 'T') + '+03:30')
    if (isNaN(t)) return { text: v, ok: true }
    const mins = Math.round((Date.now() - t) / 60000)
    if (mins < 2) return { text: 'همین الان', ok: true }
    if (mins < 60) return { text: `${mins} دقیقه پیش`, ok: mins < 15 }
    const h = Math.round(mins / 60)
    if (h < 48) return { text: `${h} ساعت پیش`, ok: false }
    return { text: `${Math.round(h / 24)} روز پیش`, ok: false }
}

export function AutopayTab({ api, superadmin }: { api: BotAPI; superadmin: boolean }) {
    const remote = useLoad(() => api.get<BotAutopay>('autopay'), [api])
    const apk = useLoad(() => botsAPI.apkInfo(), [])
    const act = useAction()
    const [showPairing, setShowPairing] = useState(false)
    const fileRef = useRef<HTMLInputElement>(null)

    if (remote.loading && !remote.data) return <Loading />
    if (!remote.data) return <ErrorBox error={remote.error} />
    const a = remote.data
    const seen = lastSeen(a.last_seen)

    return (
        <div className="space-y-4">
            <ErrorBox error={act.error} />
            <Notice text={act.notice} />
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Smartphone className="h-5 w-5 text-primary" /> تأیید خودکار پرداخت
                    </CardTitle>
                    <CardDescription className="leading-6">
                        اپ اندروید پیامک‌های واریز بانک را به ربات می‌فرستد. ربات برای هر کارت به کارت مبلغی یکتا (با چند تومان اختلاف) می‌سازد
                        و با رسیدن پیامک همان مبلغ، شارژ را بدون دخالت شما انجام می‌دهد.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Switch
                        checked={a.enabled}
                        disabled={act.busy}
                        onChange={async (v) => {
                            const r = await act.run(() => api.put<BotAutopay>('autopay', { enabled: v }))
                            if (r && r !== true) remote.setData(r)
                        }}
                        label="تأیید خودکار روشن است"
                        hint="خاموش که باشد، کارت به کارت مثل قبل با بررسی رسید کار می‌کند."
                    />
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div className="rounded-lg bg-muted/40 p-3">
                            <div className="text-xs text-muted-foreground">آخرین ارتباط گوشی</div>
                            <div className="font-medium flex items-center gap-1">
                                {seen.text} <Badge variant={seen.ok ? 'success' : 'secondary'}>{seen.ok ? 'وصل' : 'قطع'}</Badge>
                            </div>
                        </div>
                        <div className="rounded-lg bg-muted/40 p-3">
                            <div className="text-xs text-muted-foreground">گوشی</div>
                            <div className="font-medium truncate" dir="ltr">
                                {a.device || '—'}
                            </div>
                        </div>
                        <div className="rounded-lg bg-muted/40 p-3">
                            <div className="text-xs text-muted-foreground">پرداخت‌های خودکار</div>
                            <div className="font-medium">{a.paid_count}</div>
                        </div>
                        <div className="rounded-lg bg-muted/40 p-3">
                            <div className="text-xs text-muted-foreground">در انتظار واریز</div>
                            <div className="font-medium">{a.open_count}</div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>نصب و اتصال اپ</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm leading-7">
                    <ol className="list-decimal pr-5 space-y-1">
                        <li>اپ را دانلود و روی گوشی‌ای که پیامک‌های بانک به آن می‌آید نصب کنید.</li>
                        <li>اجازه‌ی خواندن پیامک و «اجازه‌ی اجرای دائمی (بهینه‌سازی باتری)» را به اپ بدهید.</li>
                        <li>
                            «نمایش کد» را بزنید و کد اتصال را به گوشی برسانید: QR را با دوربین گوشی اسکن کنید یا متن را کپی کنید. بعد در اپ
                            جای‌گذاری‌اش کنید و «اتصال به بات» را بزنید.
                        </li>
                        <li>با «تست ارتباط با سرور» در اپ مطمئن شوید «آخرین ارتباط گوشی» اینجا «همین الان» می‌شود.</li>
                    </ol>
                    <div className="flex flex-wrap gap-2">
                        <Button disabled={!apk.data?.available || act.busy} onClick={() => act.run(() => botsAPI.apkDownload())}>
                            <Download className="h-4 w-4 ml-1" /> دانلود اپ اندروید
                        </Button>
                        {apk.data?.available ? (
                            <span className="self-center text-xs text-muted-foreground">
                                {apk.data.version ? `نسخه ${apk.data.version} · ` : ''}
                                {apk.data.size ? size(apk.data.size) : ''}
                            </span>
                        ) : (
                            <span className="self-center text-xs text-muted-foreground">
                                {superadmin ? 'هنوز فایلی بارگذاری نشده.' : 'هنوز فایلی بارگذاری نشده؛ به مدیر پنل اطلاع دهید.'}
                            </span>
                        )}
                    </div>
                    {superadmin && (
                        <div className="flex flex-wrap gap-2 rounded-lg border border-dashed border-border p-3">
                            <span className="w-full text-xs text-muted-foreground">فقط شما: نسخه‌ی اپ برای همه‌ی ادمین‌ها</span>
                            <Button
                                size="sm"
                                variant="outline"
                                disabled={act.busy}
                                onClick={async () => {
                                    if (await act.run(() => botsAPI.apkFetch(), 'آخرین نسخه از GitHub گرفته شد')) apk.reload()
                                }}
                            >
                                <Github className="h-4 w-4 ml-1" /> گرفتن آخرین نسخه از GitHub
                            </Button>
                            <Button size="sm" variant="outline" disabled={act.busy} onClick={() => fileRef.current?.click()}>
                                <Upload className="h-4 w-4 ml-1" /> بارگذاری فایل APK
                            </Button>
                            <input
                                ref={fileRef}
                                type="file"
                                accept=".apk,application/vnd.android.package-archive"
                                className="hidden"
                                onChange={async (e) => {
                                    const f = e.target.files?.[0]
                                    e.target.value = ''
                                    if (f && (await act.run(() => botsAPI.apkUpload(f), 'اپ بارگذاری شد'))) apk.reload()
                                }}
                            />
                        </div>
                    )}

                    <div className="rounded-xl border border-border p-4 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <b>کد اتصال این ربات</b>
                            <Button size="sm" variant="outline" onClick={() => setShowPairing((v) => !v)}>
                                {showPairing ? 'پنهان کردن' : 'نمایش کد'}
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">این کد مثل رمز است؛ هر کس داشته باشد می‌تواند برای ربات پیامک واریز بفرستد.</p>
                        {showPairing && (
                            <div className="flex flex-col items-center gap-3">
                                <div className="rounded-xl bg-white p-3">
                                    <QRCodeSVG value={a.pairing} size={220} />
                                </div>
                                <div className="flex w-full items-center gap-2">
                                    <code className="flex-1 break-all rounded-lg bg-muted/50 p-2 text-xs" dir="ltr">
                                        {a.pairing}
                                    </code>
                                    <Button size="icon" variant="outline" onClick={() => navigator.clipboard?.writeText(a.pairing)} aria-label="کپی">
                                        <Copy className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        )}
                        <Button
                            size="sm"
                            variant="outline"
                            disabled={act.busy}
                            onClick={async () => {
                                if (!confirm('کلید جدید ساخته شود؟ گوشی فعلی قطع می‌شود و باید دوباره کد را اسکن کند.')) return
                                const r = await act.run(() => api.post<BotAutopay>('autopay/new-key'), 'کلید جدید ساخته شد؛ کد را دوباره در اپ اسکن کنید')
                                if (r && r !== true) remote.setData(r)
                            }}
                        >
                            {act.busy ? <Spinner className="ml-1" /> : <KeyRound className="h-4 w-4 ml-1" />} ساخت کلید جدید
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>آخرین پیامک‌ها</CardTitle>
                </CardHeader>
                <CardContent>
                    {!a.recent_sms.length ? (
                        <Empty text="هنوز پیامکی نرسیده" />
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="text-right">فرستنده</TableHead>
                                        <TableHead className="text-right">مبلغ</TableHead>
                                        <TableHead className="text-right">زمان</TableHead>
                                        <TableHead className="text-right">نتیجه</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {a.recent_sms.map((s: any) => (
                                        <TableRow key={s.id}>
                                            <TableCell dir="ltr" className="text-right">
                                                {s.sender}
                                            </TableCell>
                                            <TableCell>{s.amount ? money(s.amount) : '—'}</TableCell>
                                            <TableCell dir="ltr" className="text-right text-xs">
                                                {s.sent_at || s.received_at}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={s.status === 'matched' ? 'success' : 'secondary'}>{SMS_STATUS[s.status] || s.status}</Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
