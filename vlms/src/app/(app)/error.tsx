'use client';

export default function AppError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="card p-6">
      <h2 className="text-lg font-semibold text-slate-900">Đã xảy ra lỗi</h2>
      <p className="mt-1 text-sm text-slate-600">{error.message}</p>
      <button type="button" onClick={reset} className="btn-ghost mt-4">
        Thử lại
      </button>
    </div>
  );
}
