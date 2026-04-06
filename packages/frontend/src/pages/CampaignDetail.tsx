import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getCampaign,
  deleteCampaign,
  scheduleCampaign,
  sendCampaign,
} from '../api/campaigns'
import type { Recipient } from '../types'
import StatusBadge from '../components/StatusBadge'
import ProgressBar from '../components/ProgressBar'
import { CampaignDetailSkeleton } from '../components/SkeletonLoader'

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined, includeTime = false) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  })
}

// ─── Recipient status badge ──────────────────────────────────────────────────

function RecipientStatusBadge({
  status,
}: {
  status: 'pending' | 'sent' | 'failed' | undefined
}) {
  if (!status || status === 'pending') {
    return (
      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-200">
        Pending
      </span>
    )
  }
  if (status === 'sent') {
    return (
      <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-200">
        Sent
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-200">
      Failed
    </span>
  )
}

// ─── Schedule Modal ──────────────────────────────────────────────────────────

interface ScheduleModalProps {
  onClose: () => void
  onConfirm: (dateTime: string) => void
  loading: boolean
}

function ScheduleModal({ onClose, onConfirm, loading }: ScheduleModalProps) {
  const [value, setValue] = useState('')
  const [err, setErr] = useState('')

  // min = now + 5 min, formatted as local datetime-local string
  const minDateTime = (() => {
    const d = new Date(Date.now() + 5 * 60 * 1000)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  })()

  function handleConfirm() {
    if (!value) {
      setErr('Please select a date and time.')
      return
    }
    const selected = new Date(value)
    if (selected <= new Date()) {
      setErr('Scheduled time must be in the future.')
      return
    }
    setErr('')
    onConfirm(selected.toISOString())
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="card w-full max-w-sm p-6 shadow-xl space-y-4">
        <h2 className="text-gray-900">Schedule Campaign</h2>
        <p className="text-sm text-gray-500">
          Choose a future date and time to send this campaign.
        </p>

        <div>
          <label className="label" htmlFor="schedule-dt">
            Date &amp; Time
          </label>
          <input
            id="schedule-dt"
            type="datetime-local"
            className={`input ${err ? 'input-error' : ''}`}
            min={minDateTime}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={loading}
          />
          {err && <p className="error-text">{err}</p>}
        </div>

        <div className="flex gap-3 pt-2">
          <button className="btn-secondary flex-1" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button
            className="btn-primary flex-1"
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Scheduling…
              </>
            ) : (
              'Confirm Schedule'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Delete Confirm ──────────────────────────────────────────────────────────

interface DeleteConfirmProps {
  campaignName: string
  onClose: () => void
  onConfirm: () => void
  loading: boolean
}

function DeleteConfirm({ campaignName, onClose, onConfirm, loading }: DeleteConfirmProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="card w-full max-w-sm p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
            <svg
              className="w-5 h-5 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-gray-900">Delete Campaign</h2>
            <p className="text-sm text-gray-500 mt-0.5">This action cannot be undone.</p>
          </div>
        </div>
        <p className="text-sm text-gray-700">
          Are you sure you want to delete{' '}
          <span className="font-semibold">&ldquo;{campaignName}&rdquo;</span>?
        </p>
        <div className="flex gap-3 pt-2">
          <button className="btn-secondary flex-1" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button className="btn-danger flex-1" onClick={onConfirm} disabled={loading}>
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Deleting…
              </>
            ) : (
              'Delete'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Stat Card ───────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  color = 'text-gray-900',
}: {
  label: string
  value: number
  color?: string
}) {
  return (
    <div className="text-center p-4 rounded-xl bg-gray-50 border border-gray-100">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-3xl font-bold tabular-nums ${color}`}>{value}</p>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function CampaignDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [showSchedule, setShowSchedule] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [actionError, setActionError] = useState('')

  const { data: campaign, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['campaign', id],
    queryFn: () => getCampaign(id!),
    enabled: !!id,
    refetchInterval: (query) => {
      return query.state.data?.status === 'sending' ? 3000 : false
    },
    // When campaign transitions out of 'sending', invalidate all list caches
    select: (data) => {
      if (data.status !== 'sending') {
        queryClient.invalidateQueries({ queryKey: ['campaigns'], exact: false })
      }
      return data
    },
  })

  // ── Mutations ──

  const scheduleMutation = useMutation({
    mutationFn: ({ scheduled_at }: { scheduled_at: string }) =>
      scheduleCampaign(id!, scheduled_at),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign', id] })
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
      setShowSchedule(false)
      setActionError('')
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setActionError(msg ?? 'Failed to schedule campaign.')
    },
  })

  const sendMutation = useMutation({
    mutationFn: () => sendCampaign(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign', id] })
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
      setActionError('')
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setActionError(msg ?? 'Failed to send campaign.')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteCampaign(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
      navigate('/campaigns', { replace: true })
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setActionError(msg ?? 'Failed to delete campaign.')
      setShowDelete(false)
    },
  })

  // ── Render ──

  if (isLoading) {
    return (
      <div className="page-container max-w-4xl">
        <CampaignDetailSkeleton />
      </div>
    )
  }

  if (isError || !campaign) {
    return (
      <div className="page-container max-w-4xl">
        <div className="card p-10 text-center space-y-3">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100">
            <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="font-medium text-gray-700">Failed to load campaign</p>
          <p className="text-sm text-gray-500">
            {(error as { message?: string })?.message ?? 'An unexpected error occurred.'}
          </p>
          <div className="flex items-center justify-center gap-3 mt-2">
            <button className="btn-secondary" onClick={() => refetch()}>Try again</button>
            <Link to="/campaigns" className="btn-ghost">Back to Campaigns</Link>
          </div>
        </div>
      </div>
    )
  }

  const { status, stats, recipients } = campaign

  return (
    <>
      {/* Modals */}
      {showSchedule && (
        <ScheduleModal
          onClose={() => setShowSchedule(false)}
          onConfirm={(dt) => scheduleMutation.mutate({ scheduled_at: dt })}
          loading={scheduleMutation.isPending}
        />
      )}
      {showDelete && (
        <DeleteConfirm
          campaignName={campaign.name}
          onClose={() => setShowDelete(false)}
          onConfirm={() => deleteMutation.mutate()}
          loading={deleteMutation.isPending}
        />
      )}

      <div className="page-container max-w-4xl space-y-5">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-gray-500">
          <Link to="/campaigns" className="hover:text-primary-600 transition-colors">
            Campaigns
          </Link>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-gray-800 font-medium truncate max-w-xs">{campaign.name}</span>
        </nav>

        {/* Action error banner */}
        {actionError && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 flex items-center justify-between">
            <p className="text-sm text-red-700">{actionError}</p>
            <button onClick={() => setActionError('')} className="text-red-400 hover:text-red-600">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* ── Campaign Header Card ── */}
        <div className="card p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0 space-y-1">
              <h1 className="text-gray-900 truncate">{campaign.name}</h1>
              <p className="text-gray-500 text-sm">
                <span className="font-medium text-gray-600">Subject:</span> {campaign.subject}
              </p>
            </div>
            <StatusBadge status={campaign.status} className="shrink-0 mt-1" />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Created {formatDate(campaign.created_at)}
            </span>
            {campaign.updated_at !== campaign.created_at && (
              <span>Updated {formatDate(campaign.updated_at)}</span>
            )}
            {campaign.scheduled_at && (
              <span className="flex items-center gap-1 text-blue-600 font-medium">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Scheduled for {formatDate(campaign.scheduled_at, true)}
              </span>
            )}
          </div>

          {/* Action buttons */}
          <div className="mt-5 flex flex-wrap items-center gap-2 pt-5 border-t border-gray-100">
            {status === 'draft' && (
              <>
                <button
                  className="btn-primary"
                  onClick={() => setShowSchedule(true)}
                  disabled={sendMutation.isPending}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Schedule
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => sendMutation.mutate()}
                  disabled={sendMutation.isPending}
                >
                  {sendMutation.isPending ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Sending…
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                      Send Now
                    </>
                  )}
                </button>
                <div className="ml-auto">
                  <button
                    className="btn-danger"
                    onClick={() => setShowDelete(true)}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete
                  </button>
                </div>
              </>
            )}

            {status === 'scheduled' && (
              <button
                className="btn-primary"
                onClick={() => sendMutation.mutate()}
                disabled={sendMutation.isPending}
              >
                {sendMutation.isPending ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Sending…
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    Send Now
                  </>
                )}
              </button>
            )}

            {status === 'sending' && (
              <div className="flex items-center gap-2 text-amber-600 font-medium text-sm">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Sending in progress… Auto-refreshing every 3 seconds.
              </div>
            )}
          </div>
        </div>

        {/* ── Stats Card ── */}
        {stats && (
          <div className="card p-6 space-y-5">
            <h2 className="text-gray-900 text-base">Statistics</h2>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Total" value={stats.total} />
              <StatCard label="Sent" value={stats.sent} color="text-green-600" />
              <StatCard label="Failed" value={stats.failed} color="text-red-600" />
              <StatCard label="Opened" value={stats.opened} color="text-primary-600" />
            </div>

            <div className="space-y-3 pt-2">
              <ProgressBar
                label="Send Rate"
                value={stats.send_rate}
                colorClass="bg-green-500"
              />
              <ProgressBar
                label="Open Rate"
                value={stats.open_rate}
                colorClass="bg-primary-500"
              />
            </div>
          </div>
        )}

        {/* ── Email Body Preview ── */}
        <div className="card p-6 space-y-3">
          <h2 className="text-gray-900 text-base">Email Body</h2>
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 text-sm text-gray-700 whitespace-pre-wrap font-mono leading-relaxed max-h-60 overflow-y-auto scrollbar-thin">
            {campaign.body}
          </div>
        </div>

        {/* ── Recipients Table ── */}
        {recipients && recipients.length > 0 && (
          <div className="card overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-gray-900 text-base">
                Recipients{' '}
                <span className="text-sm font-normal text-gray-500">
                  ({recipients.length})
                </span>
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
                    >
                      Recipient
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
                    >
                      Status
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
                    >
                      Sent At
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
                    >
                      Opened At
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {recipients.map((recipient: Recipient) => {
                    const cr = recipient.CampaignRecipient
                    return (
                      <tr key={recipient.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-3.5">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {recipient.name}
                            </p>
                            <p className="text-xs text-gray-500">{recipient.email}</p>
                          </div>
                        </td>
                        <td className="px-6 py-3.5">
                          <RecipientStatusBadge status={cr?.status} />
                        </td>
                        <td className="px-6 py-3.5 text-sm text-gray-500">
                          {formatDate(cr?.sent_at, true)}
                        </td>
                        <td className="px-6 py-3.5 text-sm text-gray-500">
                          {cr?.opened_at ? (
                            <span className="text-green-600 font-medium">
                              {formatDate(cr.opened_at, true)}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* If no recipients attached */}
        {(!recipients || recipients.length === 0) && (
          <div className="card p-8 text-center text-gray-500 text-sm">
            No recipients attached to this campaign.
          </div>
        )}
      </div>
    </>
  )
}
