import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { BEAST_CATALOG } from '../../src/domain/linh-thu-catalog.ts';
import { BEAST_TRAINING } from '../../src/domain/linh-thu-training.ts';
import { BEAST_ART } from '../../web/assets/linh-thu/art.js';
import { beastFixture } from './linh-thu-fixture.mjs';
import { serve, chrome, browserBin, clone } from './app-harness.mjs';

test(
  'all 108 production images load through paginated collection and form details with correct purity variants',
  { skip: !browserBin, timeout: 120000 },
  async () => {
    const control = beastFixture(),
      original = control.beastApi;
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
    control.beastData.selected = [beasts[0]];
    control.beastData.roles.current.forEach((role) =>
      Object.assign(role, { beastId: beasts[0].id, attemptId: beasts[0].attemptId }),
    );
    control.beastData.speciesCounts = Object.fromEntries(BEAST_CATALOG.map((s) => [s.id, 3]));
    control.beastApi = (request, endpoint) => {
      if (endpoint === 'linh-thu/collection') {
        const start = Number(
          new URL(request.url, 'http://localhost').searchParams.get('cursor') ?? 0,
        );
        return {
          body: {
            beasts: beasts.slice(start, start + 24),
            nextCursor: start + 24 < beasts.length ? String(start + 24) : null,
          },
        };
      }
      return original(request, endpoint);
    };
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
      await browser.wait("document.querySelectorAll('.beast-collection-card').length===24");
      await browser.click('Tải thêm linh thú');
      await browser.wait("document.querySelectorAll('.beast-collection-card').length===48");
      await browser.click('Tải thêm linh thú');
      await browser.wait("document.querySelectorAll('.beast-collection-card').length===54");
      const cards = await browser.evaluate(`(async () => {
        const images = [...document.querySelectorAll('.beast-collection-card img')];
        for (const image of images) image.loading = 'eager';
        await Promise.all(images.map(image => image.decode()));
        return images.map(image => ({ src: image.src, variant: image.dataset.artVariant, kind: image.dataset.artKind, width: image.naturalWidth }));
      })()`);
      for (let i = 0; i < beasts.length; i++) {
        const variant = ['normal', 'awakened', 'perfect'][i % 3];
        const species = BEAST_CATALOG[Math.floor(i / 3)];
        assert.equal(cards[i].variant, variant);
        assert.equal(cards[i].kind, 'redesigned');
        assert.equal(cards[i].width, 128);
        assert.ok(cards[i].src.endsWith(BEAST_ART[`${species.id}:4:${variant}`].thumb));
        await browser.evaluate(`document.querySelectorAll('.beast-collection-card')[${i}].click()`);
        for (const form of variant === 'normal' ? [1, 2, 3, 4] : [4]) {
          await browser.click(`T${form} · ${species.forms[form - 1]}`);
          const displayed = await browser.evaluate(`(async () => {
            const image = document.querySelector('.beast-detail-image');
            await image.decode();
            return { src: image.src, variant: image.dataset.artVariant, width: image.naturalWidth, kind: image.dataset.artKind };
          })()`);
          const expected = form === 4 ? variant : 'normal';
          assert.equal(displayed.variant, expected);
          assert.equal(displayed.kind, 'redesigned');
          assert.equal(displayed.width, 512);
          assert.ok(displayed.src.endsWith(BEAST_ART[`${species.id}:${form}:${expected}`].full));
          assert.equal(
            await browser.evaluate('document.documentElement.scrollWidth <= innerWidth'),
            true,
          );
        }
        if (process.env.LINH_THU_CAPTURE === '1' && [0, 2, 9, 11, 17, 35, 53].includes(i)) {
          await mkdir('trial-results/linh-thu/art-v3', { recursive: true });
          await browser.screenshot(
            `trial-results/linh-thu/art-v3/${species.id}-${variant}-390.png`,
          );
        }
        await browser.press('Escape');
      }
      assert.deepEqual(browser.errors, []);
    } finally {
      await browser?.close();
      await server.close();
    }
  },
);
