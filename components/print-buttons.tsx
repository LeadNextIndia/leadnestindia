'use client'

import { useEffect } from 'react'
import { DownloadIcon } from './icons'

type Props = { invoiceNumber: string }

export function PrintButtons({ invoiceNumber }: Props) {
  // Set the browser tab title while on this page so "Save as PDF" from the
  // print dialog names the file after the invoice number.
  useEffect(() => {
    const prev = document.title
    document.title = invoiceNumber
    return () => { document.title = prev }
  }, [invoiceNumber])

  const doPrint = () => window.print()

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={doPrint}
        className="inline-flex items-center gap-1.5 text-sm border border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)] rounded-md px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-[var(--surface-muted)]"
      >
        <DownloadIcon className="w-4 h-4" /> Download PDF
      </button>
      <button
        onClick={doPrint}
        className="inline-flex items-center gap-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md px-3 py-1.5"
      >
        Print
      </button>
    </div>
  )
}
