import { el } from './dom.js';

export function techniqueSymbol(id, size = 40) {
    const image = el('img', undefined, 'technique-symbol');
    image.src = './assets/than-lo/technique-' + encodeURIComponent(id) + '.svg';
    image.width = size; image.height = size; image.alt = '';
    image.loading = 'lazy'; image.decoding = 'async';
    return image;
}
