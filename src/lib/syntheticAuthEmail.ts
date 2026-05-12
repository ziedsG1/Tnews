/**
 * Supabase Email auth requires an email-shaped identifier. We map a public
 * username to a synthetic address (no mailbox). Disable "Confirm email" for
 * the Email provider in Supabase so sign-up does not send mail.
 */
export const SYNTHETIC_AUTH_EMAIL_HOST = "signin.tnews.app";

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
}

export function usernameToAuthEmail(username: string): string {
  const n = normalizeUsername(username);
  if (n.length < 3 || n.length > 28) {
    throw new Error("USERNAME_LEN");
  }
  return `${n}@${SYNTHETIC_AUTH_EMAIL_HOST}`;
}

export function authEmailToDisplayLogin(email: string | null | undefined): string | null {
  if (!email) return null;
  const suffix = `@${SYNTHETIC_AUTH_EMAIL_HOST}`;
  if (!email.endsWith(suffix)) return email;
  const local = email.slice(0, -suffix.length);
  return local.length > 0 ? `@${local}` : null;
}
