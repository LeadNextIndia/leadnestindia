import { notFound } from 'next/navigation'
import { requireSession } from '@/lib/authz'
import { serverGetModuleConfig } from '@/lib/lead-modules-server'
import { LeadModuleProvider } from '@/components/lead-module-provider'

type Props = {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}

export default async function ModuleLayout({ children, params }: Props) {
  const session = await requireSession()
  if (!session.tenantId) notFound()

  const { slug } = await params
  const config = await serverGetModuleConfig(session.tenantId, slug)
  if (!config) notFound()

  return <LeadModuleProvider value={config}>{children}</LeadModuleProvider>
}
