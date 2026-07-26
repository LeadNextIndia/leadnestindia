import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/authz'
import {
  SparkleIcon,
  LayoutIcon,
  UsersIcon,
  SettingsIcon,
  DownloadIcon,
  ShieldIcon,
  FileIcon,
  MailIcon,
} from '@/components/icons'

// ─── Contact info ─── TODO: replace with your real company contact details.
const CONTACT = {
  email: 'hello@leadnestindia.com',
  phone: '+91 98765 43210',
  whatsapp: '919876543210', // digits only (wa.me format)
  city: 'Bengaluru, India',
}

function currentYear() {
  return new Date().getFullYear()
}

// ─── Data catalogues ─────────────────────────────────────────────────
const SERVICES = [
  {
    icon: LayoutIcon,
    title: 'Lead Management',
    desc: 'Every walk-in, phone inquiry, and website enquiry captured in one place. Search, filter, and assign leads to your team in seconds.',
    color: 'indigo',
  },
  {
    icon: SettingsIcon,
    title: 'Custom Fields Per Business',
    desc: 'Real Estate? Auto? Retail? Salon? Configure exactly the fields your industry needs — no code, no waiting.',
    color: 'emerald',
  },
  {
    icon: UsersIcon,
    title: 'Team Roles & Invites',
    desc: 'Onboard your entire team via email. Admin controls who sees what. No shared passwords, no spreadsheets.',
    color: 'blue',
  },
  {
    icon: FileIcon,
    title: 'GST-Ready Invoicing',
    desc: 'Convert a won lead into a proper Indian tax invoice in one click. Print or export as PDF, ready for your CA.',
    color: 'amber',
  },
  {
    icon: DownloadIcon,
    title: 'CSV Export & Reports',
    desc: 'Take your data anywhere. Filtered exports let you pull exactly the slice you need for reports, ads, or backups.',
    color: 'rose',
  },
  {
    icon: ShieldIcon,
    title: 'Bank-Grade Security',
    desc: 'Row-level security ensures every tenant sees only their own data. Your leads never mix with another company\'s.',
    color: 'violet',
  },
]

const FEATURE_ROWS = [
  {
    tag: 'Never lose a lead',
    title: 'A dashboard that finally makes sense.',
    desc: 'Stop copy-pasting between WhatsApp, Excel, and paper diaries. LeadNestIndia gives your team one clean view — with filters, saved views, follow-up reminders, and lead assignment built in.',
    bullets: [
      'Filter by status, source, assignee, or any custom field',
      'Save views your team uses daily (e.g. "Overdue follow-ups")',
      'Assign leads to teammates and track who owns what',
    ],
    mockup: <DashboardMockup />,
    reverse: false,
  },
  {
    tag: 'Made for India',
    title: 'GST invoices without a separate app.',
    desc: 'When a lead converts into a sale, generate a proper GST-compliant tax invoice with one click. HSN codes, CGST/SGST/IGST split, your GSTIN — all handled. Print or save as PDF.',
    bullets: [
      'Editable invoice line items with per-item GST',
      'A4 print-ready with your company branding',
      'Track paid, unpaid, and outstanding invoices',
    ],
    mockup: <InvoiceMockup />,
    reverse: true,
  },
  {
    tag: 'Your team, your rules',
    title: 'Roles and access built for real teams.',
    desc: 'Admins add employees, employees add leads. Everyone sees only what they should. No accidental deletions, no shared login chaos, no data leaks.',
    bullets: [
      'Three tiers: Superadmin, Admin, User',
      'Email invitations — each teammate sets their own password',
      'Remove access instantly when someone leaves',
    ],
    mockup: <TeamMockup />,
    reverse: false,
  },
]

