import { CookieOptions } from 'express';

export function getBaseCookieOptions(
  nodeEnv: string | undefined,
): Pick<CookieOptions, 'httpOnly' | 'secure' | 'sameSite'> {
  const isProduction = nodeEnv === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
  };
}
