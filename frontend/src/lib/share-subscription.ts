// "Send" on a user's details: the subscription as a QR-code picture with a
// caption (name, traffic, time left, link), handed to the phone's share sheet
// so the admin picks the app — Telegram, WhatsApp, anything that takes a photo.
//
// Nothing here names the panel or Nexra: the picture and the caption go to
// end customers, white-label panels included.

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { QRCodeSVG } from 'qrcode.react'
import type { ClientsOutput } from '@/types'

const GB = 1024 ** 3

function faDigits(value: string | number): string {
    return String(value).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)])
}

function formatGb(bytes: number): string {
    const gb = bytes / GB
    return faDigits(Number.isInteger(gb) ? gb : Number(gb.toFixed(1)))
}

/** "۳۰ گیگابایت" or "نامحدود". */
export function trafficText(user: ClientsOutput): string {
    return user.data_limit > 0 ? `${formatGb(user.data_limit)} گیگابایت` : 'نامحدود'
}

/** "۲۵ روز (تا ۱۴۰۵/۰۹/۲۸)", "منقضی شده" or "نامحدود". */
export function timeText(user: ClientsOutput): string {
    if (user.on_hold && user.on_hold_days) return `${faDigits(user.on_hold_days)} روز از اولین اتصال`
    if (!user.expiry_date_unix) return 'نامحدود'
    const expiry = new Date(user.expiry_date_unix)
    const days = Math.ceil((expiry.getTime() - Date.now()) / 86_400_000)
    if (days < 0) return 'منقضی شده'
    // fa-IR formats in the Persian (Jalali) calendar.
    const date = expiry.toLocaleDateString('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit' })
    return days === 0 ? `تا امروز (${date})` : `${faDigits(days)} روز (تا ${date})`
}

export function buildCaption(user: ClientsOutput, link: string): string {
    return [
        `📌 اشتراک: ${user.username}`,
        `📦 حجم: ${trafficText(user)}`,
        `⏳ زمان: ${timeText(user)}`,
        '',
        '🔗 لینک اشتراک:',
        link,
    ].join('\n')
}

function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = reject
        img.src = src
    })
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + w, y, x + w, y + h, r)
    ctx.arcTo(x + w, y + h, x, y + h, r)
    ctx.arcTo(x, y + h, x, y, r)
    ctx.arcTo(x, y, x + w, y, r)
    ctx.closePath()
}

const FONT = "'Yekan', 'Vazirmatn', Tahoma, sans-serif"

/** The QR code on a white card with a framed margin, the subscription's name
 *  and a line of traffic and time under it, as a PNG. */
export async function buildQrImage(user: ClientsOutput, link: string): Promise<Blob> {
    const QR = 640
    const PAD = 48 // inside the frame, around the code
    const MARGIN = 40 // outside the frame
    const TEXT = 150 // room under the code for the two lines
    const W = QR + 2 * (PAD + MARGIN)
    const H = QR + 2 * PAD + TEXT + 2 * MARGIN

    // xmlns is required: as a standalone file, an SVG without it won't load
    // as an image, and React leaves it out.
    const svg = renderToStaticMarkup(
        createElement(QRCodeSVG, {
            value: link,
            size: QR,
            level: 'M',
            marginSize: 0,
            xmlns: 'http://www.w3.org/2000/svg',
        } as React.ComponentProps<typeof QRCodeSVG>)
    )
    const svgUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
    let qr: HTMLImageElement
    try {
        qr = await loadImage(svgUrl)
    } finally {
        URL.revokeObjectURL(svgUrl)
    }
    // The panel's own fonts, if the page has them, so Persian draws properly.
    try {
        await document.fonts?.ready
    } catch {
        // drawn in a fallback font instead
    }

    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')!

    ctx.fillStyle = '#f1f5f9'
    ctx.fillRect(0, 0, W, H)

    roundRect(ctx, MARGIN, MARGIN, W - 2 * MARGIN, H - 2 * MARGIN, 36)
    ctx.fillStyle = '#ffffff'
    ctx.fill()
    ctx.lineWidth = 6
    ctx.strokeStyle = '#cbd5e1'
    ctx.stroke()

    ctx.imageSmoothingEnabled = false
    ctx.drawImage(qr, MARGIN + PAD, MARGIN + PAD, QR, QR)

    const textTop = MARGIN + PAD + QR + 28
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillStyle = '#0f172a'
    ctx.font = `bold 44px ${FONT}`
    ctx.fillText(user.username, W / 2, textTop, W - 2 * (MARGIN + PAD))

    ctx.direction = 'rtl'
    ctx.fillStyle = '#475569'
    ctx.font = `32px ${FONT}`
    ctx.fillText(`${trafficText(user)}  •  ${timeText(user)}`, W / 2, textTop + 66, W - 2 * (MARGIN + PAD))

    return await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not draw the QR code'))), 'image/png')
    )
}

export function qrFile(user: ClientsOutput, blob: Blob): File {
    const safe = user.username.replace(/[^\w.-]+/g, '_') || 'subscription'
    return new File([blob], `${safe}.png`, { type: 'image/png' })
}

export type ShareResult = 'shared' | 'cancelled' | 'fallback'

/**
 * Open the share sheet with the picture and the caption. Where the browser
 * can't share files (most desktops, or a panel served over plain http), the
 * caption is copied and the picture downloaded instead.
 */
export async function shareSubscription(user: ClientsOutput, link: string, file: File): Promise<ShareResult> {
    const caption = buildCaption(user, link)
    const data: ShareData = { files: [file], text: caption, title: user.username }

    if (typeof navigator.share === 'function' && navigator.canShare?.(data)) {
        try {
            await navigator.share(data)
            return 'shared'
        } catch (err: any) {
            if (err?.name === 'AbortError') return 'cancelled'
            // NotAllowedError and the like: fall through to the manual way.
        }
    }

    try {
        await navigator.clipboard.writeText(caption)
    } catch {
        // clipboard blocked; the download still happens
    }
    const url = URL.createObjectURL(file)
    const a = document.createElement('a')
    a.href = url
    a.download = file.name
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
    return 'fallback'
}
