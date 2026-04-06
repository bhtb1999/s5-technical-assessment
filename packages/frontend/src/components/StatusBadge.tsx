import type { Campaign } from '../types'

interface StatusBadgeProps {
  status: Campaign['status']
  className?: string
}

const statusConfig: Record<
  Campaign['status'],
  { label: string; classes: string; showSpinner?: boolean }
> = {
  draft: {
    label: 'Draft',
    classes: 'bg-gray-100 text-gray-600 ring-gray-200',
  },
  scheduled: {
    label: 'Scheduled',
    classes: 'bg-blue-50 text-blue-700 ring-blue-200',
  },
  sending: {
    label: 'Sending',
    classes: 'bg-amber-50 text-amber-700 ring-amber-200',
    showSpinner: true,
  },
  sent: {
    label: 'Sent',
    classes: 'bg-green-50 text-green-700 ring-green-200',
  },
}

export default function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const config = statusConfig[status]

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${config.classes} ${className}`}
    >
      {config.showSpinner ? (
        <svg
          className="w-3 h-3 animate-spin"
          fill="none"
          viewBox="0 0 24 24"
        >
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
      ) : (
        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      )}
      {config.label}
    </span>
  )
}
