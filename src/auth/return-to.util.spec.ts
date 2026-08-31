import { isSafeReturnPath } from './return-to.util';

describe('isSafeReturnPath', () => {
  it.each(['/articles/some-slug', '/', '/a/b/c?x=1'])(
    'accepts the same-site relative path %s',
    (value) => {
      expect(isSafeReturnPath(value)).toBe(true);
    },
  );

  it.each([
    undefined,
    '',
    'articles/some-slug',
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    'javascript:alert(1)',
  ])('rejects the unsafe value %p', (value) => {
    expect(isSafeReturnPath(value)).toBe(false);
  });
});
