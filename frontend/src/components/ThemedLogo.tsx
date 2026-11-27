import { useEffect, useState } from 'react'

// The theme's light: pale amber into a soft Prussian blue.
const FILL = 'linear-gradient(135deg, #f4f8ea 0%, #e4f0cc 45%, #9db8dd 100%)'

/** Whether the image has a transparent background: some of its edge pixels
 *  are see-through. Only then can its shape be repainted without turning
 *  the whole picture into a coloured block. */
function hasTransparentEdges(img: HTMLImageElement): boolean {
    const w = Math.min(img.naturalWidth, 200)
    const h = Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * w))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return false
    ctx.drawImage(img, 0, 0, w, h)
    const { data } = ctx.getImageData(0, 0, w, h)
    const alphaAt = (x: number, y: number) => data[(y * w + x) * 4 + 3]
    let clear = 0
    let total = 0
    for (let x = 0; x < w; x += Math.max(1, Math.floor(w / 20))) {
        for (const y of [0, h - 1]) {
            total++
            if (alphaAt(x, y) < 200) clear++
        }
    }
    for (let y = 0; y < h; y += Math.max(1, Math.floor(h / 20))) {
        for (const x of [0, w - 1]) {
            total++
            if (alphaAt(x, y) < 200) clear++
        }
    }
    return clear / total > 0.5
}

/**
 * A logo drawn in the theme's colours, whatever colour it was made in: a
 * dark logo on a transparent background vanished on the dark theme. Its
 * shape is used as a mask over the theme's gradient. A logo with a solid
 * background is shown as it is, since masking it would paint a rectangle.
 */
export function ThemedLogo({ src, alt, width = 132 }: { src: string; alt: string; width?: number }) {
    const [shape, setShape] = useState<{ ratio: number } | null>(null)
    const [plain, setPlain] = useState(false)

    useEffect(() => {
        let live = true
        setShape(null)
        setPlain(false)
        const img = new Image()
        img.onload = () => {
            if (!live) return
            try {
                if (img.naturalWidth && hasTransparentEdges(img)) {
                    setShape({ ratio: img.naturalHeight / img.naturalWidth })
                    return
                }
            } catch {
                // unreadable (another origin): shown as it is
            }
            setPlain(true)
        }
        img.onerror = () => live && setPlain(true)
        img.src = src
        return () => {
            live = false
        }
    }, [src])

    if (shape) {
        const mask = `url("${src}") center / contain no-repeat`
        return (
            <div
                role="img"
                aria-label={alt}
                style={{
                    width,
                    height: Math.round(width * shape.ratio),
                    background: FILL,
                    WebkitMask: mask,
                    mask,
                    filter: 'drop-shadow(0 0 18px rgba(228, 240, 204, 0.18))',
                }}
            />
        )
    }
    // Hidden until it is known how to draw it, so the dark version never flashes.
    return (
        <img
            src={src}
            alt={alt}
            style={{ width, height: 'auto', borderRadius: 10, visibility: plain ? 'visible' : 'hidden' }}
        />
    )
}
