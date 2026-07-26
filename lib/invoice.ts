// GST invoice types + math helpers.
// CGST/SGST are always half of the total gst_rate (intra-state).
// For inter-state, the full gst_rate becomes IGST.

export type InvoiceItem = {
  description: string
  hsn: string | null
  qty: number
  rate: number
  amount: number
}

export type InvoiceTotals = {
  subtotal: number
  cgstAmount: number
  sgstAmount: number
  igstAmount: number
  total: number
}

export type TenantGstConfig = {
  gstin: string | null
  company_address: string | null
  state: string | null
  state_code: string | null
  gst_rate: number
  default_hsn: string | null
}

export type Invoice = {
  id: string
  tenant_id: string
  lead_id: string | null
  invoice_number: string
  invoice_date: string

  seller_name: string
  seller_address: string | null
  seller_gstin: string | null
  seller_state: string | null
  seller_state_code: string | null

  buyer_name: string
  buyer_address: string | null
  buyer_gstin: string | null
  buyer_phone: string | null
  buyer_email: string | null
  buyer_state: string | null
  buyer_state_code: string | null

  items: InvoiceItem[]
  subtotal: number
  gst_rate: number
  cgst_amount: number
  sgst_amount: number
  igst_amount: number
  total: number
  inter_state: boolean

  notes: string | null
  created_at: string
}

export function roundTo(n: number, dp = 2): number {
  const f = Math.pow(10, dp)
  return Math.round(n * f) / f
}

export function calcItemAmount(qty: number, rate: number): number {
  return roundTo(qty * rate)
}

export function calcInvoiceTotals(
  items: InvoiceItem[],
  gstRate: number,
  interState: boolean,
): InvoiceTotals {
  const subtotal = roundTo(items.reduce((sum, it) => sum + (it.amount || 0), 0))
  const totalTax = roundTo((subtotal * gstRate) / 100)

  if (interState) {
    return {
      subtotal,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: totalTax,
      total: roundTo(subtotal + totalTax),
    }
  }
  const half = roundTo(totalTax / 2)
  return {
    subtotal,
    cgstAmount: half,
    sgstAmount: roundTo(totalTax - half), // absorb any 0.005 rounding
    igstAmount: 0,
    total: roundTo(subtotal + totalTax),
  }
}

// Indian invoice number pattern used here: INV/YYYY-YY/NNNN — Indian fiscal year.
// e.g. FY 2026-27 → "INV/2026-27/0001". Counter is per tenant per FY.
export function fiscalYearLabel(d = new Date()): string {
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  // Indian FY runs April → March
  const startY = m >= 4 ? y : y - 1
  const endY = (startY + 1) % 100
  return `${startY}-${String(endY).padStart(2, '0')}`
}

export function nextInvoiceNumber(existingCountThisFy: number, d = new Date()): string {
  const fy = fiscalYearLabel(d)
  const n = String(existingCountThisFy + 1).padStart(4, '0')
  return `INV/${fy}/${n}`
}

// Format currency in Indian style: ₹1,23,456.78
export function formatINR(n: number): string {
  const rounded = roundTo(n)
  const [whole, dec = '00'] = rounded.toFixed(2).split('.')
  const negative = whole.startsWith('-')
  const abs = negative ? whole.slice(1) : whole
  // Indian grouping: last 3 digits, then groups of 2
  const last3 = abs.slice(-3)
  const rest = abs.slice(0, -3)
  const withCommas = rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3 : last3
  return `${negative ? '-' : ''}₹${withCommas}.${dec}`
}

// Convert a number to Indian rupee words: "One Thousand Two Hundred Rupees Only"
// Handles up to crores. Rounds paise to 2 decimals.
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function twoDigit(n: number): string {
  if (n < 20) return ONES[n]
  const t = Math.floor(n / 10)
  const o = n % 10
  return TENS[t] + (o ? ' ' + ONES[o] : '')
}

function threeDigit(n: number): string {
  const h = Math.floor(n / 100)
  const rest = n % 100
  const parts: string[] = []
  if (h) parts.push(ONES[h] + ' Hundred')
  if (rest) parts.push(twoDigit(rest))
  return parts.join(' ')
}

export function numberToIndianWords(n: number): string {
  const rounded = roundTo(n)
  const [wholeStr, decStr = '00'] = rounded.toFixed(2).split('.')
  let whole = Math.abs(parseInt(wholeStr, 10))
  const paise = parseInt(decStr, 10)

  if (whole === 0 && paise === 0) return 'Zero Rupees Only'

  const parts: string[] = []
  const crore = Math.floor(whole / 10000000); whole = whole % 10000000
  const lakh  = Math.floor(whole / 100000);   whole = whole % 100000
  const thousand = Math.floor(whole / 1000);  whole = whole % 1000
  const hundred = whole

  if (crore) parts.push(twoDigit(crore) + ' Crore')
  if (lakh)  parts.push(twoDigit(lakh)  + ' Lakh')
  if (thousand) parts.push(twoDigit(thousand) + ' Thousand')
  if (hundred)  parts.push(threeDigit(hundred))

  let out = parts.join(' ').replace(/\s+/g, ' ').trim() + ' Rupees'
  if (paise) out += ' and ' + twoDigit(paise) + ' Paise'
  return out + ' Only'
}
