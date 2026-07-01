// Supabase's PostgrestError (and similar API error shapes) aren't always
// `instanceof Error`, so a plain `e instanceof Error ? e.message : fallback`
// check silently swallows real error text from failed queries/RPCs.
export function getErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.length > 0) {
      return message;
    }
  }
  console.warn(fallback, error);
  return fallback;
}
