import { FILE_LIMITS } from './constants';

export type FileErrorCode = 'fileCount' | 'fileSize' | 'fileType';

export interface FileInfo {
  name: string;
  size: number;
  /** First bytes of the file, used for the signature check (server only). */
  head?: Uint8Array;
}

// Extension → accepted magic-number prefixes. Browser-supplied MIME types are spoofable,
// so on the server the content itself has to match the extension.
const SIGNATURES: Record<string, number[][]> = {
  pdf: [[0x25, 0x50, 0x44, 0x46]], // %PDF
  jpg: [[0xff, 0xd8, 0xff]],
  jpeg: [[0xff, 0xd8, 0xff]],
  png: [[0x89, 0x50, 0x4e, 0x47]],
  doc: [[0xd0, 0xcf, 0x11, 0xe0]], // OLE2 container
  xls: [[0xd0, 0xcf, 0x11, 0xe0]],
  docx: [[0x50, 0x4b, 0x03, 0x04]], // ZIP
  xlsx: [[0x50, 0x4b, 0x03, 0x04]],
};

export function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot === -1 ? '' : filename.slice(dot + 1).toLowerCase();
}

function matchesSignature(ext: string, head: Uint8Array): boolean {
  return (SIGNATURES[ext] ?? []).some((sig) => sig.every((byte, i) => head[i] === byte));
}

/** Returns the first problem found, or null. Pass `head` on the server to check content. */
export function validateFiles(files: FileInfo[]): FileErrorCode | null {
  if (files.length > FILE_LIMITS.maxFiles) return 'fileCount';

  let total = 0;
  for (const file of files) {
    total += file.size;
    const ext = extensionOf(file.name);
    if (!(FILE_LIMITS.extensions as readonly string[]).includes(ext)) return 'fileType';
    if (file.head && !matchesSignature(ext, file.head)) return 'fileType';
  }
  if (total > FILE_LIMITS.maxTotalBytes) return 'fileSize';
  return null;
}
