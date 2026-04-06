import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { login as loginApi, register as registerApi } from '../api/auth'
import { useAuthStore } from '../store/authStore'

type Mode = 'login' | 'register'

interface FormErrors {
  email?: string
  password?: string
  name?: string
  general?: string
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export default function Login() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [loading, setLoading] = useState(false)

  // Already authed? Redirect away
  if (isAuthenticated) {
    navigate('/campaigns', { replace: true })
    return null
  }

  function validate(): FormErrors {
    const errs: FormErrors = {}
    if (!email.trim()) {
      errs.email = 'Email is required.'
    } else if (!validateEmail(email.trim())) {
      errs.email = 'Please enter a valid email address.'
    }
    if (mode === 'register' && !name.trim()) {
      errs.name = 'Name is required.'
    }
    if (!password) {
      errs.password = 'Password is required.'
    } else if (password.length < 6) {
      errs.password = 'Password must be at least 6 characters.'
    }
    return errs
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    setErrors({})
    setLoading(true)

    try {
      let result
      if (mode === 'login') {
        result = await loginApi(email.trim(), password)
      } else {
        result = await registerApi(email.trim(), name.trim(), password)
      }
      setAuth(result.token, result.user)
      navigate('/campaigns', { replace: true })
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number; data?: { message?: string } } })
        ?.response?.status
      const message = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message

      if (status === 401 || status === 400) {
        setErrors({
          general:
            message ||
            (mode === 'login'
              ? 'Invalid credentials. Please check your email and password.'
              : 'Registration failed. Please try again.'),
        })
      } else if (status === 409) {
        setErrors({ general: 'An account with this email already exists.' })
      } else {
        setErrors({ general: 'An unexpected error occurred. Please try again.' })
      }
    } finally {
      setLoading(false)
    }
  }

  function toggleMode() {
    setMode((m) => (m === 'login' ? 'register' : 'login'))
    setErrors({})
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo / branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary-600 mb-4 shadow-lg">
            <svg
              className="w-8 h-8 text-white"
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
          <h1 className="text-2xl font-bold text-gray-900">Campaign Manager</h1>
          <p className="text-sm text-gray-500 mt-1">
            {mode === 'login'
              ? 'Sign in to your account'
              : 'Create your account to get started'}
          </p>
        </div>

        {/* Card */}
        <div className="card p-8 shadow-lg">
          {errors.general && (
            <div className="mb-5 rounded-lg bg-red-50 border border-red-200 px-4 py-3 flex items-start gap-3">
              <svg
                className="w-4 h-4 text-red-500 mt-0.5 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-sm text-red-700">{errors.general}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="label" htmlFor="name">
                  Full name
                </label>
                <input
                  id="name"
                  type="text"
                  autoComplete="name"
                  className={`input ${errors.name ? 'input-error' : ''}`}
                  placeholder="Jane Smith"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={loading}
                />
                {errors.name && <p className="error-text">{errors.name}</p>}
              </div>
            )}

            <div>
              <label className="label" htmlFor="email">
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                className={`input ${errors.email ? 'input-error' : ''}`}
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
              {errors.email && <p className="error-text">{errors.email}</p>}
            </div>

            <div>
              <label className="label" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                className={`input ${errors.password ? 'input-error' : ''}`}
                placeholder={mode === 'register' ? 'Min. 6 characters' : '••••••••'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
              {errors.password && <p className="error-text">{errors.password}</p>}
            </div>

            <button
              type="submit"
              className="btn-primary w-full mt-2"
              disabled={loading}
            >
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  {mode === 'login' ? 'Signing in…' : 'Creating account…'}
                </>
              ) : mode === 'login' ? (
                'Sign in'
              ) : (
                'Create account'
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-gray-100 text-center">
            <p className="text-sm text-gray-600">
              {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
              <button
                type="button"
                onClick={toggleMode}
                className="font-medium text-primary-600 hover:text-primary-700 underline-offset-2 hover:underline transition-colors"
                disabled={loading}
              >
                {mode === 'login' ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
