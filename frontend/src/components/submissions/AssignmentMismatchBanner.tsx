export function AssignmentMismatchBanner({
  mismatch,
  reason,
}: {
  mismatch?: boolean
  reason?: string
}) {
  if (!mismatch) return null
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      <p className="font-semibold">Submission may not match this assignment</p>
      <p className="mt-1 text-amber-900/80">
        {reason ||
          'The uploaded work appears to be about a different topic than the assignment. The viva can still go ahead.'}
      </p>
    </div>
  )
}
