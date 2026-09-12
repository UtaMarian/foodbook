import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { File } from 'expo-file-system';
import { api } from './api';

/** Prima treapta de resize: nu urcam 15 MB pe date mobile. */
const MAX_UPLOAD_WIDTH = 1600;
const JPEG_QUALITY = 0.8;

export interface PickedImage {
  uri: string;
  width: number;
  height: number;
}

export async function pickFromLibrary(): Promise<PickedImage | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error('Avem nevoie de acces la poze ca sa publici o reteta.');

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 1,
    allowsMultipleSelection: false,
  });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  return { uri: asset.uri, width: asset.width, height: asset.height };
}

export async function takePhoto(): Promise<PickedImage | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) throw new Error('Avem nevoie de camera ca sa fotografiezi preparatul.');

  const result = await ImagePicker.launchCameraAsync({ quality: 1 });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  return { uri: asset.uri, width: asset.width, height: asset.height };
}

/**
 * Redimensionam pe telefon si convertim la JPEG inainte de upload. Serverul
 * regenereaza oricum variantele, dar asa nu trimitem un fisier de 15 MB si
 * scapam si de HEIC-ul de pe iOS, pe care backendul nu il decodeaza.
 */
export async function shrinkForUpload(image: PickedImage): Promise<{ uri: string }> {
  if (image.width <= MAX_UPLOAD_WIDTH) {
    const ctx = ImageManipulator.manipulate(image.uri);
    const rendered = await ctx.renderAsync();
    const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: JPEG_QUALITY });
    return { uri: saved.uri };
  }

  const ctx = ImageManipulator.manipulate(image.uri).resize({ width: MAX_UPLOAD_WIDTH });
  const rendered = await ctx.renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: JPEG_QUALITY });
  return { uri: saved.uri };
}

/**
 * fetch-ul global din Expo nu accepta formatul clasic RN `{uri, name, type}`
 * pentru fisiere in FormData - arunca "Unsupported FormData part implementation".
 * `File` din expo-file-system implementeaza Blob (are size/type/arrayBuffer),
 * deci e acceptat de orice implementare de FormData, veche sau noua.
 */
export async function uploadRecipeImage(image: PickedImage): Promise<{ key: string; url: string }> {
  const { uri } = await shrinkForUpload(image);
  const form = new FormData();
  form.append('file', new File(uri), 'poza.jpg');
  const uploaded = await api.uploadImage(form);
  return { key: uploaded.key, url: uploaded.url };
}

export async function uploadAvatar(image: PickedImage) {
  const { uri } = await shrinkForUpload(image);
  const form = new FormData();
  form.append('file', new File(uri), 'avatar.jpg');
  return api.uploadAvatar(form);
}
