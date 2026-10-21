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
  beastSpecies,
  beastUltimateText,
  beastUltimateProgress,
  displayedRole,
  beastDiscovery,
  beastUltimateRules,
} from '../models/linh-thu.js';
import { beastJourney, beastAbilities, beastAbilityRoadmap } from '../views/linh-thu.js';
import { prefersReducedMotion } from '../core/experience.js';
import { createBeastReveal } from '../ui/beast-reveal.js';
import { createBeastEvolution } from '../ui/beast-evolution.js';
import { openBeastTowerSheet } from '../ui/beast-tower.js';

const pendingKey = 'minh-anh-beast-pending-v1';
export function createBeastActions(context) {
  const { state, runtime, render, toast, openSheet, closeSheet, sheetContent, confirm } = context;
  let activeReveal, activeEvolution;
  let generation = 0,
    speciesGeneration = 0,
    speciesLoading,
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
  // Warm current and pending role portraits, not the entire collection.
  async function prepareRoleImages(
    data,
    beasts = ['training', 'companion'].flatMap((role) => {
      const { current, displayed } = displayedRole(data, role);
      return [current, displayed];
    }),
  ) {
    await Promise.all(
      beasts.map(async (beast) => {
        if (!beast) return;
        const p = beastProgress(data, beast);
        const img = new Image();
        img.src = beastArtwork(p.species, p.form, false, p.perfect, undefined, p.awakened).src;
        let timer;
        try {
          await Promise.race([
            img.decode(),
            new Promise((resolve) => (timer = setTimeout(resolve, 2500))),
          ]);
        } catch {
          // Art failures must never prevent authoritative data from being shown.
        } finally {
          clearTimeout(timer);
        }
      }),
    );
  }
  async function readCollection(cursor = null, species = null) {
    const params = new URLSearchParams();
    if (cursor) params.set('cursor', cursor);
    if (species) params.set('species', species);
    const page = await liveRequest('linh-thu/collection' + (params.size ? '?' + params : ''));
    if (cursor && page.nextCursor === cursor)
      throw Error('Không thể tải tiếp bộ sưu tập. Cậu thử lại nhé.');
    return page;
  }
  function mergeCollection(previous, page) {
    return {
      ...page,
      beasts: [
        ...new Map([...(previous?.beasts ?? []), ...page.beasts].map((b) => [b.id, b])).values(),
      ],
    };
  }
  function invalidateSpeciesPage() {
    speciesGeneration++;
    speciesLoading = null;
    state.beastSpeciesPage = null;
    state.beastSpeciesLoading = false;
    state.beastSpeciesError = null;
  }
  async function loadBeastSpecies(more = false) {
    const species = state.beastCollectionSpecies;
    if (!state.live || !state.loaded || !species || state.beastPanel !== 'collection') return;
    const revision = runtime.revision;
    if (speciesLoading?.revision === revision) return speciesLoading.promise;
    const cursor = more ? state.beastSpeciesPage?.nextCursor : null;
    if (more && !cursor) return;
    const requestGeneration = ++speciesGeneration;
    const isCurrent = () =>
      requestGeneration === speciesGeneration &&
      revision === runtime.revision &&
      state.live &&
      state.loaded &&
      state.beastPanel === 'collection' &&
      state.beastCollectionSpecies === species;
    state.beastSpeciesLoading = true;
    state.beastSpeciesError = null;
    render();
    const promise = (async () => {
      try {
        const page = await readCollection(cursor, species);
        if (!isCurrent()) return;
        state.beastSpeciesPage = mergeCollection(more ? state.beastSpeciesPage : null, page);
      } catch (error) {
        if (isCurrent()) state.beastSpeciesError = error.message;
      } finally {
        if (requestGeneration === speciesGeneration) {
          speciesLoading = null;
          state.beastSpeciesLoading = false;
          render();
        }
      }
    })();
    speciesLoading = { revision, promise };
    return promise;
  }
  async function loadBeasts(more = false, scope = 'inventory') {
    if (scope === 'species') return loadBeastSpecies(more);
    if (!state.live || !state.loaded) return;
    if (loading && loadingRevision === runtime.revision) return loading;
    loadingRevision = runtime.revision;
    const requestGeneration = ++generation,
      revision = runtime.revision;
    const isCurrent = () =>
      requestGeneration === generation && revision === runtime.revision && state.loaded;
    state.beastLoading = true;
    if (!more) state.beastError = null;
    render();
    loading = (async () => {
      try {
        if (more) {
          const cursor = state.beastCollection?.nextCursor;
          if (!cursor) return;
          const page = await readCollection(cursor);
          if (requestGeneration !== generation || revision !== runtime.revision || !state.loaded)
            return;
          state.beastCollection = mergeCollection(state.beastCollection, page);
        } else {
          const [data, page] = await Promise.all([liveRequest('linh-thu'), readCollection()]);
          if (!isCurrent()) return;
          if (state.beastData && data.account.version < state.beastData.account.version) return;
          state.beastData = data;
          state.beastCollection = page;
          state.cultivation = mapAccount(data.wallet, state.day?.day);
          invalidateSpeciesPage();
          loadBeastSpecies();
          // Coalesce data reads only, not portrait warming. A focus refresh
          // must still fetch fresh data while an earlier portrait is pending.
          loading = null;
          // Publish data and usable controls immediately. Keep the update
          // indicator until role portraits are warm so rapid tab switches
          // retain decoded art; image completion never reapplies old data.
          render();
          await prepareRoleImages(data);
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
    const roleCandidate =
      input.operation === 'select'
        ? [
            ...(state.beastCollection?.beasts ?? []),
            ...(state.beastSpeciesPage?.beasts ?? []),
            ...(state.beastData?.selected ?? []),
          ].find((beast) => beast.id === input.beastId)
        : null;
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
    state.beastRoleSaving = ['select', 'cancel'].includes(input.operation);
    const sheetControls = [
      ...sheetContent.querySelectorAll('button:not([data-sheet-close]), input'),
    ].map((control) => ({ control, disabled: control.disabled }));
    for (const { control } of sheetControls) control.disabled = true;
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
      if (fields.operation.startsWith('tower_') && response.result?.tower) {
        state.beastTower = {
          ...state.beastTower,
          account: response.account,
          wallet: response.wallet,
          run: { ...response.result.tower, version: response.result.runVersion },
        };
      }
      result = response.result;
      if (input.operation === 'evolve' && result.attempt) applyEvolution(result);
      if (
        ['select', 'cancel'].includes(input.operation) &&
        state.beastData?.day?.day === input.day
      ) {
        const view = state.beastData;
        view.roles.pending = view.roles.pending.filter((role) => role.role !== input.role);
        if (input.operation === 'select' && result.scheduled && roleCandidate) {
          view.roles.pending.push({
            role: result.role,
            day: result.effectiveDay,
            beastId: result.beastId,
            attemptId: roleCandidate.attemptId,
          });
          view.selected = [
            ...view.selected.filter(
              (beast) =>
                beast.id !== roleCandidate.id || beast.attemptId !== roleCandidate.attemptId,
            ),
            roleCandidate,
          ];
        }
      }
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
      state.beastRoleSaving = false;
      for (const { control, disabled } of sheetControls)
        if (control.isConnected) control.disabled = disabled || !!runtime.pendingBeast;
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
    const recoverySheet = currentSheet();
    const recoveryWasOpen = context.sheet.open;
    const recoveryTitle = sheetContent.firstElementChild;
    const presentRecovered = (result) => {
      const unchangedPage =
        state.loaded &&
        state.live &&
        !context.sheet.open &&
        sheetContent.firstElementChild === recoveryTitle;
      if (
        (!pending.input.operation.startsWith('tower_') && pending.input.operation !== 'evolve') ||
        (recoveryWasOpen ? recoverySheet() : unchangedPage)
      )
        presentResult(pending.input.operation, result);
      else if (pending.input.operation === 'evolve') toast(`Đã tiến hóa lên T${result.form}.`);
    };
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
      presentRecovered(receipt.result);
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
      if (result) presentRecovered(result);
    }
  }
  function presentResult(operation, result) {
    if (operation === 'summon' || operation === 'choose_summon')
      result.choice ? openBeastSummonChoice(result.choice) : showBeastReveal(result);
    else if (operation.startsWith('tower_')) openBeastTower(result);
    else if (operation === 'craft') showAlchemyResult(result);
    else if (operation === 'evolve') showEvolutionResult(result);
    else toast('Đã lưu.');
  }
  function setBeastPanel(panel) {
    if (state.beastPanel === panel) return;
    state.beastPanel = panel;
    invalidateSpeciesPage();
    render();
    if (panel === 'collection') loadBeastSpecies();
  }
  function openBeastSpecies(speciesId) {
    if (speciesId && !(state.beastData?.speciesCounts?.[speciesId] > 0)) return;
    state.beastCollectionSpecies = speciesId;
    invalidateSpeciesPage();
    render();
    loadBeastSpecies();
  }
  function currentSheet() {
    const title = sheetContent.firstElementChild;
    return () =>
      state.loaded && state.live && context.sheet.open && sheetContent.firstElementChild === title;
  }
  function openBeastPicker(role) {
    openSheet(role === 'training' ? 'Chọn linh thú luyện' : 'Chọn linh thú đồng hành');
    const isCurrent = currentSheet();
    const { current, pending } = displayedRole(state.beastData, role);
    if (pending) {
      const cancel = button(
        'Hủy thay đổi',
        async () => {
          const result = await cancelBeastRole(role);
          if (result && isCurrent()) closeSheet();
        },
        'text-button beast-picker-cancel',
      );
      cancel.disabled = state.beastBusy || !!runtime.pendingBeast;
      sheetContent.append(cancel);
    }
    const list = el('div', undefined, 'beast-picker');
    const candidates = [
      ...new Map(
        [...(state.beastCollection?.beasts ?? []), current, pending]
          .filter(Boolean)
          .map((beast) => [beast.id, beast]),
      ).values(),
    ];
    for (const beast of candidates) {
      const progress = beastProgress(state.beastData, beast);
      const b = button(
        `${progress.species.forms[progress.form - 1]} · ${progress.species.rank}`,
        () => {
          const latest = displayedRole(state.beastData, role);
          if (latest.pending?.id === beast.id && latest.pending.attemptId === beast.attemptId) {
            closeSheet();
            return;
          }
          const same =
            latest.current?.id === beast.id && latest.current.attemptId === beast.attemptId;
          if (!latest.pending && same) {
            closeSheet();
            return;
          }
          void prepareRoleImages(state.beastData, [beast]);
          const previous = latest.current && beastProgress(state.beastData, latest.current);
          const description = same
            ? 'Hủy thay đổi đang chờ và giữ linh thú hiện tại.'
            : role === 'training'
              ? previous && latest.current.attempt.status === 'training'
                ? `Sang ngày mới, lượt luyện của ${previous.species.forms[previous.form - 1]} sẽ khóa tại tiến độ hiện có, giữ nguyên tạp chất. Muốn luyện lại cần Tịnh Linh Đan.`
                : 'Linh thú sẽ bắt đầu luyện từ ngày sinh hoạt kế tiếp.'
              : 'Linh thú sẽ hỗ trợ bạn từ ngày sinh hoạt kế tiếp.';
          openSheet(
            'Chọn ' +
              progress.species.forms[progress.form - 1] +
              ' · ' +
              beastIdentity(beast) +
              '?',
          );
          const isConfirmation = currentSheet();
          const actions = el('div', undefined, 'actions');
          actions.append(
            button(
              'Xác nhận',
              async () => {
                const result = await mutateBeast({ operation: 'select', role, beastId: beast.id });
                if (result) {
                  if (isConfirmation()) closeSheet();
                  toast(same ? 'Đã hủy thay đổi.' : 'Đã chọn linh thú. Có hiệu lực từ ngày mai.');
                }
              },
              'primary',
            ),
            button('Quay lại', () => openBeastPicker(role), 'secondary'),
          );
          sheetContent.append(
            el(
              'p',
              `${beastPoints(beast.attempt.earned)} điểm thực · ${beastPoints(beast.attempt.gray)} tạp chất · Độ thuần ${beastPurityLabel(progress)}.`,
              'hint',
            ),
            el('p', description, 'hint'),
            actions,
          );
        },
        'beast-picker-item',
      );
      b.dataset.beastId = beast.id;
      b.dataset.attemptId = beast.attemptId;
      const chosen = pending?.id === beast.id && pending.attemptId === beast.attemptId;
      b.setAttribute(
        'aria-pressed',
        String(
          chosen || (!pending && current?.id === beast.id && current.attemptId === beast.attemptId),
        ),
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
      if (chosen) copy.append(el('small', 'Đã chọn · Từ ngày mai', 'beast-picker-role'));
      b.replaceChildren(copy);
      b.prepend(
        portrait(progress.species, progress.form, true, progress.perfect, progress.awakened),
      );
      if (
        state.beastBusy ||
        runtime.pendingBeast ||
        (role === 'training' && ['sealed', 'completed'].includes(beast.attempt.status))
      )
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
  async function cancelBeastRole(role) {
    const result = await mutateBeast({ operation: 'cancel', role });
    if (result) toast('Đã hủy thay đổi.');
    return result;
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
  function applyEvolution(result) {
    const data = state.beastData;
    if (!data || !result.attempt) return;
    for (const entry of [
      ...data.selected,
      ...(state.beastCollection?.beasts ?? []),
      ...(state.beastSpeciesPage?.beasts ?? []),
    ])
      if (entry.id === result.beastId && entry.attemptId === result.attemptId)
        entry.attempt = result.attempt;
    data.discoveries ??= {};
    const history = data.discoveries[result.attempt.speciesId] ?? { form: 1 };
    const beast = {
      id: result.beastId,
      speciesId: result.attempt.speciesId,
      attempt: result.attempt,
    };
    const p = beastProgress(data, beast);
    data.discoveries[result.attempt.speciesId] = {
      form: Math.max(history.form, p.form),
      awakened: history.awakened || p.awakened,
      perfect: history.perfect || p.perfect,
    };
  }
  async function evolveBeast(beast) {
    if (state.beastBusy || runtime.saving || runtime.pendingBeast) return;
    if (!beastProgress(state.beastData, beast).canEvolve) return;
    const wasOpen = context.sheet.open,
      isCurrent = currentSheet();
    for (const control of sheetContent.querySelectorAll('.beast-evolve-button')) {
      control.textContent = 'Đang tiến hóa…';
      control.setAttribute('aria-busy', 'true');
    }
    const result = await mutateBeast({ operation: 'evolve', beastId: beast.id });
    if (wasOpen && isCurrent()) {
      for (const control of sheetContent.querySelectorAll('.beast-evolve-button')) {
        control.textContent = `Tiến hóa lên T${beastProgress(state.beastData, beast).form + 1}`;
        control.removeAttribute('aria-busy');
      }
    }
    if (result && state.tab === 'beasts' && (wasOpen ? isCurrent() : !context.sheet.open))
      showEvolutionResult(result);
    else if (result) toast(`Đã tiến hóa lên T${result.form}.`);
  }
  function showEvolutionResult(result) {
    applyEvolution(result);
    const data = state.beastData;
    const beast = [
      ...(data?.selected ?? []),
      ...(state.beastCollection?.beasts ?? []),
      ...(state.beastSpeciesPage?.beasts ?? []),
    ].find((entry) => entry.id === result.beastId && entry.attemptId === result.attemptId);
    if (!beast) {
      toast(`Đã tiến hóa lên T${result.form}.`);
      return;
    }
    const progress = beastProgress(data, beast);
    closeSheet();
    activeEvolution?.();
    const panel = state.beastPanel;
    const evolution = createBeastEvolution({
      data,
      result,
      progress,
      portrait,
      isCurrent: () => state.loaded && state.tab === 'beasts' && state.beastPanel === panel,
      onClose: () => {
        if (activeEvolution === evolution) activeEvolution = undefined;
      },
    });
    activeEvolution = evolution;
  }
  function showBeast(beast, previewForm, allSkills = false) {
    const data = state.beastData,
      progress = beastProgress(data, beast),
      species = progress.species;
    if (allSkills) {
      openSheet('Toàn bộ năng lực');
      context.sheet.classList.add('beast-sheet-open');
      sheetContent.append(
        el(
          'p',
          `${species.forms[progress.form - 1]} · ${species.rank} · T${progress.form}`,
          'beast-roadmap-intro',
        ),
        beastAbilityRoadmap(context.ui, data, beast),
      );
      return;
    }
    const form = [1, 2, 3, 4].includes(previewForm) ? previewForm : progress.form;
    const history = beastDiscovery(data, beast),
      known = form <= history.form;
    openSheet(known ? species.forms[form - 1] : `T${form} · Chưa khám phá`);
    context.sheet.classList.add('beast-sheet-open');
    const presentation = {
      ...context.ui,
      showBeast,
      evolveBeast,
      beastPending: () => !!runtime.pendingBeast,
    };
    const header = el('div', undefined, 'beast-detail-portrait');
    if (known) {
      const image = portrait(
        species,
        form,
        false,
        form === progress.form && progress.perfect,
        form === progress.form && progress.awakened,
      );
      image.className = 'beast-detail-image' + (form > progress.form ? ' is-discovered' : '');
      header.append(image);
    } else {
      const mystery = el('div', undefined, 'beast-detail-mystery');
      const journey = beastJourney(presentation, data, beast, form);
      mystery.append(journey.querySelector(`[data-form="${form}"] .beast-paw`));
      header.append(mystery, el('p', 'Tiến hóa để khám phá diện mạo này.', 'hint'));
    }
    header.append(
      el('p', `${species.rank} · T${form}`, 'beast-detail-meta'),
      el(
        'p',
        form === progress.form
          ? `${beastIdentity(beast)} · Dạng hiện tại`
          : form <= progress.form
            ? 'Dạng cá thể này đã đạt'
            : known
              ? 'Đã khám phá · Cá thể này chưa đạt'
              : '',
        'hint',
      ),
    );
    sheetContent.append(header, beastJourney(presentation, data, beast, form));
    sheetContent.append(beastAbilities(presentation, data, beast, form));
    if (['sealed', 'completed'].includes(beast.attempt.status))
      sheetContent.append(
        button(
          'Luyện lại bằng Tịnh Linh Đan',
          () => resetBeast(beast),
          'secondary beast-reset-button',
        ),
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
    if (beastUltimateRules[skill.kind])
      sheetContent.append(el('p', beastUltimateRules[skill.kind], 'beast-skill-description'));
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
  function openBeastSummonPool() {
    const catalog = state.beastData?.config.catalog;
    if (!catalog) return;
    openSheet('Linh thú có thể nhận');
    context.sheet.classList.add('beast-sheet-open');
    sheetContent.append(
      el(
        'p',
        'Mỗi lượt nhận một cá thể dạng I. Các loài trong cùng tư chất có tỷ lệ bằng nhau.',
        'hint',
      ),
    );
    const grid = el('div', undefined, 'beast-summon-pool');
    for (const species of catalog) {
      const card = el('div', undefined, 'beast-pool-card');
      card.dataset.rank = species.rank;
      card.append(
        el('small', species.rank),
        portrait(species, 1, true),
        el('strong', species.forms[0]),
      );
      grid.append(card);
    }
    sheetContent.append(grid);
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
        label.append(input, el('span', beastRewardLabel(reward)));
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
    activeReveal?.();
    const openedTab = state.tab;
    const openedPanel = state.beastPanel;
    const reveal = createBeastReveal({
      data,
      result,
      portrait,
      isCurrent: () => state.loaded && state.tab === openedTab && state.beastPanel === openedPanel,
      onClose: () => {
        if (activeReveal === reveal) activeReveal = undefined;
      },
    });
    activeReveal = reveal;
  }
  function openBeastAlchemy() {
    openSheet('Lò đan');
    context.sheet.classList.add('beast-sheet-open');
    const isCurrent = currentSheet();
    const alchemy = state.beastData?.account.state.alchemy;
    if (!alchemy) return;
    const ready = alchemy.days === 30,
      guaranteed = alchemy.failures >= 2;
    const overview = el('div', undefined, 'beast-alchemy-overview');
    const copy = el('div');
    copy.append(
      el('p', 'TỊNH LINH ĐAN', 'beast-eyebrow'),
      el('h3', ready ? 'Sẵn sàng luyện đan' : `Còn ${30 - alchemy.days} ngày đủ habit`),
      el('p', `${alchemy.days}/30 ngày`, 'beast-alchemy-count'),
    );
    overview.append(furnaceArt(ready ? 'ready' : 'idle'), copy);
    const progress = el('progress', undefined, 'beast-alchemy-progress');
    progress.max = 30;
    progress.value = alchemy.days;
    progress.setAttribute('aria-label', 'Tiến độ tích ngày luyện đan');
    const chance = el(
      'p',
      guaranteed ? 'Mẻ tiếp theo chắc chắn thành công' : 'Tỷ lệ thành công 40%',
      'beast-alchemy-chance',
    );
    if (guaranteed) chance.classList.add('is-guaranteed');
    const craft = button(
      'Luyện Tịnh Linh Đan',
      async () => {
        if (craft.disabled) return;
        craft.textContent = 'Đang luyện…';
        const result = await mutateBeast({ operation: 'craft' });
        if (result) {
          if (isCurrent()) showAlchemyResult(result);
          else
            toast(
              result.success
                ? 'Tịnh Linh Đan đã thành · Đã cất vào kho.'
                : 'Mẻ đan chưa thành · Đã giữ tiến độ bảo hiểm.',
            );
        } else if (isCurrent()) openBeastAlchemy();
      },
      'primary beast-alchemy-craft',
    );
    craft.disabled = !ready || state.beastBusy || !!runtime.pendingBeast;
    const stock = el('section', undefined, 'beast-alchemy-stock');
    stock.append(
      el('h3', 'Kho đan: ' + alchemy.inventory),
      el('p', 'Dùng 1 đan để mở lại lượt luyện của một linh thú.', 'hint'),
    );
    const use = button('Dùng đan · Chọn linh thú', openBeastElixirPicker, 'secondary');
    use.disabled = !alchemy.inventory || state.beastBusy || !!runtime.pendingBeast;
    stock.append(use);
    const rules = el('details', undefined, 'beast-alchemy-rules');
    rules.append(
      el('summary', 'Cách tích ngày & bảo hiểm'),
      el(
        'p',
        'Mỗi ngày đủ habit tích 1 ngày. Ngày nghỉ giữ tiến độ; ngày thiếu bắt đầu lại từ 0. Đủ 30 ngày sẽ giữ đến khi luyện.',
        'hint',
      ),
      el(
        'p',
        `Mỗi mẻ dùng trọn 30 ngày, kể cả khi thất bại. Hai mẻ thất bại liên tiếp thì mẻ thứ ba chắc chắn thành công. Đã thất bại: ${alchemy.failures}/2 mẻ.`,
        'hint',
      ),
    );
    sheetContent.append(overview, progress, chance, craft, stock, rules);
    if (runtime.pendingBeast)
      sheetContent.append(button('Kiểm tra kết quả trước', recoverBeast, 'primary'));
  }
  function openBeastElixirPicker() {
    openSheet('Chọn linh thú luyện lại');
    context.sheet.classList.add('beast-sheet-open');
    const isCurrent = currentSheet();
    const inventory = state.beastData?.account.state.alchemy.inventory ?? 0;
    sheetContent.append(el('p', `Kho đan: ${inventory} · Mỗi lượt dùng 1 đan`, 'hint'));
    const list = el('div', undefined, 'beast-elixir-picker');
    for (const beast of state.beastCollection?.beasts ?? [])
      if (['sealed', 'completed'].includes(beast.attempt.status)) {
        const p = beastProgress(state.beastData, beast);
        const control = button('', () => resetBeast(beast), 'beast-picker-item');
        const copy = el('span', undefined, 'beast-picker-copy');
        copy.append(
          el('strong', p.species.forms[p.form - 1]),
          el(
            'small',
            `${beastIdentity(beast)} · ${beast.attempt.status === 'sealed' ? 'Đã khóa lượt' : 'Hoàn tất'} · ${beastPurityLabel(p)}`,
          ),
          el('small', 'Dùng 1 đan', 'beast-picker-role'),
        );
        control.append(portrait(p.species, p.form, true, p.perfect, p.awakened), copy);
        control.disabled = !inventory || state.beastBusy || !!runtime.pendingBeast;
        list.append(control);
      }
    sheetContent.append(list);
    if (!list.childElementCount)
      sheetContent.append(
        el(
          'p',
          state.beastCollection?.nextCursor
            ? 'Chưa có linh thú phù hợp trong trang này. Tải thêm để tìm tiếp.'
            : 'Chưa có linh thú đã khóa lượt hoặc hoàn tất để luyện lại.',
          'beast-empty-note',
        ),
      );
    if (state.beastCollection?.nextCursor) {
      const more = button(
        'Tải thêm linh thú',
        async () => {
          more.disabled = true;
          more.textContent = 'Đang tải…';
          await loadBeasts(true);
          if (isCurrent()) {
            openBeastElixirPicker();
            if (state.beastError) toast(state.beastError);
          }
        },
        'secondary',
      );
      sheetContent.append(more);
    }
    sheetContent.append(button('Trở lại Lò đan', openBeastAlchemy, 'text-button'));
  }
  function showAlchemyResult(result) {
    openSheet('Linh khí đang kết tụ');
    context.sheet.classList.add('beast-sheet-open');
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
            ? 'Đã thêm 1 đan vào kho. Cậu có thể chọn linh thú để luyện lại.'
            : `Đã dùng 30 ngày. Bảo hiểm: ${state.beastData?.account.state.alchemy.failures ?? 0}/2 mẻ thất bại.`,
          'hint',
        ),
        button('Trở lại Lò đan', openBeastAlchemy, 'primary'),
      );
      if (result.success)
        stage.append(button('Chọn linh thú luyện lại', openBeastElixirPicker, 'secondary'));
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
      `Dùng 1 Tịnh Linh Đan để trở về dạng I, xóa ${beastPoints(beast.attempt.earned)} điểm thực và ${beastPoints(beast.attempt.gray)} tạp chất. Tuyệt kỹ của cá thể này sẽ bị hủy. Không tự đổi linh thú đang luyện.`,
      async () => {
        const result = await mutateBeast({ operation: 'reset', beastId: beast.id });
        if (result) toast('Đã mở một lượt luyện mới từ dạng I.');
      },
    );
  }
  async function openBeastTower(confirmedResult = null) {
    return openBeastTowerSheet({
      context,
      loadTower,
      mutateBeast,
      currentSheet,
      recoverBeast,
      confirmedClaim: confirmedResult?.tower?.status === 'claimed' ? confirmedResult : null,
    });
  }

  return {
    loadBeasts,
    loadTower,
    setBeastPanel,
    openBeastSpecies,
    openBeastPicker,
    showBeast,
    evolveBeast,
    openBeastExchange,
    openBeastRates,
    openBeastSummonPool,
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
    cancelBeastRole,
  };
}
