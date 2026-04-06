import { type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const { user, clearAuth } = useAuthStore()
  const navigate = useNavigate()

  function handleLogout() {
    clearAuth()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link
              to="/campaigns"
              className="flex items-center gap-2 group"
            >
              <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center group-hover:bg-primary-700 transition-colors">
                <svg
                  className="w-5 h-5 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <span className="text-base font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">
                Campaign Manager
              </span>
            </Link>

            {/* Right side */}
            <div className="flex items-center gap-4">
              {user && (
                <div className="flex items-center gap-3">
                  <div className="hidden sm:flex flex-col items-end">
                    <span className="text-sm font-medium text-gray-900 leading-none">
                      {user.name}
                    </span>
                    <span className="text-xs text-gray-500 mt-0.5">{user.email}</span>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center ring-2 ring-primary-200">
                    <span className="text-sm font-semibold text-primary-700">
                      {user.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                </div>
              )}
              <button
                onClick={handleLogout}
                className="btn-secondary text-xs px-3 py-1.5"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-xs text-gray-400">
            Campaign Manager &copy; {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  )
}
