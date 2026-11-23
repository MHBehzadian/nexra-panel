/** A red 16-point starburst with "% OFF", drawn rather than shipped as an
 * image so it stays sharp at any size. */
export function DiscountSticker({ className }: { className?: string }) {
    const points = Array.from({ length: 32 }, (_, i) => {
        const r = i % 2 ? 40 : 50
        const a = (Math.PI * i) / 16
        return `${50 + r * Math.sin(a)},${50 - r * Math.cos(a)}`
    }).join(' ')
    return (
        <svg className={className} viewBox="0 0 100 100" aria-hidden="true">
            <polygon points={points} fill="#ff2d3d" />
            <circle cx="50" cy="50" r="33" fill="none" stroke="#fff" strokeOpacity=".35" strokeWidth="1.5" strokeDasharray="3 3" />
            <text x="50" y="49" textAnchor="middle" fontFamily="Arial Black,Arial,sans-serif" fontWeight="900" fontSize="30" fill="#fff">%</text>
            <text x="50" y="68" textAnchor="middle" fontFamily="Arial Black,Arial,sans-serif" fontWeight="900" fontSize="13" letterSpacing="1.5" fill="#fff">OFF</text>
        </svg>
    )
}

/** The diagonal OFF pattern behind festival surfaces, as a CSS background. */
export const OFF_TEXTURE =
    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='150'><g font-family='Arial Black,Arial,Helvetica,sans-serif' font-weight='900' font-size='64' letter-spacing='4'><text x='6' y='62' fill='none' stroke='white' stroke-opacity='.085' stroke-width='1.4'>OFF</text><text x='156' y='137' fill='white' fill-opacity='.04'>OFF</text></g><text x='224' y='60' font-family='Arial Black,Arial,sans-serif' font-weight='900' font-size='40' fill='%23ff2d3d' fill-opacity='.14'>%25</text></svg>\")"
