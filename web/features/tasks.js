import { activeTaskPage, historyPage } from '../core/live-data.js';
import { demoCompleteTask } from '../demo/cultivation.js';
import { button, el, field, noteField } from '../ui/dom.js';
export function createTaskActions(context) {
  const {
    state,
    runtime,
    sheet,
    sheetContent,
    openSheet,
    confirm,
    performLive,
    render,
    toast,
    openTodayPlan,
  } = context;
  function toggleTask(task) {
    if (state.live) {
      confirm(
        task.done ? 'Mở lại #' + task.code : 'Hoàn thành #' + task.code,
        task.done
          ? 'Mở lại task cha, giữ trạng thái các bước đã xong.'
          : 'Đánh dấu xong cả task và các bước còn lại?',
        () => completeTask(task, !task.done),
      );
      return;
    }
    if (task.done) {
      confirm(
        'Mở lại #' + task.code,
        'Task sẽ trở lại danh sách đang làm. Các bước đã xong vẫn giữ.',
        () => {
          task.done = false;
          render();
          toast('Demo: đã mở lại task.');
        },
      );
      return;
    }
    const open = task.steps.filter((s) => !s.done).length;
    confirm(
      'Hoàn thành #' + task.code,
      open
        ? 'Còn ' + open + ' bước chưa xong. Đánh dấu hoàn thành cả task và các bước còn lại?'
        : 'Xác nhận đã xong toàn bộ công việc này?',
      () => {
        task.done = true;
        demoCompleteTask(state.cultivation, task.code);
        task.steps.forEach((s) => (s.done = true));
        render();
        toast('Ui xong rồi này :> · Chỉ là thao tác demo');
      },
    );
  }
  async function completeTask(task, complete) {
    if (state.taskIntents?.[task.id]) return;
    const session = runtime.session;
    (state.taskIntents ??= {})[task.id] = { done: complete };
    render();
    const result = await performLive(
      'tasks',
      {
        operation: 'complete',
        taskId: task.id,
        version: task.version,
        complete,
        confirm: true,
      },
      {
        queue: true,
        keepSheet: true,
        silent: true,
        resolveInput: () => {
          const current = state.tasks.find((item) => item.id === task.id);
          if (!current) throw Error('Công việc không còn trong danh sách.');
          return {
            operation: 'complete',
            taskId: current.id,
            version: current.version,
            complete,
            confirm: true,
          };
        },
        onCommitted: (_saved, input, receipt) => {
          if (receipt.task) {
            if (receipt.task.status === 'completed' && state.taskFocus?.taskId === task.id)
              state.taskFocus = null;
            return;
          }
          const current = state.tasks.find((item) => item.id === task.id);
          if (!current) return;
          current.done = complete;
          current.version = input.version + 1;
          current.completedAt = complete
            ? (state.serverNow ?? Date.now()) + Date.now() - (state.loadedAt ?? Date.now())
            : null;
          if (complete)
            for (const step of current.steps) {
              if (!step.done) step.version++;
              step.done = true;
            }
          if (complete && state.taskFocus?.taskId === task.id) state.taskFocus = null;
        },
      },
    );
    if (session !== runtime.session) return;
    delete state.taskIntents[task.id];
    render();
    if (result?.ticket > 0) toast('+' + result.ticket + ' vé quay', undefined, { kind: 'success' });
    return result;
  }
  function openTask(task) {
    if (state.live && task?.id) task = state.tasks.find((item) => item.id === task.id) ?? task;
    openSheet(task ? '#' + task.code + ' · Chi tiết' : 'Thêm công việc');
    sheet.classList.add('task-sheet-open');
    const shell = el('div', undefined, 'task-sheet'),
      body = el('div', undefined, 'task-sheet-body'),
      form = el('form');
    form.id = 'task-sheet-form';
    const name = field('Tên công việc', 'text', task?.title ?? ''),
      note = noteField(task?.note ?? ''),
      deadline = field('Ngày hết hạn', 'date', task?.deadline?.slice(0, 10) ?? '', false),
      deadlineTime = field(
        'Giờ hết hạn · để trống là 23:59',
        'time',
        task?.deadline?.includes('T') ? task.deadline.slice(11, 16) : '',
        false,
      );
    name.input.maxLength = 160;
    form.append(name.wrap);
    let progress = null,
      timeMode = 'estimate',
      progressBox = null;
    const timeEditor = el('section', undefined, 'task-time-editor');
    form.append(timeEditor);
    const originalRemaining = task?.remainingMinutes ?? null;
    const remainingField = field(
      'Thời gian còn cần làm (phút)',
      'number',
      originalRemaining === null ? '' : String(originalRemaining),
      false,
    );
    remainingField.input.min = '0';
    remainingField.input.max = '100000';
    remainingField.input.step = '1';
    remainingField.input.placeholder = 'Chưa ước lượng';
    const remainingSlider = el('input');
    remainingSlider.type = 'range';
    remainingSlider.min = '0';
    remainingSlider.max = String(Math.max(600, originalRemaining ?? 0));
    remainingSlider.step = '1';
    remainingSlider.value = String(originalRemaining ?? 0);
    remainingSlider.className = 'work-slider';
    remainingSlider.setAttribute('aria-label', 'Thời gian còn cần làm (phút)');
    const remainingBox = el('section', undefined, 'remaining-editor');
    remainingBox.append(
      remainingField.wrap,
      remainingSlider,
      el(
        'p',
        'Ước lượng từ bây giờ đến khi xong. Để trống nếu chưa biết. Lịch đã xếp giữ nguyên cho đến khi cậu chỉnh lại.',
        'hint',
      ),
    );
    timeEditor.append(remainingBox);
    const remainingValue = () =>
      remainingField.input.value === '' ? null : Number(remainingField.input.value);
    const remainingDirty = () => timeMode === 'estimate' && remainingValue() !== originalRemaining;
    const syncRemaining = () => {
      const value = remainingValue();
      if (value !== null && Number.isFinite(value)) {
        remainingSlider.max = String(Math.max(600, Math.min(100000, value)));
        remainingSlider.value = String(value);
      }
      if (progress) {
        progress.inputs.forEach((input) => (input.disabled = timeMode !== 'progress'));
      }
    };
    remainingField.input.addEventListener('input', syncRemaining);
    remainingSlider.addEventListener('input', () => {
      remainingField.input.value = remainingSlider.value;
      syncRemaining();
    });
    if (task && state.live) {
      const planned = state.dailyPlan?.plan?.items.find((item) => item.taskId === task.id),
        actual = Number(planned?.actualMinutes ?? task.actualMinutes ?? 0);
      const remaining = task.remainingMinutes ?? planned?.remaining ?? null,
        baseRemaining =
          remaining === null ? null : Number(task.remainingBalance ?? remaining) + actual;
      let sliderMax = Math.min(1440, Math.max(120, actual + Number(remaining ?? 0)));
      const box = el('section', undefined, 'work-progress'),
        head = el('div', undefined, 'progress-head'),
        label = el('label', 'Đã làm hôm nay', 'progress-label'),
        minutesControl = el('div', undefined, 'minutes-control');
      const minutes = el('input');
      minutes.type = 'number';
      minutes.min = '0';
      minutes.max = '1440';
      minutes.step = '5';
      minutes.value = String(actual);
      minutes.inputMode = 'numeric';
      minutes.className = 'work-minutes';
      minutes.setAttribute('aria-label', 'Số phút đã làm hôm nay');
      const slider = el('input');
      slider.type = 'range';
      slider.min = '0';
      slider.max = String(sliderMax);
      slider.step = '1';
      slider.value = String(Math.min(actual, sliderMax));
      slider.className = 'work-slider';
      slider.setAttribute('aria-label', 'Thanh trượt số phút đã làm hôm nay');
      const remainingText = el('p', '', 'progress-remaining'),
        hint = el(
          'p',
          'Nhập tổng số phút cậu đã làm trong hôm nay, hoặc kéo thanh trượt. Lưu lại không bị cộng/trừ lặp.',
          'hint',
        );
      const updateProgress = (value) => {
        let next = Number(value);
        if (!Number.isInteger(next) || next < 0) next = 0;
        next = Math.min(1440, next);
        if (next > sliderMax) {
          sliderMax = next;
          slider.max = String(next);
        }
        minutes.value = String(next);
        slider.value = String(next);
        remainingText.textContent =
          baseRemaining === null
            ? 'Chưa có ước lượng tổng cho task này'
            : `Còn khoảng ${Math.min(100000, Math.max(0, baseRemaining - next))} phút`;
        progress.dirty = timeMode === 'progress' && next !== actual;
        progress.minutes = next;
        remainingField.input.disabled = timeMode === 'progress';
        remainingSlider.disabled = timeMode === 'progress';
      };
      minutes.addEventListener('input', () => updateProgress(minutes.value));
      slider.addEventListener('input', () => updateProgress(slider.value));
      progress = {
        dirty: false,
        minutes: actual,
        inputs: [minutes, slider],
        refresh: () => updateProgress(minutes.value),
      };
      updateProgress(actual);
      minutesControl.append(minutes, el('span', 'phút'));
      head.append(label, minutesControl);
      box.append(head, slider, remainingText, hint);
      progressBox = box;
      box.hidden = true;
      timeEditor.append(box);
      const modes = el('div', undefined, 'segment task-time-modes');
      for (const [mode, text] of [
        ['estimate', 'Còn cần làm'],
        ['progress', 'Đã làm hôm nay'],
      ]) {
        const control = button(
          text,
          () => {
            timeMode = mode;
            for (const b of modes.children) b.setAttribute('aria-pressed', String(b === control));
            remainingBox.hidden = mode !== 'estimate';
            progressBox.hidden = mode !== 'progress';
            progress.refresh();
            syncRemaining();
          },
          'secondary',
        );
        control.setAttribute('aria-pressed', String(mode === timeMode));
        modes.append(control);
      }
      timeEditor.prepend(modes);
      syncRemaining();
    }
    const extras = el('details', undefined, 'task-extras'),
      extraSummary = el('summary', 'Ghi chú & hạn hoàn thành');
    const extraHint = task?.deadline
      ? 'Hạn ' + task.deadline.slice(0, 10).split('-').reverse().join('/')
      : task?.note
        ? 'Có ghi chú'
        : 'Tùy chọn';
    extraSummary.append(el('span', extraHint, 'task-extra-meta'));
    extras.append(extraSummary, note.wrap, deadline.wrap, deadlineTime.wrap);
    form.append(extras);
    if (task) {
      form.append(el('h3', 'Các bước nhỏ'));
      for (const step of task.steps) {
        const row = el('div', undefined, 'task-row task-step-row' + (step.done ? ' done' : '')),
          check = el('input');
        check.type = 'checkbox';
        check.className = 'check';
        check.checked = step.done;
        check.setAttribute('aria-label', 'Hoàn thành bước ' + step.title);
        const label = el('span', '#' + step.code + ' · ' + step.title);
        check.addEventListener('change', () => {
          if (state.live) {
            const act = () =>
              performLive('tasks', {
                operation: 'step_status',
                taskId: task.id,
                stepId: step.id,
                version: task.version,
                complete: check.checked,
                confirm: true,
              });
            if (task.done && !check.checked)
              confirm('Mở lại bước và task?', 'Task cha sẽ trở lại đang làm.', act);
            else act();
            return;
          }
          if (task.done && !check.checked) {
            confirm(
              'Mở lại bước và task?',
              'Mở lại #' + step.code + ' cũng mở lại #' + task.code + '.',
              () => {
                task.done = false;
                step.done = false;
                render();
                openTask(task);
              },
            );
            return;
          }
          step.done = check.checked;
          if (task.steps.every((s) => s.done) && !task.done) {
            confirm(
              'Các bước đều xong rồi',
              'Cậu muốn đánh dấu hoàn thành cả #' + task.code + ' không?',
              () => {
                task.done = true;
                demoCompleteTask(state.cultivation, task.code);
                render();
              },
            );
          }
        });
        const remove = button(
          'Xóa',
          () =>
            confirm('Xóa bước nhỏ?', 'Chỉ xóa “' + step.title + '”, giữ nguyên task cha.', () => {
              if (state.live) {
                performLive('tasks', {
                  operation: 'delete_step',
                  taskId: task.id,
                  stepId: step.id,
                  version: task.version,
                  confirm: true,
                });
                return;
              }
              task.steps = task.steps.filter((item) => item !== step);
              render();
              openTask(task);
            }),
          'text-button step-delete',
        );
        remove.setAttribute('aria-label', 'Xóa bước ' + step.title);
        row.append(check, label, remove);
        form.append(row);
      }
      form.append(
        button(
          '+ Thêm bước',
          () => {
            openSheet('Thêm bước cho #' + task.code);
            const f = el('form'),
              title = field('Tên bước', 'text');
            f.append(title.wrap);
            const save = el('button', 'Thêm bước', 'primary');
            save.type = 'submit';
            f.append(save);
            f.addEventListener('submit', (e) => {
              e.preventDefault();
              const value = title.input.value.trim();
              if (!value) return;
              if (state.live) {
                performLive('tasks', {
                  operation: 'add_step',
                  taskId: task.id,
                  version: task.version,
                  title: value,
                  confirm: false,
                });
                return;
              }
              task.steps.push({
                code: task.code + '.' + task.nextStep++,
                title: value,
                done: false,
              });
              task.done = false;
              render();
              openTask(task);
            });
            sheetContent.append(f);
          },
          'text-button',
        ),
      );
    }
    body.append(form);
    if (task)
      body.append(el('p', 'Cậu cũng có thể nhắn Minh Anh “sửa task #' + task.code + '”.', 'hint'));
    shell.append(body);
    const actions = el('div', undefined, 'actions task-actions'),
      save = el('button', state.live ? 'Lưu thay đổi' : 'Lưu thay đổi mẫu', 'primary');
    save.type = 'submit';
    save.setAttribute('form', form.id);
    actions.append(save);
    if (task)
      actions.append(
        button(task.done ? 'Mở lại' : 'Hoàn thành', () => toggleTask(task), 'secondary'),
      );
    if (task && state.live)
      actions.append(
        button(
          state.dailyPlan?.plan?.items.some((item) => item.taskId === task.id)
            ? 'Chỉnh trong hôm nay'
            : 'Thêm vào hôm nay',
          () => openTodayPlan(task.id),
          'text-button task-plan-action',
        ),
      );
    shell.append(actions);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const title = name.input.value.trim();
      if (!title) return;
      const deadlineValue = deadline.input.value
        ? deadlineTime.input.value
          ? deadline.input.value + 'T' + deadlineTime.input.value + ':00+07:00'
          : deadline.input.value
        : null;
      if (state.live) {
        const taskChanged =
          !task ||
          remainingDirty() ||
          title !== task.title ||
          note.input.value !== (task.note ?? '') ||
          deadlineValue !== (task.deadline || null);
        if (!taskChanged && !progress?.dirty) {
          sheet.close();
          return;
        }
        if (taskChanged) {
          const saved = await performLive(
            'tasks',
            {
              operation: task ? 'edit' : 'create',
              ...(task ? { taskId: task.id, version: task.version } : {}),
              title,
              note: note.input.value,
              ...(!task || remainingDirty() ? { remainingMinutes: remainingValue() } : {}),
              ...(!task || deadlineValue !== (task.deadline || null)
                ? { deadline: deadlineValue }
                : {}),
            },
            { keepSheet: true, silent: true },
          );
          if (!saved) return;
        }
        if (task && progress?.dirty) {
          const saved = await performLive(
            'task-work',
            { taskId: task.id, minutes: progress.minutes, note: null },
            { keepSheet: true, silent: true },
          );
          if (!saved) return;
        }
        if (form.isConnected) sheet.close();
        render();
        toast(progress?.dirty ? 'Đã lưu task và tiến độ hôm nay.' : 'Đã lưu thay đổi.');
        return;
      }
      if (task) {
        task.title = title;
        task.note = note.input.value;
        task.deadline = deadlineValue ?? '';
        task.remainingMinutes = remainingValue();
      } else
        state.tasks.push({
          code: state.nextTask++,
          title,
          note: note.input.value,
          deadline: deadlineValue ?? '',
          remainingMinutes: remainingValue(),
          done: false,
          steps: [],
          nextStep: 1,
        });
      sheet.close();
      render();
      toast('Đã đổi bản mẫu · Không lưu lên bot');
    });
    sheetContent.append(shell);
  }
  function confirmDelete() {
    if (state.live) {
      const items = state.tasks.filter((t) => state.selected.has(t.code));
      confirm(
        'Xóa ' + items.length + ' công việc?',
        items.map((t) => '#' + t.code + ' ' + t.title).join(' · ') +
          ' — lời nhắc liên quan sẽ được hủy.',
        async () => {
          const result = await performLive('tasks-delete', {
            items: items.map((t) => ({ id: t.id, version: t.version })),
            confirm: true,
          });
          if (result) {
            state.selected.clear();
            state.selecting = false;
            render();
          }
        },
      );
      return;
    }
    const selected = state.tasks.filter((t) => state.selected.has(t.code));
    confirm(
      'Xóa ' + selected.length + ' công việc?',
      selected.map((t) => '#' + t.code + ' ' + t.title).join(' · ') +
        ' — thao tác này chỉ tác động dữ liệu demo.',
      () => {
        state.tasks = state.tasks.filter((t) => !state.selected.has(t.code));
        state.selected.clear();
        state.selecting = false;
        render();
        toast('Đã xóa trong bản mẫu. Tải lại trang để khôi phục.');
      },
    );
  }
  async function loadHistory() {
    if (
      !state.live ||
      runtime.saving ||
      state.historyLoading ||
      (state.historyRefreshed && !state.historyHasMore)
    )
      return;
    const firstPage = !state.historyRefreshed;
    let changed = false;
    state.historyLoading = true;
    runtime.revision++;
    if (!firstPage) render();
    const revision = runtime.revision;
    try {
      const page = await historyPage(state.historyOffset ?? 0);
      if (revision !== runtime.revision || !state.loaded) return;
      changed = page.items.length > 0 || page.hasMore;
      for (const task of page.items ?? [])
        if (!state.tasks.some((item) => item.id === task.id)) state.tasks.push(task);
      state.historyOffset = (page.offset ?? state.historyOffset ?? 0) + (page.items?.length ?? 0);
      state.historyHasMore = !!page.hasMore;
      state.historyTotal = page.total ?? state.historyTotal;
      state.historyRefreshed = true;
    } catch (error) {
      if (revision === runtime.revision) toast(error.message || 'Chưa tải thêm lịch sử được.');
    } finally {
      state.historyLoading = false;
      if (revision === runtime.revision && (!firstPage || changed)) render();
    }
  }
  async function loadActiveTasks() {
    if (!state.live || runtime.saving || state.activeTasksLoading || !state.activeTasksHasMore)
      return;
    state.activeTasksLoading = true;
    runtime.revision++;
    render();
    const revision = runtime.revision;
    try {
      const page = await activeTaskPage(state.activeTasksOffset ?? 0);
      if (revision !== runtime.revision || !state.loaded) return;
      const byId = new Map(state.tasks.map((task) => [task.id, task]));
      for (const task of page.items) byId.set(task.id, task);
      state.tasks = [...byId.values()];
      state.activeTasksOffset = page.offset + page.items.length;
      state.activeTasksTotal = page.total;
      state.activeTasksHasMore = page.hasMore;
    } catch (error) {
      if (revision === runtime.revision) toast(error.message || 'Chưa tải thêm công việc được.');
    } finally {
      state.activeTasksLoading = false;
      if (revision === runtime.revision) render();
    }
  }
  return { toggleTask, openTask, confirmDelete, loadHistory, loadActiveTasks };
}
