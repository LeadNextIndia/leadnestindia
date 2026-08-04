import { FullPageSpinner } from '@/components/loading-spinner'

// Rendered by Next.js while any /dashboard/** page's server data is loading.
// React automatically debounces this — fast transitions won't flash.
export default function DashboardLoading() {
  return <FullPageSpinner />
}
