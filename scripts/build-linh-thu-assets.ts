import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { BEAST_CATALOG, beastReferencePath } from '../src/domain/linh-thu-catalog.ts';
import type { BeastForm } from '../src/domain/linh-thu.ts';
import { buildBeastArtwork } from './linh-thu-art.ts';

const require = createRequire(import.meta.url);
const sharp = require(require.resolve('sharp', { paths: [require.resolve('miniflare')] }));
const root = 'web/assets/linh-thu/reference';
const sourceRoot = 'docs/assets/linh-thu/reference';
const write = process.argv.includes('--write');
const sha256 = (data: Uint8Array) => createHash('sha256').update(data).digest('hex');
const catalogBytes = await readFile(sourceRoot + '/REFERENCE_CATALOG.json');
const sourceCatalog = JSON.parse(catalogBytes.toString('utf8'));
const entries: unknown[] = [];
let fullBytes = 0,
  thumbBytes = 0;
for (const species of BEAST_CATALOG)
  for (const form of [1, 2, 3, 4] as BeastForm[]) {
    const source = beastReferencePath(species.id, form),
      bytes = await readFile(source);
    const relative = source.slice(sourceRoot.length + 1);
    const paths = { full: root + '/' + relative, thumb: root + '/thumbs/' + relative };
    if (write) {
      for (const [kind, path] of Object.entries(paths)) {
        await mkdir(dirname(path), { recursive: true });
        await sharp(bytes)
          .resize(kind === 'full' ? 512 : 128, kind === 'full' ? 512 : 128, {
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 },
          })
          .webp({ quality: kind === 'full' ? 88 : 82, alphaQuality: 100 })
          .toFile(path);
      }
    }
    const outputs: Record<string, unknown> = {};
    for (const [kind, path] of Object.entries(paths)) {
      const output = await readFile(path),
        metadata = await sharp(output).metadata();
      assert.equal(metadata.hasAlpha, true, path + ': missing alpha');
      assert.equal(metadata.width, kind === 'full' ? 512 : 128);
      assert.equal(metadata.height, metadata.width);
      if (kind === 'full') fullBytes += output.length;
      else thumbBytes += output.length;
      outputs[kind] = { path, bytes: output.length, sha256: sha256(output) };
    }
    entries.push({ speciesId: species.id, form, source, sourceSha256: sha256(bytes), outputs });
  }
const report = {
  version: 1,
  kind: 'optimized reference, not redesigned production art',
  source: sourceRoot,
  sourceRepository: sourceCatalog.repository,
  sourceCommit: sourceCatalog.source_commit,
  sourceCatalogSha256: sha256(catalogBytes),
  encoder: { sharp: sharp.versions.sharp, webp: sharp.versions.webp },
  full: { count: 72, size: 512, quality: 88, alphaQuality: 100, bytes: fullBytes },
  thumb: { count: 72, size: 128, quality: 82, alphaQuality: 100, bytes: thumbBytes },
  redesignedNormal: 0,
  redesignedPerfect: 0,
  entries,
};
if (write) await writeFile(root + '/BUILD.json', JSON.stringify(report, null, 2) + '\n');
else
  assert.deepEqual(
    JSON.parse(await readFile(root + '/BUILD.json', 'utf8')),
    report,
    'Manifest mismatch: inspect changed sources, then rebuild with --write',
  );
const artwork = await buildBeastArtwork({
  write,
  complete: process.argv.includes('--require-complete'),
  sharp,
});
console.log(
  JSON.stringify({
    mode: write ? 'write' : 'verify',
    count: entries.length,
    fullBytes,
    thumbBytes,
    redesignedNormal: artwork.report.redesignedNormal,
    redesignedPerfect: artwork.report.redesignedPerfect,
    redesignedAwakened: artwork.report.redesignedAwakened,
  }),
);
