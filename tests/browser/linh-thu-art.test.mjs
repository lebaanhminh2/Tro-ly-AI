import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { BEAST_CATALOG } from '../../src/domain/linh-thu-catalog.ts';
import { BEAST_TRAINING } from '../../src/domain/linh-thu-training.ts';
import { BEAST_ART } from '../../web/assets/linh-thu/art.js';
import { beastFixture } from './linh-thu-fixture.mjs';
import { serve, chrome, browserBin, clone } from './app-harness.mjs';

test(
  'all 108 production images load through species collection and owned individuals with correct purity variants',
  { skip: !browserBin, timeout: 120000 },
  async () => {
    const control = beastFixture();
    const sample = clone(control.beastData.selected[0]);
    // Ownership and progress are fixtures; image bytes and registry are the real build.
    const beasts = BEAST_CATALOG.flatMap((species) => {
      const capacity = BEAST_TRAINING[species.rank].capacity;
      return ['normal', 'awakened', 'perfect'].map((variant) => {
        const gray =
          variant === 'normal' ? capacity / 10 : variant === 'awakened' ? capacity / 20 : 0;
        const id = `art_${species.id}_${variant}`;
        return {
          ...clone(sample),
          id,
          speciesId: species.id,
          attemptId: id + '_attempt',
          attempt: {
            ...sample.attempt,
            speciesId: species.id,
            status: 'completed',
            earned: capacity - gray,
            gray,
          },
        };
      });
    });
    control.ownedBeasts = beasts;
    control.beastData.selected = [beasts[0]];
    control.beastData.roles.current.forEach((role) =>
      Object.assign(role, { beastId: beasts[0].id, attemptId: beasts[0].attemptId }),
    );
    control.beastData.speciesCounts = Object.fromEntries(BEAST_CATALOG.map((s) => [s.id, 3]));
    const server = await serve(control);
    let browser;
    try {
      browser = await chrome();
      await browser.reducedMotion();
      await browser.navigate(server.url, 390);
      await browser.wait("!!document.querySelector('.focus-flip-card')");
      await browser.evaluate("document.querySelector('[data-tab=beasts]').click()");
      await browser.wait("!!document.querySelector('.beast-hero img')");
      await browser.click('Bộ sưu tập');
      await browser.wait("document.querySelectorAll('.beast-atlas-entry img').length===18");
      assert.deepEqual(
        control.collectionRequests.map(({ species, start }) => ({ species, start })),
        [{ species: null, start: 0 }],
        'The atlas uses the overview without draining individual pages',
      );
      assert.equal(
        await browser.evaluate("document.querySelectorAll('.beast-collection-card').length"),
        0,
        'The collection opens with one tile per species, not the individual inventory',
      );
      const representatives = await browser.evaluate(`(async () => {
        const images = [...document.querySelectorAll('.beast-atlas-entry img')];
        for (const image of images) image.loading = 'eager';
        await Promise.all(images.map(image => image.decode()));
        return images.map(image => ({ src: image.src, variant: image.dataset.artVariant, kind: image.dataset.artKind, width: image.naturalWidth }));
      })()`);
      const checkedForms = new Set();
      let checkedThumbnails = 0;
      for (const [speciesIndex, species] of BEAST_CATALOG.entries()) {
        const representative = representatives[speciesIndex];
        assert.equal(representative.variant, 'perfect');
        assert.equal(representative.kind, 'redesigned');
        assert.equal(representative.width, 128);
        assert.ok(representative.src.endsWith(BEAST_ART[`${species.id}:4:perfect`].thumb));
        await browser.evaluate(`document.querySelector('[data-species="${species.id}"]').click()`);
        await browser.wait("document.querySelectorAll('.beast-collection-card').length===3");
        assert.equal(control.collectionRequests.at(-1).species, species.id);
        assert.equal(control.collectionRequests.at(-1).start, 0);
        assert.equal(await browser.evaluate("document.querySelector('#sheet').open"), false);
        const cards = await browser.evaluate(`(async () => {
          const images = [...document.querySelectorAll('.beast-collection-card img')];
          for (const image of images) image.loading = 'eager';
          await Promise.all(images.map(image => image.decode()));
          return images.map(image => ({ src: image.src, variant: image.dataset.artVariant, kind: image.dataset.artKind, width: image.naturalWidth }));
        })()`);
        for (const [index, variant] of ['normal', 'awakened', 'perfect'].entries()) {
          assert.equal(cards[index].variant, variant);
          assert.equal(cards[index].kind, 'redesigned');
          assert.equal(cards[index].width, 128);
          assert.ok(cards[index].src.endsWith(BEAST_ART[`${species.id}:4:${variant}`].thumb));
          checkedThumbnails++;
          await browser.evaluate(
            `document.querySelectorAll('.beast-collection-card')[${index}].click()`,
          );
          for (const form of variant === 'normal' ? [1, 2, 3, 4] : [4]) {
            await browser.evaluate(
              `document.querySelector('#sheet-content .beast-journey [data-form="${form}"]').click()`,
            );
            const displayed = await browser.evaluate(`(async () => {
            const image = document.querySelector('.beast-detail-image');
            await image.decode();
            return { src: image.src, variant: image.dataset.artVariant, width: image.naturalWidth, kind: image.dataset.artKind };
          })()`);
            const expected = form === 4 ? variant : 'normal';
            assert.equal(displayed.variant, expected);
            assert.equal(displayed.kind, 'redesigned');
            assert.equal(displayed.width, 512);
            const key = `${species.id}:${form}:${expected}`;
            assert.ok(displayed.src.endsWith(BEAST_ART[key].full));
            checkedForms.add(key);
            assert.equal(
              await browser.evaluate('document.documentElement.scrollWidth <= innerWidth'),
              true,
            );
          }
          const i = speciesIndex * 3 + index;
          if (process.env.LINH_THU_CAPTURE === '1' && [0, 2, 9, 11, 17, 35, 53].includes(i)) {
            await mkdir('trial-results/linh-thu/art-v3', { recursive: true });
            await browser.screenshot(
              `trial-results/linh-thu/art-v3/${species.id}-${variant}-390.png`,
            );
          }
          await browser.press('Escape');
          await browser.wait("!document.querySelector('#sheet').open");
        }
        await browser.click('‹ Bộ sưu tập');
        await browser.wait("document.querySelectorAll('.beast-atlas-entry').length===18");
      }
      assert.equal(checkedThumbnails, 54);
      assert.equal(checkedForms.size, 108);
      assert.equal(control.collectionRequests.length, 1 + BEAST_CATALOG.length);
      assert.equal(control.collectionRequests.filter(({ species }) => species === null).length, 1);
      assert.equal(control.posts.length, 0, 'Reviewing art does not change the account');
      assert.deepEqual(browser.errors, []);
    } finally {
      await browser?.close();
      await server.close();
    }
  },
);
