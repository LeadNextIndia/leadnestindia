export default function SettingsPage() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
      <p className="text-sm text-gray-500 mt-1">
        Store profile, API keys, and integrations.
      </p>

      <div className="mt-6 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
        <div className="text-sm font-medium text-gray-700">Coming in later phases</div>
        <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
          Store branding, notification preferences (email on new lead),
          and public API keys for Instagram / webhook lead capture.
        </p>
      </div>
    </div>
  )
}
