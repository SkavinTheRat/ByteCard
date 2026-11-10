import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseArgs, readJson, root } from './shared.mjs';

const args = parseArgs(process.argv.slice(2));
const outputDir = resolve(root, args.values.get('out') ?? 'dist');
const decks = await readJson(join(root, 'assets/data/decks.json'));
const cards = [];
for (const deck of decks.decks) {
  const group = await readJson(join(root, `assets/data/cards/${deck.id}.json`));
  cards.push(...group.cards);
}
const bundle = {
  version: Number(decks.version),
  removed: decks.removed ?? [],
  minAppVersion: decks.minAppVersion,
  decks: decks.decks,
  cards,
};
await mkdir(outputDir, { recursive: true });
const bundlePath = join(outputDir, `decks-v${bundle.version}.json`);
const bytes = Buffer.from(`${JSON.stringify(bundle, null, 2)}\n`, 'utf8');
await writeFile(bundlePath, bytes);
const sha256 = createHash('sha256').update(bytes).digest('hex');
const manifest = {
  version: bundle.version,
  bundleUrl: `https://example.com/bytecard/decks-v${bundle.version}.json`,
  sha256,
  size: (await stat(bundlePath)).size,
  publishedAt: new Date().toISOString(),
  notes: `题库 v${bundle.version}，共 ${cards.length} 张`,
};
await writeFile(
  join(outputDir, 'manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
  'utf8',
);
console.log(`publish: v${bundle.version}，${cards.length} 张，${manifest.size} bytes`);
console.log(`bundle: ${bundlePath}`);
console.log(`sha256: ${sha256}`);
