import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const decksDir = join(root, 'assets/data/cards');
export const outDir = join(root, 'tools/gen-cards/out');

export async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

export async function findJsonFiles(directory) {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    const nested = await Promise.all(
      entries.map(async (entry) => {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) {
          return findJsonFiles(path);
        }
        return entry.isFile() && entry.name.endsWith('.json') ? [path] : [];
      }),
    );
    return nested.flat();
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

export async function readDeckCards(deckId) {
  const path = join(decksDir, `${deckId}.json`);
  try {
    const data = await readJson(path);
    return Array.isArray(data.cards) ? data.cards : [];
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

export function parseArgs(argv) {
  const result = { positional: [], flags: new Set(), values: new Map() };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      result.positional.push(token);
      continue;
    }
    const [key, inline] = token.slice(2).split('=', 2);
    if (inline !== undefined) {
      result.values.set(key, inline);
    } else if (argv[index + 1] && !argv[index + 1].startsWith('--')) {
      result.values.set(key, argv[index + 1]);
      index += 1;
    } else {
      result.flags.add(key);
    }
  }
  return result;
}

export function relativeToRoot(path) {
  return relative(root, path).replaceAll('\\', '/');
}

export function countChars(value) {
  return Array.from(String(value ?? '')).length;
}
