import Constants from 'expo-constants';
import type { DeckBundle } from '@/types';
import { sha256Hex } from '@/utils/sha256';
import { applyDeckBundle } from './applyBundle';
import { getSetting, setSetting } from './repository';
import { validateRemoteBundle } from './validateBundle';

const FIVE_MB = 5 * 1024 * 1024;

type Manifest = {
  version: number;
  bundleUrl: string;
  sha256: string;
  size: number;
  publishedAt?: string;
  notes?: string;
};

export type UpdateResult =
  | { status: 'disabled' | 'up-to-date' | 'deferred'; version: number }
  | {
      status: 'updated';
      version: number;
      added: number;
      updated: number;
      removed: number;
      notes?: string;
    }
  | { status: 'error'; version: number; code: string; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseManifest(value: unknown): Manifest | null {
  if (!isRecord(value)) return null;
  if (
    !Number.isInteger(value.version) ||
    typeof value.bundleUrl !== 'string' ||
    typeof value.sha256 !== 'string' ||
    !Number.isInteger(value.size)
  ) {
    return null;
  }
  return value as Manifest;
}

function appVersionAtLeast(required: string): boolean {
  const current = (Constants.expoConfig?.version ?? '0.0.0').split('.').map(Number);
  const target = required.split('.').map(Number);
  for (let index = 0; index < Math.max(current.length, target.length); index += 1) {
    const left = current[index] ?? 0;
    const right = target[index] ?? 0;
    if (left !== right) return left > right;
  }
  return true;
}

async function download(url: string, timeoutMs: number, limit: number): Promise<Uint8Array> {
  if (!url.startsWith('https://')) throw new Error('insecure');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (!response.url.startsWith('https://')) throw new Error('insecure');
    const length = Number(response.headers.get('content-length') ?? 0);
    if (length > limit) throw new Error('too-large');
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > limit) throw new Error('too-large');
    return bytes;
  } finally {
    clearTimeout(timer);
  }
}

async function markChecked(): Promise<void> {
  await setSetting('deck_checked_at', new Date().toISOString());
}

export async function checkRemoteDeckUpdate(options?: {
  beforeApply?: () => boolean;
}): Promise<UpdateResult> {
  const url = await getSetting('deck_remote_url');
  const local = Number((await getSetting('deck_version')) ?? 0);
  if (!url?.trim()) return { status: 'disabled', version: local };
  try {
    if (!url.startsWith('https://')) throw new Error('insecure');
    const manifestBytes = await download(url, 8_000, 128 * 1024);
    const manifest = parseManifest(
      JSON.parse(new TextDecoder().decode(manifestBytes)) as unknown,
    );
    if (!manifest) throw new Error('invalid-manifest');
    if (manifest.version <= local) {
      await markChecked();
      return { status: 'up-to-date', version: local };
    }
    if (!manifest.bundleUrl.startsWith('https://')) throw new Error('insecure');
    if (manifest.size <= 0 || manifest.size > FIVE_MB) throw new Error('too-large');
    const bytes = await download(manifest.bundleUrl, 15_000, FIVE_MB);
    if (bytes.byteLength !== manifest.size) throw new Error('size');
    const hash = sha256Hex(bytes);
    if (hash.toLowerCase() !== manifest.sha256.toLowerCase()) throw new Error('checksum');
    const bundle = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    const errors = validateRemoteBundle(bundle);
    if (errors.length > 0) throw new Error(`invalid-bundle:${errors[0]}`);
    if (
      isRecord(bundle) &&
      typeof bundle.minAppVersion === 'string' &&
      !appVersionAtLeast(bundle.minAppVersion)
    ) {
      throw new Error('app-too-old');
    }
    if (options?.beforeApply && !options.beforeApply()) {
      return { status: 'deferred', version: local };
    }
    const result = await applyDeckBundle(bundle as DeckBundle, { source: 'remote' });
    await markChecked();
    if (!result) return { status: 'up-to-date', version: local };
    return {
      status: 'updated',
      version: manifest.version,
      ...result,
      notes: manifest.notes,
    };
  } catch (error: unknown) {
    await markChecked().catch(() => undefined);
    return {
      status: 'error',
      version: local,
      code: error instanceof Error ? error.message : 'unknown',
      message: error instanceof Error ? error.message : '题库更新失败',
    };
  }
}
