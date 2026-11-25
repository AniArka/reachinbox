import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load both apps/backend/.env and root .env, ensuring non-empty values take precedence
const backendEnv = dotenv.config({ path: path.resolve(__dirname, '../../.env') }).parsed || {};
const rootEnv = dotenv.config({ path: path.resolve(__dirname, '../../../../.env') }).parsed || {};

for (const key of new Set([...Object.keys(backendEnv), ...Object.keys(rootEnv)])) {
  const rootVal = rootEnv[key];
  const backendVal = backendEnv[key];
  if (rootVal && rootVal.trim() !== '') {
    process.env[key] = rootVal;
  } else if (backendVal && backendVal.trim() !== '') {
    process.env[key] = backendVal;
  }
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('5000').transform((val) => parseInt(val, 10)),
  FRONTEND_URL: z
    .string()
    .default('http://localhost:5173')
    .transform((val) => {
      let cleaned = val.trim().replace(/\/+$/, '');
      if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
        cleaned = `https://${cleaned}`;
      }
      return cleaned;
    }),
  BACKEND_URL: z
    .string()
    .default('http://localhost:5000')
    .transform((val) => {
      let cleaned = val.trim().replace(/\/+$/, '');
      if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
        cleaned = `https://${cleaned}`;
      }
      return cleaned;
    }),

  DATABASE_URL: z.string().default('postgresql://postgres:password@localhost:5432/reachinbox?schema=public'),

  REDIS_URL: z.string().optional(),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().default('6379').transform((val) => parseInt(val, 10)),

  WORKER_CONCURRENCY: z.string().default('5').transform((val) => parseInt(val, 10)),
  MIN_EMAIL_DELAY_MS: z.string().default('2000').transform((val) => parseInt(val, 10)),
  MAX_EMAILS_PER_HOUR_PER_SENDER: z.string().default('100').transform((val) => parseInt(val, 10)),
  EMAIL_MAX_RETRIES: z.string().default('3').transform((val) => parseInt(val, 10)),

  EMAIL_DELIVERY_MODE: z.enum(['ethereal', 'simulated']).default('ethereal'),
  ETHEREAL_HOST: z.string().default('smtp.ethereal.email'),
  ETHEREAL_PORT: z.string().default('587').transform((val) => parseInt(val, 10)),
  ETHEREAL_USER: z.string().optional().default(''),
  ETHEREAL_PASS: z.string().optional().default(''),

  GOOGLE_CLIENT_ID: z.string().optional().default(''),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(''),
  GOOGLE_CALLBACK_URL: z.string().optional().default(''),

  SLACK_CLIENT_ID: z.string().optional().default(''),
  SLACK_CLIENT_SECRET: z.string().optional().default(''),
  SLACK_REDIRECT_URI: z.string().optional().default(''),

  ENABLE_ELASTICSEARCH: z
    .string()
    .optional()
    .default('false')
    .transform((val) => val === 'true' || val === '1'),
  ELASTICSEARCH_URL: z.string().default('http://localhost:9200'),

  SESSION_SECRET: z.string().default('reachinbox_default_session_secret_key_32_bytes_min'),
  TOKEN_ENCRYPTION_KEY: z.string().default('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'),
});

const parsed = envSchema.parse(process.env);

export const env = {
  ...parsed,
  GOOGLE_CALLBACK_URL: parsed.GOOGLE_CALLBACK_URL && parsed.GOOGLE_CALLBACK_URL.trim() !== ''
    ? parsed.GOOGLE_CALLBACK_URL
    : `${parsed.BACKEND_URL}/api/auth/google/callback`,
  SLACK_REDIRECT_URI: parsed.SLACK_REDIRECT_URI && parsed.SLACK_REDIRECT_URI.trim() !== ''
    ? parsed.SLACK_REDIRECT_URI
    : `${parsed.BACKEND_URL}/api/slack/callback`,
};

// Production security audit check
if (env.NODE_ENV === 'production') {
  if (env.SESSION_SECRET === 'reachinbox_default_session_secret_key_32_bytes_min') {
    console.warn('⚠️ [SECURITY WARNING] SESSION_SECRET is using the insecure default value in production! Please set a unique secret in your environment.');
  }
  if (env.TOKEN_ENCRYPTION_KEY === '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef') {
    console.warn('⚠️ [SECURITY WARNING] TOKEN_ENCRYPTION_KEY is using the default encryption key in production! Please set a unique 64-character hex key.');
  }
}
