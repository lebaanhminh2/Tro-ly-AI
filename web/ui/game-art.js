import { el } from './dom.js';

export const gameArtUrl = name => './assets/than-lo/' + name + '?v=cultivation-2';

export function techniqueSymbol(id, size = 40, tier = 0) {
    const image = el('img', undefined, 'technique-symbol');
    const raster = id === 'kiem-y' && Number.isInteger(tier) && tier >= 1 && tier <= 4 && size >= 80;
    image.src = gameArtUrl('technique-' + encodeURIComponent(id) + (raster ? '-tier-' + tier + '.webp' : '.svg'));
    image.width = size; image.height = size; image.alt = '';
    image.loading = 'lazy'; image.decoding = 'async';
    if (raster) image.classList.add('technique-tier-art');
    return image;
}
