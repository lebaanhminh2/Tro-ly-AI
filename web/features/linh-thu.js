import { liveRequest, requestIdentity, settleRequest } from '../core/http.js';
import { mapAccount } from '../core/live-data.js';
import { button, el, field } from '../ui/dom.js';
import {
  beastArtwork,
  beastPoints,
  beastIdentity,
  beastPurityLabel,
  beastProgress,
  beastRewardLabel,
  beastSkillLabel,
  beastSpecies,
  beastUltimateText,
  beastUltimateProgress,
} from '../models/linh-thu.js';
import { prefersReducedMotion } from '../core/experience.js';

const pendingKey = 'minh-anh-beast-pending-v1';
export function createBeastActions(context) {
  const { state, runtime, render, toast, openSheet, closeSheet, sheetContent, confirm } = context;
  let generation = 0,
    loading,
    loadingRevision,
    towerLoading,
    towerRevision,
    towerGeneration = 0;
  function persistPending(value) {
    try {
      if (value) sessionStorage.setItem(pendingKey, JSON.stringify(value));
      else sessionStorage.removeItem(pendingKey);
    } catch {
      /* In-memory recovery remains available when storage is disabled. */
    }
  }
  try {
    const pending = JSON.parse(sessionStorage.getItem(pendingKey) ?? 'null');
    if (pending?.id && pending?.input) {
      requestIdentity('linh-thu', pending.input, pending.id);
      runtime.pendingBeast = pending;
    }
  } catch {
    persistPending(null);
  }

  function clearPending() {
    if (runtime.pendingBeast) settleRequest('linh-thu', runtime.pendingBeast.input);
    runtime.pendingBeast = null;
    persistPending(null);
  }
  async function loadBeasts(more = false) {
    if (!state.live || !state.loaded) return;
    if (loading && loadingRevision === runtime.revision) return loading;
    loadingRevision = runtime.revision;
    const requestGeneration = ++generation,
      revision = runtime.revision;
    state.beastLoading = true;
    if (!more) state.beastError = null;
    render();
    loading = (async () => {
      try {
        if (more) {
          const cursor = state.beastCollection?.nextCursor;
          if (!cursor) return;
          const page = await liveRequest(
            'linh-thu/collection?cursor=' + encodeURIComponent(cursor),
          );
          if (requestGeneration !== generation || revision !== runtime.revision || !state.loaded)
            return;
          state.beastCollection = {
            ...page,
            beasts: [...state.beastCollection.beasts, ...page.beasts],
          };
        } else {
          const [data, page] = await Promise.all([
            liveRequest('linh-thu'),
            liveRequest('linh-thu/collection'),
          ]);
          if (requestGeneration !== generation || revision !== runtime.revision || !state.loaded)
            return;
          state.beastData = data;
          state.beastCollection = page;
          state.cultivation = mapAccount(data.wallet, state.day?.day);
        }
      } catch (error) {
        if (requestGeneration === generation && revision === runtime.revision)
          state.beastError = error.message;
      } finally {
        if (requestGeneration === generation) {
          state.beastLoading = false;
          render();
        }
        if (requestGeneration === generation) loading = null;
      }
    })();
    return loading;
  }
  async function loadTower() {
    if (!state.live || !state.loaded) return;
    if (towerLoading && towerRevision === runtime.revision) return towerLoading;
    towerRevision = runtime.revision;
    const requestGeneration = ++towerGeneration;
    const revision = runtime.revision;
    towerLoading = liveRequest('linh-thu/tower')
      .then((data) => {
        if (requestGeneration !== towerGeneration || revision !== runtime.revision || !state.loaded)
          return;
        state.beastTower = data;
        state.towerError = null;
        if (state.beastData) state.beastData.account = data.account;
        state.cultivation = mapAccount(data.wallet, state.day?.day);
      })
      .catch((error) => {
        if (requestGeneration === towerGeneration && revision === runtime.revision)
          state.towerError = error.message;
      })
      .finally(() => {
        if (requestGeneration === towerGeneration) {
          towerLoading = null;
          render();
        }
      });
    return towerLoading;
  }
  async function mutateBeast(fields) {
    if (runtime.saving) return null;
    if (!state.live) {
      toast('Mở ứng dụng đã đăng nhập để sử dụng.');
      return null;
    }
    if (runtime.pendingDraw) {
      toast('Kiểm tra lượt quay thường chưa xác nhận trước nhé.');
      return null;
    }
    const data = fields.operation.startsWith('tower_') ? state.beastTower : state.beastData;
    if (!data) return null;
    const day = fields.operation.startsWith('tower_')
      ? state.beastTower?.eligibility.day
      : data.day?.day;
    const input = runtime.pendingBeast?.input ?? { ...fields, day, version: data.account.version };
    if (
      runtime.pendingBeast &&
      JSON.stringify(runtime.pendingBeast.input) !== JSON.stringify(fields)
    ) {
      toast('Còn một thao tác chưa xác nhận. Bấm Kiểm tra kết quả trước nhé.');
      return null;
    }
    const id = requestIdentity('linh-thu', input);
    runtime.pendingBeast = { input, id };
    persistPending(runtime.pendingBeast);
    runtime.saving = true;
    const revision = ++runtime.revision;
    state.beastBusy = true;
    render();
    let result = null;
    try {
      const response = await liveRequest('linh-thu', input);
      if (revision !== runtime.revision || !state.loaded) return null;
      clearPending();
      if (state.beastData) {
        state.beastData.account = response.account;
        state.beastData.wallet = response.wallet;
      }
      state.cultivation = mapAccount(response.wallet, state.day?.day);
      result = response.result;
      state.beastError = null;
    } catch (error) {
      if (revision !== runtime.revision) return null;
      if (!['NETWORK_UNCONFIRMED', 'OPERATION_NOT_CONFIRMED'].includes(error.code)) clearPending();
      state.beastError = error.message;
      toast(error.message);
    } finally {
      const unchanged = revision === runtime.revision;
      runtime.saving = false;
      state.beastBusy = false;
      runtime.revision++;
      render();
      if (unchanged && !runtime.pendingBeast) {
        if (state.tab === 'beasts') loadBeasts();
        if (fields.operation.startsWith('tower_') || state.tab === 'habits') loadTower();
      }
    }
    return result;
  }
  async function recoverBeast() {
    const pending = runtime.pendingBeast;
    if (!pending || runtime.saving) return;
    const revision = ++runtime.revision;
    runtime.saving = true;
    state.beastBusy = true;
    render();
    let retry = false;
    try {
      const receipt = await liveRequest(
        'linh-thu/receipt?' +
          new URLSearchParams({ id: pending.id, operation: pending.input.operation }),
      );
      if (revision !== runtime.revision || !state.loaded || runtime.pendingBeast !== pending)
        return;
      clearPending();
      await loadBeasts();
      await loadTower();
      presentResult(pending.input.operation, receipt.result);
    } catch (error) {
      if (revision !== runtime.revision || !state.loaded) return;
      if (error.code === 'NOT_FOUND') retry = true;
      else toast(error.message);
    } finally {
      runtime.saving = false;
      state.beastBusy = false;
      render();
    }
    if (retry) {
      // Recovery can be opened before the reloaded page has its first beast data.
      // Its revision invalidated that initial read, so load an authoritative base
      // before retrying an intent that never reached the server.
      await loadBeasts();
      if (pending.input.operation.startsWith('tower_')) await loadTower();
      if (revision !== runtime.revision || !state.loaded || runtime.pendingBeast !== pending)
        return;
      const result = await mutateBeast(pending.input);
      if (result) presentResult(pending.input.operation, result);
    }
  }
  function presentResult(operation, result) {
    if (operation === 'summon' || operation === 'choose_summon')
      result.choice ? openBeastSummonChoice(result.choice) : showBeastReveal(result);
    else if (operation.startsWith('tower_')) openBeastTower();
    else if (operation === 'craft') showAlchemyResult(result);
    else toast('Đã lưu.');
  }
  function setBeastPanel(panel) {
    state.beastPanel = panel;
    render();
  }
  function currentSheet() {
    const title = sheetContent.firstElementChild;
    return () =>
      state.loaded && state.live && context.sheet.open && sheetContent.firstElementChild === title;
  }
  function openBeastPicker(role) {
    openSheet(role === 'training' ? 'Chọn linh thú luyện' : 'Chọn linh thú đồng hành');
    const isCurrent = currentSheet();
    const list = el('div', undefined, 'beast-picker');
    for (const beast of state.beastCollection?.beasts ?? []) {
      const progress = beastProgress(state.beastData, beast);
      const b = button(
        `${progress.species.forms[progress.form - 1]} · ${progress.species.rank}`,
        () => {
          const description =
            role === 'training'
              ? 'Ngày hôm nay vẫn tính cho linh thú cũ. Sang ngày mới, lượt cũ sẽ khóa ở đúng tiến độ và tạp chất đã có. Muốn luyện lại cần Tịnh Linh Đan.'
              : 'Linh thú này sẽ hỗ trợ cậu từ ngày sinh hoạt kế tiếp. Việc chọn đồng hành không đổi linh thú đang luyện.';
          confirm(
            'Chọn ' +
              progress.species.forms[progress.form - 1] +
              ' · ' +
              beastIdentity(beast) +
              '?',
            `${beastPoints(beast.attempt.earned)} điểm thực · ${beastPoints(beast.attempt.gray)} tạp chất · Độ thuần ${beastPurityLabel(progress)}. ${description}`,
            async () => {
              const result = await mutateBeast({ operation: 'select', role, beastId: beast.id });
              if (result) toast('Đã hẹn lựa chọn cho ngày kế tiếp.');
            },
          );
        },
        'beast-picker-item',
      );
      const copy = el('span', undefined, 'beast-picker-copy');
      copy.append(
        el('strong', b.textContent),
        el(
          'small',
          `${beastIdentity(beast)} · ${beast.attempt.status === 'sealed' ? 'Đã khóa lượt · Cần đan' : beast.attempt.status === 'completed' ? 'Hoàn tất' : beast.attempt.status === 'training' ? 'Đang luyện' : 'Chưa luyện'}`,
        ),
        el(
          'small',
          `${beastPoints(beast.attempt.earned)} thực · ${beastPoints(beast.attempt.gray)} xám · ${beastPurityLabel(progress)}`,
        ),
      );
      const roles = state.beastData.roles.current.filter(
        (selection) => selection.beastId === beast.id && selection.attemptId === beast.attemptId,
      );
      if (roles.length)
        copy.append(
          el(
            'small',
            roles
              .map((selection) => (selection.role === 'training' ? 'Đang luyện' : 'Đang đồng hành'))
              .join(' · '),
            'beast-picker-role',
          ),
        );
      b.replaceChildren(copy);
      b.prepend(
        portrait(progress.species, progress.form, true, progress.perfect, progress.awakened),
      );
      if (role === 'training' && ['sealed', 'completed'].includes(beast.attempt.status))
        b.disabled = true;
      list.append(b);
    }
    sheetContent.append(list);
    if (!list.childElementCount)
      sheetContent.append(el('p', 'Triệu hồi một linh thú để bắt đầu hành trình.', 'hint'));
    if (state.beastCollection?.nextCursor)
      sheetContent.append(
        button('Tải thêm linh thú', async () => {
          await loadBeasts(true);
          if (isCurrent()) openBeastPicker(role);
        }),
      );
  }
  function portrait(species, form, thumbnail = false, perfect = false, awakened = false) {
    const image = el('img');
    const art = beastArtwork(species, form, thumbnail, perfect, undefined, awakened);
    image.src = art.src;
    image.alt =
      species.forms[form - 1] +
      (art.variant === 'perfect' ? ' · Hoàn mỹ' : art.variant === 'awakened' ? ' · Thức tỉnh' : '');
    image.dataset.artVariant = art.variant;
    image.dataset.artKind = art.kind;
    image.width = thumbnail ? 128 : 512;
    image.height = image.width;
    image.loading = thumbnail ? 'lazy' : 'eager';
    image.decoding = 'async';
    return image;
  }
  function showBeast(beast, previewForm) {
    const data = state.beastData,
      progress = beastProgress(data, beast),
      species = progress.species;
    const form = previewForm ?? progress.form;
    openSheet(species.forms[form - 1]);
    const image = portrait(species, form, false, progress.perfect, progress.awakened);
    image.className = 'beast-detail-image';
    sheetContent.append(
      image,
      el(
        'p',
        `${species.rank} · ${species.title}${form !== progress.form ? ' · Xem trước hình dạng' : ''}`,
        'hint',
      ),
      el('p', `${beastIdentity(beast)} · Độ thuần ${beastPurityLabel(progress)}`, 'hint'),
    );
    const forms = el('div', undefined, 'beast-evolutions');
    species.forms.forEach((name, index) =>
      forms.append(
        button(
          `T${index + 1} · ${name}`,
          () => showBeast(beast, index + 1),
          index + 1 === form ? 'primary' : 'secondary',
        ),
      ),
    );
    sheetContent.append(
      forms,
      el(
        'p',
        `${beastPoints(beast.attempt.earned)} điểm thực · ${beastPoints(beast.attempt.gray)} tạp chất`,
        'hint',
      ),
    );
    const skills = data.config.skills[species.id];
    skills.talents.forEach((skill) => {
      sheetContent.append(el('h3', skill.name), el('p', beastSkillLabel(skill), 'hint'));
    });
    sheetContent.append(
      el('h3', '95% · ' + skills.awakening.name),
      el('p', beastSkillLabel(skills.awakening), 'hint'),
      el('h3', '100% · ' + skills.ultimate.name),
      el('p', beastUltimateText[skills.ultimate.kind], 'hint'),
      el(
        'p',
        'Mở khi luyện đầy dạng IV với độ thuần chính xác 100%. Một tuyệt kỹ mỗi tài khoản mỗi tuần.',
        'hint',
      ),
    );
    if (progress.perfect)
      sheetContent.append(
        button('Xem & kích hoạt tuyệt kỹ', () => openBeastUltimate(beast), 'primary'),
      );
    if (['sealed', 'completed'].includes(beast.attempt.status))
      sheetContent.append(
        button('Luyện lại bằng Tịnh Linh Đan', () => resetBeast(beast), 'secondary'),
      );
  }
  function openBeastExchange() {
    openSheet('Đổi vé triệu hồi');
    const isCurrent = currentSheet();
    sheetContent.append(
      el(
        'p',
        '20 vé thường = 1 vé triệu hồi. Vé thường vẫn dùng chung với vòng quay hiện tại.',
        'hint',
      ),
    );
    const amount = field('Số vé triệu hồi', 'number', '1');
    amount.input.min = '1';
    amount.input.max = String(Math.floor((state.beastData?.wallet.state.tickets ?? 0) / 20));
    amount.input.step = '1';
    const cost = el('p', 'Tốn 20 vé thường', 'beast-cost');
    const exchange = button(
      'Xác nhận đổi',
      async () => {
        updateCost();
        if (exchange.disabled) return;
        const result = await mutateBeast({
          operation: 'exchange',
          count: Number(amount.input.value),
        });
        if (result) {
          if (isCurrent()) closeSheet();
          toast(`Đã đổi ${result.exchanged} vé triệu hồi.`);
        }
      },
      'primary',
    );
    function updateCost() {
      const count = Number(amount.input.value),
        max = Number(amount.input.max),
        valid = Number.isInteger(count) && count >= 1;
      exchange.disabled = !valid || count > max || state.beastBusy || !!runtime.pendingBeast;
      cost.textContent = !valid
        ? 'Nhập số vé nguyên, từ 1 trở lên.'
        : count > max
          ? `Cần ${count * 20} vé thường · Hiện có ${state.beastData?.wallet.state.tickets ?? 0} vé.`
          : `Tốn ${count * 20} vé thường`;
    }
    amount.input.addEventListener('input', updateCost);
    updateCost();
    sheetContent.append(amount.wrap, cost, exchange);
  }
  function openBeastUltimate(beast, draft = { targets: [], pact: 'reward' }) {
    const data = state.beastData,
      progress = beastProgress(data, beast),
      skill = data.config.skills[beast.speciesId].ultimate;
    openSheet(skill.name);
    const isCurrent = currentSheet();
    sheetContent.append(
      el('p', beastUltimateText[skill.kind], 'hint'),
      el(
        'p',
        'Dùng hạn mức tuyệt kỹ chung của cả tài khoản tuần này. Đổi đồng hành không hủy hiệu ứng; luyện lại cá thể bằng đan sẽ hủy. Phần chưa dùng hết hạn không hoàn hạn mức.',
        'hint',
      ),
    );
    if (data.ultimate) {
      const active = data.ultimate,
        activeSkill = data.config.skills[active.speciesId]?.ultimate;
      sheetContent.append(
        el('h3', activeSkill?.name ?? 'Tuyệt kỹ đã kích hoạt'),
        el(
          'p',
          beastUltimateProgress(
            active,
            activeSkill,
            (state.serverNow ?? data.now ?? Date.now()) +
              Date.now() -
              (state.loadedAt ?? Date.now()),
          ),
          'beast-notice',
        ),
        el(
          'h3',
          data.ultimate.cancelled
            ? 'Hạn mức tuần đã dùng · Hiệu ứng đã hủy'
            : 'Hạn mức tuần đã dùng',
        ),
        el(
          'p',
          'Hiệu lực đến ' +
            new Date(data.ultimate.expiresAt).toLocaleString('vi-VN', {
              timeZone: 'Asia/Ho_Chi_Minh',
            }),
          'hint',
        ),
      );
      return;
    }
    const current = data.roles.current.find((role) => role.role === 'companion');
    if (
      !progress.perfect ||
      current?.beastId !== beast.id ||
      current?.attemptId !== beast.attemptId
    ) {
      sheetContent.append(
        el(
          'p',
          'Cần luyện hoàn tất 100% và chọn cá thể này đồng hành có hiệu lực để kích hoạt.',
          'beast-notice',
        ),
      );
      return;
    }
    const selected = new Set(draft.targets),
      targetKind = ['marked_tasks', 'magnet_tasks'].includes(skill.kind);
    if (targetKind) {
      const max = skill.kind === 'marked_tasks' ? 2 : 3;
      sheetContent.append(
        el('h3', skill.kind === 'marked_tasks' ? 'Chọn đúng 2 task' : 'Chọn từ 1 đến 3 task'),
      );
      const list = el('div', undefined, 'beast-target-picker');
      for (const task of state.tasks.filter((task) => !task.done)) {
        const label = el('label', undefined, 'beast-target-option'),
          input = el('input');
        input.type = 'checkbox';
        input.checked = selected.has(task.id);
        input.addEventListener('change', () => {
          if (input.checked && selected.size >= max) {
            input.checked = false;
            toast('Chỉ chọn tối đa ' + max + ' task.');
            return;
          }
          if (input.checked) selected.add(task.id);
          else selected.delete(task.id);
        });
        label.append(input, el('span', task.title));
        list.append(label);
      }
      sheetContent.append(list);
      if (state.activeTasksHasMore)
        sheetContent.append(
          button(
            'Tải thêm task để chọn',
            async () => {
              await context.loadActiveTasks();
              if (isCurrent() && state.beastData === data)
                openBeastUltimate(beast, { targets: [...selected], pact });
            },
            'secondary',
          ),
        );
    }
    let pact = draft.pact;
    if (skill.kind === 'breakthrough_pact') {
      const label = el('label', 'Giao ước', 'form-field'),
        select = el('select');
      for (const [value, text] of [
        ['reward', 'Truy Thưởng · Thành công +1 vé triệu hồi'],
        ['guard', 'Hộ Thân · Thất bại hoàn tu vi thực mất'],
      ]) {
        const option = el('option', text);
        option.value = value;
        select.append(option);
      }
      select.addEventListener('change', () => {
        pact = select.value;
      });
      select.value = pact;
      label.append(select);
      sheetContent.append(label);
    }
    sheetContent.append(
      button(
        'Kích hoạt tuyệt kỹ tuần này',
        () => {
          if (
            targetKind &&
            (skill.kind === 'marked_tasks' ? selected.size !== 2 : selected.size < 1)
          ) {
            toast('Chọn đủ task mục tiêu trước nhé.');
            return;
          }
          const fields = {
            operation: 'ultimate',
            beastId: beast.id,
            ...(targetKind ? { targets: [...selected] } : {}),
            ...(skill.kind === 'breakthrough_pact' ? { pact } : {}),
          };
          confirm(
            'Dùng tuyệt kỹ tuần này?',
            skill.name + ' · ' + beastUltimateText[skill.kind],
            async () => {
              const title = sheetContent.firstElementChild;
              const result = await mutateBeast(fields);
              if (result) {
                if (sheetContent.firstElementChild === title) closeSheet();
                toast('Đã kích hoạt ' + skill.name + '.');
              }
            },
          );
        },
        'primary',
      ),
    );
  }
  async function chooseBeastReward(choice, option) {
    const result = await mutateBeast({ operation: 'choose_reward', choiceId: choice.id, option });
    if (result) toast('Đã nhận ' + beastRewardLabel(result.reward));
  }
  function openBeastRates() {
    openSheet('Tỷ lệ và bảo hiểm');
    sheetContent.append(
      el(
        'p',
        'R 70% · SR 25% · SSR 4,5% · UR 0,5%. Các loài trong cùng rank có tỷ lệ bằng nhau.',
        'hint',
      ),
      el(
        'p',
        'Sau 19 lượt không có SSR+, lượt tiếp theo: SSR 90% / UR 10%. Sau 79 lượt không có UR, lượt tiếp theo chắc chắn UR và được ưu tiên.',
        'hint',
      ),
      el(
        'p',
        'Ra SSR: đặt lại bảo hiểm SSR+, vẫn tăng bộ đếm UR. Ra UR: đặt lại cả hai. Mỗi lần triệu hồi nhận một cá thể dạng I độc lập.',
        'hint',
      ),
    );
  }
  async function summonBeast(count) {
    const result = await mutateBeast({ operation: 'summon', count });
    if (result) result.choice ? openBeastSummonChoice(result.choice) : showBeastReveal(result);
  }
  function openBeastSummonChoice(choice = state.beastData?.summonChoice) {
    if (!choice) return;
    openSheet('Tam Thủ Chiêu Hồn · Chọn một giao ước');
    sheetContent.append(
      el(
        'p',
        'Vé đã được dùng. Chỉ ứng viên cậu chọn vào bộ sưu tập; bảo hiểm cập nhật một lần. Cậu có thể quay lại lựa chọn này sau.',
        'hint',
      ),
    );
    const list = el('div', undefined, 'beast-picker');
    choice.candidates.forEach((id, option) => {
      const species = beastSpecies(state.beastData, id);
      const control = button(
        species.rank + ' · ' + species.forms[0],
        () =>
          confirm(
            'Chọn ' + species.forms[0] + '?',
            'Hai ứng viên còn lại không vào kho. Các lượt còn lại trong lần triệu hồi ×10, nếu có, sẽ tiếp tục với bảo hiểm sau lựa chọn này.',
            async () => {
              const result = await mutateBeast({
                operation: 'choose_summon',
                choiceId: choice.id,
                option,
              });
              if (result) showBeastReveal(result);
            },
          ),
        'beast-picker-item',
      );
      control.prepend(portrait(species, 1, true));
      list.append(control);
    });
    sheetContent.append(list);
  }
  async function openBeastDrawChoices() {
    openSheet('Tinh tú dẫn lối · Chọn phần thưởng');
    const isCurrent = currentSheet(),
      loadingHint = el('p', 'Đang tải phần thưởng…', 'hint');
    sheetContent.append(loadingHint);
    const revision = runtime.revision;
    await loadBeasts();
    if (!isCurrent() || revision !== runtime.revision) return;
    loadingHint.remove();
    const choices = state.beastData?.drawChoices ?? [];
    sheetContent.append(
      el(
        'p',
        'Vé đã dùng. Chọn các ô khác nhau; được nhận hai phần thưởng trùng loại nếu chúng nằm ở hai ô. Lựa chọn chưa nhận được giữ khi đóng màn hình.',
        'hint',
      ),
    );
    if (!choices.length) {
      sheetContent.append(el('p', 'Cậu đã nhận hết phần thưởng đang chờ.', 'hint'));
      return;
    }
    for (const choice of choices) {
      const box = el('section', undefined, 'beast-draw-choice'),
        selected = new Set();
      box.append(el('h3', 'Chọn ' + choice.picks + '/' + choice.candidates.length + ' kết quả'));
      choice.candidates.forEach((loot, index) => {
        const reward =
          loot === 'qi1' || loot === 'qi2'
            ? { qi: loot === 'qi1' ? 1 : 2 }
            : { items: { [loot]: 1 } };
        const label = el('label', undefined, 'beast-target-option'),
          input = el('input');
        input.type = 'checkbox';
        input.addEventListener('change', () => {
          if (input.checked && selected.size >= choice.picks) {
            input.checked = false;
            return;
          }
          if (input.checked) selected.add(index);
          else selected.delete(index);
        });
        label.append(
          input,
          el(
            'span',
            beastSkillLabel({ trigger: 'draw', reward })
              .split(': ')
              .slice(1)
              .join(': ')
              .replace(/\.$/, ''),
          ),
        );
        box.append(label);
      });
      box.append(
        button(
          'Nhận lựa chọn',
          async () => {
            if (selected.size !== choice.picks) {
              toast('Chọn đúng ' + choice.picks + ' ô để nhận.');
              return;
            }
            const result = await mutateBeast({
              operation: 'choose_draw',
              choiceId: choice.id,
              picks: [...selected],
            });
            if (result) {
              toast('Đã nhận phần thưởng lựa chọn.');
              if (isCurrent()) await openBeastDrawChoices();
            }
          },
          'primary',
        ),
      );
      sheetContent.append(box);
    }
  }
  function showBeastReveal(result) {
    const data = state.beastData;
    if (!data || !result?.beasts?.length) return;
    closeSheet();
    const dialog = el('dialog', undefined, 'beast-reveal');
    const ranks = { R: 0, SR: 1, SSR: 2, UR: 3 };
    const best = result.beasts.reduce((a, b) =>
      ranks[beastSpecies(data, a.speciesId).rank] >= ranks[beastSpecies(data, b.speciesId).rank]
        ? a
        : b,
    );
    const species = beastSpecies(data, best.speciesId);
    dialog.dataset.rank = species.rank;
    dialog.setAttribute('aria-label', 'Kết quả triệu hồi');
    const stage = el('div', undefined, 'beast-reveal-stage'),
      skip = button('Bỏ qua hiệu ứng', finish, 'beast-reveal-skip');
    stage.append(
      el('div', undefined, 'beast-summon-sigil'),
      el('p', 'MỘT GIAO ƯỚC ĐANG THÀNH HÌNH', 'beast-reveal-caption'),
    );
    dialog.append(skip, stage);
    let timer;
    function finish() {
      clearTimeout(timer);
      dialog.classList.add('is-revealed');
      skip.remove();
      stage.replaceChildren();
      stage.append(
        el('p', species.rank + ' · TRIỆU HỒI THÀNH CÔNG', 'beast-reveal-caption'),
        portrait(species, 1),
        el('h2', species.forms[0]),
        el('p', species.title, 'beast-reveal-subtitle'),
      );
      if (result.beasts.length > 1) {
        const grid = el('div', undefined, 'beast-result-grid');
        for (const beast of result.beasts) {
          const entry = beastSpecies(data, beast.speciesId),
            card = el('div', undefined, 'beast-result-card');
          card.dataset.rank = entry.rank;
          card.append(
            portrait(entry, 1, true),
            el('strong', entry.forms[0]),
            el('small', entry.rank),
          );
          grid.append(card);
        }
        stage.append(grid);
      }
      stage.append(button('Tiếp tục hành trình', () => dialog.close(), 'primary'));
    }
    dialog.addEventListener('close', () => {
      clearTimeout(timer);
      dialog.remove();
    });
    document.body.append(dialog);
    dialog.showModal();
    if (prefersReducedMotion()) finish();
    else timer = setTimeout(finish, 1800);
  }
  function openBeastAlchemy() {
    openSheet('Lò đan · Tịnh Linh Đan');
    const isCurrent = currentSheet();
    const alchemy = state.beastData?.account.state.alchemy;
    if (!alchemy) return;
    const art = furnaceArt(alchemy.days === 30 ? 'ready' : 'idle');
    sheetContent.append(
      art,
      el('h3', alchemy.days === 30 ? 'Linh khí đã viên mãn' : 'Ủ linh khí qua từng ngày'),
      el('p', `${alchemy.days}/30 ngày · Kho đan: ${alchemy.inventory}`, 'beast-alchemy-count'),
      el(
        'p',
        'Ngày đủ habit tích một ngày. Ngày nghỉ tạm dừng; ngày thiếu đứt chuỗi. Đủ 30 giữ sẵn đến khi luyện.',
        'hint',
      ),
      el(
        'p',
        `Thành công 40%. Đã thất bại ${alchemy.failures}/2 mẻ; sau hai thất bại mẻ tiếp theo bảo đảm. Mỗi mẻ dùng trọn chuỗi đã chuẩn bị.`,
        'hint',
      ),
    );
    const craft = button(
      'Luyện Tịnh Linh Đan',
      async () => {
        const result = await mutateBeast({ operation: 'craft' });
        if (result) {
          if (isCurrent()) showAlchemyResult(result);
          else
            toast(
              result.success
                ? 'Tịnh Linh Đan đã thành · Đã cất vào kho.'
                : 'Mẻ đan chưa thành · Đã giữ tiến độ bảo hiểm.',
            );
        }
      },
      'primary',
    );
    craft.disabled = alchemy.days < 30 || state.beastBusy;
    sheetContent.append(craft, el('h3', 'Linh thú có thể luyện lại'));
    for (const beast of state.beastCollection?.beasts ?? [])
      if (['sealed', 'completed'].includes(beast.attempt.status)) {
        const species = beastSpecies(state.beastData, beast.speciesId);
        const control = button(
          species.forms[beastProgress(state.beastData, beast).form - 1] +
            ' · ' +
            beastIdentity(beast) +
            ' · Dùng 1 đan',
          () => resetBeast(beast),
        );
        control.disabled = !alchemy.inventory;
        sheetContent.append(control);
      }
  }
  function showAlchemyResult(result) {
    openSheet('Linh khí đang kết tụ');
    const stage = el('div', undefined, 'beast-alchemy-result');
    stage.append(furnaceArt('ready'));
    const finish = () => {
      clearTimeout(timer);
      if (!stage.isConnected) return;
      stage.replaceChildren(
        furnaceArt(result.success ? 'success' : 'failed'),
        el('h3', result.success ? 'Tịnh Linh Đan đã thành' : 'Linh khí chưa kết tụ'),
        el(
          'p',
          result.success
            ? 'Một cơ hội bắt đầu lại đang chờ trong kho đan.'
            : 'Chuỗi đã dùng cho mẻ này. Tiến độ bảo hiểm được giữ cho mẻ tiếp theo.',
          'hint',
        ),
        button('Trở lại Lò đan', openBeastAlchemy, 'primary'),
      );
    };
    stage.append(button('Bỏ qua hiệu ứng', finish, 'text-button'));
    sheetContent.append(stage);
    let timer;
    if (prefersReducedMotion()) finish();
    else timer = setTimeout(finish, 1800);
  }
  function furnaceArt(mode) {
    const wrapper = el('div', undefined, 'beast-furnace');
    wrapper.dataset.mode = mode;
    wrapper.setAttribute('aria-hidden', 'true');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 240 230');
    /** @param {string} tag @param {Record<string, string | number>} attrs @param {Element} parent */
    const shape = (tag, attrs, parent = svg) => {
      const element = document.createElementNS(svg.namespaceURI, tag);
      for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, String(value));
      parent.append(element);
      return element;
    };
    shape('ellipse', { cx: 120, cy: 211, rx: 77, ry: 12, fill: 'currentColor', opacity: '.08' });
    shape('ellipse', {
      cx: 120,
      cy: 117,
      rx: 100,
      ry: 97,
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '.7',
      opacity: '.22',
      'stroke-dasharray': '2 8',
    });
    shape('path', {
      d: 'M85 180 76 208h19l11-25m49-3 9 28h-19l-11-25',
      fill: '#504469',
      stroke: '#a99ac5',
      'stroke-width': 2,
    });
    shape('path', {
      d: 'M69 112C20 93 30 156 71 151m100-39c49-19 39 44-2 39',
      fill: 'none',
      stroke: '#a995cc',
      'stroke-width': 10,
    });
    shape('path', {
      d: 'M70 102c-3 25-13 41-6 61 8 27 104 27 112 0 7-20-3-36-6-61Z',
      fill: '#312a48',
      stroke: '#aa96cd',
      'stroke-width': 2,
    });
    shape('path', {
      d: 'M76 117c21 9 67 9 88 0m-94 45c29 13 71 13 100 0',
      fill: 'none',
      stroke: '#c9af84',
      'stroke-width': 2,
    });
    shape('path', {
      d: 'm120 128 16 15-16 18-16-18Z',
      fill: '#9071c7',
      stroke: '#d9c4f4',
      'stroke-width': 1.5,
    });
    shape('path', { d: 'm120 134 9 9-9 11-9-11Z', fill: '#e2cffa', class: 'beast-furnace-core' });
    shape('path', {
      d: 'M63 103q57-30 114 0l-4 12H67Z',
      fill: '#554366',
      stroke: '#c3a785',
      'stroke-width': 2,
    });
    shape('path', {
      d: 'm79 97 17-19h48l17 19m-52-22 11-10 11 10',
      fill: '#786080',
      stroke: '#c8ac86',
      'stroke-width': 2,
    });
    const vapor = shape('g', {
      fill: 'none',
      stroke: '#c8acef',
      'stroke-width': 2,
      'stroke-linecap': 'round',
      class: 'beast-furnace-vapor',
    });
    shape(
      'path',
      { d: 'M104 68c-17-20 17-27 1-46m30 46c19-17-13-24 3-39M120 56c-9-11 6-18 1-29' },
      vapor,
    );
    if (mode === 'success') {
      shape('circle', {
        cx: 120,
        cy: 49,
        r: 16,
        fill: '#dbbe8a',
        stroke: '#fff0cb',
        'stroke-width': 2,
        class: 'beast-elixir-pearl',
      });
      shape('path', {
        d: 'm116 42 8 7-8 8m5-20v24',
        fill: 'none',
        stroke: '#8d6845',
        'stroke-width': 1.5,
      });
    }
    wrapper.append(svg);
    return wrapper;
  }
  function resetBeast(beast) {
    const p = beastProgress(state.beastData, beast);
    confirm(
      'Luyện lại ' + p.species.forms[p.form - 1] + ' · ' + beastIdentity(beast) + '?',
      `Dùng 1 Tịnh Linh Đan. Dạng ${p.form}, ${beastPoints(beast.attempt.earned)} điểm thực và ${beastPoints(beast.attempt.gray)} tạp chất của lượt này sẽ trở về dạng I, 0 điểm, 0 tạp chất. Không tự đổi linh thú đang luyện.`,
      async () => {
        const result = await mutateBeast({ operation: 'reset', beastId: beast.id });
        if (result) toast('Đã mở một lượt luyện mới từ dạng I.');
      },
    );
  }
  async function openBeastTower() {
    openSheet('Tháp giao ước');
    const isCurrent = currentSheet(),
      loadingHint = el('p', 'Đang mở tháp…', 'hint');
    sheetContent.append(loadingHint);
    const revision = runtime.revision;
    await loadTower();
    if (!isCurrent() || revision !== runtime.revision) return;
    loadingHint.remove();
    const data = state.beastTower;
    if (!data) {
      sheetContent.append(el('p', state.towerError ?? 'Chưa tải được lượt tháp.', 'hint'));
      return;
    }
    const run = data.run;
    const track = el('div', undefined, 'beast-tower-track');
    ['2 vé thường', '3 vé thường', '1 vé triệu hồi', '2 vé triệu hồi'].forEach((reward, i) => {
      const step = el(
        'div',
        undefined,
        'beast-tower-step' + ((run?.cleared ?? 0) > i ? ' is-cleared' : ''),
      );
      step.append(el('strong', 'Tầng ' + (i + 1)), el('small', reward));
      track.append(step);
    });
    sheetContent.append(track);
    if (runtime.pendingBeast)
      sheetContent.append(button('Kiểm tra kết quả trước', recoverBeast, 'primary'));
    if (!run) {
      sheetContent.append(
        el(
          'p',
          'Một lượt miễn phí mỗi ngày. Đủ habit hôm nay và ít nhất một task công việc hoàn tất hợp lệ để bắt đầu.',
          'hint',
        ),
      );
      const start = button(
        'Bắt đầu leo tháp',
        async () => {
          const result = await mutateBeast({ operation: 'tower_start' });
          if (result && isCurrent()) openBeastTower();
        },
        'primary',
      );
      start.disabled = !data.eligibility.eligible || state.beastBusy || !!runtime.pendingBeast;
      sheetContent.append(start);
      return;
    }
    if (['claimed', 'expired', 'failed'].includes(run.status)) {
      sheetContent.append(
        el('h3', run.status === 'failed' ? 'Giao ước chưa thành' : 'Quà đã vào ví'),
        el(
          'p',
          run.status === 'failed'
            ? 'Cậu gặp bẫy. Chỉ quà của lượt này mất đi; vé trong ví được giữ nguyên.'
            : beastRewardLabel(run.atRisk),
          'hint',
        ),
        el('p', 'Hẹn cậu lượt mới vào ngày sinh hoạt kế tiếp.', 'hint'),
      );
      return;
    }
    sheetContent.append(
      el('h3', 'Tầng ' + run.floor),
      el('p', 'Đang mạo hiểm: ' + beastRewardLabel(run.atRisk), 'beast-tower-risk'),
    );
    if (run.rescued)
      sheetContent.append(
        el('p', 'Phân thân đã cứu một lần. Các lá đã xáo lại; vẫn còn một bẫy.', 'hint'),
      );
    if (run.status === 'choosing') {
      sheetContent.append(el('p', `Chọn một trong ${run.cards} lá. Có đúng một lá bẫy.`, 'hint'));
      const cards = el('div', undefined, 'beast-tower-cards');
      for (let card = 0; card < run.cards; card++) {
        const control = button(
          '✦',
          async () => {
            const result = await mutateBeast({
              operation: 'tower_pick',
              runVersion: run.version,
              card,
            });
            if (result && isCurrent()) openBeastTower();
          },
          'beast-tower-card',
        );
        control.setAttribute('aria-label', 'Lật lá ' + (card + 1));
        control.disabled = state.beastBusy || !!runtime.pendingBeast;
        cards.append(control);
      }
      sheetContent.append(cards);
    } else {
      sheetContent.append(
        button(
          'Dừng · Nhận ' + beastRewardLabel(run.atRisk),
          async () => {
            const result = await mutateBeast({ operation: 'tower_claim', runVersion: run.version });
            if (result && isCurrent()) openBeastTower();
          },
          'primary',
        ),
      );
      if (run.floor < 4)
        sheetContent.append(
          button(
            'Đi tiếp · ' + beastRewardLabel(run.nextReward),
            () =>
              confirm(
                'Đánh cược đi tiếp?',
                `Nếu gặp bẫy, cậu mất ${beastRewardLabel(run.atRisk)} chưa nhận của lượt này. Quà tầng sau thay thế quà hiện tại.`,
                async () => {
                  // Confirmation closes its sheet before invoking this action.
                  // Keep that identity so a newer sheet is never replaced.
                  const title = sheetContent.firstElementChild;
                  const result = await mutateBeast({
                    operation: 'tower_continue',
                    runVersion: run.version,
                  });
                  if (
                    result &&
                    state.loaded &&
                    state.live &&
                    sheetContent.firstElementChild === title
                  )
                    openBeastTower();
                },
              ),
            'secondary',
          ),
        );
    }
  }
  return {
    loadBeasts,
    loadTower,
    setBeastPanel,
    openBeastPicker,
    showBeast,
    openBeastExchange,
    openBeastRates,
    summonBeast,
    showBeastReveal,
    openBeastAlchemy,
    openBeastTower,
    recoverBeast,
    openBeastUltimate,
    chooseBeastReward,
    openBeastSummonChoice,
    openBeastDrawChoices,
    beastPending: () => !!runtime.pendingBeast,
    cancelBeastRole: async (role) => {
      const result = await mutateBeast({ operation: 'cancel', role });
      if (result) toast('Đã hủy lựa chọn đang chờ.');
    },
  };
}
