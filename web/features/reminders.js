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
    const form = el('form'),
      name = field('Nhắc việc gì?', 'text', reminder?.title ?? '');
    const times = el('fieldset', undefined, 'time-slots'),
      legend = el('legend', 'Giờ nhắc · 24 giờ');
    times.append(legend);
    const rows = el('div');
    times.append(rows);
    const addTime = (value) => {
      if (rows.children.length >= 8) return;
      const row = el('div', undefined, 'time-slot'),
        time = field('Giờ ' + (rows.children.length + 1), 'time', value),
        remove = button(
          'Bỏ giờ',
          () => {
            row.remove();
            refreshTimes();
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
        row.querySelector('button').disabled = rows.children.length === 1;
      });
      add.disabled = rows.children.length >= 8;
    };
    const add = button('+ Thêm giờ', () => addTime(''), 'text-button');
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
      end = field('Kết thúc · bỏ trống để tiếp tục', 'date', reminder?.end ?? '', false);
    const days = el('div', undefined, 'weekday-list');
    for (let n = 1; n <= 7; n++) {
      const label = el('label'),
        input = el('input');
      input.type = 'checkbox';
      input.value = String(n);
      input.checked = reminder?.weekdays.includes(n) ?? [1, 3, 5].includes(n);
      label.append(input, el('span', n === 7 ? 'CN' : 'T' + (n + 1)));
      days.append(label);
    }
    const showDays = () => {
      days.hidden = type.value !== 'weekdays';
      end.wrap.hidden = type.value === 'once';
    };
    type.addEventListener('change', showDays);
    showDays();
    form.append(
      name.wrap,
      typeLabel,
      days,
      times,
      from.wrap,
      end.wrap,
      el(
        'p',
        'Lịch lặp tiếp tục đến khi tắt hoặc đến ngày kết thúc. Không phải thiết lập lại mỗi sáng.',
        'hint',
      ),
    );
    const submit = el(
      'button',
      state.live
        ? reminder
          ? 'Lưu cả lịch'
          : 'Tạo lịch'
        : reminder
          ? 'Lưu cả lịch mẫu'
          : 'Tạo lịch mẫu',
      'primary',
    );
    submit.type = 'submit';
    form.append(submit);
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
      if (end.input.value && end.input.value < from.input.value) {
        toast('Ngày kết thúc phải sau ngày bắt đầu.');
        return;
      }
      const value = {
        title: name.input.value.trim(),
        kind: type.value,
        times: [...new Set(slots)].join(', '),
        weekdays,
        start: from.input.value,
        end: type.value === 'once' ? '' : end.input.value,
        enabled: reminder?.enabled ?? true,
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
      toast('Đã cập nhật lịch mẫu, chưa tạo thông báo thật.');
    });
    sheetContent.append(form);
    if (reminder?.origin === 'appointment')
      sheetContent.append(
        button(
          'Hủy lời nhắc',
          () =>
            confirm('Hủy lời nhắc này?', 'Không xóa công việc liên quan.', () =>
              performLive('reminders', {
                rule: {
                  id: reminder.id,
                  origin: 'appointment',
                  title: reminder.title,
                  kind: 'once',
                  times: reminder.times.split(',').map((t) => t.trim()),
                  weekdays: [],
                  startDate: reminder.start,
                  endDate: null,
                  enabled: false,
                  version: reminder.version,
                },
              }),
            ),
          'danger',
        ),
      );
    if (reminder && !reminder.origin) {
      const actions = el('div', undefined, 'actions');
      actions.style.marginTop = '18px';
      actions.append(
        button(
          'Dời lần kế tiếp',
          () => {
            openSheet('Dời riêng lần kế tiếp');
            const f = el('form'),
              date = field(
                'Ngày',
                'date',
                new Date((state.serverNow ?? Date.now()) + 7 * 3600000).toISOString().slice(0, 10),
              ),
              time = field('Giờ Việt Nam', 'time', '19:00');
            f.append(date.wrap, time.wrap, el('p', 'Những lần sau vẫn giữ quy tắc cũ.', 'hint'));
            const save = el('button', 'Lưu lần này', 'primary');
            save.type = 'submit';
            f.append(save);
            f.addEventListener('submit', (e) => {
              e.preventDefault();
              const due = Date.parse(date.input.value + 'T' + time.input.value + ':00+07:00');
              if (due <= Date.now()) {
                toast('Chọn giờ tương lai nhé.');
                return;
              }
              if (state.live)
                performLive('reminder-instance', { ruleId: reminder.id, operation: 'move', due });
              else {
                toast('Demo: chỉ dời một lần, chưa lưu server.');
                sheet.close();
              }
            });
            sheetContent.append(f);
          },
          'secondary',
        ),
        button(
          'Bỏ lần kế tiếp',
          () => {
            if (state.live) {
              performLive('reminder-instance', { ruleId: reminder.id, operation: 'skip' });
              return;
            }
            reminder.skipped = true;
            sheet.close();
            render();
            toast('Demo: bỏ một lần, không tắt lịch lặp.');
          },
          'secondary',
        ),
        button(
          reminder.enabled ? 'Tắt cả lịch' : 'Bật cả lịch',
          () => {
            if (state.live) {
              performLive('reminders', {
                rule: {
                  id: reminder.id,
                  ...(reminder.origin ? { origin: reminder.origin } : {}),
                  title: reminder.title,
                  kind: reminder.kind,
                  times: reminder.times.split(',').map((t) => t.trim()),
                  weekdays: reminder.weekdays,
                  startDate: reminder.start,
                  endDate: reminder.end || null,
                  enabled: !reminder.enabled,
                  version: reminder.version,
                },
              });
              return;
            }
            reminder.enabled = !reminder.enabled;
            sheet.close();
            render();
          },
          'secondary',
        ),
      );
      sheetContent.append(actions);
    }
  }
  return { openReminder, loadMoreReminders };
}
