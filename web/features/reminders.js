import { button, el, field } from '../ui/dom.js';
import { liveRequest } from '../core/http.js';
export function createReminderActions(context) {
  const { state, runtime, sheet, sheetContent, openSheet, confirm, performLive, render, toast } =
    context;
  async function loadMoreReminders() {
    const cursor = state.remindersNextCursor;
    if (!state.live || cursor == null || state.remindersLoading) return;
    const revision = runtime.revision;
    state.remindersLoading = true;
    render();
    try {
      const page = await liveRequest('reminders?offset=' + cursor);
      if (revision !== runtime.revision) return;
      const rows = page.reminders.map((r) => ({
        ...r,
        times: r.times.join(', '),
        start: r.startDate,
        end: r.endDate ?? '',
      }));
      state.reminders = [
        ...new Map([...state.reminders, ...rows].map((row) => [row.id, row])).values(),
      ];
      state.remindersNextCursor = page.nextCursor;
    } catch (error) {
      toast(error.message);
    } finally {
      state.remindersLoading = false;
      render();
    }
  }
  function openReminder(reminder) {
    openSheet(reminder ? 'Chỉnh lời nhắc' : 'Thêm lời nhắc');
    const form = el('form', undefined, 'reminder-editor'),
      body = el('div', undefined, 'reminder-editor-body'),
      name = field('Nhắc việc gì?', 'text', reminder?.title ?? '');
    const times = el('fieldset', undefined, 'time-slots'),
      legend = el('legend', 'Giờ nhắc · 24 giờ');
    times.append(legend);
    const rows = el('div');
    times.append(rows);
    const addTime = (value) => {
      if (rows.children.length >= 8 || (reminder?.origin === 'appointment' && rows.children.length))
        return;
      const row = el('div', undefined, 'time-slot'),
        time = field('Giờ ' + (rows.children.length + 1), 'time', value),
        remove = button(
          'Bỏ giờ',
          () => {
            if (rows.children.length === 1) return;
            row.remove();
            refreshTimes();
            add.focus();
          },
          'secondary',
        );
      row.append(time.wrap, remove);
      rows.append(row);
      refreshTimes();
    };
    const refreshTimes = () => {
      [...rows.children].forEach((row, index) => {
        row.querySelector('label').firstChild.textContent = 'Giờ ' + (index + 1);
        const remove = row.querySelector('button');
        remove.hidden = rows.children.length === 1;
        remove.setAttribute('aria-label', 'Bỏ giờ ' + (index + 1));
      });
      add.disabled = rows.children.length >= 8;
    };
    const add = button(
      '+ Thêm giờ',
      () => {
        addTime('');
        rows.lastElementChild?.querySelector('input')?.focus();
      },
      'text-button',
    );
    add.hidden = reminder?.origin === 'appointment';
    times.append(add);
    for (const value of (reminder?.times ?? '09:00').split(',').map((t) => t.trim()))
      addTime(value);
    const typeLabel = el('label', 'Lặp lại', 'form-field'),
      type = el('select');
    for (const [value, label] of [
      ['once', 'Một lần'],
      ['daily', 'Hằng ngày'],
      ['weekdays', 'Các thứ trong tuần'],
    ]) {
      const option = el('option', label);
      option.value = value;
      type.append(option);
    }
    type.value = reminder?.kind ?? 'daily';
    if (reminder?.origin === 'appointment') type.disabled = true;
    typeLabel.append(type);
    const from = field(
        'Bắt đầu từ',
        'date',
        reminder?.start ??
          new Date((state.serverNow ?? Date.now()) + 25200000).toISOString().slice(0, 10),
      ),
      end = field('Ngày kết thúc', 'date', reminder?.end ?? '');
    const repeat = el('section', undefined, 'reminder-repeat-fields'),
      endOption = el('label', undefined, 'reminder-end-option'),
      hasEnd = el('input');
    hasEnd.type = 'checkbox';
    hasEnd.checked = !!reminder?.end;
    endOption.append(hasEnd, el('span', 'Đặt ngày kết thúc'));
    const days = el('fieldset', undefined, 'reminder-weekdays'),
      dayOptions = el('div', undefined, 'weekday-list');
    days.append(el('legend', 'Nhắc vào'), dayOptions);
    for (let n = 1; n <= 7; n++) {
      const label = el('label'),
        input = el('input');
      input.type = 'checkbox';
      input.value = String(n);
      input.checked = reminder?.weekdays?.includes(n) ?? [1, 3, 5].includes(n);
      label.append(input, el('span', n === 7 ? 'CN' : 'T' + (n + 1)));
      dayOptions.append(label);
    }
    const repeatHint = el('p', '', 'hint');
    const showRepeat = () => {
      const once = type.value === 'once';
      days.hidden = type.value !== 'weekdays';
      from.wrap.firstChild.textContent = once ? 'Ngày nhắc' : 'Bắt đầu từ';
      endOption.hidden = once;
      end.wrap.hidden = once || !hasEnd.checked;
      end.input.disabled = end.wrap.hidden;
      end.input.min = from.input.value;
      repeatHint.textContent = once
        ? 'Nhắc vào ngày đã chọn · giờ Việt Nam.'
        : hasEnd.checked
          ? 'Lặp lại đến hết ngày kết thúc · giờ Việt Nam.'
          : 'Lặp lại đến khi cậu tắt lời nhắc · giờ Việt Nam.';
    };
    type.addEventListener('change', showRepeat);
    hasEnd.addEventListener('change', showRepeat);
    from.input.addEventListener('input', showRepeat);
    showRepeat();
    repeat.append(typeLabel, days, from.wrap, endOption, end.wrap, repeatHint);
    body.append(name.wrap, times, repeat);
    if (reminder?.kind === 'once' && (reminder.delivered || reminder.past))
      body.prepend(
        el(
          'p',
          reminder.delivered
            ? 'Đã gửi lời nhắc này. Kiểm tra ngày và giờ nếu muốn đặt lại.'
            : 'Lời nhắc này đã qua giờ. Kiểm tra ngày và giờ nếu muốn đặt lại.',
          'reminder-editor-status',
        ),
      );
    const enabled = el('input');
    enabled.type = 'checkbox';
    enabled.setAttribute('role', 'switch');
    enabled.setAttribute('aria-label', 'Bật lời nhắc');
    enabled.checked = reminder?.enabled ?? true;
    if (reminder?.origin !== 'appointment') {
      const toggle = el('label', undefined, 'reminder-enable'),
        copy = el('span'),
        hint = el('small', 'Tắt để ngừng nhắc, các thiết lập vẫn được giữ.');
      hint.id = 'reminder-enable-hint';
      enabled.setAttribute('aria-describedby', hint.id);
      copy.append(el('strong', 'Bật lời nhắc'), hint);
      toggle.append(copy, enabled);
      body.append(toggle);
    }
    const submit = el(
      'button',
      state.live
        ? reminder
          ? 'Lưu thay đổi'
          : 'Tạo lời nhắc'
        : reminder
          ? 'Lưu thay đổi mẫu'
          : 'Tạo lời nhắc mẫu',
      'primary',
    );
    submit.type = 'submit';
    const actions = el('div', undefined, 'reminder-editor-actions');
    actions.append(
      button('Hủy', () => sheet.close(), 'secondary'),
      submit,
    );
    form.append(body, actions);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const slots = [...rows.querySelectorAll('input')].map((t) => t.value);
      if (slots.some((t) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(t))) {
        toast('Chọn giờ hợp lệ cho từng lần nhắc nhé.');
        return;
      }
      const weekdays = [...days.querySelectorAll('input:checked')].map((i) => Number(i.value));
      if (type.value === 'weekdays' && !weekdays.length) {
        toast('Chọn ít nhất một thứ.');
        return;
      }
      const endDate = type.value !== 'once' && hasEnd.checked ? end.input.value : '';
      if (endDate && endDate < from.input.value) {
        toast('Ngày kết thúc phải từ ngày bắt đầu trở đi.');
        return;
      }
      const value = {
        title: name.input.value.trim(),
        kind: type.value,
        times: [...new Set(slots)].join(', '),
        weekdays,
        start: from.input.value,
        end: endDate,
        enabled: enabled.checked,
      };
      if (!value.title) return;
      if (state.live) {
        performLive('reminders', {
          rule: {
            ...(reminder
              ? { id: reminder.id, ...(reminder.origin ? { origin: reminder.origin } : {}) }
              : {}),
            title: value.title,
            kind: value.kind,
            times: [...new Set(slots)],
            weekdays,
            startDate: value.start,
            endDate: value.end || null,
            enabled: value.enabled,
            version: reminder?.version ?? 0,
          },
        });
        return;
      }
      if (reminder) Object.assign(reminder, value);
      else state.reminders.push({ id: state.nextReminder++, ...value });
      sheet.close();
      render();
      toast('Đã cập nhật lời nhắc mẫu, chưa tạo thông báo thật.');
    });
    sheetContent.append(form);
    if (reminder) {
      const danger = el('div', undefined, 'reminder-editor-danger');
      danger.append(
        button(
          'Xóa lời nhắc',
          () =>
            confirm(
              'Xóa lời nhắc?',
              'Xóa “' +
                reminder.title +
                '” và dừng các lần nhắc sau. Công việc và thói quen liên quan vẫn giữ nguyên. Những tin đã gửi tới Telegram vẫn giữ nguyên.',
              () => {
                if (state.live) {
                  void performLive('reminders-delete', {
                    reminderId: reminder.id,
                    ...(reminder.origin ? { origin: reminder.origin } : {}),
                    version: reminder.version,
                    confirm: true,
                  });
                  return;
                }
                state.reminders = state.reminders.filter(
                  (item) => item.id !== reminder.id || item.origin !== reminder.origin,
                );
                render();
                toast('Đã xóa lời nhắc mẫu.');
              },
            ),
          'danger',
        ),
      );
      body.append(danger);
    }
  }
  return { openReminder, loadMoreReminders };
}
