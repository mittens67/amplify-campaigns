import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { env } from '../env.js';
import { badRequest } from '../lib/errors.js';

/**
 * Media storage. Uploads go through the API so type and size are validated server-side,
 * then land in Supabase Storage (production) or on local disk (development).
 */
export const UPLOAD_RULES = {
  image: { types: ['image/jpeg', 'image/png', 'image/webp'], maxBytes: 8 * 1024 * 1024 },
  video: { types: ['video/mp4', 'video/quicktime'], maxBytes: 40 * 1024 * 1024 },
} as const;

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
};

export const localUploadDir = join(dirname(fileURLToPath(import.meta.url)), '../../uploads');

const supabase =
  env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
    : null;

/** Check the file's magic bytes — the declared mimetype alone can't be trusted. */
function sniff(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  if (buf.toString('ascii', 4, 8) === 'ftyp') {
    const brand = buf.toString('ascii', 8, 12);
    return brand === 'qt  ' ? 'video/quicktime' : 'video/mp4';
  }
  return null;
}

export async function storeUpload(ownerKey: string, file: { buffer: Buffer; mimetype: string; size: number }) {
  const actual = sniff(file.buffer);
  const kind = actual?.startsWith('video/') ? 'video' : 'image';
  const rules = UPLOAD_RULES[kind];
  if (!actual || !(rules.types as readonly string[]).includes(actual)) {
    throw badRequest('Use a JPG, PNG or WebP image, or an MP4/MOV video.', { file: 'Unsupported file type' });
  }
  if (file.size > rules.maxBytes) {
    throw badRequest(`That file is too large (max ${rules.maxBytes / 1024 / 1024} MB).`, { file: 'Too large' });
  }
  const safeOwner = ownerKey.replace(/[^a-z0-9]/gi, '_');
  const path = `${safeOwner}/${Date.now()}-${randomBytes(4).toString('hex')}.${EXT[actual]}`;
  if (supabase) {
    const { error } = await supabase.storage.from(env.SUPABASE_BUCKET).upload(path, file.buffer, {
      contentType: actual,
      upsert: false,
    });
    if (error) throw new Error(`Storage upload failed: ${error.message}`);
    const { data } = supabase.storage.from(env.SUPABASE_BUCKET).getPublicUrl(path);
    return { url: data.publicUrl, kind };
  }
  const dest = join(localUploadDir, path);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, file.buffer);
  return { url: `${env.PUBLIC_URL}/uploads/${path}`, kind };
}

export async function ensureBucket() {
  if (!supabase) return;
  const { data } = await supabase.storage.getBucket(env.SUPABASE_BUCKET);
  if (!data) {
    await supabase.storage.createBucket(env.SUPABASE_BUCKET, {
      public: true,
      fileSizeLimit: UPLOAD_RULES.video.maxBytes,
      allowedMimeTypes: [...UPLOAD_RULES.image.types, ...UPLOAD_RULES.video.types],
    });
  }
}
