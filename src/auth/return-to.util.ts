// Only a same-site relative path is safe to redirect to. "//host" and "/\host"
// are browser-interpreted as protocol-relative absolute URLs, so both are rejected.
export function isSafeReturnPath(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.startsWith('/') &&
    !value.startsWith('//') &&
    !value.startsWith('/\\')
  );
}
