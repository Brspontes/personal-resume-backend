import { envValidationSchema } from './env.validation';

describe('envValidationSchema', () => {
  const validEnv = {
    PORT: '3000',
    NODE_ENV: 'development',
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    DIRECT_URL: 'postgresql://user:pass@localhost:5432/db',
    FRONTEND_URL: 'http://localhost:4200',
    LINKEDIN_CLIENT_ID: 'client-id',
    LINKEDIN_CLIENT_SECRET: 'client-secret',
    LINKEDIN_CALLBACK_URL:
      'http://localhost:3000/api/v1/auth/linkedin/callback',
    AUTH_JWT_SECRET: 'a-secret-that-is-at-least-32-characters-long',
  };

  it('passes with a complete, valid configuration', () => {
    const { error } = envValidationSchema.validate(validEnv);
    expect(error).toBeUndefined();
  });

  it('fails when DATABASE_URL is missing', () => {
    const env: Record<string, string> = { ...validEnv };
    delete env.DATABASE_URL;
    const { error } = envValidationSchema.validate(env);
    expect(error).toBeDefined();
    expect(error?.message).toContain('DATABASE_URL');
  });

  it('fails when FRONTEND_URL is missing', () => {
    const env: Record<string, string> = { ...validEnv };
    delete env.FRONTEND_URL;
    const { error } = envValidationSchema.validate(env);
    expect(error).toBeDefined();
    expect(error?.message).toContain('FRONTEND_URL');
  });

  it('fails when DATABASE_URL is not a valid URI', () => {
    const { error } = envValidationSchema.validate({
      ...validEnv,
      DATABASE_URL: 'not-a-valid-uri',
    });
    expect(error).toBeDefined();
  });

  it('defaults PORT and NODE_ENV when omitted', () => {
    const env: Record<string, string> = { ...validEnv };
    delete env.PORT;
    delete env.NODE_ENV;
    const { error, value } = envValidationSchema.validate(env);
    expect(error).toBeUndefined();
    expect(value.PORT).toBe(3000);
    expect(value.NODE_ENV).toBe('development');
  });

  it.each([
    'DIRECT_URL',
    'LINKEDIN_CLIENT_ID',
    'LINKEDIN_CLIENT_SECRET',
    'LINKEDIN_CALLBACK_URL',
    'AUTH_JWT_SECRET',
  ])('fails when %s is missing', (key) => {
    const env: Record<string, string> = { ...validEnv };
    delete env[key];
    const { error } = envValidationSchema.validate(env);
    expect(error).toBeDefined();
    expect(error?.message).toContain(key);
  });

  it('fails when LINKEDIN_CALLBACK_URL is not a valid URI', () => {
    const { error } = envValidationSchema.validate({
      ...validEnv,
      LINKEDIN_CALLBACK_URL: 'not-a-valid-uri',
    });
    expect(error).toBeDefined();
  });

  it('fails when AUTH_JWT_SECRET is shorter than the minimum required length', () => {
    const { error } = envValidationSchema.validate({
      ...validEnv,
      AUTH_JWT_SECRET: 'too-short',
    });
    expect(error).toBeDefined();
    expect(error?.message).toContain('AUTH_JWT_SECRET');
  });
});
