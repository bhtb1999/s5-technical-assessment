import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getCampaigns } from '../api/campaigns'
import type { Campaign } from '../types'
import StatusBadge from '../components/StatusBadge'
import { CampaignListSkeleton } from '../components/SkeletonLoader'

type StatusFilter = 'all' | Campaign['status']

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'sending', label: 'Sending' },
  { value: 'sent', label: 'Sent' },
]

const PAGE_SIZE = 10

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function Campaigns() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['campaigns', page, statusFilter],
    queryFn: () =>
      getCampaigns({
        page,
        limit: PAGE_SIZE,
        status: statusFilter === 'all' ? undefined : statusFilter,
      }),
    placeholderData: (prev) => prev,
    staleTime: 0,
    refetchInterval: (query) => {
      const hasSending = query.state.data?.data?.some((c) => c.status === 'sending')
      return hasSending ? 3000 : false
    },
  })

  function handleStatusChange(status: StatusFilter) {
    setStatusFilter(status)
    setPage(1)
  }

  const campaigns = data?.data ?? []
  const totalPages = data?.totalPages ?? 1

  return (
    <div className="page-container">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-gray-900">Campaigns</h1>
          {data && (
            <p className="text-sm text-gray-500 mt-0.5">
              {data.total} campaign{data.total !== 1 ? 's' : ''} total
            </p>
          )}
        </div>
        <button
          className="btn-primary"
          onClick={() => navigate('/campaigns/new')}
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 4v16m8-8H4"
            />
          </svg>
          New Campaign
        </button>
      </div>

      {/* Status filter tabs */}
      <div className="flex items-center gap-1 mb-5 bg-gray-100 p-1 rounded-xl w-fit">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => handleStatusChange(tab.value)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ${
              statusFilter === tab.value
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <CampaignListSkeleton count={5} />
      ) : isError ? (
        <div className="card p-10 text-center space-y-3">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100">
            <svg
              className="w-6 h-6 text-red-500"
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
          </div>
          <p className="text-gray-700 font-medium">Failed to load campaigns</p>
          <p className="text-sm text-gray-500">
            {(error as { message?: string })?.message ?? 'An unexpected error occurred.'}
          </p>
          <button className="btn-secondary mt-2" onClick={() => refetch()}>
            Try again
          </button>
        </div>
      ) : campaigns.length === 0 ? (
        <div className="card p-14 text-center space-y-3">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gray-100">
            <svg
              className="w-7 h-7 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>
          <p className="text-gray-700 font-medium">
            {statusFilter === 'all' ? 'No campaigns yet' : `No ${statusFilter} campaigns`}
          </p>
          <p className="text-sm text-gray-500">
            {statusFilter === 'all'
              ? 'Create your first campaign to get started.'
              : 'Try a different filter or create a new campaign.'}
          </p>
          <Link to="/campaigns/new" className="btn-primary inline-flex mt-2">
            Create Campaign
          </Link>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {campaigns.map((campaign) => (
              <CampaignCard key={campaign.id} campaign={campaign} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
              <button
                className="btn-secondary"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                Previous
              </button>
              <span className="text-sm text-gray-600">
                Page{' '}
                <span className="font-semibold text-gray-900">{page}</span> of{' '}
                <span className="font-semibold text-gray-900">{totalPages}</span>
              </span>
              <button
                className="btn-secondary"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function CampaignCard({ campaign }: { campaign: Campaign }) {
  return (
    <Link
      to={`/campaigns/${campaign.id}`}
      className="card-hover block p-5 group"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-gray-900 truncate group-hover:text-primary-600 transition-colors">
              {campaign.name}
            </h3>
          </div>
          <p className="text-sm text-gray-500 truncate">
            <span className="font-medium text-gray-600">Subject:</span>{' '}
            {campaign.subject}
          </p>
        </div>
        <StatusBadge status={campaign.status} className="shrink-0 mt-0.5" />
      </div>

      {/* Footer meta */}
      <div className="mt-3 flex items-center gap-4 text-xs text-gray-400">
        <span className="flex items-center gap-1">
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
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          {formatDate(campaign.created_at)}
        </span>
        {campaign.recipient_count !== undefined && (
          <span className="flex items-center gap-1">
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
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            {campaign.recipient_count} recipient
            {campaign.recipient_count !== 1 ? 's' : ''}
          </span>
        )}
        {campaign.scheduled_at && (
          <span className="flex items-center gap-1 text-blue-500">
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
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            {formatDate(campaign.scheduled_at)}
          </span>
        )}
      </div>
    </Link>
  )
}
