import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { BEAST_CATALOG, beastReferencePath } from '../src/domain/linh-thu-catalog.ts';
import { BEAST_TRAINING } from '../src/domain/linh-thu-training.ts';
import { beastFixture } from '../tests/browser/linh-thu-fixture.mjs';
import { serve, chrome, browserBin, clone } from '../tests/browser/app-harness.mjs';

// Diagnostic only: real web modules/images with fixture API data, no product writes.
assert.ok(browserBin, 'A real Chrome/Chromium browser is required');
const throttled = process.argv.includes('--throttled');
const capture = process.argv.includes('--capture');
const samples = Number(
  process.argv.find((arg) => arg.startsWith('--samples='))?.split('=')[1] ?? 3,
);
assert.ok(Number.isSafeInteger(samples) && samples >= 1 && samples <= 10, 'Use 1–10 samples');
const referenceRegistry = Object.fromEntries(
  BEAST_CATALOG.flatMap((species) =>
    [1, 2, 3, 4].map((form) => {
      const path = beastReferencePath(species.id, form).slice(
        'docs/assets/linh-thu/reference/'.length,
      );
      return [
        `${species.id}:${form}:normal`,
        { full: 'reference/' + path, thumb: 'reference/thumbs/' + path, kind: 'reference' },
      ];
    }),
  ),
);

async function phase(browser, selector) {
  return browser.evaluate(`(async () => {
    const visible = [...document.querySelectorAll(${JSON.stringify(selector)})].filter(image => {
      const box = image.getBoundingClientRect();
      return box.top < innerHeight && box.bottom > 0;
    });
    await Promise.all(visible.map(image => image.decode()));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const resources = performance.getEntriesByType('resource');
    const images = resources.filter(entry => entry.name.includes('/assets/linh-thu/') && entry.initiatorType === 'img');
    return {
      readyMs: Math.round((performance.now() - (globalThis.__phaseStart ?? 0)) * 10) / 10,
      resourceCount: resources.length,
      decodedBodyBytes: resources.reduce((sum, entry) => sum + entry.decodedBodySize, 0),
      transferBytes: resources.reduce((sum, entry) => sum + entry.transferSize, 0),
      imageRequests: images.length,
      imageBodyBytes: images.reduce((sum, entry) => sum + entry.decodedBodySize, 0),
      imageUrls: images.map(entry => new URL(entry.name).pathname),
      visibleImageWidths: visible.map(image => image.naturalWidth),
      overflow: document.documentElement.scrollWidth > innerWidth + 1
    };
  })()`);
}

