import { decodeSave } from './save-data';
import type { SaveRecord } from './save-data';

export const BACKUP_LIMIT_BYTES = 10 * 1024 * 1024;

export function parseBackup(text: string): SaveRecord | null {
  try {
    return decodeSave(JSON.parse(text));
  } catch (error) {
    if (error instanceof SyntaxError) return null;
    throw error;
  }
}

export function downloadBackup(record: SaveRecord): boolean {
  const blob = new Blob([JSON.stringify(record)], { type: 'application/json' });
  if (blob.size > BACKUP_LIMIT_BYTES) return false;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `silicon-empire-${record.id.slice(0, 8)}.json`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  return true;
}
