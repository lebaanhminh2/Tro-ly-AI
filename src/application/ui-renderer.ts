import type {Button, View} from '../domain/work.ts';

const segmenter = new Intl.Segmenter('vi', {granularity: 'grapheme'});
const encoder = new TextEncoder();

// A layout fallback, not a pixel-width guarantee. Full entity names belong in card text.
export function buttonLabel(text: string, limit = 24): string {
  if (!Number.isInteger(limit) || limit < 2) throw Error('INVALID_LABEL_LIMIT');
  const clean = text.replace(/\s+/gu, ' ').trim();
  if (!clean) throw Error('EMPTY_BUTTON_LABEL');
  const graphemes = Array.from(segmenter.segment(clean), part => part.segment);
  return graphemes.length <= limit ? clean : graphemes.slice(0, limit - 1).join('') + '…';
}

export function renderView(view: View): View {
  if (!view.text.trim() || view.text.length > 4096) throw Error('INVALID_CARD_TEXT');
  const buttons: Button[][] = [];
  for (const sourceRow of view.buttons) {
    if (!sourceRow.length) continue;
    const row = sourceRow.map(button => {
      const bytes = encoder.encode(button.callback_data).byteLength;
      if (bytes < 1 || bytes > 64) throw Error('INVALID_CALLBACK_LENGTH');
      return {text: buttonLabel(button.text), callback_data: button.callback_data};
    });
    const clockRow = row.every(button => /^([01]\d|2[0-3]):[0-5]\d$/.test(button.text));
    // Dynamic entity labels have a full row; other long labels do too.
    const single = row.some(button => /^(task:|forget:|cal-toggle:|cal-plan:|focus:)/.test(button.callback_data)
      || Array.from(segmenter.segment(button.text)).length > 12);
    const width = clockRow ? 4 : single ? 1 : 2;
    for (let index = 0; index < row.length; index += width) buttons.push(row.slice(index, index + width));
  }
  if (buttons.flat().length > 100) throw Error('TOO_MANY_BUTTONS');
  return {...view, buttons};
}