const runs = [];
for (let sample = 1; sample <= samples; sample++) {
  for (const art of ['reference-baseline', 'production-v3']) {
    const control = beastFixture(),
      template = clone(control.beastData.selected[0]);
    const beasts = Array.from({ length: 2400 }, (_, index) => {
      const species = BEAST_CATALOG[index % BEAST_CATALOG.length];
      return {
        ...clone(template),
        id: 'perf_beast_' + index,
        speciesId: species.id,
        attemptId: 'perf_attempt_' + index,
        attempt: {
          ...template.attempt,
          speciesId: species.id,
          status: 'completed',
          earned: BEAST_TRAINING[species.rank].capacity,
          gray: 0,
        },
      };
    });
    // The selected individual remains a normal, in-progress Frostique in both runs.
    control.beastData.speciesCounts = Object.fromEntries(
      BEAST_CATALOG.map((species) => [
        species.id,
        beasts.filter((b) => b.speciesId === species.id).length,
      ]),
    );
    control.ownedBeasts = beasts;
    const inventoryMetrics = () => ({
      requests: control.collectionRequests.length,
      bytes: control.collectionRequests.reduce((sum, request) => sum + request.bytes, 0),
      overviewBytes: Buffer.byteLength(JSON.stringify(control.collectionOverview())),
    });
    if (art === 'reference-baseline')
      control.staticFiles = new Map([
        [
          'assets/linh-thu/art.js',
          'export const BEAST_ART = Object.freeze(' + JSON.stringify(referenceRegistry) + ');',
        ],
      ]);
    const server = await serve(control);
    let browser;
    try {
      browser = await chrome();
      await browser.reducedMotion();
      if (throttled) await browser.networkConditions(false, 100, 256 * 1024);
      await browser.navigate(server.url, 390);
      await browser.wait("!!document.querySelector('.focus-flip-card')");
      const today = await phase(browser, '.beast-page img');
      assert.equal(today.imageRequests, 0, 'Today must not preload the beast image catalog');
      await browser.evaluate(
        "performance.clearResourceTimings();globalThis.__phaseStart=performance.now();document.querySelector('[data-tab=beasts]').click()",
      );
      await browser.wait("!!document.querySelector('.beast-hero img')");
      const training = await phase(browser, '.beast-page img');
      assert.ok(training.visibleImageWidths.includes(512), 'Hero uses the full 512px image');
      if (capture && sample === 1 && art === 'production-v3') {
        await mkdir('trial-results/linh-thu/review-v3', { recursive: true });
        await browser.screenshot('trial-results/linh-thu/review-v3/training-390.png');
      }
      await browser.evaluate(
        'performance.clearResourceTimings();globalThis.__phaseStart=performance.now()',
      );
      await browser.click('Bộ sưu tập');
      await browser.wait("document.querySelectorAll('.beast-atlas-entry img').length===18");
      const atlas = { ...(await phase(browser, '.beast-page img')), inventory: inventoryMetrics() };
      assert.equal(atlas.inventory.requests, 1, 'Atlas uses the overview without draining pages');
      assert.equal(
        await browser.evaluate("document.querySelectorAll('.beast-collection-card').length"),
        0,
      );
      await browser.evaluate(
        "performance.clearResourceTimings();globalThis.__phaseStart=performance.now();document.querySelector('[data-species=frostnip]').click()",
      );
      await browser.wait("document.querySelectorAll('.beast-collection-card').length===24");
      const collection = {
        ...(await phase(browser, '.beast-page img')),
        inventory: inventoryMetrics(),
      };
      assert.ok(
        collection.visibleImageWidths.every((width) => width === 128),
        'Collection uses thumbnails',
      );
      const collectionPage = await browser.evaluate(`({
        renderedIndividuals: document.querySelectorAll('.beast-collection-card').length,
        atlasSpecies: document.querySelectorAll('.beast-atlas-entry').length,
        images: document.querySelectorAll('.beast-page img').length,
        lazyImages: document.querySelectorAll('.beast-page img[loading=lazy]').length
      })`);
      assert.equal(collectionPage.renderedIndividuals, 24);
      assert.equal(collectionPage.atlasSpecies, 0);
      assert.equal(collectionPage.lazyImages, collectionPage.images);
      assert.ok(collection.imageRequests <= 42, 'Never load 2,400 individuals at once');
      assert.equal(collection.inventory.requests, 2);
      assert.equal(control.collectionRequests.at(-1).species, 'frostnip');
      await browser.evaluate(
        'performance.clearResourceTimings();globalThis.__phaseStart=performance.now()',
      );
      await browser.click('Tải tiếp các cá thể');
      await browser.wait("document.querySelectorAll('.beast-collection-card').length===48");
      const collectionMore = {
        ...(await phase(browser, '.beast-page img')),
        inventory: inventoryMetrics(),
      };
      assert.equal(collectionMore.inventory.requests, 3);
      assert.equal(control.collectionRequests.at(-1).species, 'frostnip');
      assert.ok(
        collectionMore.inventory.bytes < 40000,
        'Three pages stay bounded independently of 2,400 owned beasts',
      );
      assert.equal(control.posts.length, 0, 'Benchmark must not mutate product state');
      assert.deepEqual(browser.errors, []);
      for (const value of [today, training, atlas, collection, collectionMore])
        assert.equal(value.overflow, false);
      if (capture && sample === 1 && art === 'production-v3') {
        await browser.screenshot('trial-results/linh-thu/review-v3/collection-390.png');
        for (const [label, name] of [
          ['Đồng hành', 'companion'],
          ['Triệu hồi', 'summon'],
          ['Lò đan · 0/30', 'alchemy'],
        ]) {
          await browser.click(label);
          await phase(browser, '.beast-page img, #sheet img');
          await browser.screenshot(`trial-results/linh-thu/review-v3/${name}-390.png`);
        }
      }
      runs.push({
        sample,
        art,
        width: 390,
        ownedIndividuals: 2400,
        today,
        training,
        atlas,
        collection,
        collectionMore,
        collectionPage,
        apiCalls: control.calls,
      });
    } finally {
      await browser?.close();
      await server.close();
    }
  }
}

const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const summary = Object.fromEntries(
  ['reference-baseline', 'production-v3'].map((art) => [
    art,
    Object.fromEntries(
      ['today', 'training', 'atlas', 'collection', 'collectionMore'].map((name) => [
        name,
        Object.fromEntries(
          ['readyMs', 'decodedBodyBytes', 'transferBytes', 'imageRequests', 'imageBodyBytes'].map(
            (metric) => [
              metric,
              median(runs.filter((run) => run.art === art).map((run) => run[name][metric])),
            ],
          ),
        ),
      ]),
    ),
  ]),
);
const report = {
  date: new Date().toISOString(),
  kind: 'Local Chrome diagnostic; same runtime and fixture API, reference sprites versus production v3 artwork',
  network: throttled ? { latencyMs: 100, bytesPerSecond: 262144 } : 'unthrottled localhost',
  samplesPerVariant: samples,
  limitations: [
    'Baseline is the same current UI using the reference sprite registry, not an older deployed app',
    'HTTP fixture server is uncompressed; transfer bytes do not predict CDN compression or cache',
    'Readiness includes polling and animation frames, not a field Web Vital',
    'API responses are fixtures; use the separate D1 benchmark for real service/store query and timing diagnostics',
    'Cold Chrome profiles; no real account, remote database, deployment or product mutations',
  ],
  summary,
  runs,
};
await mkdir('trial-results/linh-thu', { recursive: true });
const path = `trial-results/linh-thu/web-performance${throttled ? '-throttled' : ''}.json`;
await writeFile(path, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ path, summary }, null, 2));
