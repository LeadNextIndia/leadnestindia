export default function FieldsPage() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Fields</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
        Customize what data you collect on each lead — text, dropdown, number, date, and more.
      </p>

      <div className="mt-6 rounded-lg border border-dashed border-gray-300 dark:border-[var(--border)] bg-gray-50 dark:bg-[var(--surface-muted)] p-8 text-center">
        <div className="text-sm font-medium text-gray-700 dark:text-gray-200">Field management</div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-md mx-auto">
          Custom fields are configured by the platform superadmin per tenant. If you need
          fields added, edited, or removed, raise a support ticket from{' '}
          <a href="/dashboard/settings" className="text-indigo-600 dark:text-indigo-400 hover:underline">Settings</a>.
        </p>
      </div>
    </div>
  )
}
