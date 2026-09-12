import test from 'node:test';
import assert from 'node:assert/strict';
import {buttonLabel,renderView} from '../../src/application/ui-renderer.ts';

test('labels preserve graphemes, use ellipsis and never truncate callback identifiers', () => {
  const emoji = '👨‍👩‍👧‍👦';
  assert.equal(buttonLabel(emoji.repeat(25)), emoji.repeat(23) + '…');
  assert.equal(buttonLabel('  Đặt\n hạn  '), 'Đặt hạn');
  const original = {text: 'Tên đầy đủ vẫn ở đây', buttons: [[{text: 'a'.repeat(50), callback_data: 'task:original'}]]};
  const result = renderView(original);
  assert.equal(result.text, original.text);
  assert.equal(result.buttons[0]![0]!.callback_data, 'task:original');
  assert.equal(original.buttons[0]![0]!.text.length, 50);
  assert.deepEqual(renderView(result), result);
});

test('common layout gives entity labels full rows, two actions or four clock choices', () => {
  const action = (text: string, callback_data = 'action') => ({text, callback_data});
  const result = renderView({text: 'card', buttons: [
    [action('15 phút'),action('25 phút'),action('45 phút')],
    [action('A','task:1'),action('B','task:2')],
    ['08:00','09:00','10:00','11:00','12:00'].map(text => action(text))
  ]});
  assert.deepEqual(result.buttons.map(row => row.length), [2,1,1,1,4,1]);
});

test('invalid text, blank labels and oversized UTF-8 callbacks fail before sending', () => {
  assert.throws(() => renderView({text: '',buttons: []}), /INVALID_CARD_TEXT/);
  assert.throws(() => renderView({text: 'a'.repeat(4097),buttons: []}), /INVALID_CARD_TEXT/);
  assert.throws(() => buttonLabel(' '), /EMPTY_BUTTON_LABEL/);
  assert.throws(() => renderView({text: 'card',buttons: [[{text:'ok',callback_data:'ế'.repeat(22)}]]}), /INVALID_CALLBACK_LENGTH/);
});
