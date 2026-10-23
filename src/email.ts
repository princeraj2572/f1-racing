export type EmailCheck = { ok: true; value: string } | { ok: false; reason: 'empty' | 'invalid' };

// Pragmatic check, not a full RFC 5322 parser: one @, a dotted domain, no spaces.
const EMAIL =
  /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

export function checkEmail(input: string): EmailCheck {
  const value = input.trim();
  if (value === '') return { ok: false, reason: 'empty' };
  if (value.length > 254) return { ok: false, reason: 'invalid' };
  const [local = ''] = value.split('@');
  if (local.length > 64 || local.startsWith('.') || local.endsWith('.') || value.includes('..')) {
    return { ok: false, reason: 'invalid' };
  }
  return EMAIL.test(value) ? { ok: true, value } : { ok: false, reason: 'invalid' };
}
