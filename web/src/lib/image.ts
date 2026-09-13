import { api } from './api';

/** Prima treapta de resize: nu urcam poze de 15 MB direct din browser. */
const MAX_UPLOAD_WIDTH = 1600;
const JPEG_QUALITY = 0.8;

export interface PickedImage {
  file: File;
  previewUrl: string;
}

export function pickImageFile(file: File): PickedImage {
  return { file, previewUrl: URL.createObjectURL(file) };
}

/**
 * Redimensionam in browser (canvas) si convertim la JPEG inainte de upload.
 * Serverul regenereaza oricum variantele, dar asa nu trimitem fisiere uriase.
 */
export async function shrinkForUpload(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_UPLOAD_WIDTH / bitmap.width);
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Nu am putut pregati imaginea pentru upload.');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Nu am putut converti imaginea.'))),
      'image/jpeg',
      JPEG_QUALITY,
    );
  });
}

export async function uploadRecipeImage(file: File): Promise<{ key: string; url: string }> {
  const blob = await shrinkForUpload(file);
  const form = new FormData();
  form.append('file', blob, 'poza.jpg');
  const uploaded = await api.uploadImage(form);
  return { key: uploaded.key, url: uploaded.url };
}

export async function uploadAvatar(file: File) {
  const blob = await shrinkForUpload(file);
  const form = new FormData();
  form.append('file', blob, 'avatar.jpg');
  return api.uploadAvatar(form);
}