const STEPS = [
  {
    n: 1,
    title: 'We onboard your business',
    desc: 'A 15-minute call. We set up your workspace, custom fields, and first team members.',
  },
  {
    n: 2,
    title: 'Invite your team',
    desc: 'Admins send email invites. Employees set their password and log in — that\'s it.',
  },
  {
    n: 3,
    title: 'Capture, convert, invoice',
    desc: 'Log every inquiry, follow up on time, close deals, and issue GST invoices.',
  },
]

const PRICING = [
  {
    name: 'Starter',
    price: '₹0',
    period: 'Free during pilot',
    desc: 'Everything you need to move off spreadsheets.',
    features: ['Up to 3 users', 'Up to 500 leads', 'CSV export', 'Email support'],
    cta: 'Start free',
    highlight: false,
  },
  {
    name: 'Growth',
    price: '₹1,499',
    period: 'per month',
    desc: 'For growing SMBs with a real sales team.',
    features: [
      'Up to 15 users',
      'Unlimited leads',
      'GST invoicing included',
      'Custom fields',
      'Priority WhatsApp support',
    ],
    cta: 'Talk to us',
    highlight: true,
  },
  {
    name: 'Business',
    price: 'Custom',
    period: 'annual',
    desc: 'For multi-branch businesses and franchises.',
    features: [
      'Unlimited users',
      'Multiple locations',
      'API access',
      'Dedicated success manager',
      'Onboarding & training',
    ],
    cta: 'Contact sales',
    highlight: false,
  },
]

// ─── Page ────────────────────────────────────────────────────────────
export default async function Home() {
  const session = await getSession().catch(() => null)
  if (session) redirect('/dashboard')

  const year = currentYear()

  return (
    <div className="flex-1 bg-background text-foreground">
      <TopNav />
      <Hero />
      <TrustBar />
      <Services />
      {FEATURE_ROWS.map((row, i) => (
        <FeatureRow key={i} row={row} />
      ))}
      <HowItWorks />
      <Pricing />
      <Testimonial />
      <FinalCTA />
      <SiteFooter year={year} />
    </div>
  )
}

// ─── Nav ─────────────────────────────────────────────────────────────
function TopNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 dark:border-[var(--border)] bg-white/85 dark:bg-[var(--surface)]/85 backdrop-blur">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 py-3">
        <a href="#top" className="flex items-center gap-2 group">
          <div className="w-9 h-9 rounded-md bg-gradient-to-br from-indigo-600 to-blue-700 text-white flex items-center justify-center shadow-sm group-hover:shadow-md transition">
            <SparkleIcon className="w-5 h-5" />
          </div>
          <div className="leading-tight">
            <div className="text-base font-semibold">LeadNest India</div>
            <div className="text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-400">
              Lead management for SMBs
            </div>
          </div>
        </a>

        <nav className="hidden md:flex items-center gap-6 text-sm text-gray-600 dark:text-gray-300">
          <a href="#services" className="hover:text-gray-900 dark:hover:text-gray-100 transition">Services</a>
          <a href="#features" className="hover:text-gray-900 dark:hover:text-gray-100 transition">Features</a>
          <a href="#pricing" className="hover:text-gray-900 dark:hover:text-gray-100 transition">Pricing</a>
          <a href="#contact" className="hover:text-gray-900 dark:hover:text-gray-100 transition">Contact</a>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/login"
            className="text-sm font-medium px-3 sm:px-4 py-1.5 sm:py-2 rounded-md text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-[var(--surface-muted)] transition"
          >
            Log in
          </Link>
          <a
            href="#contact"
            className="text-sm font-medium px-3 sm:px-4 py-1.5 sm:py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition"
          >
            Sign up
          </a>
        </div>
      </div>
    </header>
  )
}

