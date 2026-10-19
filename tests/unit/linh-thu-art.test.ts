import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { buildBeastArtwork } from '../../scripts/linh-thu-art.ts';
import { BEAST_CATALOG, beastReferencePath } from '../../src/domain/linh-thu-catalog.ts';
import { BEAST_TRAINING } from '../../src/domain/linh-thu-training.ts';

const require = createRequire(import.meta.url);
const sharp = require(require.resolve('sharp', { paths: [require.resolve('miniflare')] }));
const modelPath = '../../web/models/linh-thu.js';
const registryPath = '../../web/assets/linh-thu/art.js';
const sample = (source: string, variant = 'normal', form = 4) => ({
  speciesId: 'frostnip',
  form,
  variant,
  source,
  generator: 'image_gen',
  prompt: 'Synthetic test fixture; not generated or accepted production artwork.',
});

async function fixture(t: { after: (action: () => Promise<void>) => void }) {
  const root = await mkdtemp(join(tmpdir(), 'beast-art-test-'));
  assert.equal(dirname(root), tmpdir());
  t.after(async () => {
    assert.equal(dirname(root), tmpdir());
    await rm(root, { recursive: true, force: true });
  });
  const sourceRoot = join(root, 'sources'),
    outputRoot = join(root, 'web');
  await mkdir(sourceRoot);
  const manifest = (entries: unknown[]) =>
    writeFile(
      join(sourceRoot, 'MANIFEST.json'),
      JSON.stringify({ schemaVersion: 1, artVersion: 1, entries }),
    );
  const source = async (name: string, color: string) => {
    // Geometry is used only to test alpha/integrity and separate file routing.
    const inner = await sharp({
      create: { width: 600, height: 600, channels: 4, background: color },
    })
      .png()
      .toBuffer();
    await sharp({ create: { width: 1024, height: 1024, channels: 4, background: '#00000000' } })
      .composite([{ input: inner, left: 212, top: 212 }])
      .png()
      .toFile(join(sourceRoot, name));
  };
  return {
    root,
    sourceRoot,
    outputRoot,
    manifest,
    source,
    options: { sourceRoot, outputRoot, sharp },
  };
}

test('art compiler retains reference fallbacks and builds distinct full and thumbnail perfect images with provenance', async (t) => {
  const f = await fixture(t);
  await f.source('normal.png', '#8855ffff');
  await f.source('perfect.png', '#ffbb55ff');
  await f.manifest([sample('normal.png'), sample('perfect.png', 'perfect')]);
  const built = await buildBeastArtwork({ ...f.options, write: true });
  assert.equal(built.report.redesignedNormal, 1);
  assert.equal(built.report.redesignedPerfect, 1);
  assert.equal(Object.keys(built.registry).length, 73);
  assert.equal(built.registry['frostnip:1:normal']!.kind, 'reference');
  const normal = built.registry['frostnip:4:normal']!,
    perfect = built.registry['frostnip:4:perfect']!;
  assert.equal(normal.kind, 'redesigned');
  assert.notEqual(normal.full, perfect.full);
  assert.notEqual(perfect.full, perfect.thumb);
  assert.match(perfect.full, /t4-perfect-[a-f0-9]{12}\.webp$/);
  assert.deepEqual((await buildBeastArtwork(f.options)).report, built.report);
  const art = JSON.parse(await readFile(join(f.outputRoot, 'ART.json'), 'utf8'));
  assert.equal(art.entries[1].generator, 'image_gen');
  assert.match(art.entries[1].sourceSha256, /^[a-f0-9]{64}$/);
  assert.match(art.entries[1].imageSha256, /^[a-f0-9]{64}$/);
  await writeFile(join(f.outputRoot, perfect.full), 'corrupted image');
  await assert.rejects(buildBeastArtwork(f.options));
});

test('art compiler rejects opaque, empty, cropped and undersized sources instead of inventing usable alpha', async (t) => {
  const f = await fixture(t);
  await f.manifest([sample('invalid.png')]);
  for (const [size, channels, background, error] of [
    [1024, 3, '#8855ff', /missing alpha/],
    [1024, 4, '#00000000', /cannot be empty/],
    [1024, 4, '#8855ffff', /transparent breathing room/],
    [512, 4, '#8855ffff', /at least 1024px/],
  ] as const) {
    await sharp({ create: { width: size, height: size, channels, background } })
      .png()
      .toFile(join(f.sourceRoot, 'invalid.png'));
    await assert.rejects(buildBeastArtwork({ ...f.options, write: true }), error);
  }
});

