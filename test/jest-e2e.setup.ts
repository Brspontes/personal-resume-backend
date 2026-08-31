process.env.PORT = process.env.PORT ?? '3000';
process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://user:pass@localhost:5432/test';
process.env.FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:4200';
