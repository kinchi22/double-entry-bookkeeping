import { describe, expect, it } from 'vitest';
import { returnPath, signInPath } from './return-path';

describe('returnPath', () => {
  it.each([
    ['/entries', '/entries'],
    ['/entries?day=2026-09-15', '/entries?day=2026-09-15'],
    ['/entries#new', '/entries#new'],
    ['/', '/'],
  ])('keeps a path on this origin: %s', (requested, expected) => {
    expect(returnPath(requested)).toBe(expected);
  });

  it.each([
    ['another site', 'https://evil.test/steal'],
    ['a protocol-relative URL', '//evil.test/steal'],
    ['a path no URL can be made of', '//['],
    ['a backslash browsers read as a slash', '/\\evil.test/steal'],
    ['a relative path', 'entries'],
    ['a script', 'javascript:alert(1)'],
    ['nothing', ''],
    ['no value', undefined],
    ['a value that is not text', ['/entries']],
  ])('lands on the entries page instead of %s', (_case, requested) => {
    expect(returnPath(requested)).toBe('/entries');
  });
});

describe('signInPath', () => {
  it('sends the visitor to sign in, remembering where they were going', () => {
    expect(signInPath('/entries?day=2026-09-15')).toBe(
      '/sign-in?returnTo=%2Fentries%3Fday%3D2026-09-15',
    );
  });

  it('is read back by returnPath as the path it was given', () => {
    const query = new URL(signInPath('/entries'), 'http://app.test').searchParams;

    expect(returnPath(query.get('returnTo'))).toBe('/entries');
  });
});
