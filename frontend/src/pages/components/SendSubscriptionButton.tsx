import { useEffect, useState } from 'react'
import { Check, Loader2, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ClientsOutput } from '@/types'
import { buildQrImage, qrFile, shareSubscription } from '@/lib/share-subscription'

interface Props {
    user: ClientsOutput
    link: string
    className?: string
    iconClassName?: string
}

/**
 * "ارسال": the subscription's QR picture and caption to the app the admin
 * picks from the phone's share sheet.
 *
 * The picture is drawn as soon as the details open, not on the tap: Safari
 * only opens the share sheet straight from a tap, and drawing first would
 * spend that tap.
 */
export function SendSubscriptionButton({ user, link, className, iconClassName = 'h-4 w-4 mr-2' }: Props) {
    const [file, setFile] = useState<File | null>(null)
    const [busy, setBusy] = useState(false)
    const [notice, setNotice] = useState<string | null>(null)

    const key = `${user.username}|${link}|${user.data_limit}|${user.expiry_date_unix ?? ''}`
    useEffect(() => {
        let live = true
        setFile(null)
        buildQrImage(user, link)
            .then((blob) => live && setFile(qrFile(user, blob)))
            .catch(() => live && setFile(null))
        return () => {
            live = false
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key])

    const send = async (e: React.MouseEvent) => {
        e.stopPropagation()
        setNotice(null)
        setBusy(true)
        try {
            const ready = file ?? qrFile(user, await buildQrImage(user, link))
            const result = await shareSubscription(user, link, ready)
            if (result === 'fallback') {
                setNotice('اشتراک‌گذاری مستقیم در این مرورگر ممکن نیست؛ عکس دانلود و متن کپشن کپی شد.')
            } else if (result === 'shared') {
                setNotice('sent')
                setTimeout(() => setNotice(null), 1500)
            }
        } catch (err: any) {
            setNotice(err?.message || 'ارسال ناموفق بود')
        } finally {
            setBusy(false)
        }
    }

    return (
        <>
            <Button size="sm" variant="outline" className={cn(className)} onClick={send} disabled={busy}>
                {busy ? (
                    <Loader2 className={cn(iconClassName, 'animate-spin')} />
                ) : notice === 'sent' ? (
                    <Check className={iconClassName} />
                ) : (
                    <Send className={iconClassName} />
                )}
                ارسال
            </Button>
            {notice && notice !== 'sent' && (
                <p dir="rtl" className="basis-full text-xs text-muted-foreground">{notice}</p>
            )}
        </>
    )
}
