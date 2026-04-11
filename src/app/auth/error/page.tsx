export default function AuthErrorPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-2xl font-semibold text-green-700 mb-2">giveKhair</h1>
        <div className="rounded-xl border border-red-200 bg-white p-6">
          <p className="text-sm font-medium text-red-600 mb-2">Sign in failed</p>
          <p className="text-sm text-gray-500 mb-4">
            There was a problem signing you in. Please try again.
          </p>
          <a
            href="/auth/signin"
            className="inline-block rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800"
          >
            Try again
          </a>
        </div>
      </div>
    </div>
  );
}
