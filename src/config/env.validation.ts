import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  PORT: Joi.number().port().default(3000),
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  DATABASE_URL: Joi.string().uri().required(),
  DIRECT_URL: Joi.string().uri().required(),
  FRONTEND_URL: Joi.string().uri().required(),
  LINKEDIN_CLIENT_ID: Joi.string().required(),
  LINKEDIN_CLIENT_SECRET: Joi.string().required(),
  LINKEDIN_CALLBACK_URL: Joi.string().uri().required(),
  AUTH_JWT_SECRET: Joi.string().min(32).required(),
  ANALYTICS_VIEW_DEDUP_WINDOW_SECONDS: Joi.number().positive().default(1800),
});
