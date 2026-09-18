import test from 'node:test';
import assert from 'node:assert/strict';
import {ceilToMinutes,deadlineAt,deadlineValue} from '../../src/domain/time.ts';

test('strict date parser validates calendar dates and preserves explicit UTC+7', () => {
  assert.equal(deadlineValue('29/02/2028 00:00'), '2028-02-29T00:00:00+07:00');
  for (const value of ['31/02/2026 20:00', '29/02/2025 12:00', '12/13/2026 09:00',
    '12/09/2026 24:00', '12/09/2026', 'mai', '12/09/2026 12:99']) {
    assert.equal(deadlineValue(value), null);
  }
});

test('date-only task deadlines end at 23:59 Vietnam time and replans round forward',()=>{
 assert.equal(deadlineAt('2026-09-18'),Date.parse('2026-09-18T23:59:00+07:00'));
 assert.equal(deadlineAt('2026-09-18T08:15:00+07:00'),Date.parse('2026-09-18T08:15:00+07:00'));
 assert.equal(ceilToMinutes(Date.parse('2026-09-18T09:02:01+07:00')),Date.parse('2026-09-18T09:05:00+07:00'));
});
