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
import {
  beastJourney,
  beastAbilities,
  beastAbilityRoadmap,
  beastCollectionCard,
  beastProtectionButton,
  updateBeastProtectionButton,
} from '../views/linh-thu.js';
import { prefersReducedMotion } from '../core/experience.js';
import { createBeastReveal } from '../ui/beast-reveal.js';
import { createBeastEvolution } from '../ui/beast-evolution.js';
import { openBeastTowerSheet } from '../ui/beast-tower.js';
import { beastSkillsV2 } from '../models/linh-thu-v2.js';

const pendingKey = 'minh-anh-beast-pending-v1';
export function createBeastActions(context) {
  const { state, runtime, render, toast, openSheet, closeSheet, sheetContent, confirm } = context;
  let activeReveal, activeEvolution;
  // Only one account version can commit at a time. Coalesce each individual's
  // latest desired value while acknowledging its star without rebuilding cards.
  const protectionChanges = new Map();
  state.beastProtectionChanges = protectionChanges;
  let protectionSaving = false,
    protectionReconciling = false;
  let previewGeneration = 0,
    previewLoading,
    trainingDayTimer;
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
  async function readCollection(cursor = null, species = null, purpose = null) {
    const params = new URLSearchParams();
    if (cursor) params.set('cursor', cursor);
    if (species) params.set('species', species);
    if (purpose) params.set('purpose', purpose);
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
  function scheduleTrainingDay(data) {
    clearTimeout(trainingDayTimer);
    if (!data.day || !Number.isFinite(data.day.endAt) || !Number.isFinite(data.now)) return;
    trainingDayTimer = setTimeout(
      () => {
        if (!state.loaded || state.beastData !== data) return;
        data.trainingPreview = null;
        render();
        if (state.tab === 'beasts' && document.visibilityState === 'visible' && !runtime.saving)
          loadBeasts();
      },
      Math.max(1, Math.min(2147483647, data.day.endAt - data.now + 30)),
    );
  }
  async function loadBeastTrainingPreview(invalidate = false) {
    if (!state.live || !state.loaded || !state.beastData) return;
    const data = state.beastData,
      revision = runtime.revision;
    if (!invalidate && previewLoading?.data === data && previewLoading.revision === revision)
      return previewLoading.promise;
    const requestGeneration = ++previewGeneration;
    if (invalidate) {
      data.trainingPreview = null;
      render();
    }
    const isCurrent = () =>
      requestGeneration === previewGeneration &&
      revision === runtime.revision &&
      state.loaded &&
      state.beastData === data;
    const promise = (async () => {
      try {
        const startedAt = Date.now();
        // A newer base needs its own read even while transport coalesces older GETs.
        const result = await liveRequest(
          `linh-thu/training-preview?revision=${revision}&generation=${requestGeneration}`,
        );
        if (isCurrent()) data.trainingPreview = { ...result, receivedAt: startedAt };
      } catch {
        if (isCurrent()) data.trainingPreview = null;
      } finally {
        if (requestGeneration === previewGeneration) previewLoading = null;
        if (isCurrent()) render();
      }
    })();
    previewLoading = { data, revision, promise };
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
          data.trainingPreview = state.beastData?.trainingPreview ?? null;
          state.beastData = data;
          scheduleTrainingDay(data);
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
          await Promise.all([prepareRoleImages(data), loadBeastTrainingPreview()]);
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
    if (runtime.saving) {
      if (protectionSaving) toast('Đang lưu dấu sao. Chờ lưu xong rồi thực hiện thao tác này nhé.');
      return null;
    }
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
        // Routine star writes use their own queue. This path also handles a
        // recovered receipt, whose optimistic snapshot must be reconciled.
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
      if (pending.input.operation === 'sacrifice') {
        presentResult('sacrifice', result, recoveryWasOpen ? recoverySheet() : unchangedPage);
        return;
      }
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
      if (pending.input.operation === 'protect') protectionChanges.clear();
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
      if (pending.input.operation === 'protect') protectionChanges.clear();
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
  function presentResult(operation, result, mayReplaceSheet = true) {
    if (operation === 'summon' || operation === 'choose_summon')
      result.choice ? openBeastSummonChoice(result.choice) : showBeastReveal(result);
    else if (operation.startsWith('tower_')) openBeastTower(result);
    else if (operation === 'craft') showAlchemyResult(result);
    else if (operation === 'evolve') showEvolutionResult(result);
    else if (operation === 'sacrifice') {
      state.beastSacrifice = null;
      if (mayReplaceSheet && context.sheet.open) openBeastExchange('sacrifice');
      toast(
        `Đã hiến tế ${result.sacrificedIds.length} cá thể, nhận ${result.tickets} vé triệu hồi. Dư ${result.remainder} điểm.`,
      );
    } else if (operation === 'protect')
      toast(result.isProtected ? 'Đã bảo vệ linh thú.' : 'Đã bỏ bảo vệ linh thú.');
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
    if (
      speciesId &&
      !(state.beastData?.speciesCounts?.[speciesId] > 0) &&
      !state.beastData?.discoveries?.[speciesId]
    )
      return;
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
  function showBeast(beast, previewForm, allSkills = false, onBack = null) {
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
    const skillsV2 = beastSkillsV2(data, beast);
    if (skillsV2) sheetContent.append(el('p', skillsV2.summary, 'beast-skill-description'));
    if (onBack)
      sheetContent.append(
        button('‹ Quay lại hiến tế', onBack, 'text-button beast-collection-back'),
      );
    const presentation = {
      ...context.ui,
      showBeast: (entry, form, skills) => showBeast(entry, form, skills, onBack),
      evolveBeast,
      beastPending: () => !!runtime.pendingBeast,
    };
    const header = el('div', undefined, 'beast-detail-portrait');
    const identityRow = el('div', undefined, 'beast-detail-identity-row');
    const identityCopy = el('div');
    identityCopy.append(
      el(
        'p',
        `${beastIdentity(beast)} · ${form === progress.form ? 'Dạng hiện tại' : form <= progress.form ? 'Dạng cá thể này đã đạt' : known ? 'Đã khám phá · Cá thể này chưa đạt' : 'Chưa khám phá'}`,
        'hint',
      ),
      el('p', `${species.rank} · T${form}`, 'beast-detail-meta'),
    );
    identityRow.append(identityCopy, beastProtectionButton(context.ui, state, beast));
    header.append(identityRow);
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
  function applyProtectionValue(beast, value) {
    beast.isProtected = value;
    if (state.beastSacrifice) {
      state.beastSacrifice.generation++;
      state.beastSacrifice.loading = false;
      state.beastSacrifice.pages.clear();
      state.beastSacrifice.availableCounts = null;
      if (value) state.beastSacrifice.selected.delete(beast.id);
    }
    for (const entry of [
      ...(state.beastSpeciesPage?.beasts ?? []),
      ...(state.beastCollection?.beasts ?? []),
      ...(state.beastData?.selected ?? []),
      ...Object.values(state.beastData?.collectionOverview ?? {}).map((entry) => entry.best),
    ])
      if (entry.id === beast.id) entry.isProtected = value;
    for (const star of /** @type {NodeListOf<HTMLButtonElement>} */ (
      document.querySelectorAll(`.beast-protection[data-protection-id="${CSS.escape(beast.id)}"]`)
    )) {
      updateBeastProtectionButton(star, beast, protectionChanges.get(beast.id));
      if (star.dataset.protectionReadonly !== 'true') star.disabled = protectionReconciling;
    }
  }
  function protectionFeedback(message, unconfirmed = false) {
    const root =
      context.sheet.open && sheetContent.querySelector('.beast-detail-identity-row')
        ? sheetContent.querySelector('.beast-detail-identity-row')
        : context.content.querySelector('.beast-collection-heading');
    document.querySelectorAll('.beast-protection-feedback').forEach((node) => node.remove());
    const feedback = el('div', undefined, 'beast-protection-feedback');
    feedback.setAttribute('role', 'status');
    feedback.append(el('span', message));
    if (unconfirmed) feedback.append(button('Kiểm tra kết quả', recoverBeast, 'text-button'));
    if (root) root.after(feedback);
    else toast(message);
  }
  function toggleBeastProtection(beast) {
    if (!state.live || !state.loaded || !state.beastData) {
      toast('Mở ứng dụng đã đăng nhập để sử dụng.');
      return false;
    }
    if (
      protectionReconciling ||
      (!protectionSaving && (runtime.saving || runtime.pendingBeast || runtime.pendingDraw))
    ) {
      toast('Có thao tác chưa xác nhận. Kiểm tra kết quả trước nhé.');
      return false;
    }
    const change = protectionChanges.get(beast.id) ?? {
      beast,
      confirmed: !!beast.isProtected,
      desired: !!beast.isProtected,
      status: 'queued',
    };
    change.desired = !change.desired;
    if (change.status !== 'saving') change.status = 'queued';
    protectionChanges.set(beast.id, change);
    applyProtectionValue(beast, change.desired);
    document.querySelectorAll('.beast-protection-feedback').forEach((node) => node.remove());
    void saveProtectionChanges();
    return true;
  }
  async function saveProtectionChanges() {
    if (protectionSaving) return;
    protectionSaving = true;
    state.beastProtectionSaving = true;
    runtime.saving = true;
    try {
      while (protectionChanges.size && state.live && state.loaded) {
        const [beastId, change] = protectionChanges.entries().next().value;
        if (change.desired === change.confirmed) {
          protectionChanges.delete(beastId);
          applyProtectionValue(change.beast, change.confirmed);
          continue;
        }
        const sentValue = change.desired;
        change.status = 'saving';
        applyProtectionValue(change.beast, change.desired);
        const data = state.beastData;
        const input = {
          operation: 'protect',
          beastId,
          isProtected: sentValue,
          day: data.day?.day,
          version: data.account.version,
        };
        const id = requestIdentity('linh-thu', input);
        runtime.pendingBeast = { input, id };
        persistPending(runtime.pendingBeast);
        const revision = ++runtime.revision;
        let failure;
        try {
          const response = await liveRequest('linh-thu', input);
          if (revision !== runtime.revision || !state.loaded || !state.live) {
            // A newer session/page cannot adopt this response. Retain the receipt
            // intent, then reconcile before allowing any other business write.
            failure = {
              code: 'NETWORK_UNCONFIRMED',
              message: 'Chưa xác nhận lưu dấu sao. Kiểm tra kết quả để tiếp tục.',
            };
          } else {
            clearPending();
            state.beastData.account = response.account;
            state.beastData.wallet = response.wallet;
            state.cultivation = mapAccount(response.wallet, state.day?.day);
            change.confirmed = response.result.isProtected;
            if (change.desired === change.confirmed) protectionChanges.delete(beastId);
            else change.status = 'queued';
            applyProtectionValue(change.beast, change.desired);
            state.beastError = null;
          }
        } catch (error) {
          failure = error;
        }
        if (failure) {
          protectionReconciling = true;
          const unconfirmed =
            !failure.code ||
            ['NETWORK_UNCONFIRMED', 'OPERATION_NOT_CONFIRMED'].includes(failure.code);
          if (!unconfirmed) clearPending();
          const queued = [...protectionChanges.values()];
          protectionChanges.clear();
          if (unconfirmed) {
            change.desired = sentValue;
            change.status = 'unconfirmed';
            protectionChanges.set(beastId, change);
          }
          for (const other of queued)
            applyProtectionValue(
              other.beast,
              unconfirmed && other === change ? sentValue : other.confirmed,
            );
          const message = unconfirmed
            ? 'Chưa xác nhận lưu dấu sao. Kiểm tra kết quả trước khi tiếp tục.'
            : failure.message;
          state.beastError = message;
          protectionFeedback(message, unconfirmed);
          if (!unconfirmed && ['BEAST_CHANGED', 'BEAST_DAY_CLOSED'].includes(failure.code)) {
            // Read a new version before the next queued intent; never replay a
            // rejected request using a different body or receipt identity.
            try {
              const fresh = await liveRequest('linh-thu');
              if (state.loaded && revision === runtime.revision) {
                state.beastData.account = fresh.account;
                state.beastData.day = fresh.day;
                let cursor = null;
                do {
                  const page = await readCollection(cursor, change.beast.speciesId);
                  if (!state.loaded || revision !== runtime.revision) break;
                  const current = page.beasts.find((entry) => entry.id === beastId);
                  if (current) {
                    applyProtectionValue(change.beast, !!current.isProtected);
                    break;
                  }
                  cursor = page.nextCursor;
                } while (cursor);
              }
            } catch {
              /* The next interaction can retry after connectivity returns. */
            }
          }
          break;
        }
      }
    } finally {
      protectionSaving = false;
      protectionReconciling = false;
      state.beastProtectionSaving = false;
      runtime.saving = false;
      for (const star of /** @type {NodeListOf<HTMLButtonElement>} */ (
        document.querySelectorAll('.beast-protection')
      ))
        star.disabled =
          !!runtime.pendingBeast || !!state.beastBusy || star.dataset.protectionReadonly === 'true';
      if (
        state.loaded &&
        !runtime.pendingBeast &&
        state.beastPanel === 'collection' &&
        state.beastCollectionSpecies &&
        !state.beastSpeciesPage
      )
        void loadBeastSpecies();
    }
  }
  function openBeastExchange(tab = 'exchange') {
    tab = tab === 'sacrifice' ? 'sacrifice' : 'exchange';
    const switching =
      context.sheet.open && context.sheet.classList.contains('beast-exchange-sheet');
    if (switching) {
      for (const panel of sheetContent.querySelectorAll('.beast-exchange-panel, .beast-sacrifice'))
        panel.remove();
    } else openSheet('Đổi vé triệu hồi');
    context.sheet.classList.add('beast-sheet-open', 'beast-exchange-sheet');
    if (!switching) buildExchangeTabs();
    for (const control of sheetContent.querySelectorAll('[data-exchange-tab]')) {
      const selected = control.dataset.exchangeTab === tab;
      control.setAttribute('aria-selected', String(selected));
      control.tabIndex = selected ? 0 : -1;
      control.disabled = state.beastBusy || !!runtime.pendingBeast;
    }
    if (switching)
      sheetContent.querySelector(`[data-exchange-tab="${tab}"]`)?.focus({ preventScroll: true });
    if (tab === 'sacrifice') return renderBeastSacrifice();
    const panel = el('div', undefined, 'beast-exchange-panel');
    sheetContent.append(panel);
    const isCurrent = currentSheet();
    panel.append(
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
    panel.append(amount.wrap, cost, exchange);
  }

  function buildExchangeTabs() {
    const tabs = el('div', undefined, 'beast-exchange-tabs');
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', 'Cách đổi vé triệu hồi');
    for (const [id, label] of [
      ['exchange', 'Đổi vé'],
      ['sacrifice', 'Hiến tế'],
    ]) {
      const control = button(label, () => openBeastExchange(id), 'beast-exchange-tab');
      control.dataset.exchangeTab = id;
      control.setAttribute('role', 'tab');
      control.addEventListener('keydown', (event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key) || control.disabled)
          return;
        event.preventDefault();
        const next =
          event.key === 'Home'
            ? 'exchange'
            : event.key === 'End'
              ? 'sacrifice'
              : id === 'exchange'
                ? 'sacrifice'
                : 'exchange';
        openBeastExchange(next);
        sheetContent.querySelector(`[data-exchange-tab="${next}"]`)?.focus({ preventScroll: true });
      });
      control.disabled = state.beastBusy || !!runtime.pendingBeast;
      tabs.append(control);
    }
    sheetContent.append(tabs);
  }

  function sacrificeDraft() {
    return (state.beastSacrifice ??= {
      selected: new Map(),
      pages: new Map(),
      availableCounts: null,
      screen: 'summary',
      species: null,
      rank: 'all',
      loading: false,
      error: null,
      generation: 0,
    });
  }
  function sacrificeQuote() {
    const selected = [...sacrificeDraft().selected.values()];
    const config = state.beastData.config;
    const values = config.sacrificePoints ?? { R: 1, SR: 1, SSR: 2, UR: 3 };
    const cost = config.sacrificeCost ?? 10;
    const points = selected.reduce(
      (sum, beast) => sum + values[beastSpecies(state.beastData, beast.speciesId).rank],
      0,
    );
    const previous = state.beastData.account.state.sacrificePoints ?? 0;
    return {
      selected,
      points,
      previous,
      tickets: Math.floor((points + previous) / cost),
      remainder: (points + previous) % cost,
      cost,
    };
  }
  async function loadSacrificeSpecies(more = false) {
    const draft = sacrificeDraft(),
      species = draft.species;
    if (draft.loading || !state.live || !state.loaded) return;
    const page = draft.pages.get(species),
      cursor = more ? page?.nextCursor : null;
    if (more && !cursor) return;
    const token = ++draft.generation,
      isCurrent = currentSheet();
    draft.loading = true;
    draft.error = null;
    renderBeastSacrifice();
    try {
      const result = await readCollection(cursor, species, 'sacrifice');
      if (draft !== state.beastSacrifice || token !== draft.generation) return;
      if (result.day !== undefined && result.day !== state.beastData.day.day)
        throw Error('Ngày hoạt động vừa thay đổi. Đóng cửa sổ và tải lại để tiếp tục.');
      draft.availableCounts = result.availableCounts ?? {};
      if (species) draft.pages.set(species, mergeCollection(more ? page : null, result));
      for (const beast of result.beasts) {
        if (!draft.selected.has(beast.id)) continue;
        if (beast.isProtected || beast.sacrificeBlockedReason) draft.selected.delete(beast.id);
        else draft.selected.set(beast.id, beast);
      }
    } catch (error) {
      if (token === draft.generation) draft.error = error.message;
    } finally {
      if (token === draft.generation) {
        draft.loading = false;
        if (isCurrent() || sheetContent.querySelector('.beast-sacrifice')) renderBeastSacrifice();
      }
    }
  }
  function renderBeastSacrifice() {
    if (
      !context.sheet.open ||
      !sheetContent.querySelector('[data-exchange-tab="sacrifice"][aria-selected="true"]')
    )
      return;
    const draft = sacrificeDraft(),
      quote = sacrificeQuote(),
      data = state.beastData;
    const old = sheetContent.querySelector('.beast-sacrifice');
    const focusedBeast = old?.contains(document.activeElement)
      ? document.activeElement.closest('.beast-collection-card')?.getAttribute('data-beast-id')
      : null;
    const focusedControl = old?.contains(document.activeElement)
      ? document.activeElement
          .closest('[data-sacrifice-focus]')
          ?.getAttribute('data-sacrifice-focus')
      : null;
    const previousScroll = old?.querySelector('.beast-sacrifice-body')?.scrollTop ?? 0;
    const previousOuterScroll = old?.scrollTop ?? 0;
    const root = el('div', undefined, 'beast-sacrifice');
    root.dataset.screen = draft.screen;
    root.dataset.species = draft.species ?? '';
    root.dataset.rank = draft.rank;
    const body = el('div', undefined, 'beast-sacrifice-body');
    if (draft.screen !== 'picker') {
      body.append(
        el(
          'p',
          '10 điểm hiến tế = 1 vé triệu hồi. R / SR: 1 điểm · SSR: 2 điểm · UR: 3 điểm.',
          'hint',
        ),
        el('p', `Điểm đang tích lũy: ${quote.previous}/${quote.cost}`, 'beast-sacrifice-balance'),
      );
    }
    const blocked = state.beastBusy || !!runtime.pendingBeast;
    if (runtime.pendingBeast) {
      body.append(
        el('p', 'Có thao tác chưa xác nhận. Kiểm tra kết quả trước khi tiếp tục.', 'hint'),
        button('Kiểm tra kết quả', recoverBeast, 'secondary'),
      );
    }
    if (draft.screen === 'summary') {
      const choose = button(
        quote.selected.length ? 'Chọn thêm linh thú' : 'Chọn linh thú',
        () => {
          draft.screen = 'picker';
          draft.species = null;
          renderBeastSacrifice();
          loadSacrificeSpecies();
        },
        'secondary beast-sacrifice-choose',
      );
      choose.dataset.sacrificeFocus = 'choose';
      choose.disabled = blocked;
      body.append(
        choose,
        el('p', 'Linh thú sao vàng và cá thể đang được sử dụng không thể hiến tế.', 'hint'),
      );
      if (quote.selected.length) body.append(sacrificeSelectedList());
    } else if (draft.screen === 'picker') {
      // Keep navigation outside the changing list, including empty rarity results.
      const navigation = el('div', undefined, 'beast-sacrifice-navigation');
      root.append(navigation);
      const back = button(
        draft.species ? '‹ Các loài linh thú' : '‹ Quay lại',
        () => {
          if (draft.loading) {
            draft.generation++;
            draft.loading = false;
          }
          if (draft.species) draft.species = null;
          else draft.screen = 'summary';
          renderBeastSacrifice();
        },
        'text-button beast-collection-back',
      );
      back.dataset.sacrificeFocus = 'back';
      back.disabled = blocked;
      navigation.append(back);
      if (!draft.species) {
        const filters = el('div', undefined, 'beast-sacrifice-filters');
        filters.setAttribute('aria-label', 'Lọc phẩm cấp');
        for (const rank of ['all', 'R', 'SR', 'SSR', 'UR']) {
          const filter = button(
            rank === 'all' ? 'Tất cả' : rank,
            () => {
              draft.rank = rank;
              renderBeastSacrifice();
            },
            'secondary',
          );
          filter.dataset.sacrificeFocus = 'rank-' + rank;
          filter.setAttribute('aria-pressed', String(draft.rank === rank));
          filter.disabled = blocked;
          filters.append(filter);
        }
        navigation.append(filters);
        const atlas = el('div', undefined, 'beast-atlas');
        for (const species of data.config.catalog) {
          if (draft.rank !== 'all' && draft.rank !== species.rank) continue;
          const count = data.speciesCounts?.[species.id] ?? 0;
          if (!count) continue;
          const available = draft.availableCounts?.[species.id];
          const entry = button(
            '',
            () => {
              draft.species = species.id;
              renderBeastSacrifice();
              loadSacrificeSpecies();
            },
            'beast-atlas-entry',
          );
          entry.dataset.rank = species.rank;
          entry.dataset.species = species.id;
          entry.disabled = blocked || draft.loading;
          entry.append(
            el('span', species.rank, 'beast-atlas-rank'),
            portrait(species, 1, true),
            el('strong', species.title),
            el(
              'small',
              available === undefined ? 'Đang kiểm tra…' : `${available}/${count} có thể hiến tế`,
            ),
          );
          atlas.append(entry);
        }
        body.append(atlas);
        if (!atlas.childElementCount)
          body.append(el('p', 'Chưa có cá thể thuộc phẩm cấp này.', 'hint'));
      } else {
        const species = beastSpecies(data, draft.species),
          page = draft.pages.get(draft.species);
        body.append(el('h3', species.title));
        const grid = el('div', undefined, 'beast-collection-grid');
        for (const beast of page?.beasts ?? []) {
          const rank = beastSpecies(data, beast.speciesId).rank;
          grid.append(
            beastCollectionCard(context.ui, state, beast, {
              selected: draft.selected.has(beast.id),
              points: (data.config.sacrificePoints ?? { R: 1, SR: 1, SSR: 2, UR: 3 })[rank],
              blockedReason: beast.isProtected
                ? 'Đã đánh dấu bảo vệ'
                : beast.sacrificeBlockedReason,
              onSelect: (entry) => {
                if (draft.selected.has(entry.id)) draft.selected.delete(entry.id);
                else {
                  if (draft.selected.size >= (data.config.sacrificeLimit ?? 24)) {
                    toast('Mỗi lần chọn tối đa 24 cá thể.');
                    return;
                  }
                  draft.selected.set(entry.id, entry);
                }
                renderBeastSacrifice();
              },
              onDetails: (entry) =>
                showBeast(entry, undefined, false, () => {
                  openBeastExchange('sacrifice');
                  loadSacrificeSpecies();
                }),
            }),
          );
        }
        body.append(grid);
        if (!draft.loading && !page?.beasts.length && !draft.error)
          body.append(el('p', 'Không còn cá thể trong loài này.', 'hint'));
        if (page?.nextCursor) {
          const more = button('Tải tiếp các cá thể', () => loadSacrificeSpecies(true), 'secondary');
          more.dataset.sacrificeFocus = 'more';
          more.disabled = draft.loading || blocked;
          body.append(more);
        }
      }
    } else if (draft.screen === 'review') {
      body.append(el('h3', `Hiến tế ${quote.selected.length} cá thể?`));
      const ranks = {};
      for (const beast of quote.selected) {
        const rank = beastSpecies(data, beast.speciesId).rank;
        ranks[rank] = (ranks[rank] ?? 0) + 1;
      }
      body.append(
        el(
          'p',
          Object.entries(ranks)
            .map(([rank, count]) => `${count} ${rank}`)
            .join(' · '),
          'hint',
        ),
      );
      const warnings = [];
      if (
        quote.selected.some((beast) =>
          ['SSR', 'UR'].includes(beastSpecies(data, beast.speciesId).rank),
        )
      )
        warnings.push('Có cá thể SSR / UR.');
      if (
        quote.selected.some(
          (beast) =>
            beast.attempt.earned > 0 ||
            beast.attempt.gray > 0 ||
            beastProgress(data, beast).form > 1,
        )
      )
        warnings.push(
          'Có cá thể đã luyện hoặc tiến hóa. Toàn bộ tiến trình luyện của chúng sẽ mất.',
        );
      const selectedCounts = {};
      for (const beast of quote.selected)
        selectedCounts[beast.speciesId] = (selectedCounts[beast.speciesId] ?? 0) + 1;
      if (Object.entries(selectedCounts).some(([id, count]) => count >= data.speciesCounts[id]))
        warnings.push('Có loài sẽ không còn cá thể đang sở hữu. Lịch sử khám phá vẫn được giữ.');
      body.append(
        el('p', 'Các cá thể đã hiến tế sẽ bị tiêu hao vĩnh viễn.', 'beast-sacrifice-warning'),
      );
      for (const warning of warnings) body.append(el('p', warning, 'beast-sacrifice-warning'));
      body.append(sacrificeSelectedList());
      const cancel = button(
        '‹ Quay lại lựa chọn',
        () => {
          draft.screen = 'summary';
          renderBeastSacrifice();
        },
        'text-button',
      );
      cancel.disabled = blocked;
      body.append(cancel);
    }
    if (draft.loading) body.append(el('p', 'Đang kiểm tra các cá thể…', 'hint'));
    if (draft.error)
      body.append(
        el('p', draft.error, 'beast-sacrifice-warning'),
        button('Thử lại', () => loadSacrificeSpecies(), 'secondary'),
      );
    const footer = el('div', undefined, 'beast-sacrifice-footer');
    const status = el(
      'p',
      `Đã chọn ${quote.selected.length} cá thể · ${quote.points} điểm`,
      'beast-sacrifice-total',
    );
    status.setAttribute('role', 'status');
    const quoteLine = el('p', undefined, 'beast-sacrifice-quote');
    quoteLine.append(
      el('span', `${quote.previous} điểm sẵn có · `),
      el(
        'span',
        quote.tickets
          ? `Nhận ${quote.tickets} vé triệu hồi · Còn dư ${quote.remainder} điểm`
          : `Cần thêm ${quote.cost - quote.previous - quote.points} điểm để đổi 1 vé`,
        'beast-sacrifice-result',
      ),
    );
    footer.append(status, quoteLine);
    const submit = button(
      draft.screen === 'review' ? `Hiến tế ${quote.selected.length} cá thể` : 'Xem lại hiến tế',
      async () => {
        if (submit.disabled) return;
        if (draft.screen !== 'review') {
          draft.screen = 'review';
          renderBeastSacrifice();
          sheetContent.querySelector('.beast-sacrifice-body').scrollTop = 0;
          return;
        }
        const isCurrent = currentSheet();
        const result = await mutateBeast({
          operation: 'sacrifice',
          beastIds: quote.selected.map((beast) => beast.id).sort(),
        });
        if (result) {
          state.beastSacrifice = null;
          if (isCurrent()) openBeastExchange('sacrifice');
          toast(
            `Đã hiến tế ${result.sacrificedIds.length} cá thể, nhận ${result.tickets} vé triệu hồi. Dư ${result.remainder} điểm.`,
          );
        } else if (isCurrent()) {
          if (!runtime.pendingBeast) {
            draft.screen = 'summary';
            draft.selected.clear();
            draft.pages.clear();
            draft.availableCounts = null;
          }
          renderBeastSacrifice();
        }
      },
      'primary beast-sacrifice-submit',
    );
    submit.dataset.sacrificeFocus = 'submit';
    submit.disabled = blocked || draft.loading || !quote.selected.length || quote.tickets < 1;
    footer.append(submit);
    root.append(body, footer);
    if (old) old.replaceWith(root);
    else sheetContent.append(root);
    if (
      old?.dataset.screen === root.dataset.screen &&
      old?.dataset.species === root.dataset.species
    ) {
      if (old?.dataset.rank === root.dataset.rank) body.scrollTop = previousScroll;
      root.scrollTop = previousOuterScroll;
    }
    if (focusedControl)
      root
        .querySelector(`[data-sacrifice-focus="${CSS.escape(focusedControl)}"]`)
        ?.focus({ preventScroll: true });
    if (focusedBeast)
      root
        .querySelector(`.beast-collection-card[data-beast-id="${CSS.escape(focusedBeast)}"]`)
        ?.focus({ preventScroll: true });
  }
  function sacrificeSelectedList() {
    const draft = sacrificeDraft(),
      list = el('div', undefined, 'beast-sacrifice-selected');
    for (const beast of draft.selected.values()) {
      const p = beastProgress(state.beastData, beast);
      const row = el('div', undefined, 'beast-sacrifice-row');
      const copy = el('div');
      copy.append(
        el('strong', `${p.species.forms[p.form - 1]} · ${beastIdentity(beast)}`),
        el('small', `${p.species.rank} · Dạng ${p.form} · ${beastPurityLabel(p)}`),
      );
      const remove = button(
        'Bỏ chọn',
        () => {
          draft.selected.delete(beast.id);
          renderBeastSacrifice();
        },
        'text-button',
      );
      remove.disabled = state.beastBusy || !!runtime.pendingBeast;
      remove.setAttribute(
        'aria-label',
        `Bỏ chọn ${p.species.forms[p.form - 1]} ${beastIdentity(beast)}`,
      );
      row.append(portrait(p.species, p.form, true, p.perfect, p.awakened), copy, remove);
      list.append(row);
    }
    return list;
  }
  function openBeastUltimate(beast, draft = { targets: [], pact: 'reward' }) {
    if (beastSkillsV2(state.beastData, beast)) {
      showBeast(beast, undefined, true);
      return;
    }
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
        el(
          'h3',
          skill.kind === 'marked_tasks' ? 'Chọn đúng 2 công việc' : 'Chọn từ 1 đến 3 công việc',
        ),
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
            toast('Chỉ chọn tối đa ' + max + ' công việc.');
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
            'Tải thêm công việc để chọn',
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
            toast('Chọn đủ công việc mục tiêu trước nhé.');
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
    context.sheet.classList.add('beast-sheet-open');
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
        '',
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
      const copy = el('span', undefined, 'beast-picker-copy');
      copy.append(el('strong', species.forms[0]), el('small', species.rank));
      control.append(portrait(species, 1, true), copy);
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
      el('h3', ready ? 'Sẵn sàng luyện đan' : `Còn ${30 - alchemy.days} ngày đủ thói quen`),
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
        'Mỗi ngày đủ thói quen tích 1 ngày. Ngày nghỉ giữ tiến độ; ngày thiếu bắt đầu lại từ 0. Đủ 30 ngày sẽ giữ đến khi luyện.',
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
    loadBeastTrainingPreview,
    loadTower,
    setBeastPanel,
    openBeastSpecies,
    openBeastPicker,
    showBeast,
    evolveBeast,
    openBeastExchange,
    toggleBeastProtection,
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
