import { describe, expect, it } from 'vitest';
import { checkEmail } from '../src/email';

describe('checkEmail', () => {
  it.each(['a@b.co', 'first.last@example.com', 'user+tag@sub.example.org', ' padded@example.com '])(
    'accepts %s',
    (input) => {
      expect(checkEmail(input).ok).toBe(true);
    },
  );

  it('trims the accepted value', () => {
    expect(checkEmail('  me@example.com ')).toEqual({ ok: true, value: 'me@example.com' });
  });

  it.each(['', '   '])('reports empty for %j', (input) => {
    expect(checkEmail(input)).toEqual({ ok: false, reason: 'empty' });
  });

  it.each([
    'plain',
    'no-at.example.com',
    'two@@example.com',
    'a@b',
    'a b@example.com',
    '.dot@example.com',
    'dot.@example.com',
    'a..b@example.com',
    'a@-bad.com',
    'a@bad-.com',
    `${'x'.repeat(65)}@example.com`,
  ])('rejects %s', (input) => {
    expect(checkEmail(input)).toEqual({ ok: false, reason: 'invalid' });
  });
});
