process.env.PORT = process.env.PORT ?? '3000';
process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://user:pass@localhost:5432/test';
process.env.FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:4200';
process.env.LINKEDIN_CLIENT_ID =
  process.env.LINKEDIN_CLIENT_ID ?? 'test-linkedin-client-id';
process.env.LINKEDIN_CLIENT_SECRET =
  process.env.LINKEDIN_CLIENT_SECRET ?? 'test-linkedin-client-secret';
process.env.LINKEDIN_CALLBACK_URL =
  process.env.LINKEDIN_CALLBACK_URL ??
  'http://localhost:3000/api/v1/auth/linkedin/callback';
process.env.AUTH_JWT_SECRET =
  process.env.AUTH_JWT_SECRET ??
  'test-auth-jwt-secret-with-at-least-32-characters';
