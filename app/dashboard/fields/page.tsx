export default function FieldsPage() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold text-gray-900">Fields</h1>
      <p className="text-sm text-gray-500 mt-1">
        Customize what data you collect on each lead — text, dropdown, number, date, and more.
      </p>

      <div className="mt-6 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
        <div className="text-sm font-medium text-gray-700">Coming in Phase 3</div>
        <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
          Drag-and-drop field editor. Add, rename, reorder, and remove fields without touching the database.
        </p>
      </div>
    </div>
  )
}
