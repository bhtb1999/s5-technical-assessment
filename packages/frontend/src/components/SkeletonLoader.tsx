interface SkeletonProps {
  className?: string
}

function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded bg-gray-200 ${className}`}
      aria-hidden="true"
    />
  )
}

export function CampaignCardSkeleton() {
  return (
    <div className="card p-5 space-y-3">
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1">
          <Skeleton className="h-5 w-2/5" />
          <Skeleton className="h-4 w-3/5" />
        </div>
        <Skeleton className="h-5 w-16 rounded-full ml-4" />
      </div>
      <Skeleton className="h-4 w-full" />
      <div className="flex items-center gap-4 pt-1">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  )
}

export function CampaignListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <CampaignCardSkeleton key={i} />
      ))}
    </div>
  )
}

export function CampaignDetailSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <Skeleton className="h-7 w-2/5" />
            <Skeleton className="h-5 w-3/5" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <div className="flex gap-3 pt-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3 w-28" />
        </div>
      </div>

      {/* Stats */}
      <div className="card p-6 space-y-4">
        <Skeleton className="h-5 w-24" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-8 w-12" />
            </div>
          ))}
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
      </div>

      {/* Recipients table */}
      <div className="card p-6 space-y-4">
        <Skeleton className="h-5 w-32" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-4 py-2">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-4 w-1/5 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default Skeleton
