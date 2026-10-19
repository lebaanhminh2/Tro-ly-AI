import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import * as prettier from 'prettier';
import { BEAST_CATALOG, beastReferencePath, beastSpecies } from '../src/domain/linh-thu-catalog.ts';
import type { BeastForm } from '../src/domain/linh-thu.ts';

type ArtEntry = {
  speciesId: string;
  form: BeastForm;
  variant: 'normal' | 'awakened' | 'perfect';
  source: string;
  generator: 'image_gen' | 'imagegen_cli_cockpit';
  model?: string;
  prompt: string;
};
type ArtPaths = { full: string; thumb: string; kind: 'reference' | 'redesigned' };
const hash = (data: Uint8Array) => createHash('sha256').update(data).digest('hex');

/** Compile real source artwork; never synthesize a redesign from a reference. */
export async function buildBeastArtwork({
  write = false,
  complete = false,
  sourceRoot = 'docs/assets/linh-thu/art',
  outputRoot = 'web/assets/linh-thu',
  sharp,
}: {
  write?: boolean;
  complete?: boolean;
  sourceRoot?: string;
  outputRoot?: string;
  sharp: any;
}) {
  const manifestBytes = await readFile(sourceRoot + '/MANIFEST.json');
  const manifest = JSON.parse(manifestBytes.toString('utf8')) as {
    schemaVersion: number;
    artVersion: number;
    entries: ArtEntry[];
  };
  assert.equal(manifest.schemaVersion, 1, 'Unsupported artwork manifest schema');
  assert.ok(
    Number.isSafeInteger(manifest.artVersion) && manifest.artVersion > 0,
    'Invalid art version',
  );
  assert.ok(Array.isArray(manifest.entries), 'Artwork entries must be an array');
  const registry: Record<string, ArtPaths> = {};
  const referenceHashes = new Set<string>();
  for (const species of BEAST_CATALOG)
    for (const form of [1, 2, 3, 4] as const) {
      const reference = beastReferencePath(species.id, form);
      const path = reference.slice('docs/assets/linh-thu/reference/'.length);
      registry[`${species.id}:${form}:normal`] = {
        full: 'reference/' + path,
        thumb: 'reference/thumbs/' + path,
        kind: 'reference',
      };
      referenceHashes.add(hash(await readFile(reference)));
    }
  const seen = new Set<string>();
  for (const entry of manifest.entries) {
    beastSpecies(entry.speciesId);
    assert.ok([1, 2, 3, 4].includes(entry.form), 'Invalid artwork form');
    assert.ok(['normal', 'awakened', 'perfect'].includes(entry.variant), 'Invalid artwork variant');
    assert.ok(entry.variant !== 'perfect' || entry.form === 4, 'Perfect artwork must be T4');
    assert.ok(entry.variant !== 'awakened' || entry.form === 4, 'Awakened artwork must be T4');
    assert.ok(
      ['image_gen', 'imagegen_cli_cockpit'].includes(entry.generator),
      'Artwork must record the actual approved generator',
    );
    if (entry.generator === 'imagegen_cli_cockpit')
      assert.ok(typeof entry.model === 'string' && entry.model.trim(), 'Missing CLI image model');
    assert.ok(
      typeof entry.prompt === 'string' && entry.prompt.trim().length > 0,
      'Missing generation prompt',
    );
    assert.ok(
      typeof entry.source === 'string' && entry.source.length > 0,
      'Missing artwork source',
    );
    const key = `${entry.speciesId}:${entry.form}:${entry.variant}`;
    assert.ok(!seen.has(key), 'Duplicate artwork: ' + key);
    seen.add(key);
  }
  const redesignedNormal = manifest.entries.filter((entry) => entry.variant === 'normal').length;
  const redesignedPerfect = manifest.entries.filter((entry) => entry.variant === 'perfect').length;
  const redesignedAwakened = manifest.entries.filter(
    (entry) => entry.variant === 'awakened',
  ).length;
  if (complete) {
    assert.equal(redesignedNormal, 72, 'Release requires all 72 redesigned normal forms');
    assert.equal(redesignedPerfect, 18, 'Release requires all 18 distinct perfect T4 images');
    assert.equal(redesignedAwakened, 18, 'Release requires all 18 awakened T4 images');
  }
  const records: unknown[] = [];
  const imageHashes = new Set<string>();
  let fullBytes = 0,
    thumbBytes = 0;
  for (const entry of manifest.entries) {
    const source = resolve(sourceRoot, entry.source);
    const within = relative(resolve(sourceRoot), source);
    assert.ok(
      within && within !== '..' && !within.startsWith('..' + sep) && !isAbsolute(within),
      'Artwork source escapes its directory',
    );
    const bytes = await readFile(source);
    const sourceHash = hash(bytes);
    assert.ok(!referenceHashes.has(sourceHash), 'Reference image cannot be declared a redesign');
    const metadata = await sharp(bytes).metadata();
    assert.ok(
      metadata.width >= 1024 && metadata.height >= 1024,
      'Source artwork must be at least 1024px on both sides',
    );
    assert.ok(
      metadata.width === metadata.height,
      'Use a square source canvas for consistent form anchors',
    );
    assert.equal(metadata.pages ?? 1, 1, 'Source artwork must be a single image');
    assert.equal(metadata.hasAlpha, true, 'Source artwork is missing alpha');
    const imageHash = hash(await sharp(bytes).ensureAlpha().resize(256, 256).raw().toBuffer());
    assert.ok(!imageHashes.has(imageHash), 'Each form and perfect variant needs a distinct image');
    imageHashes.add(imageHash);
    const alpha = await sharp(bytes).extractChannel('alpha').raw().toBuffer();
    assert.ok(
      alpha.some((value: number) => value > 0),
      'Artwork cannot be empty',
    );
    const gutter = Math.ceil(metadata.width / 128);
    for (let y = 0; y < metadata.height; y++)
      for (let x = 0; x < metadata.width; x++)
        if (
          x < gutter ||
          y < gutter ||
          x >= metadata.width - gutter ||
          y >= metadata.height - gutter
        )
          assert.equal(
            alpha[y * metadata.width + x],
            0,
            'Artwork needs transparent breathing room at every edge',
          );
    const species = beastSpecies(entry.speciesId);
    const stem = `designed/v${manifest.artVersion}/${species.rank.toLowerCase()}/${species.id}/t${entry.form}-${entry.variant}-${sourceHash.slice(0, 12)}.webp`;
    const paths = { full: stem, thumb: stem.replace('designed/', 'designed/thumbs/') };
    const outputs: Record<string, unknown> = {};
    for (const [kind, path] of Object.entries(paths)) {
      const target = outputRoot + '/' + path;
      if (write) {
        await mkdir(dirname(target), { recursive: true });
        const size = kind === 'full' ? 512 : 128;
        await sharp(bytes)
          .resize(size, size)
          .webp({ quality: kind === 'full' ? 88 : 82, alphaQuality: 100 })
          .toFile(target);
      }
      const output = await readFile(target);
      const info = await sharp(output).metadata();
      assert.equal(info.width, kind === 'full' ? 512 : 128, target);
      assert.equal(info.height, info.width, target);
      assert.equal(info.hasAlpha, true, target);
      if (kind === 'full') fullBytes += output.length;
      else thumbBytes += output.length;
      outputs[kind] = { path, sha256: hash(output), bytes: output.length };
    }
    registry[`${entry.speciesId}:${entry.form}:${entry.variant}`] = {
      ...paths,
      kind: 'redesigned',
    };
    records.push({
      ...entry,
      reference: beastReferencePath(entry.speciesId, entry.form),
      sourceSha256: sourceHash,
      imageSha256: imageHash,
      outputs,
    });
  }
  const report = {
    schemaVersion: 1,
    artVersion: manifest.artVersion,
    kind: 'Artwork availability and provenance; not visual acceptance',
    sourceManifestSha256: hash(manifestBytes),
    encoder: { sharp: sharp.versions.sharp, webp: sharp.versions.webp },
    redesignedNormal,
    redesignedPerfect,
    redesignedAwakened,
    fullBytes,
    thumbBytes,
    entries: records,
  };
  const modulePath = outputRoot + '/art.js';
  const module = await prettier.format(
    '// Generated by scripts/build-linh-thu-assets.ts. Preserve source provenance in the art manifest.\nexport const BEAST_ART = Object.freeze(' +
      JSON.stringify(registry) +
      ');\n',
    { ...(await prettier.resolveConfig(modulePath)), filepath: modulePath },
  );
  if (write) {
    await mkdir(outputRoot, { recursive: true });
    await writeFile(outputRoot + '/ART.json', JSON.stringify(report, null, 2) + '\n');
    await writeFile(modulePath, module);
  } else {
    assert.deepEqual(
      JSON.parse(await readFile(outputRoot + '/ART.json', 'utf8')),
      report,
      'Artwork build manifest mismatch',
    );
    assert.equal(await readFile(modulePath, 'utf8'), module, 'Artwork registry mismatch');
  }
  return { registry, report };
}