test('art compiler preserves CLI provenance and rejects invented generators or a missing model', async (t) => {
  const f = await fixture(t);
  await f.source('awakened.png', '#ffdd88ff');
  const cli = {
    ...sample('awakened.png', 'awakened'),
    generator: 'imagegen_cli_cockpit',
    model: 'test-image-model',
  };
  await f.manifest([cli]);
  const built = await buildBeastArtwork({ ...f.options, write: true });
  assert.equal(built.report.redesignedAwakened, 1);
  const report = JSON.parse(await readFile(join(f.outputRoot, 'ART.json'), 'utf8'));
  assert.equal(report.entries[0].generator, 'imagegen_cli_cockpit');
  assert.equal(report.entries[0].model, 'test-image-model');
  for (const [entry, error] of [
    [{ ...cli, generator: 'invented' }, /actual approved generator/],
    [{ ...cli, model: '' }, /Missing CLI image model/],
    [{ ...cli, form: 3 }, /Awakened artwork must be T4/],
  ] as const) {
    await f.manifest([entry]);
    await assert.rejects(buildBeastArtwork({ ...f.options, write: true }), error);
  }
});

test('art compiler rejects reference substitution, duplicate pictures, path escape and invalid evolution metadata', async (t) => {
  const f = await fixture(t);
  await copyFile(beastReferencePath('frostnip', 4), join(f.sourceRoot, 'reference.webp'));
  await f.manifest([sample('reference.webp')]);
  await assert.rejects(
    buildBeastArtwork({ ...f.options, write: true }),
    /cannot be declared a redesign/,
  );
  await f.source('normal.png', '#8855ffff');
  await f.manifest([sample('normal.png'), sample('normal.png', 'perfect')]);
  await assert.rejects(buildBeastArtwork({ ...f.options, write: true }), /distinct image/);
  for (const [entries, error] of [
    [[sample('../outside.png')], /escapes its directory/],
    [[sample('normal.png', 'perfect', 3)], /Perfect artwork must be T4/],
    [[sample('normal.png'), sample('normal.png')], /Duplicate artwork/],
    [[{ ...sample('normal.png'), speciesId: 'unknown' }], /INVALID_BEAST_SPECIES/],
    [[{ ...sample('normal.png'), prompt: '' }], /Missing generation prompt/],
  ] as const) {
    await f.manifest([...entries]);
    await assert.rejects(buildBeastArtwork({ ...f.options, write: true }), error);
  }
});

test('the complete-art gate rejects empty and partial normal, perfect and awakened coverage', async (t) => {
  const f = await fixture(t);
  await f.manifest([]);
  await assert.rejects(
    buildBeastArtwork({ ...f.options, complete: true, write: true }),
    /all 72 redesigned/,
  );
  await f.manifest(
    BEAST_CATALOG.flatMap((species) =>
      [1, 2, 3, 4].map((form) => ({
        ...sample('not-loaded.png', 'normal', form),
        speciesId: species.id,
      })),
    ),
  );
  await assert.rejects(
    buildBeastArtwork({ ...f.options, complete: true, write: true }),
    /all 18 distinct perfect/,
  );
  const normals = BEAST_CATALOG.flatMap((species) =>
    [1, 2, 3, 4].map((form) => ({
      ...sample('not-loaded.png', 'normal', form),
      speciesId: species.id,
    })),
  );
  await f.manifest([
    ...normals,
    ...BEAST_CATALOG.map((species) => ({
      ...sample('not-loaded.png', 'perfect'),
      speciesId: species.id,
    })),
  ]);
  await assert.rejects(
    buildBeastArtwork({ ...f.options, complete: true, write: true }),
    /all 18 awakened/,
  );
  await f.source('normal.png', '#8855ffff');
  await f.manifest([sample('normal.png')]);
  await assert.rejects(
    buildBeastArtwork({ ...f.options, complete: true, write: true }),
    /all 72 redesigned/,
  );
});

