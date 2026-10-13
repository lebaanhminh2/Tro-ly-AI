import { el } from './dom.js';

export const gameArtUrl = name => './assets/than-lo/' + name + '?v=cultivation-2';

export function techniqueSymbol(id, size = 40) {
    const image = el('img', undefined, 'technique-symbol');
    image.src = gameArtUrl('technique-' + encodeURIComponent(id) + '.svg');
    image.width = size; image.height = size; image.alt = '';
    image.loading = 'lazy'; image.decoding = 'async';
    return image;
}
