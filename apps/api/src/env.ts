import 'dotenv/config';

function str(name: string, fallback = ''): string {
  return (process.env[name] ?? fallback).trim();
}

export const env = {
  NODE_ENV: str('NODE_ENV', 'development'),
  PORT: Number(str('PORT', '4000')),
  DATABASE_URL: str('DATABASE_URL'),
  JWT_SECRET: str('JWT_SECRET'),
  PUBLIC_URL: str('PUBLIC_URL', 'http://localhost:4000').replace(/\/$/, ''),
  SUPABASE_URL: str('SUPABASE_URL'),
  SUPABASE_SERVICE_ROLE_KEY: str('SUPABASE_SERVICE_ROLE_KEY'),
  SUPABASE_BUCKET: str('SUPABASE_BUCKET', 'campaign-media'),
  GROQ_API_KEY: str('GROQ_API_KEY'),
  GROQ_CHAT_MODEL: str('GROQ_CHAT_MODEL', 'llama-3.3-70b-versatile'),
  GROQ_STT_MODEL: str('GROQ_STT_MODEL', 'whisper-large-v3-turbo'),
};

if (!env.JWT_SECRET) {
  if (env.NODE_ENV === 'production') throw new Error('JWT_SECRET is required in production');
  env.JWT_SECRET = 'dev-secret-local-only';
}
