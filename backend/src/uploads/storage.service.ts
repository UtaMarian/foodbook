/** Contract comun pentru R2 si pentru storage-ul local de dezvoltare. */
export abstract class StorageService {
  abstract put(key: string, body: Buffer, contentType: string): Promise<void>;
  abstract delete(key: string): Promise<void>;
  abstract readonly publicBase: string;
}
