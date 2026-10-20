/**
 * Convert Gigabytes to Bytes
 */
export function gbToBytes(gb: number): number {
    return Math.floor(gb * 1024 * 1024 * 1024)
}

/**
 * Convert Bytes to Gigabytes
 */
export function bytesToGB(bytes: number): number {
    return bytes / (1024 * 1024 * 1024)
}

/**
 * Convert Bytes to Terabytes
 */
export function bytesToTB(bytes: number): number {
    return bytes / (1024 * 1024 * 1024 * 1024)
}

/**
 * Convert Terabytes to Bytes
 */
export function tbToBytes(tb: number): number {
    return Math.floor(tb * 1024 * 1024 * 1024 * 1024)
}

/**
 * Format bytes to human readable format with proper unit
 */
export function formatTraffic(bytes: number): string {
    if (bytes === 0) return '0 B'
    // An admin's remaining traffic can be negative (see the Marzban sync).
    if (bytes < 0) return '-' + formatTraffic(-bytes)

    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    const k = 1024
    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + units[i]
}
