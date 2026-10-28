import { liveRequest, requestIdentity } from '../core/http.js';
import { el, button } from '../ui/dom.js';

export const journalFields = ['achieved', 'lessons', 'tomorrow'];
export const journalLabels = [
  'Hôm nay làm được gì?',
  'Điều chưa tốt / bài học',
  'Ngày mai cải thiện gì?',
];
export const journalDate = (day) => new Date(day * 86400000).toISOString().slice(0, 10);
export const journalLongDate = (day) =>
  new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(day * 86400000));
export const journalWeekday = (day) =>
  new Intl.DateTimeFormat('vi-VN', { timeZone: 'UTC', weekday: 'long' }).format(
    new Date(day * 86400000),
  );

export function createJournalActions(context) {
  const { state, runtime, render, toast, openSheet, sheet, sheetContent, performLive } = context;
  let generation = 0;
  let opening = 0;
  const draftKey = () =>
    state.journalData?.owner ? 'minh-anh-diary-v1-' + state.journalData.owner : null;
  function readDrafts() {
    try {
      const saved = JSON.parse(localStorage.getItem(draftKey()) || '{}');
      if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return {};
      const validVersion = (value) => Number.isSafeInteger(value) && value >= 0;
      const validText = (value) =>
        value &&
        journalFields.every((key) => typeof value[key] === 'string' && value[key].length <= 4000);
      return Object.fromEntries(
        Object.entries(saved).filter(([day, draft]) => {
          if (
            !/^\d+$/.test(day) ||
            !validVersion(Number(day)) ||
            Number(day) > state.journalData.today ||
            !validVersion(draft?.version) ||
            !validText(draft)
          )
            return false;
          const pending = draft.pending;
          return (
            !pending ||
            (/^[a-zA-Z0-9_-]{8,100}$/.test(pending.id) &&
              pending.input?.operation === 'save' &&
              pending.input.day === Number(day) &&
              validVersion(pending.input.version) &&
              validText(pending.input))
          );
        }),
      );
    } catch {
      return {};
    }
  }
  function persistDraft(day, draft) {
    state.journalDrafts ??= {};
    if (draft) state.journalDrafts[day] = draft;
    else delete state.journalDrafts[day];
    try {
      localStorage.setItem(draftKey(), JSON.stringify(state.journalDrafts));
      return true;
    } catch {
      return false;
    }
  }
  async function loadJournals(more = false) {
    if (!state.live || (more && state.journalData?.next == null)) return;
    const ticket = ++generation,
      session = runtime.session;
    state.journalLoading = true;
    state.journalError = null;
    render();
    try {
      const data = await liveRequest(
        'journals' + (more ? '?before=' + state.journalData.next : ''),
      );
      if (ticket !== generation || session !== runtime.session) return;
      const previous =
        more && state.journalData?.owner === data.owner ? state.journalData.entries : [];
      const sameOwner = state.journalData?.owner === data.owner;
      state.journalData = { ...data, entries: [...previous, ...data.entries] };
      if (!sameOwner || !state.journalDrafts) state.journalDrafts = readDrafts();
    } catch (error) {
      if (ticket === generation) state.journalError = error.message;
    } finally {
      if (ticket === generation && session === runtime.session) {
        state.journalLoading = false;
        render();
      }
    }
  }
  async function showJournals() {
    state.habitPanel = 'journals';
    state.habitSelecting = false;
    render();
    await loadJournals();
  }
  function addFeedback(message) {
    const feedback = sheetContent.querySelector('#sheet-feedback');
    if (feedback) {
      feedback.textContent = message;
      feedback.hidden = false;
    }
  }
  async function openJournal(day, edit = false, trigger = undefined) {
    if (!sheet.open) sheetContent.replaceChildren();
    const session = runtime.session,
      ticket = ++opening,
      tab = state.tab,
      panel = state.habitPanel,
      previousTitle = sheetContent.querySelector('#sheet-title'),
      wasOpen = sheet.open,
      today = day === undefined;
    state.journalOpening = ticket;
    const current = () =>
      ticket === opening &&
      session === runtime.session &&
      tab === state.tab &&
      panel === state.habitPanel &&
      sheet.open === wasOpen &&
      sheetContent.querySelector('#sheet-title') === previousTitle;
    if (trigger) {
      trigger.disabled = true;
      trigger.setAttribute('aria-busy', 'true');
    }
    try {
      // The habit page already knows the operating day. Read that day directly
      // instead of opening a loading dialog and recursively reopening it.
      day ??= state.habitData?.day.day ?? state.journalData?.today;
      let data = await liveRequest('journals' + (day === undefined ? '' : '?day=' + day));
      if (!current()) return false;
      if (day === undefined) {
        state.journalData = data;
        day = data.today;
        data = await liveRequest('journals?day=' + day);
        if (!current()) return false;
      }
      // Keep the default entry on today's server day across midnight or a
      // changed operating schedule, without trusting an old page's date.
      if (today && day !== data.today) {
        day = data.today;
        data = await liveRequest('journals?day=' + day);
        if (!current()) return false;
      }
      const sameOwner = state.journalData?.owner === data.owner;
      if (state.journalData?.owner !== data.owner) {
        state.journalData = { owner: data.owner, today: data.today, entries: [], next: null };
      } else state.journalData.today = data.today;
      if (today)
        state.journalData.entries = [
          ...(data.entry ? [data.entry] : []),
          ...state.journalData.entries.filter((entry) => entry.day !== day),
        ];
      if (today || !sameOwner || !state.journalDrafts) state.journalDrafts = readDrafts();
      if (today && state.journalDrafts[day]) edit = true;
      if (trigger?.isConnected && trigger.tagName === 'BUTTON') {
        trigger.disabled = false;
        trigger.focus({ preventScroll: true });
      }
      if (!edit && data.entry) readJournal(data.entry);
      else editJournal(day, data.entry, data.version);
      return true;
    } catch (error) {
      if (current()) toast(error.message);
      return false;
    } finally {
      if (state.journalOpening === ticket) {
        state.journalOpening = null;
        // A background page refresh may have replaced the original button.
        const entry = document.querySelector('.hv2-diary-entry');
        if (entry instanceof HTMLButtonElement) {
          entry.disabled = false;
          entry.removeAttribute('aria-busy');
        }
      }
      if (trigger) {
        trigger.disabled = false;
        trigger.removeAttribute('aria-busy');
      }
    }
  }
  function readJournal(entry, savedNow = false) {
    openSheet('Nhật ký ngày');
    sheet.classList.add('settings-sheet-open', 'diary-v2-sheet');
    const layout = el('div', undefined, 'settings-sheet-body habit-form habit-editor diary-sheet');
    const body = el('article', undefined, 'habit-form-fields diary-reading');
    body.dataset.journalDay = entry.day;
    const date = el('time', undefined, 'diary-reading-date');
    date.dateTime = journalDate(entry.day);
    date.append(el('span', journalWeekday(entry.day)), el('strong', journalLongDate(entry.day)));
    body.append(date);
    if (savedNow) body.append(el('p', 'Đã lưu nhật ký', 'diary-status'));
    else if (state.journalDrafts?.[entry.day])
      body.append(el('p', 'Có bản nháp chỉnh sửa chưa lưu', 'diary-status'));
    if (entry.rewarded) body.append(el('p', 'Đã nhận +1 tu vi · +1 vé quay', 'diary-reward'));
    journalFields.forEach((key, index) => {
      if (!entry[key]?.trim()) return;
      const section = el('section', undefined, 'diary-reading-section');
      section.append(el('h3', journalLabels[index]), el('p', entry[key]));
      body.append(section);
    });
    const controls = el('div', undefined, 'actions habit-form-footer');
    controls.append(
      button('Xóa', () => confirmDelete(entry), 'secondary danger'),
      button('Chỉnh sửa', () => editJournal(entry.day, entry, entry.version), 'primary'),
    );
    layout.append(body, controls);
    sheetContent.append(layout);
  }
  function confirmDelete(entry) {
    openSheet('Xóa nhật ký này?');
    sheet.classList.add('settings-sheet-open', 'diary-v2-sheet');
    const body = el('div', undefined, 'settings-sheet-body diary-confirm');
    body.append(
      el('p', 'Nhật ký ngày ' + journalLongDate(entry.day) + ' và bản nháp chỉnh sửa sẽ bị xóa.'),
      el('p', 'Không thể hoàn tác. Phần thưởng đã nhận được giữ nguyên.', 'hint'),
    );
    const controls = el('div', undefined, 'actions');
    controls.append(
      button('Hủy', () => readJournal(entry)),
      button(
        'Xóa nhật ký',
        async () => {
          const result = await performLive(
            'journals',
            { operation: 'delete', day: entry.day, version: entry.version },
            {
              keepSheet: true,
              silent: true,
              reconciled: true,
              handleError: true,
              onError: (error) => addFeedback(error.message),
            },
          );
          if (!result) return;
          persistDraft(entry.day, null);
          if (state.journalData)
            state.journalData.entries = state.journalData.entries.filter(
              (row) => row.day !== entry.day,
            );
          sheet.close();
          state.habitPanel = 'journals';
          await loadJournals();
          toast('Đã xóa nhật ký');
        },
        'secondary danger',
      ),
    );
    body.append(controls);
    sheetContent.append(body);
  }
  function editJournal(day, entry, version) {
    const draft = state.journalDrafts?.[day];
    openSheet(entry ? 'Chỉnh sửa nhật ký' : 'Nhật ký ngày');
    sheet.classList.add('settings-sheet-open', 'diary-v2-sheet');
    const form = el('form', undefined, 'settings-sheet-body habit-form habit-editor diary-sheet');
    form.dataset.journalDay = day;
    const fields = el('div', undefined, 'habit-form-fields');
    const dateLabel = el('label', 'Ngày viết', 'diary-date-label'),
      date = el('input');
    date.type = 'date';
    date.value = journalDate(day);
    date.max = journalDate(state.journalData.today);
    date.setAttribute('aria-label', 'Ngày viết nhật ký');
    dateLabel.append(date);
    fields.append(dateLabel);
    const status = el('p', draft ? 'Bản nháp · Chưa lưu nhật ký' : '', 'diary-status');
    fields.append(status);
    const inputs = {};
    journalFields.forEach((key, index) => {
      const label = el('label', journalLabels[index], 'form-field'),
        input = el('textarea');
      input.name = key;
      input.maxLength = 4000;
      input.rows = 3;
      input.placeholder = [
        'Những việc đã làm, dù nhỏ…',
        'Điều chưa như ý và điều mình rút ra…',
        'Một vài việc cụ thể mình muốn làm tốt hơn…',
      ][index];
      input.value = draft?.[key] ?? entry?.[key] ?? '';
      inputs[key] = input;
      label.append(input);
      fields.append(label);
    });
    const read = () => Object.fromEntries(journalFields.map((key) => [key, inputs[key].value]));
    const error = el('p', '', 'diary-error');
    error.hidden = true;
    error.setAttribute('role', 'alert');
    fields.append(error);
    const showError = (message) => {
      error.textContent = message;
      error.hidden = false;
    };
    const storeDraft = (pending) => {
      const text = read();
      const changed = journalFields.some((key) => text[key] !== (entry?.[key] ?? ''));
      const next =
        changed || pending
          ? { ...text, version: draft?.version ?? version, ...(pending ? { pending } : {}) }
          : null;
      if (!persistDraft(day, next))
        showError(
          'Chưa giữ được bản nháp trên trình duyệt. Giữ trang này và lưu nhật ký để tránh mất nội dung.',
        );
      status.textContent = next
        ? 'Bản nháp · Chưa lưu nhật ký'
        : entry
          ? 'Đã lưu · Có thể chỉnh sửa'
          : '';
    };
    form.addEventListener('input', (event) => {
      if (event.target !== date) storeDraft(state.journalDrafts?.[day]?.pending);
    });
    date.addEventListener('change', async () => {
      const selected = Math.floor(Date.parse(date.value + 'T00:00:00Z') / 86400000);
      if (Number.isSafeInteger(selected) && selected >= 0 && selected <= state.journalData.today) {
        const opened = await openJournal(selected, true, date);
        if (!opened && date.isConnected) date.value = journalDate(day);
      } else date.value = journalDate(day);
    });
    const controls = el('div', undefined, 'actions habit-form-footer'),
      submit = el('button', 'Lưu nhật ký', 'primary');
    submit.type = 'submit';
    controls.append(submit);
    form.append(fields, controls);
    sheetContent.append(form);
    if (draft && draft.version !== version && !draft.pending) {
      showError(
        'Bản đã lưu vừa thay đổi. Bản nháp vẫn ở đây; kiểm tra bản đã lưu trước khi lưu lại.',
      );
      fields.append(
        button('Xem bản đã lưu', () => (entry ? readJournal(entry) : openJournal(day))),
      );
      fields.append(
        button('Dùng nội dung nháp này', () => {
          persistDraft(day, { ...read(), version });
          editJournal(day, entry, version);
        }),
      );
      submit.disabled = true;
    }
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      error.hidden = true;
      if (!journalFields.some((key) => inputs[key].value.trim())) {
        showError('Viết ít nhất một mục để lưu nhật ký nhé.');
        inputs.achieved.focus();
        return;
      }
      const pending = state.journalDrafts?.[day]?.pending;
      const input = pending?.input ?? { operation: 'save', day, version, ...read() };
      if (pending) requestIdentity('journals', pending.input, pending.id);
      const result = await performLive('journals', input, {
        keepSheet: true,
        silent: true,
        reconciled: true,
        handleError: true,
        onRequest: (input) => storeDraft({ input, id: requestIdentity('journals', input) }),
        onError: (error) => {
          if (error.code !== 'NETWORK_UNCONFIRMED') storeDraft();
          showError(error.message);
          if (error.code === 'JOURNAL_CHANGED')
            fields.append(button('Mở bản mới nhất', () => openJournal(day)));
        },
      });
      if (!result) return;
      // Clear only the exact submitted draft. Edits made after an uncertain
      // request must survive while that earlier receipt is recovered.
      const current = read();
      const changed = journalFields.some((key) => current[key] !== input[key]);
      persistDraft(day, changed ? { ...current, version: result.version } : null);
      const saved = {
        ...input,
        version: result.version,
        rewarded: result.reward || entry?.rewarded,
      };
      if (state.journalData)
        state.journalData.entries = [
          saved,
          ...state.journalData.entries.filter((row) => row.day !== day),
        ].sort((a, b) => b.day - a.day);
      if (form.isConnected && sheet.open) readJournal(saved, true);
      render();
    });
  }
  return { loadJournals, showJournals, openJournal };
}
