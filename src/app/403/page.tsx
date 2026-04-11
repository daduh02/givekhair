export default function ForbiddenPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-green-700 mb-2">giveKhair</h1>
        <p className="text-4xl font-bold text-gray-900 mb-2">403</p>
        <p className="text-sm text-gray-500 mb-4">You don't have permission to view this page.</p>
        <a href="/" className="inline-block rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800">
          Go home
        </a>
      </div>
    </div>
  );
}
