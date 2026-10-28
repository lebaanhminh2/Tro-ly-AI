import {
  journalFields,
  journalDate,
  journalLongDate,
  journalWeekday,
} from '../features/journals.js';
import { habitIcon } from '../ui/habit-icons.js';

export function renderJournals(ui, state) {
  const { el, button } = ui,
    root = el('section', undefined, 'habits-page diary-page');
  root.append(button('‹ Thói quen', () => ui.showHabitPanel('today'), 'text-button feature-back'));
  const top = el('div', undefined, 'heading');
  const today = state.journalData?.today;
  top.append(
    el('h1', 'Nhật ký'),
    button(
      state.journalDrafts?.[today]
        ? 'Viết tiếp'
        : state.journalData?.entries.some((entry) => entry.day === today)
          ? 'Xem hôm nay'
          : 'Viết hôm nay',
      (event) => ui.openJournal(undefined, false, event.currentTarget),
      'primary',
    ),
  );
  root.append(top);
  if (state.journalLoading && !state.journalData) root.append(el('p', 'Đang tải…', 'hint'));
  if (state.journalError)
    root.append(
      el('p', state.journalError, 'hint'),
      button('Thử lại', () => ui.loadJournals()),
    );
  const data = state.journalData;
  if (!data) return root;
  const entries = new Map(data.entries.map((entry) => [entry.day, entry]));
  const dates = [
    ...new Set([...entries.keys(), ...Object.keys(state.journalDrafts ?? {}).map(Number)]),
  ].sort((a, b) => b - a);
  if (!dates.length && !state.journalLoading) {
    const empty = el('div', undefined, 'diary-empty');
    empty.append(
      el('h2', 'Chưa có nhật ký'),
      el('p', 'Những điều cậu viết sẽ được lưu theo từng ngày ở đây.', 'hint'),
    );
    root.append(empty);
  }
  const list = el('div', undefined, 'diary-list');
  dates.forEach((day) => {
    const entry = entries.get(day) ?? state.journalDrafts[day],
      draft = state.journalDrafts?.[day];
    const row = button(
      '',
      (event) => ui.openJournal(day, !entries.has(day), event.currentTarget),
      'diary-day',
    );
    row.dataset.journalDay = day;
    row.setAttribute('aria-label', 'Nhật ký ngày ' + journalLongDate(day));
    const date = el('time', undefined);
    date.dateTime = journalDate(day);
    date.append(
      el('span', journalDate(day).slice(8)),
      el('small', journalDate(day).slice(5, 7) + '/' + journalDate(day).slice(0, 4)),
    );
    const copy = el('span', undefined, 'diary-copy');
    copy.append(
      el(
        'strong',
        day === data.today ? 'Hôm nay' : day === data.today - 1 ? 'Hôm qua' : journalWeekday(day),
      ),
      el(
        'p',
        journalFields
          .map((key) => entry[key]?.trim())
          .find(Boolean)
          ?.slice(0, 240) ?? '',
      ),
    );
    if (draft) copy.append(el('small', entries.has(day) ? 'Có bản nháp chỉnh sửa' : 'Bản nháp'));
    const arrow = habitIcon('chevron');
    arrow.classList.add('diary-chevron');
    row.append(date, copy, arrow);
    list.append(row);
  });
  root.append(list);
  if (data.next != null)
    root.append(button('Xem thêm', () => ui.loadJournals(true), 'text-button'));
  return root;
}
