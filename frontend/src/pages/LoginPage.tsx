import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { loginSchema, LoginFormData } from '@/types'
import { authAPI, settingsAPI, getLogoUrl } from '@/lib/api'
import { setToken, getDecodedToken, isTokenValid } from '@/lib/auth'
import logo from '@/assets/logo.png'

// Black Friday dress for the login page: black, a diagonal OFF texture and a
// red discount sticker on the logo. Set to false to bring the usual page back.
const BLACK_FRIDAY = true

function DiscountSticker({ className }: { className?: string }) {
    // A 16-point starburst with a percent sign, drawn rather than shipped as an
    // image so it stays sharp at any size.
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

const styles = `
.nx-login-root{
  position:fixed; inset:0; z-index:0; overflow:hidden;
  background:hsl(var(--background)); color:hsl(var(--foreground));
  display:flex; align-items:center; justify-content:center; padding:24px;
  -webkit-font-smoothing:antialiased;
  background-image:radial-gradient(ellipse 70% 50% at 50% -10%, hsl(var(--brand-blue) / .12), transparent 62%);
}
/* Slow drifting colour behind the card, in the panel's own blue. Blurred far
   past the point of any visible edge, so it reads as light in the room rather
   than as circles. */
.nx-aurora{position:absolute;border-radius:50%;filter:blur(80px);pointer-events:none;will-change:transform}
.nx-aurora-1{width:46vw;height:46vw;min-width:380px;min-height:380px;top:-14%;left:-8%;
  background:radial-gradient(circle, hsl(var(--brand-blue) / .62), transparent 70%);
  animation:nx-drift-1 24s ease-in-out infinite alternate}
.nx-aurora-2{width:40vw;height:40vw;min-width:320px;min-height:320px;bottom:-16%;right:-6%;
  background:radial-gradient(circle, hsl(217 91% 55% / .50), transparent 70%);
  animation:nx-drift-2 30s ease-in-out infinite alternate}
.nx-aurora-3{width:34vw;height:34vw;min-width:280px;min-height:280px;top:34%;right:22%;
  background:radial-gradient(circle, hsl(205 90% 60% / .42), transparent 70%);
  animation:nx-drift-3 20s ease-in-out infinite alternate}
@keyframes nx-drift-1{from{transform:translate3d(0,0,0) scale(1)}to{transform:translate3d(8vw,6vh,0) scale(1.14)}}
@keyframes nx-drift-2{from{transform:translate3d(0,0,0) scale(1.08)}to{transform:translate3d(-7vw,-5vh,0) scale(1)}}
@keyframes nx-drift-3{from{transform:translate3d(0,0,0) scale(.94)}to{transform:translate3d(-5vw,7vh,0) scale(1.12)}}
.nx-card{
  width:100%; max-width:412px;
  background:var(--surface-gradient);
  border:1px solid hsl(var(--border));
  border-radius:1.75rem; padding:36px 32px 24px;
  box-shadow:inset 0 1px 0 0 var(--surface-highlight), var(--surface-shadow);
  position:relative; overflow:hidden; z-index:1;
}
.nx-brand{display:flex;align-items:center;gap:9px;font-size:11px;font-weight:800;letter-spacing:.22em;text-transform:uppercase;color:hsl(var(--muted-foreground));margin-bottom:22px}
.nx-dot{width:8px;height:8px;border-radius:50%;background:hsl(var(--brand-blue));box-shadow:0 0 12px 1px hsl(var(--brand-blue) / .5)}
.nx-logo{display:flex;justify-content:center;margin-bottom:18px}
.nx-logo img{width:132px;height:auto}
.nx-title{font-weight:900;font-size:28px;letter-spacing:-.02em;line-height:1.3;margin-bottom:8px;color:hsl(var(--foreground))}
.nx-sub{font-size:14px;color:hsl(var(--muted-foreground));line-height:1.8;margin-bottom:24px}
.nx-err{border:1px solid hsl(var(--destructive) / .35);color:hsl(var(--destructive));background:hsl(var(--destructive) / .08);border-radius:12px;padding:11px 13px;font-size:13px;margin-bottom:16px;line-height:1.6}
.nx-form{display:flex;flex-direction:column;gap:18px}
.nx-field{position:relative}
.nx-field label{position:absolute;top:-7px;left:12px;background:hsl(var(--card));padding:0 6px;font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:hsl(var(--muted-foreground))}
.nx-field input{width:100%;background:hsl(var(--card));border:1px solid hsl(var(--input));border-radius:12px;padding:15px 14px;color:hsl(var(--foreground));font-family:inherit;font-size:14px;transition:border-color .15s ease,box-shadow .15s ease}
.nx-field input:focus{outline:none;border-color:hsl(var(--brand-blue));box-shadow:0 0 0 3px hsl(var(--brand-blue) / .18)}
.nx-field input::placeholder{color:hsl(var(--muted-foreground) / .6)}
.nx-fielderr{color:hsl(var(--destructive));font-size:12px;margin-top:6px}
.nx-btn{margin-top:6px;width:100%;background:hsl(var(--primary));color:hsl(var(--primary-foreground));border:0;border-radius:12px;padding:16px;font-family:inherit;font-size:14px;font-weight:800;cursor:pointer;box-shadow:0 12px 28px rgba(19,34,56,.16);transition:transform .18s ease,background .15s ease,box-shadow .18s ease}
.nx-btn:hover{background:hsl(var(--primary) / .9);transform:translateY(-2px)}
.nx-btn:active{transform:translateY(0)}
.nx-btn:disabled{opacity:.55;cursor:default;transform:none}
.nx-foot{margin-top:24px;padding-top:16px;border-top:1px solid hsl(var(--border));display:flex;justify-content:space-between;font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:hsl(var(--muted-foreground))}
@media (prefers-reduced-motion:reduce){.nx-dot{animation:none}.nx-aurora{animation:none}}

/* ---------------------------------------------------------- Black Friday
   Everything below only applies under .nx-bf, so switching the campaign off
   is a single flag (BLACK_FRIDAY) and the page falls back to the usual look. */
.nx-bf{
  --bf-red:#ff2d3d;
  background:#050505; color:#f5f5f5;
  background-image:
    radial-gradient(ellipse 60% 45% at 85% 110%, rgba(255,45,61,.16), transparent 65%),
    radial-gradient(ellipse 55% 40% at 10% -10%, rgba(255,255,255,.06), transparent 60%);
}
.nx-bf .nx-aurora{display:none}
/* The diagonal OFF texture: one tile repeated across a plane that is turned
   on its side and much larger than the screen, so no corner ever shows. */
.nx-bf-texture{
  position:absolute; left:50%; top:50%; width:260vmax; height:260vmax;
  transform:translate(-50%,-50%) rotate(-28deg);
  background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='150'><g font-family='Arial Black,Arial,Helvetica,sans-serif' font-weight='900' font-size='64' letter-spacing='4'><text x='6' y='62' fill='none' stroke='white' stroke-opacity='.085' stroke-width='1.4'>OFF</text><text x='156' y='137' fill='white' fill-opacity='.04'>OFF</text></g><text x='224' y='60' font-family='Arial Black,Arial,sans-serif' font-weight='900' font-size='40' fill='%23ff2d3d' fill-opacity='.14'>%25</text></svg>");
  background-size:300px 150px;
  animation:nx-bf-slide 60s linear infinite;
  pointer-events:none;
}
@keyframes nx-bf-slide{from{background-position:0 0}to{background-position:300px 150px}}
/* Fades the texture out behind the card so the form stays quiet. */
.nx-bf-vignette{position:absolute;inset:0;pointer-events:none;
  background:radial-gradient(ellipse 38% 55% at 50% 50%, rgba(5,5,5,.92), rgba(5,5,5,.55) 55%, rgba(5,5,5,.15) 100%)}
.nx-bf .nx-card{
  background:linear-gradient(160deg,#141414 0%,#0b0b0b 100%);
  border:1px solid rgba(255,255,255,.08);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.06), 0 30px 80px rgba(0,0,0,.65), 0 0 0 1px rgba(0,0,0,.6);
  overflow:visible;
  max-width:392px; padding:52px 32px 30px;
}
.nx-bf .nx-card::before,.nx-bf .nx-card::after{content:"";position:absolute;left:0;right:0;height:3px;pointer-events:none;
  background:linear-gradient(90deg,transparent,var(--bf-red) 30%,var(--bf-red) 70%,transparent);
  box-shadow:0 0 18px 1px rgba(255,45,61,.45)}
.nx-bf .nx-card::before{top:0;border-radius:1.75rem 1.75rem 0 0}
.nx-bf .nx-card::after{bottom:0;border-radius:0 0 1.75rem 1.75rem}
.nx-bf .nx-brand{color:rgba(255,255,255,.55);justify-content:space-between;margin-bottom:46px}
.nx-bf .nx-brand > span:first-child{display:inline-flex;align-items:center;gap:9px}
.nx-bf .nx-dot{background:var(--bf-red);box-shadow:0 0 12px 2px rgba(255,45,61,.6);animation:nx-bf-pulse 1.8s ease-in-out infinite}
@keyframes nx-bf-pulse{50%{opacity:.35}}
.nx-bf .nx-logo{position:relative;margin:0 0 46px}
.nx-bf .nx-logo img{width:150px}
.nx-bf .nx-logo img{filter:invert(1) grayscale(1) brightness(1.6) contrast(1.2);mix-blend-mode:screen}
.nx-bf-red{color:var(--bf-red);font-weight:inherit}
.nx-bf-logo-wrap{position:relative;display:inline-block}
.nx-bf-sticker{position:absolute;top:-31px;right:-33px;width:46px;height:46px;transform:rotate(14deg);
  filter:drop-shadow(0 6px 14px rgba(255,45,61,.45));animation:nx-bf-wiggle 3.2s ease-in-out infinite}
@keyframes nx-bf-wiggle{0%,100%{transform:rotate(14deg) scale(1)}50%{transform:rotate(4deg) scale(1.06)}}
.nx-bf .nx-title{color:#fff}
.nx-bf .nx-sub{margin-bottom:32px}
.nx-bf .nx-form{gap:22px}
.nx-bf .nx-btn{margin-top:10px}
.nx-bf .nx-foot{margin-top:34px;padding-top:20px}
.nx-bf .nx-sub{color:rgba(255,255,255,.55)}
.nx-bf .nx-field label{background:#101010;color:rgba(255,255,255,.55)}
.nx-bf .nx-field input{background:#101010;border-color:rgba(255,255,255,.12);color:#fff}
.nx-bf .nx-field input::placeholder{color:rgba(255,255,255,.28)}
.nx-bf .nx-field input:focus{border-color:var(--bf-red);box-shadow:0 0 0 3px rgba(255,45,61,.18)}
.nx-bf .nx-btn{background:#fff;color:#050505;box-shadow:0 14px 34px rgba(0,0,0,.5)}
.nx-bf .nx-btn:hover{background:#fff;box-shadow:0 16px 38px rgba(255,45,61,.28)}
.nx-bf .nx-foot{border-top-color:rgba(255,255,255,.08);color:rgba(255,255,255,.4)}
.nx-bf .nx-foot .nx-bf-off{color:var(--bf-red)}
@media (prefers-reduced-motion:reduce){.nx-bf-texture,.nx-bf-sticker,.nx-bf .nx-dot{animation:none}}
`

export function LoginPage() {
    const navigate = useNavigate()
    const [serverError, setServerError] = useState<string | null>(null)
    const [branding, setBranding] = useState<{ login_title: string; has_logo: boolean }>({
        login_title: 'Nexra Panel',
        has_logo: false,
    })

    useEffect(() => {
        settingsAPI.getBranding().then(setBranding).catch(() => { })
    }, [])

    // Light only, whatever the saved theme is. index.html skips the class on a
    // direct hit; this covers arriving here from inside the app (logging out),
    // and hands the theme back on the way out.
    useEffect(() => {
        const root = document.documentElement
        const wasDark = root.classList.contains('dark')
        root.classList.remove('dark')
        return () => {
            if (wasDark) root.classList.add('dark')
        }
    }, [])

    useEffect(() => {
        if (isTokenValid()) {
            navigate('/', { replace: true })
        }
    }, [navigate])

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<LoginFormData>({
        resolver: zodResolver(loginSchema),
    })

    const onSubmit = async (data: LoginFormData) => {
        setServerError(null)
        try {
            const response = await authAPI.login(data.username, data.password)
            setToken(response.access_token)
            const decoded = getDecodedToken()
            if (decoded?.role) {
                navigate('/', { replace: true })
            } else {
                setServerError('نقش کاربر مشخص نشد')
            }
        } catch (error: any) {
            console.error('Login error:', error)
            setServerError(error?.message || 'ورود ناموفق بود. اطلاعات ورود را بررسی کنید.')
        }
    }

    return (
        <div className={BLACK_FRIDAY ? 'nx-login-root nx-bf' : 'nx-login-root'}>
            <style>{styles}</style>
            {BLACK_FRIDAY && (
                <>
                    <div className="nx-bf-texture" aria-hidden="true" />
                    <div className="nx-bf-vignette" aria-hidden="true" />
                </>
            )}
            <div className="nx-aurora nx-aurora-1" aria-hidden="true" />
            <div className="nx-aurora nx-aurora-2" aria-hidden="true" />
            <div className="nx-aurora nx-aurora-3" aria-hidden="true" />
            <main className="nx-card">
                {BLACK_FRIDAY ? (
                    <div className="nx-brand">
                        <span><span className="nx-dot" /> Black <b className="nx-bf-red">Friday</b></span>
                    </div>
                ) : (
                    <div className="nx-brand"><span className="nx-dot" /> Panel Access</div>
                )}

                <div className="nx-logo">
                    {BLACK_FRIDAY ? (
                        <>
                            <span className="nx-bf-logo-wrap">
                                <img src={branding.has_logo ? getLogoUrl() : logo} alt={branding.login_title} />
                                <DiscountSticker className="nx-bf-sticker" />
                            </span>
                        </>
                    ) : (
                        <img src={branding.has_logo ? getLogoUrl() : logo} alt={branding.login_title} />
                    )}
                </div>

                <h1 className="nx-title">Sign in</h1>
                <p className="nx-sub">Enter your credentials to access {branding.login_title}.</p>

                {serverError && (
                    <div className="nx-err" dir="auto">{serverError}</div>
                )}

                <form className="nx-form" onSubmit={handleSubmit(onSubmit)}>
                    <div className="nx-field">
                        <label>User</label>
                        <input
                            type="text"
                            placeholder="username"
                            autoCapitalize="off"
                            spellCheck={false}
                            disabled={isSubmitting}
                            {...register('username')}
                        />
                        {errors.username && (
                            <div className="nx-fielderr">{errors.username.message}</div>
                        )}
                    </div>

                    <div className="nx-field">
                        <label>Pass</label>
                        <input
                            type="password"
                            placeholder="password"
                            disabled={isSubmitting}
                            {...register('password')}
                        />
                        {errors.password && (
                            <div className="nx-fielderr">{errors.password.message}</div>
                        )}
                    </div>

                    <button className="nx-btn" type="submit" disabled={isSubmitting}>
                        {isSubmitting ? 'Signing in…' : 'Sign in'}
                    </button>
                </form>

                <div className="nx-foot">
                    <span>Status · Ready</span>
                    {BLACK_FRIDAY ? <span>Nexra · <span className="nx-bf-off">Black Friday</span></span> : <span>Nexra</span>}
                </div>
            </main>
        </div>
    )
}
