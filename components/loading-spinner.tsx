import { cn } from '@/lib/utils'

type Props = {
  size?: 'sm' | 'md' | 'lg'
  className?: string
  label?: string
}

const SIZE_CLASSES: Record<NonNullable<Props['size']>, string> = {
  sm: 'w-4 h-4 border-2',
  md: 'w-6 h-6 border-[3px]',
  lg: 'w-8 h-8 border-4',
}

/**
 * Simple animated spinner. Use inside buttons (size="sm"), inline (size="md"),
 * or as a full route-level loading state (size="lg" with label).
 */
export function LoadingSpinner({ size = 'md', className, label }: Props) {
  return (
    <div className={cn('inline-flex items-center gap-2', className)} role="status" aria-live="polite">
      <span
        className={cn(
          'inline-block animate-spin rounded-full border-indigo-500 border-t-transparent',
          SIZE_CLASSES[size],
        )}
        aria-hidden
      />
      {label && <span className="text-sm text-gray-600 dark:text-gray-300">{label}</span>}
      <span className="sr-only">{label ?? 'Loading'}</span>
    </div>
  )
}

/** Full-viewport-under-shell centered spinner for route-level loading.tsx files. */
export function FullPageSpinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <LoadingSpinner size="lg" label={label} />
    </div>
  )
}
