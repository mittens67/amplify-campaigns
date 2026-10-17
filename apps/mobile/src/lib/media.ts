import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { LIMITS, type Asset } from '@amplify/domain';
import { api, ApiError } from './api';

export class MediaError extends Error {}

/**
 * Append a local file to a multipart form. Native accepts { uri, name, type };
 * on web the uri is a blob:/data: URL, so it has to be read into a Blob first.
 */
export async function appendFile(form: FormData, field: string, uri: string, name: string, type: string) {
  if (Platform.OS === 'web') {
    const blob = await (await fetch(uri)).blob();
    form.append(field, blob, name);
  } else {
    form.append(field, { uri, name, type } as any);
  }
}

async function uploadFile(uri: string, name: string, type: string) {
  const form = new FormData();
  await appendFile(form, 'file', uri, name, type);
  return api<{ url: string; kind: 'image' | 'video' }>('/uploads', { method: 'POST', form, timeoutMs: 60_000 });
}

/**
 * Pick an image, check it meets the minimum size, compress it for mobile networks,
 * and upload it. The API re-validates type and size server-side.
 */
export async function pickAndUploadImage(opts: { aspect?: [number, number] } = {}): Promise<Asset | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new MediaError('Allow photo access in Settings to add images.');
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, allowsEditing: !!opts.aspect, aspect: opts.aspect });
  if (res.canceled || !res.assets[0]) return null;
  const a = res.assets[0];
  if (a.width && a.width < LIMITS.imageMinWidth) {
    throw new MediaError(`That image is too small (${a.width}px wide). Use one at least ${LIMITS.imageMinWidth}px wide so it stays sharp in ads.`);
  }
  if (a.fileSize && a.fileSize > 25 * 1024 * 1024) throw new MediaError('That image is over 25 MB. Choose a smaller one.');
  const ctx = ImageManipulator.manipulate(a.uri);
  if (a.width > 1600) ctx.resize({ width: 1600 });
  const rendered = await ctx.renderAsync();
  const out = await rendered.saveAsync({ compress: 0.82, format: SaveFormat.JPEG });
  try {
    const up = await uploadFile(out.uri, 'image.jpg', 'image/jpeg');
    return { url: up.url, kind: 'image', width: out.width, height: out.height };
  } catch (e) {
    if (e instanceof ApiError) throw new MediaError(e.message);
    throw e;
  }
}

export async function pickAndUploadVideo(): Promise<Asset | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new MediaError('Allow media access in Settings to add a video.');
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], videoMaxDuration: LIMITS.videoMaxSeconds });
  if (res.canceled || !res.assets[0]) return null;
  const a = res.assets[0];
  if (a.duration && a.duration / 1000 > LIMITS.videoMaxSeconds) throw new MediaError(`Keep videos under ${LIMITS.videoMaxSeconds} seconds.`);
  if (a.fileSize && a.fileSize > 40 * 1024 * 1024) throw new MediaError('That video is over 40 MB. Trim it or choose another.');
  const up = await uploadFile(a.uri, 'video.mp4', a.mimeType ?? 'video/mp4');
  return { url: up.url, kind: 'video', width: a.width, height: a.height };
}

/** Upload a rendered image (e.g. a generated ad card). */
export async function uploadLocalImage(uri: string, width?: number, height?: number): Promise<Asset> {
  const up = await uploadFile(uri, 'ad-card.jpg', 'image/jpeg');
  return { url: up.url, kind: 'image', width, height, generated: true };
}
