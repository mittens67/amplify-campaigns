import { Image, type ImageProps } from 'expo-image';
import { API_URL } from '@/lib/api';

/** Media served by our API is stored as a relative path; resolve it against the API in use. */
export function mediaUrl(url?: string | null) {
  if (!url) return null;
  return url.startsWith('/') ? API_URL + url : url;
}

export function Img({ source, ...rest }: ImageProps) {
  const resolved = typeof source === 'string' ? mediaUrl(source) : source;
  return <Image source={resolved} {...rest} />;
}