test('art selection keeps all references truthful and only requests a separate perfect T4 when eligible', async () => {
  const { beastArtwork, beastProgress } = await import(modelPath);
  const { BEAST_ART } = await import(registryPath);
  const references = Object.fromEntries(
    BEAST_CATALOG.flatMap((species) =>
      [1, 2, 3, 4].map((form) => {
        const path = beastReferencePath(species.id, form as 1 | 2 | 3 | 4).slice(
          'docs/assets/linh-thu/'.length,
        );
        return [`${species.id}:${form}:normal`, { full: path, thumb: path, kind: 'reference' }];
      }),
    ),
  );
  for (const species of BEAST_CATALOG)
    for (const form of [1, 2, 3, 4]) {
      const art = beastArtwork(species, form, false, true, references);
      assert.equal(art.kind, 'reference');
      assert.equal(art.variant, 'normal', 'Unavailable perfect art must not be fabricated');
      assert.ok(
        art.src.endsWith(
          beastReferencePath(species.id, form as 1 | 2 | 3 | 4).slice('docs/'.length),
        ),
      );
    }
  const species = BEAST_CATALOG.find((s) => s.id === 'frostnip')!;
  const registry = {
    ...BEAST_ART,
    'frostnip:4:perfect': {
      full: 'designed/v1/perfect.webp',
      thumb: 'designed/thumbs/v1/perfect.webp',
      kind: 'redesigned',
    },
  };
  const data = { config: { catalog: BEAST_CATALOG, training: BEAST_TRAINING } };
  for (const [earned, gray, expected] of [
    [800, 0, false],
    [1140, 60, false],
    [1199, 1, false],
    [1200, 0, true],
  ] as const) {
    const progress = beastProgress(data, {
      speciesId: 'frostnip',
      attempt: { earned, gray, status: earned + gray === 1200 ? 'completed' : 'training' },
    });
    assert.equal(progress.perfect, expected);
    assert.equal(
      beastArtwork(species, progress.form, false, progress.perfect, registry).variant,
      expected ? 'perfect' : 'normal',
    );
  }
  assert.equal(beastArtwork(species, 3, true, true, registry).variant, 'normal');
  assert.ok(beastArtwork(species, 4, true, true, registry).src.includes('/designed/thumbs/'));
});

test('awakened images require completed training and never override perfect or lower-form previews', async () => {
  const { beastArtwork, beastProgress } = await import(modelPath);
  const species = BEAST_CATALOG.find((s) => s.id === 'frostnip')!;
  const art = Object.fromEntries([
    ...[1, 2, 3, 4].map((form) => [
      `frostnip:${form}:normal`,
      { full: `t${form}.webp`, thumb: `t${form}-thumb.webp`, kind: 'redesigned' },
    ]),
    [
      'frostnip:4:awakened',
      { full: 'awakened.webp', thumb: 'awakened-thumb.webp', kind: 'redesigned' },
    ],
    [
      'frostnip:4:perfect',
      { full: 'perfect.webp', thumb: 'perfect-thumb.webp', kind: 'redesigned' },
    ],
  ]);
  const data = { config: { catalog: BEAST_CATALOG, training: BEAST_TRAINING } };
  for (const [earned, gray, expected] of [
    [800, 0, 'normal'],
    [1139, 61, 'normal'],
    [1140, 60, 'awakened'],
    [1199, 1, 'awakened'],
    [1200, 0, 'perfect'],
  ] as const) {
    const p = beastProgress(data, {
      speciesId: species.id,
      attempt: { earned, gray, status: earned + gray === 1200 ? 'completed' : 'training' },
    });
    assert.equal(
      beastArtwork(species, p.form, false, p.perfect, art, p.awakened).variant,
      expected,
    );
  }
  assert.equal(beastArtwork(species, 3, true, true, art, true).variant, 'normal');
  assert.equal(
    beastArtwork(species, 4, true, false, art, true).src.endsWith('/awakened-thumb.webp'),
    true,
  );
  const { ['frostnip:4:perfect']: _perfect, ...withoutPerfect } = art;
  assert.equal(beastArtwork(species, 4, false, true, withoutPerfect, true).variant, 'awakened');
});