// ─── Hero ──────────────────────���─────────────────────────────────────
function Hero() {
  return (
    <section id="top" className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 via-white to-blue-50 dark:from-[var(--surface)] dark:via-[var(--background)] dark:to-[var(--surface-muted)]" />
        <div className="absolute inset-x-0 top-0 h-96 bg-[radial-gradient(60%_60%_at_50%_0%,rgba(99,102,241,0.15)_0%,transparent_60%)]" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-20 lg:py-24">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div>
            <span className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-950/40 px-3 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
              Built in India · for India
            </span>
            <h1 className="mt-5 text-4xl sm:text-5xl lg:text-6xl font-semibold leading-[1.05] tracking-tight">
              Turn every enquiry
              <br />
              into <span className="text-indigo-600 dark:text-indigo-400">a customer.</span>
            </h1>
            <p className="mt-5 text-base sm:text-lg text-gray-600 dark:text-gray-300 leading-relaxed max-w-xl">
              LeadNestIndia is the modern lead-management and invoicing platform built for small
              Indian businesses. Capture, track, and convert leads — then send GST-compliant
              invoices, all in one clean dashboard.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href="#contact"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm shadow-sm transition"
              >
                Start free — talk to us
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </a>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-md border border-gray-300 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)] hover:bg-gray-50 dark:hover:bg-[var(--surface-muted)] text-gray-800 dark:text-gray-100 font-medium text-sm transition"
              >
                I already have an account
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-gray-500 dark:text-gray-400">
              <span className="inline-flex items-center gap-1.5">
                <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                No credit card required
              </span>
              <span className="inline-flex items-center gap-1.5">
                <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Set up in under 1 hour
              </span>
              <span className="inline-flex items-center gap-1.5">
                <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Cancel anytime
              </span>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-4 bg-gradient-to-br from-indigo-400/20 to-blue-400/20 blur-3xl -z-10" />
            <DashboardMockup />
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Trust bar ───────────────────────────────────────────────────────
function TrustBar() {
  const industries = ['Real Estate', 'Auto Dealers', 'Retail', 'Salons', 'Coaching', 'Clinics']
  return (
    <section className="border-y border-gray-200 dark:border-[var(--border)] bg-gray-50/50 dark:bg-[var(--surface-muted)]/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="text-center text-xs uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-5">
          Powering small businesses across India
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          {industries.map((name) => (
            <span
              key={name}
              className="text-sm font-medium text-gray-500 dark:text-gray-400 tracking-tight"
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Services ────────────────────────────────────────────────────────
function Services() {
  return (
    <section id="services" className="py-16 sm:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="max-w-2xl mx-auto text-center">
          <div className="text-xs font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
            Our services
          </div>
          <h2 className="mt-2 text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight">
            One platform. Six essential tools.
          </h2>
          <p className="mt-4 text-gray-600 dark:text-gray-300 leading-relaxed">
            Stop stitching together spreadsheets, WhatsApp, and paper diaries. LeadNestIndia
            replaces the whole mess with one clean, modern system.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {SERVICES.map((s) => (
            <ServiceCard key={s.title} s={s} />
          ))}
        </div>
      </div>
    </section>
  )
}

function ServiceCard({ s }: { s: typeof SERVICES[number] }) {
  const Icon = s.icon
  const colorMap: Record<string, string> = {
    indigo: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300',
    emerald: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-300',
    blue: 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300',
    amber: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-300',
    rose: 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300',
    violet: 'bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-300',
  }
  return (
    <div className="group p-6 rounded-xl border border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)] hover:shadow-lg hover:border-indigo-200 dark:hover:border-indigo-900 hover:-translate-y-0.5 transition">
      <div className={`w-11 h-11 rounded-lg flex items-center justify-center ${colorMap[s.color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="mt-5 font-semibold text-gray-900 dark:text-gray-100 text-lg">
        {s.title}
      </div>
      <div className="mt-2 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
        {s.desc}
      </div>
    </div>
  )
}

// ─── Feature deep-dive rows ──���───────────────────────────────────────
function FeatureRow({ row }: { row: typeof FEATURE_ROWS[number] }) {
  return (
    <section id="features" className="py-16 sm:py-24 border-t border-gray-200 dark:border-[var(--border)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className={`grid lg:grid-cols-2 gap-10 lg:gap-16 items-center ${row.reverse ? 'lg:[&>*:first-child]:order-2' : ''}`}>
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
              {row.tag}
            </div>
            <h3 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-tight">
              {row.title}
            </h3>
            <p className="mt-4 text-gray-600 dark:text-gray-300 leading-relaxed">
              {row.desc}
            </p>
            <ul className="mt-6 space-y-3">
              {row.bullets.map((b) => (
                <li key={b} className="flex items-start gap-3 text-sm text-gray-700 dark:text-gray-200">
                  <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-300 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                  {b}
                </li>
              ))}
            </ul>
          </div>
          <div className="relative">
            <div className="absolute -inset-4 bg-gradient-to-br from-indigo-400/10 to-blue-400/10 blur-3xl -z-10" />
            {row.mockup}
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── How it works ────────────────────────────────────────────────────
function HowItWorks() {
  return (
    <section className="py-16 sm:py-24 border-t border-gray-200 dark:border-[var(--border)] bg-gray-50/60 dark:bg-[var(--surface-muted)]/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="max-w-2xl mx-auto text-center">
          <div className="text-xs font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
            Getting started
          </div>
          <h2 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-tight">
            From signup to first invoice in under an hour.
          </h2>
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-4">
          {STEPS.map((s, i) => (
            <div
              key={s.n}
              className="relative p-6 rounded-xl border border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)]"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-600 to-blue-700 text-white text-base font-semibold flex items-center justify-center shadow-sm">
                {s.n}
              </div>
              <div className="mt-5 font-semibold text-gray-900 dark:text-gray-100 text-lg">
                {s.title}
              </div>
              <div className="mt-2 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                {s.desc}
              </div>
              {i < STEPS.length - 1 && (
                <svg className="hidden md:block absolute -right-3 top-9 w-6 h-6 text-gray-300 dark:text-gray-700" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Pricing ─────────────────────────────────────────────────────────
function Pricing() {
  return (
    <section id="pricing" className="py-16 sm:py-24 border-t border-gray-200 dark:border-[var(--border)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="max-w-2xl mx-auto text-center">
          <div className="text-xs font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
            Pricing
          </div>
          <h2 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-tight">
            Fair, transparent pricing for Indian SMBs.
          </h2>
          <p className="mt-4 text-gray-600 dark:text-gray-300">
            No hidden fees. No per-lead charges. Cancel anytime.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-4">
          {PRICING.map((p) => (
            <div
              key={p.name}
              className={`p-6 rounded-xl border transition ${
                p.highlight
                  ? 'border-indigo-500 dark:border-indigo-400 bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-950/30 dark:to-[var(--surface)] shadow-lg scale-[1.02]'
                  : 'border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)]'
              }`}
            >
              {p.highlight && (
                <div className="text-[10px] uppercase tracking-widest font-semibold text-indigo-600 dark:text-indigo-300 mb-2">
                  Most popular
                </div>
              )}
              <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {p.name}
              </div>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-4xl font-semibold tracking-tight">{p.price}</span>
                <span className="text-sm text-gray-500 dark:text-gray-400">/ {p.period}</span>
              </div>
              <div className="mt-3 text-sm text-gray-600 dark:text-gray-300">
                {p.desc}
              </div>

              <ul className="mt-6 space-y-2">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-200">
                    <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>

              <a
                href="#contact"
                className={`mt-8 flex items-center justify-center w-full px-4 py-2.5 rounded-md text-sm font-medium transition ${
                  p.highlight
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'
                    : 'border border-gray-300 dark:border-[var(--border)] hover:bg-gray-50 dark:hover:bg-[var(--surface-muted)] text-gray-800 dark:text-gray-100'
                }`}
              >
                {p.cta}
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Testimonial ─────────────────────────────────────────────────────
function Testimonial() {
  return (
    <section className="py-16 sm:py-20 border-t border-gray-200 dark:border-[var(--border)] bg-gradient-to-br from-indigo-600 to-blue-700 text-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
        <svg className="w-10 h-10 mx-auto text-indigo-300 opacity-70" fill="currentColor" viewBox="0 0 32 32">
          <path d="M9.352 4C4.456 7.456 1 13.12 1 20.048 1 25.696 4.416 29.088 8.336 29.088c3.696 0 6.4-2.72 6.4-6.032 0-3.312-2.336-5.68-5.408-5.68-.608 0-1.44.096-1.664.192.512-3.552 3.968-7.744 7.424-9.984L9.352 4zm18.72 0c-4.8 3.456-8.32 9.12-8.32 16.048 0 5.648 3.408 9.04 7.328 9.04 3.632 0 6.4-2.72 6.4-6.032 0-3.312-2.4-5.68-5.472-5.68-.608 0-1.408.096-1.632.192.512-3.552 3.936-7.744 7.392-9.984L28.072 4z" />
        </svg>
        <blockquote className="mt-6 text-xl sm:text-2xl lg:text-3xl font-medium leading-snug">
          &ldquo;We were losing 30–40% of walk-in enquiries because they got buried in WhatsApp.
          Since switching to LeadNestIndia, our follow-up rate is 95% and revenue is up 22%
          in one quarter.&rdquo;
        </blockquote>
        <div className="mt-6 text-sm text-indigo-100">
          <div className="font-semibold">Rajesh Kumar</div>
          <div className="opacity-80">Owner, Sunrise Motors — Pune</div>
        </div>
      </div>
    </section>
  )
}

// ─── Final CTA / Contact ────────────────────────────────────────────
function FinalCTA() {
  return (
    <section id="contact" className="py-16 sm:py-24 border-t border-gray-200 dark:border-[var(--border)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
              Get in touch
            </div>
            <h2 className="mt-2 text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight">
              Ready to run your leads properly?
            </h2>
            <p className="mt-4 text-gray-600 dark:text-gray-300 leading-relaxed max-w-lg">
              Tell us about your business — we&apos;ll get your workspace set up, invite your team,
              and walk you through your first leads. It takes 15 minutes, and there&apos;s no
              commitment.
            </p>

            <div className="mt-8 space-y-3">
              <ContactCard
                href={`mailto:${CONTACT.email}?subject=LeadNestIndia%20-%20Interested`}
                label="Email us"
                value={CONTACT.email}
                icon={<MailIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />}
              />
              <ContactCard
                href={`tel:${CONTACT.phone.replace(/\s+/g, '')}`}
                label="Call us"
                value={CONTACT.phone}
                icon={
                  <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106a1.125 1.125 0 00-1.173.417l-.97 1.293a.75.75 0 01-.71.286 12.035 12.035 0 01-7.143-7.143.75.75 0 01.286-.71l1.293-.97a1.125 1.125 0 00.417-1.173L6.372 3.102a1.125 1.125 0 00-1.091-.852H3.75A2.25 2.25 0 001.5 4.5v2.25z" />
                  </svg>
                }
              />
              <ContactCard
                href={`https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent("Hi, I'm interested in LeadNestIndia.")}`}
                label="WhatsApp us"
                value="Chat with our team"
                icon={
                  <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                  </svg>
                }
              />
            </div>
          </div>

          <div className="p-8 rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-700 text-white shadow-xl">
            <div className="text-xs uppercase tracking-widest text-indigo-200">
              Free 15-min consultation
            </div>
            <h3 className="mt-2 text-2xl sm:text-3xl font-semibold leading-tight">
              Talk to a real person. Get real advice.
            </h3>
            <p className="mt-3 text-sm text-white/85 leading-relaxed">
              Our team will understand your business, show you the platform live, and answer every
              question you have. No boilerplate demos — just a proper working call.
            </p>
            <ul className="mt-6 space-y-2.5 text-sm">
              {[
                'Custom fields configured for your industry',
                'Team members invited during the call',
                'Sample leads imported so you can play with it',
                'Transparent pricing — you\'ll leave the call knowing exactly what it costs',
              ].map((point) => (
                <li key={point} className="flex items-start gap-2">
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2.4" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-white/95">{point}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <a
                href={`mailto:${CONTACT.email}?subject=LeadNestIndia%20-%20Book%20a%20consultation`}
                className="inline-flex items-center justify-center px-4 py-2.5 rounded-md bg-white text-indigo-700 font-medium text-sm hover:bg-indigo-50 transition"
              >
                Email us
              </a>
              <a
                href={`https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent("Hi, I'd like to book a LeadNestIndia consultation.")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-4 py-2.5 rounded-md bg-emerald-500 hover:bg-emerald-600 text-white font-medium text-sm transition"
              >
                WhatsApp us
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function ContactCard({
  href,
  label,
  value,
  icon,
}: {
  href: string
  label: string
  value: string
  icon: React.ReactNode
}) {
  return (
    <a
      href={href}
      className="flex items-center gap-4 p-4 rounded-xl border border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)] hover:border-indigo-300 dark:hover:border-indigo-800 hover:shadow-sm transition"
    >
      <div className="flex-shrink-0">{icon}</div>
      <div>
        <div className="text-xs uppercase tracking-widest text-gray-500 dark:text-gray-400">{label}</div>
        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{value}</div>
      </div>
    </a>
  )
}

// ─── Footer ──────────────────────────────────────────────────────────
function SiteFooter({ year }: { year: number }) {
  return (
    <footer className="border-t border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
          <div className="col-span-2 sm:col-span-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-md bg-gradient-to-br from-indigo-600 to-blue-700 text-white flex items-center justify-center">
                <SparkleIcon className="w-4 h-4" />
              </div>
              <div className="font-semibold">LeadNest India</div>
            </div>
            <div className="mt-3 text-xs text-gray-500 dark:text-gray-400 leading-relaxed max-w-xs">
              Modern lead management for small Indian businesses. Built with love in {CONTACT.city}.
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-gray-900 dark:text-gray-100">Product</div>
            <ul className="mt-3 space-y-2 text-sm text-gray-600 dark:text-gray-300">
              <li><a href="#services" className="hover:text-gray-900 dark:hover:text-gray-100">Services</a></li>
              <li><a href="#features" className="hover:text-gray-900 dark:hover:text-gray-100">Features</a></li>
              <li><a href="#pricing" className="hover:text-gray-900 dark:hover:text-gray-100">Pricing</a></li>
            </ul>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-gray-900 dark:text-gray-100">Account</div>
            <ul className="mt-3 space-y-2 text-sm text-gray-600 dark:text-gray-300">
              <li><Link href="/login" className="hover:text-gray-900 dark:hover:text-gray-100">Log in</Link></li>
              <li><a href="#contact" className="hover:text-gray-900 dark:hover:text-gray-100">Sign up</a></li>
            </ul>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-gray-900 dark:text-gray-100">Contact</div>
            <ul className="mt-3 space-y-2 text-sm text-gray-600 dark:text-gray-300">
              <li><a href={`mailto:${CONTACT.email}`} className="hover:text-gray-900 dark:hover:text-gray-100">{CONTACT.email}</a></li>
              <li><a href={`tel:${CONTACT.phone.replace(/\s+/g, '')}`} className="hover:text-gray-900 dark:hover:text-gray-100">{CONTACT.phone}</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-gray-200 dark:border-[var(--border)] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500 dark:text-gray-400">
          <div>© {year} LeadNestIndia. All rights reserved.</div>
          <div className="inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            All systems operational
          </div>
        </div>
      </div>
    </footer>
  )
}

// ─── SVG Mockups (inline product illustrations) ──────────────────────
function DashboardMockup() {
  return (
    <div className="relative rounded-xl shadow-2xl overflow-hidden border border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)]">
      {/* Browser chrome */}
      <div className="flex items-center gap-1.5 px-4 py-2.5 bg-gray-100 dark:bg-[var(--surface-muted)] border-b border-gray-200 dark:border-[var(--border)]">
        <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
        <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
        <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
        <div className="ml-3 text-[10px] text-gray-500 dark:text-gray-400 font-mono">
          app.leadnestindia.com/dashboard
        </div>
      </div>

      <div className="flex bg-gray-50 dark:bg-[var(--background)]">
        {/* Sidebar */}
        <div className="w-32 sm:w-40 border-r border-gray-200 dark:border-[var(--border)] p-3 space-y-1.5 bg-white dark:bg-[var(--surface)]">
          <div className="flex items-center gap-1.5 mb-3">
            <div className="w-5 h-5 rounded bg-gradient-to-br from-indigo-600 to-blue-700" />
            <div className="text-[10px] font-semibold text-gray-900 dark:text-gray-100">LeadNest</div>
          </div>
          {[
            { label: 'Dashboard', active: true },
            { label: 'Leads', active: false },
            { label: 'Team', active: false },
            { label: 'Invoices', active: false },
            { label: 'Fields', active: false },
          ].map((item) => (
            <div
              key={item.label}
              className={`text-[10px] px-2 py-1.5 rounded ${
                item.active
                  ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-medium'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              {item.label}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 p-3 sm:p-4 space-y-3">
          {/* KPIs */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { l: 'Total leads', v: '1,284', c: 'indigo' },
              { l: 'This week', v: '48', c: 'emerald' },
              { l: 'Converted', v: '32', c: 'blue' },
            ].map((kpi) => (
              <div key={kpi.l} className="p-2 sm:p-3 rounded-md bg-white dark:bg-[var(--surface)] border border-gray-200 dark:border-[var(--border)]">
                <div className="text-[8px] uppercase tracking-widest text-gray-500 dark:text-gray-400">{kpi.l}</div>
                <div className="mt-0.5 text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100">{kpi.v}</div>
              </div>
            ))}
          </div>

          {/* Table */}
          <div className="rounded-md bg-white dark:bg-[var(--surface)] border border-gray-200 dark:border-[var(--border)] overflow-hidden">
            <div className="px-2 sm:px-3 py-2 border-b border-gray-200 dark:border-[var(--border)] flex items-center justify-between">
              <div className="text-[10px] font-semibold text-gray-900 dark:text-gray-100">Recent leads</div>
              <div className="w-12 h-4 rounded bg-indigo-100 dark:bg-indigo-950/40" />
            </div>
            {[
              { name: 'Amit Sharma', status: 'New', color: 'blue' },
              { name: 'Priya Menon', status: 'Contacted', color: 'amber' },
              { name: 'Rakesh Iyer', status: 'Won', color: 'emerald' },
              { name: 'Sneha Reddy', status: 'New', color: 'blue' },
            ].map((row) => (
              <div key={row.name} className="px-2 sm:px-3 py-1.5 flex items-center justify-between border-b border-gray-100 dark:border-[var(--border)] last:border-0">
                <div className="text-[10px] text-gray-700 dark:text-gray-200 font-medium">{row.name}</div>
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded ${
                    row.color === 'blue'
                      ? 'bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                      : row.color === 'amber'
                      ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'
                      : 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                  }`}
                >
                  {row.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function InvoiceMockup() {
  return (
    <div className="relative rounded-xl shadow-2xl overflow-hidden border border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)] p-6 sm:p-8">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-400">Tax Invoice</div>
          <div className="mt-1 text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100">INV-2026-0042</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-400">GSTIN</div>
          <div className="mt-1 text-xs font-mono text-gray-700 dark:text-gray-200">29ABCDE1234F1Z5</div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 text-xs">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-400">Bill to</div>
          <div className="mt-1 font-medium text-gray-900 dark:text-gray-100">Amit Sharma</div>
          <div className="text-gray-500 dark:text-gray-400">Bengaluru, KA</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-400">Date</div>
          <div className="mt-1 font-medium text-gray-900 dark:text-gray-100">26 Jul 2026</div>
        </div>
      </div>

      <div className="mt-6 rounded-md border border-gray-200 dark:border-[var(--border)] overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-gray-50 dark:bg-[var(--surface-muted)] text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-400">
          <div className="col-span-6">Item</div>
          <div className="col-span-2 text-right">Qty</div>
          <div className="col-span-4 text-right">Amount</div>
        </div>
        {[
          { name: 'Consultation package', qty: '1', amt: '₹15,000' },
          { name: 'Setup fee', qty: '1', amt: '₹5,000' },
        ].map((r) => (
          <div key={r.name} className="grid grid-cols-12 gap-2 px-3 py-2 text-xs border-t border-gray-100 dark:border-[var(--border)]">
            <div className="col-span-6 text-gray-800 dark:text-gray-100">{r.name}</div>
            <div className="col-span-2 text-right text-gray-600 dark:text-gray-300">{r.qty}</div>
            <div className="col-span-4 text-right font-medium text-gray-900 dark:text-gray-100">{r.amt}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 space-y-1 text-xs">
        <div className="flex justify-between text-gray-600 dark:text-gray-300">
          <span>Subtotal</span>
          <span>₹20,000</span>
        </div>
        <div className="flex justify-between text-gray-600 dark:text-gray-300">
          <span>CGST 9%</span>
          <span>₹1,800</span>
        </div>
        <div className="flex justify-between text-gray-600 dark:text-gray-300">
          <span>SGST 9%</span>
          <span>₹1,800</span>
        </div>
        <div className="flex justify-between pt-2 mt-2 border-t border-gray-200 dark:border-[var(--border)] font-semibold text-gray-900 dark:text-gray-100">
          <span>Total</span>
          <span>₹23,600</span>
        </div>
      </div>
    </div>
  )
}

function TeamMockup() {
  const members = [
    { name: 'Rajesh K.', role: 'Admin', color: 'indigo' },
    { name: 'Priya M.', role: 'User', color: 'blue' },
    { name: 'Vikas S.', role: 'User', color: 'emerald' },
    { name: 'Anita R.', role: 'Admin', color: 'indigo' },
  ]
  return (
    <div className="relative rounded-xl shadow-2xl overflow-hidden border border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)] p-5 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Team members</div>
        <div className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">+ Invite</div>
      </div>
      <div className="space-y-2">
        {members.map((m) => {
          const initials = m.name.split(' ').map((s) => s[0]).join('').slice(0, 2)
          const colorClasses: Record<string, string> = {
            indigo: 'bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300',
            blue: 'bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300',
            emerald: 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300',
          }
          return (
            <div key={m.name} className="flex items-center gap-3 p-2.5 rounded-md border border-gray-100 dark:border-[var(--border)]">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold ${colorClasses[m.color]}`}>
                {initials}
              </div>
              <div className="flex-1">
                <div className="text-xs font-medium text-gray-900 dark:text-gray-100">{m.name}</div>
                <div className="text-[10px] text-gray-500 dark:text-gray-400">rajesh@sunrise-motors.in</div>
              </div>
              <div className={`text-[10px] px-2 py-1 rounded font-medium ${
                m.role === 'Admin'
                  ? 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300'
                  : 'bg-gray-100 dark:bg-[var(--surface-muted)] text-gray-600 dark:text-gray-300'
              }`}>
                {m.role}
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-4 p-3 rounded-md bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900 text-xs">
        <div className="flex items-start gap-2">
          <svg className="w-4 h-4 mt-0.5 text-indigo-600 dark:text-indigo-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-indigo-800 dark:text-indigo-200">
            Only admins can invite members or delete leads. Users can add and edit their own.
          </span>
        </div>
      </div>
    </div>
  )
}
