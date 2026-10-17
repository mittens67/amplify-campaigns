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
  // AI: Gemini preferred (one key covers drafting + transcription); Mistral as an alternative.
  AI_PROVIDER: str('AI_PROVIDER'),
  GEMINI_API_KEY: str('GEMINI_API_KEY'),
  // Tried in order; the next one is used if a model is overloaded, rate-limited or slow.
  GEMINI_MODELS: str('GEMINI_MODELS', 'gemini-3.5-flash-lite,gemini-3.1-flash-lite,gemini-3.8-flash')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean),
  MISTRAL_API_KEY: str('MISTRAL_API_KEY'),
  MISTRAL_CHAT_MODEL: str('MISTRAL_CHAT_MODEL', 'mistral-small-latest'),
  MISTRAL_STT_MODEL: str('MISTRAL_STT_MODEL', 'voxtral-mini-latest'),
};

if (!env.JWT_SECRET) {
  if (env.NODE_ENV === 'production') throw new Error('JWT_SECRET is required in production');
  env.JWT_SECRET = 'dev-secret-local-only';
}
