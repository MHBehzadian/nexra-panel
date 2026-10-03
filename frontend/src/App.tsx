import { useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { Sidebar } from '@/components/Sidebar'
import { LoginPage } from '@/pages/LoginPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { AdminsPage } from '@/pages/AdminsPage'
import { PanelsPage } from '@/pages/PanelsPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { HelpPage } from '@/pages/HelpPage'
import { BotsPage } from '@/pages/BotsPage'
import { Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

// BASE_URL carries a trailing slash ("/dashboard/"), and React Router only
// strips a basename when the URL starts with it in full — so a bare
// "/dashboard" matched nothing and rendered a blank page, while "/dashboard/"
// and "/dashboard/login" both worked. Without the slash both forms match.
const ROUTER_BASENAME = import.meta.env.BASE_URL.replace(/\/+$/, '') || '/'

function App() {
    return (
        <Router basename={ROUTER_BASENAME}>
            <Routes>
                {/* Public Routes */}
                <Route path="/login" element={<LoginPage />} />

                {/* Protected Routes */}
                <Route
                    path="/"
                    element={
                        <ProtectedRoute>
                            <Layout>
                                <DashboardPage />
                            </Layout>
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/admins"
                    element={
                        <ProtectedRoute>
                            <Layout>
                                <AdminsPage />
                            </Layout>
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/panels"
                    element={
                        <ProtectedRoute>
                            <Layout>
                                <PanelsPage />
                            </Layout>
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/settings"
                    element={
                        <ProtectedRoute>
                            <Layout>
                                <SettingsPage />
                            </Layout>
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/bots"
                    element={
                        <ProtectedRoute>
                            <Layout>
                                <BotsPage />
                            </Layout>
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/help"
                    element={
                        <ProtectedRoute>
                            <Layout>
                                <HelpPage />
                            </Layout>
                        </ProtectedRoute>
                    }
                />

                {/* Fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </Router>
    )
}

function Layout({ children }: { children: React.ReactNode }) {
    const [sidebarOpen, setSidebarOpen] = useState(false)

    return (
        // The page scrolls, as it always did — one scrollbar, at the window
        // edge. (Making the content its own scroll area pins the sidebar just
        // as well, but puts a second scrollbar inside the layout and narrows
        // every card by its width.)
        <div className="flex min-h-screen bg-background max-w-full overflow-x-hidden">
            {/* Mobile Sidebar Overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Mobile Sidebar */}
            <aside
                className={`fixed inset-y-0 left-0 z-50 w-64 bg-card border-r transform transition-transform duration-300 ease-in-out md:hidden ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
                    }`}
            >
                <div className="flex items-center justify-between p-4 border-b">
                    <span className="font-black text-lg tracking-tight">Nexra Panel</span>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setSidebarOpen(false)}
                    >
                        <X className="h-5 w-5" />
                    </Button>
                </div>
                <div className="flex-1 overflow-y-auto">
                    <Sidebar onItemClick={() => setSidebarOpen(false)} />
                </div>
            </aside>

            {/* Desktop Sidebar - Hidden on mobile. Fixed to the viewport so
                Finance/Support/Logout stay at the bottom of the screen rather
                than the bottom of a long page. Sticky can't do this here: the
                overflow-x-hidden above makes the browser compute overflow-y as
                auto, which disables sticky inside it. Fixed is unaffected, but
                it leaves the flow, so the content column makes room with a
                matching margin. */}
            <aside className="nx-header hidden md:flex fixed inset-y-0 left-0 w-64 border-r flex-col z-30">
                <div className="flex-1 overflow-y-auto">
                    <Sidebar />
                </div>
            </aside>

            {/* Mobile menu: a tab on the left edge, level with the middle of
                the screen, rather than a bar across the top — that bar cost a
                strip of every screen on a phone for a button and a title.
                Flat against the edge it sits on, rounded on the open side. */}
            <Button
                size="icon"
                aria-label="Open menu"
                onClick={() => setSidebarOpen(true)}
                className="md:hidden fixed left-0 top-1/2 -translate-y-1/2 z-30 h-12 w-9 rounded-l-none rounded-r-xl shadow-lg"
            >
                <Menu className="h-4 w-4" />
            </Button>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden md:ml-64">

                <main className="flex-1 overflow-x-hidden">
                    {children}
                </main>
            </div>
        </div>
    )
}

export default App
