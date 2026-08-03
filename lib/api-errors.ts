/**
 * Small helper for server-side error responses.
 *
 * The client never needs Postgres error codes or constraint names — those
 * leak schema info and help attackers map the DB. Log the raw error
 * server-side (visible in `vercel logs`) and return a generic 500 payload.
 */
export function serverError(context: string, error: unknown) {
  // eslint-disable-next-line no-console
  console.error(`[${context}]`, error)
  return { error: 'Something went wrong. Please try again.' }
}
