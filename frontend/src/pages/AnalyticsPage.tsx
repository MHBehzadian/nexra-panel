import { useCallback, useEffect, useState } from 'react'
import { Activity, CalendarClock, RefreshCw, ShoppingCart, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BarChart } from '@/components/charts/BarChart'
import { analyticsAPI } from '@/lib/api'
import { getUserRole } from '@/lib/auth'
import { formatTraffic } from '@/lib/traffic-converter'
import { cn } from '@/lib/utils'
import { AdminAnalytics, AnalyticsNodePeriod } from '@/types'

const NODE_PERIODS: { value: AnalyticsNodePeriod; label: string }[] = [
    { value: '1d', label: '24h' },
    { value: '7d', label: '7d' },
    { value: '30d', label: '30d' },
]

// Silent refresh; the usage behind it only moves with each Marzban sync.
const POLL_MS = 60_000

/** Backend timestamps are naive UTC. */
function parseUtc(iso: string): Date {
    return new Date(iso.endsWith('Z') ? iso : `${iso}Z`)
}

/** "2026-11-16" (already a local date) -> "Mon 16". */
function dayLabel(date: string, long = false): string {
    const d = new Date(`${date}T00:00:00`)
    return d.toLocaleDateString('en-US', long ? { weekday: 'long', month: 'short', day: 'numeric' } : { weekday: 'short', day: 'numeric' })
}

function changeText(today: number, yesterday: number): string {
    if (yesterday <= 0) return today > 0 ? 'Nothing used yesterday' : 'No usage yet'
    const pct = Math.round(((today - yesterday) / yesterday) * 100)
    return `${pct >= 0 ? '+' : ''}${pct}% vs yesterday (${formatTraffic(yesterday)})`
}

function StatCard({
    title,
    icon: Icon,
    value,
    caption,
    valueClass,
}: {
    title: string
    icon: typeof Activity
    value: string
    caption: string
    valueClass?: string
}): JSX.Element {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <Icon className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
                <div className={cn('text-2xl font-bold tabular-nums', valueClass)}>{value}</div>
                <p className="text-xs text-muted-foreground">{caption}</p>
            </CardContent>
        </Card>
    )
}

function RunwayCard({ data }: { data: AdminAnalytics }): JSX.Element {
    const { days_left, runs_out_at } = data.sales
    let value: string
    let caption: string
    let tone: string | undefined
    if (data.remaining <= 0) {
        value = 'Out of traffic'
        caption = 'Your balance is used up'
        tone = 'text-destructive'
    } else if (days_left === null) {
        value = '—'
        caption = `No sales in the last ${data.sales.window_days} days`
    } else {
        value = days_left < 1 ? '< 1 day' : `${Math.floor(days_left)} days`
        caption = runs_out_at
            ? `Around ${parseUtc(runs_out_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at this pace`
            : 'At this pace'
        tone = days_left < 3 ? 'text-destructive' : days_left < 7 ? 'text-amber-500' : undefined
    }
    return <StatCard title="Traffic runs out in" icon={CalendarClock} value={value} caption={caption} valueClass={tone} />
}

function NodeRanking({ nodes }: { nodes: AdminAnalytics['nodes'] }): JSX.Element {
    if (nodes.items === null) {
        return <p className="py-6 text-center text-sm text-muted-foreground">Marzban couldn't be reached. Try again in a moment.</p>
    }
    if (nodes.items.length === 0) {
        return <p className="py-6 text-center text-sm text-muted-foreground">Your users haven't used any node in this period.</p>
    }
    const top = nodes.items[0].used
    return (
        <ol className="space-y-3">
            {nodes.items.map((node, i) => {
                const share = nodes.total > 0 ? (node.used / nodes.total) * 100 : 0
                return (
                    <li key={`${node.id ?? 'master'}-${node.name}`} className="space-y-1.5">
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                            <span className="min-w-0 truncate font-medium">
                                <span className="mr-2 text-muted-foreground tabular-nums">{i + 1}.</span>
                                {node.name}
                            </span>
                            <span className="shrink-0 tabular-nums text-muted-foreground">
                                <span className="font-semibold text-foreground">{formatTraffic(node.used)}</span>
                                {' · '}
                                {share < 1 ? '<1' : Math.round(share)}%
                            </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-muted">
                            <div
                                className="h-2 rounded-full"
                                style={{ width: `${Math.max(1, (node.used / top) * 100)}%`, background: 'hsl(var(--brand-blue))' }}
                            />
                        </div>
                    </li>
                )
            })}
        </ol>
    )
}

export function AnalyticsPage(): JSX.Element {
    const role = getUserRole()
    const [data, setData] = useState<AdminAnalytics | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [nodePeriod, setNodePeriod] = useState<AnalyticsNodePeriod>('1d')

    const load = useCallback(
        async (silent: boolean) => {
            if (!silent) setRefreshing(true)
            try {
                setData(await analyticsAPI.get(nodePeriod))
                setError(null)
            } catch (e) {
                if (!silent) setError(e instanceof Error ? e.message : 'Failed to load analytics')
            } finally {
                setLoading(false)
                setRefreshing(false)
            }
        },
        [nodePeriod]
    )

    useEffect(() => {
        if (role !== 'admin') return
        load(false)
        const timer = setInterval(() => load(true), POLL_MS)
        return () => clearInterval(timer)
    }, [role, load])

    if (role !== 'admin') {
        return (
            <div className="p-4 md:p-6">
                <p className="text-muted-foreground">Analytics is available to admins.</p>
            </div>
        )
    }

    const usage = data?.usage
    const sales = data?.sales
    const recordingSince = usage?.since ? parseUtc(usage.since) : null
    const shortHistory = !recordingSince || Date.now() - recordingSince.getTime() < 24 * 3600 * 1000

    return (
        <div className="space-y-6 p-4 md:p-6 max-w-full overflow-x-hidden">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Analytics</h1>
                    <p className="text-muted-foreground">Your users' usage and your sales</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => load(false)} disabled={refreshing}>
                    <RefreshCw className={cn('h-4 w-4 mr-2', refreshing && 'animate-spin')} />
                    {refreshing ? 'Refreshing...' : 'Refresh'}
                </Button>
            </div>

            {error && (
                <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive border border-destructive/20">{error}</div>
            )}

            {loading && !data && <p className="text-sm text-muted-foreground">Loading...</p>}

            {data && usage && sales && (
                <>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <StatCard
                            title="Used today"
                            icon={Activity}
                            value={formatTraffic(usage.today)}
                            caption={changeText(usage.today, usage.yesterday)}
                        />
                        <StatCard
                            title="Sold per day"
                            icon={ShoppingCart}
                            value={formatTraffic(sales.per_day)}
                            caption={`Average of the last ${sales.window_days} days`}
                        />
                        <StatCard
                            title="Expected sales tomorrow"
                            icon={TrendingUp}
                            value={formatTraffic(sales.tomorrow)}
                            caption="Volume of the users you'll likely create"
                        />
                        <RunwayCard data={data} />
                    </div>

                    {sales.days_covered < sales.window_days && (
                        <p className="text-xs text-muted-foreground">
                            Sales history covers {sales.days_covered} of {sales.window_days} days so far, so the
                            estimates will settle as it fills in.
                        </p>
                    )}

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base">Usage — last 24 hours</CardTitle>
                            <p className="text-xs text-muted-foreground">
                                {shortHistory
                                    ? recordingSince
                                        ? `Recording since ${recordingSince.toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}`
                                        : 'Recording starts with the next sync of your users'
                                    : 'All your users together, per hour'}
                            </p>
                        </CardHeader>
                        <CardContent>
                            <BarChart
                                data={usage.hourly.map((h, i) => ({
                                    label: h.label,
                                    title: `${h.label} – ${String((Number(h.label.slice(0, 2)) + 1) % 24).padStart(2, '0')}:00`,
                                    value: h.used,
                                    muted: i === usage.hourly.length - 1,
                                }))}
                                format={formatTraffic}
                                labelEvery={3}
                            />
                        </CardContent>
                    </Card>

                    <div className="grid gap-4 lg:grid-cols-2">
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base">Usage — last 7 days</CardTitle>
                                <p className="text-xs text-muted-foreground">Today is still running</p>
                            </CardHeader>
                            <CardContent>
                                <BarChart
                                    data={usage.daily.map((d, i) => ({
                                        label: dayLabel(d.date),
                                        title: dayLabel(d.date, true),
                                        value: d.used,
                                        muted: i === usage.daily.length - 1,
                                    }))}
                                    format={formatTraffic}
                                    height={220}
                                />
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base">Sales — last 7 days</CardTitle>
                                <p className="text-xs text-muted-foreground">Traffic charged for new, upgraded and reset users, minus refunds</p>
                            </CardHeader>
                            <CardContent>
                                <BarChart
                                    data={sales.daily.map((d, i) => ({
                                        label: dayLabel(d.date),
                                        title: dayLabel(d.date, true),
                                        value: d.sold,
                                        muted: i === sales.daily.length - 1,
                                    }))}
                                    format={formatTraffic}
                                    height={220}
                                    color="hsl(var(--brand-green))"
                                />
                            </CardContent>
                        </Card>
                    </div>

                    <Card>
                        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0 pb-4">
                            <div>
                                <CardTitle className="text-base">Most used nodes</CardTitle>
                                <p className="text-xs text-muted-foreground">Where your users' traffic goes, most first</p>
                            </div>
                            <div className="flex rounded-md border p-0.5">
                                {NODE_PERIODS.map((p) => (
                                    <button
                                        key={p.value}
                                        type="button"
                                        onClick={() => setNodePeriod(p.value)}
                                        className={cn(
                                            'rounded px-3 py-1 text-xs font-medium transition-colors',
                                            nodePeriod === p.value
                                                ? 'bg-primary text-primary-foreground'
                                                : 'text-muted-foreground hover:text-foreground'
                                        )}
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                        </CardHeader>
                        <CardContent>
                            <NodeRanking nodes={data.nodes} />
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    )
}
