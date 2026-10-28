import {
  demoBreakthrough,
  demoCheckin,
  demoDrawBatch,
  demoFuseBatch,
} from '../demo/cultivation.js';
import {
  breakthroughPenalties,
  breakthroughPity,
  checkinProgress,
  dailyRewardLabel,
  loot,
  realms,
  rewardLabels,
  talismans,
  talismanName,
} from '../models/cultivation.js';
import { button, el } from '../ui/dom.js';
import { playEffect } from '../ui/effects.js';
import { prefersReducedMotion } from '../core/experience.js';
import { renderRewardCalendar } from '../views/achievements.js';
import { liveRequest } from '../core/http.js';
import { mapAccount } from '../core/live-data.js';
export function summarizeDrawRewards(rewards) {
  const groups = new Map();
  let qi = 0;
  for (const reward of rewards) {
    if (reward === 'qi1' || reward === 'qi2') qi += reward === 'qi1' ? 1 : 2;
    else groups.set(reward, (groups.get(reward) ?? 0) + 1);
  }
  return {
    qi,
    items: Array.from(groups, ([key, amount]) => ({ label: rewardLabels[key] ?? key, amount })),
  };
}
export function createCultivationActions(context) {
  const {
    state,
    runtime,
    ui,
    sheet,
    sheetContent,
    openSheet,
    confirm,
    performLive,
    render,
    toast,
  } = context;
  let drawOpened = false,
    inventoryOpened = false;
  sheet.addEventListener('close', () => {
    if (sheet.open) return;
    const refreshDraw = drawOpened || inventoryOpened;
    drawOpened = false;
    inventoryOpened = false;
    if (refreshDraw && state.live && state.baseDirty) context.refreshOnReturn();
  });
  function openShare() {
    openSheet(state.live ? 'Thẻ thành tích' : 'Thẻ thành tích mẫu');
    const c = el('div', undefined, 'rank-card');
    c.append(
      el('div', '✧', 'rank-seal'),
      el('p', 'TU LUYỆN KỶ LUẬT', 'eyebrow'),
      el('h2', realms[state.cultivation.rank].name),
      el('p', 'Tổng tích lũy: ' + state.cultivation.totalEarned + ' tu vi'),
      el('p', state.live ? 'MINH ANH · TRỢ LÝ CỦA CẬU' : 'MINH ANH · DEMO', 'eyebrow'),
    );
    sheetContent.append(
      c,
      el('p', 'Không chứa tên task hoặc lịch cá nhân. Chỉ chia sẻ khi cậu chủ động chọn.', 'hint'),
      button(
        'Lưu thẻ PNG',
        () => {
          const canvas = document.createElement('canvas');
          canvas.width = 800;
          canvas.height = 1000;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#242034';
          ctx.fillRect(0, 0, 800, 1000);
          ctx.textAlign = 'center';
          ctx.fillStyle = '#e6c382';
          ctx.font = '28px sans-serif';
          ctx.fillText('TU LUYỆN KỶ LUẬT', 400, 220);
          ctx.font = '64px serif';
          ctx.fillText(realms[state.cultivation.rank].name, 400, 440);
          ctx.fillStyle = '#f4f0ff';
          ctx.font = '30px sans-serif';
          ctx.fillText('Tổng tích lũy: ' + state.cultivation.totalEarned + ' tu vi', 400, 550);
          ctx.font = '22px sans-serif';
          ctx.fillText(state.live ? 'MINH ANH · TRỢ LÝ CỦA CẬU' : 'MINH ANH · DEMO', 400, 830);
          canvas.toBlob((blob) => {
            if (!blob) return;
            const url = URL.createObjectURL(blob),
              link = document.createElement('a');
            link.href = url;
            link.download = 'minh-anh-thanh-tich.png';
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 10000);
          }, 'image/png');
        },
        'primary',
      ),
    );
  }
  function demoDay() {
    if (state.live && state.day) return state.day.day;
    return Math.floor((Date.now() + 7 * 3600000 - 4.5 * 3600000) / 86400000);
  }
  async function claimCheckin() {
    if (runtime.saving) return;
    if (state.live) {
      const saved = await performLive('cultivation', { operation: 'checkin' }, { silent: true });
      if (saved?.dailyReward && !runtime.refreshPending)
        toast('Quà ngày ' + saved.dailyReward.day + ' · ' + dailyRewardLabel(saved.dailyReward));
      return;
    }
    const reward = demoCheckin(state.cultivation);
    if (reward) {
      sheet.close();
      render();
      toast('Bản mẫu · ' + dailyRewardLabel(reward));
    }
  }
  function openRewardCalendar() {
    openSheet('Lịch quà 30 ngày');
    sheet.classList.add('reward-sheet-open');
    const now = (state.serverNow ?? Date.now()) + Date.now() - (state.loadedAt ?? Date.now());
    const calendar = renderRewardCalendar(ui, state, now);
    calendar.tabIndex = 0;
    calendar.setAttribute('role', 'region');
    sheetContent.append(calendar);
    calendar.scrollTop = 0;
  }
  function openDailyReward(reward) {
    openSheet('Quà ngày ' + reward.day);
    const now = (state.serverNow ?? Date.now()) + Date.now() - (state.loadedAt ?? Date.now()),
      p = checkinProgress(state.cultivation, now, state.checkin?.rewards);
    const reveal = el(
      'div',
      dailyRewardLabel(reward),
      'daily-reward-detail' + (reward.milestone ? ' is-milestone' : ''),
    );
    sheetContent.append(reveal);
    for (const item of talismans) {
      if (reward.items[item.key]) {
        sheetContent.append(
          el(
            'p',
            'Phá Cảnh Phù · ' +
              item.name +
              ' tăng ' +
              item.boost +
              ' điểm % cơ hội thành công khi dùng trong một lần đột phá.',
            'hint',
          ),
        );
        if (item.next)
          sheetContent.append(
            el(
              'p',
              item.key === 'supreme'
                ? 'Ghép Hộ Đạo Tiên Phù tại mục Tín vật & vật phẩm đặc biệt trong Túi vật phẩm: 3 phù cực phẩm + 3 tín vật Minh Anh, tỷ lệ 20%.'
                : 'Có thể ghép 3 phù cùng cấp trong Túi vật phẩm để thử tạo một phù cấp cao hơn.',
              'hint',
            ),
          );
      }
    }
    const received = reward.day <= p.count,
      available = reward.day === p.rewardDay && p.canClaim;
    sheetContent.append(
      el(
        'p',
        received
          ? 'Cậu đã nhận phần quà này.'
          : available
            ? 'Phần quà này đã sẵn sàng cho hôm nay.'
            : 'Nhận khi điểm danh đủ ' +
              reward.day +
              ' lần trong chu kỳ này. Bỏ lỡ một ngày không mất các quà phía sau.',
        'hint',
      ),
    );
    if (available) sheetContent.append(button('Nhận quà hôm nay', claimCheckin, 'primary'));
    sheetContent.append(button('← Lịch quà 30 ngày', openRewardCalendar, 'text-button'));
  }
  function openDraw() {
    if (runtime.pendingDraw?.revision !== runtime.revision) runtime.pendingDraw = null;
    openSheet(state.live ? 'Quay thưởng' : 'Quay thưởng · Bản mẫu');
    drawOpened = true;
    sheet.classList.add('draw-sheet-open');
    const balance = el('div', undefined, 'draw-balance');
    const ticketCount = el('strong', String(state.cultivation.tickets));
    ticketCount.dataset.ticketBalance = 'true';
    balance.append(el('span', 'Vé hiện có'), ticketCount);
    const hint = el('p', '', 'hint draw-hint');
    hint.setAttribute('role', 'status');
    const body = el('div', undefined, 'draw-body');
    const reveal = el('div', undefined, 'loot-result mystery-card draw-result');
    reveal.setAttribute('role', 'status');
    reveal.setAttribute('aria-live', 'polite');
    function resetReveal() {
      reveal.classList.remove('mystery-revealed');
      reveal.replaceChildren(
        el('span', '✦', 'draw-seal'),
        el('h3', 'Một món quà cho nỗ lực của cậu'),
        el('p', 'Quay 1 lần hoặc mở nhanh 10 phần thưởng.', 'hint'),
      );
    }
    resetReveal();
    const probabilities = el('details', undefined, 'draw-probabilities');
    probabilities.append(el('summary', 'Tỷ lệ phần thưởng'));
    for (const item of loot) {
      const row = el('div', undefined, 'draw-odds-row');
      row.append(
        el('span', item.label),
        el('span', Number(item.weight).toLocaleString('vi-VN') + '%'),
      );
      probabilities.append(row);
    }
    probabilities.append(
      el('p', 'Quay ×10 có cùng tỷ lệ từng lượt như quay ×1. Không mua vé bằng tiền.', 'hint'),
    );
    body.append(reveal, probabilities);
    const actions = el('div', undefined, 'draw-actions');
    const controls = new Map();
    let busy = false,
      opening = false;
    function flipHalf(open) {
      if (prefersReducedMotion()) return Promise.resolve();
      reveal.classList.remove('draw-closing', 'draw-opening');
      reveal.classList.add(open ? 'draw-opening' : 'draw-closing');
      const name = open ? 'draw-open' : 'draw-close';
      const animation = reveal
        .getAnimations()
        .find((animation) => 'animationName' in animation && animation.animationName === name);
      // CSS owns the duration. Cancellation (closing the sheet or reducing
      // motion) must release the controller just like a completed half flip.
      return animation?.finished.catch(() => {}) ?? Promise.resolve();
    }
    function sync() {
      if (!actions.isConnected) return;
      const c = state.cultivation,
        pending = runtime.pendingDraw;
      ticketCount.textContent = String(c.tickets);
      hint.textContent = busy
        ? opening
          ? 'Đang mở phần thưởng…'
          : 'Đang xác nhận phần thưởng…'
        : pending
          ? 'Chưa xác nhận kết quả. Kiểm tra lại đúng lượt quay; vé sẽ không bị trừ thêm.'
          : c.suspended
            ? 'Tạm ngưng vì lâu không chat. Nhắn Minh Anh để hoạt động lại.'
            : c.tickets < 1
              ? 'Hoàn thành task, thói quen hoặc điểm danh để nhận vé.'
              : c.tickets < 10
                ? 'Còn thiếu ' + (10 - c.tickets) + ' vé để quay ×10.'
                : '10 vé · 10 phần thưởng · một lần mở.';
      for (const [count, control] of controls) {
        const retry = pending?.count === count;
        control.disabled =
          busy ||
          runtime.saving ||
          (!!pending && !retry) ||
          (!retry && (c.suspended || c.tickets < count));
        control.textContent = busy
          ? 'Đang mở…'
          : retry
            ? 'Kiểm tra lại ×' + count
            : 'Quay ×' + count + ' · ' + count + ' vé';
      }
      reveal.setAttribute('aria-busy', String(busy));
    }
    for (const count of [1, 10]) {
      const control = button(
        '',
        async () => {
          if (control.disabled || busy || runtime.saving) return;
          busy = true;
          resetReveal();
          sync();
          try {
            const request = state.live
              ? performLive(
                  'cultivation',
                  { operation: 'draw', count },
                  { keepSheet: true, silent: true },
                )
              : Promise.resolve(demoDrawBatch(state.cultivation, count));
            const closing = flipHalf(false);
            const saved = await request,
              revision = runtime.revision;
            if (!saved) return;
            const rewards = saved.rewards ?? [saved.reward];
            if (rewards.includes('summonTicket')) state.beastRefreshedAt = 0;
            const pendingChoices = saved.choices?.length ?? 0;
            const content = document.createDocumentFragment();
            content.append(
              el(
                'h3',
                'Đã nhận ' +
                  rewards.length +
                  ' phần thưởng' +
                  (pendingChoices ? ' · ' + pendingChoices + ' lượt chờ chọn' : ''),
              ),
            );
            const { qi, items } = summarizeDrawRewards(rewards);
            const list = el('ul', undefined, 'draw-rewards');
            if (qi) list.append(el('li', '+' + qi + ' tu vi', 'draw-qi'));
            for (const { label, amount } of items) {
              const row = el('li');
              row.append(el('span', label), el('strong', '×' + amount));
              list.append(row);
            }
            content.append(
              list,
              el(
                'p',
                (saved.count ?? rewards.length) +
                  ' lượt · Đã dùng ' +
                  (saved.count ?? rewards.length) +
                  ' vé',
                'hint',
              ),
            );
            if (pendingChoices)
              content.append(
                button(
                  'Chọn phần thưởng từ linh thú',
                  () => context.openBeastDrawChoices(),
                  'primary',
                ),
              );
            // The request overlaps the first half. Keep the card edge-on if
            // it is late; the entire confirmed result is ready before opening.
            await closing;
            if (!reveal.isConnected || !sheet.open || runtime.revision !== revision) return;
            reveal.replaceChildren(content);
            reveal.classList.add('mystery-revealed');
            opening = true;
            sync();
            await flipHalf(true);
            if (!state.live) render();
          } finally {
            reveal.classList.remove('draw-closing', 'draw-opening');
            busy = false;
            opening = false;
            sync();
          }
        },
        count === 10 ? 'primary' : 'secondary',
      );
      control.dataset.drawCount = String(count);
      controls.set(count, control);
      actions.append(control);
    }
    sheetContent.append(balance, hint, body, actions);
    sync();
  }
  function openInventory() {
    if (runtime.pendingFusion?.session !== runtime.session) runtime.pendingFusion = null;
    openSheet('Túi vật phẩm');
    inventoryOpened = true;
    const c = state.cultivation;
    const quantities = [],
      fusionControls = [];
    let busy = false;
    const countLabel = el('label', 'Số lượt ghép', 'form-field');
    const countSelect = el('select');
    countSelect.dataset.fusionCount = 'true';
    for (const count of [1, 10, 100]) {
      const option = el('option', count + ' lượt');
      option.value = String(count);
      countSelect.append(option);
    }
    countSelect.value = String(runtime.pendingFusion?.count ?? 1);
    countLabel.append(countSelect);
    const fusionHint = el('p', '', 'hint');
    fusionHint.setAttribute('role', 'status');
    function syncInventory() {
      if (!countSelect.isConnected) return;
      const latest = state.cultivation,
        pending = runtime.pendingFusion;
      for (const { key, badge } of quantities)
        badge.textContent = '×' + (latest.inventory[key] ?? 0);
      countSelect.disabled = busy || runtime.saving || !!pending;
      fusionHint.textContent = busy
        ? 'Đang ghép và lưu kết quả…'
        : pending
          ? 'Chưa xác nhận được đợt ghép. Bấm Kiểm tra lại để lấy đúng kết quả, không trừ thêm nguyên liệu.'
          : '';
      fusionHint.hidden = !fusionHint.textContent;
      for (const { t, control } of fusionControls) {
        const retry = pending?.item === t.key;
        const required = 3 * Number(countSelect.value);
        control.textContent = retry
          ? 'Kiểm tra lại ×' + pending.count
          : 'Ghép ×' + countSelect.value + ' · ' + t.chance + '%';
        control.disabled =
          busy ||
          runtime.saving ||
          (!!pending && !retry) ||
          (!retry &&
            (latest.suspended ||
              latest.inventory[t.key] < required ||
              (t.key === 'supreme' && latest.inventory.keepsake < required)));
      }
    }
    countSelect.addEventListener('change', syncInventory);
    const itemHeading = (name, count, key) => {
      const row = el('div', undefined, 'inventory-heading');
      const badge = el('span', '×' + (count ?? 0), 'quantity-badge');
      badge.dataset.inventoryItem = key;
      quantities.push({ key, badge });
      row.append(el('h3', name), badge);
      return row;
    };
    sheetContent.append(el('p', 'BẢO VỆ', 'inventory-group'));
    for (const [key, name, description] of [
      [
        'heart',
        'Hộ Tâm Phù',
        'Nếu cậu ngủ muộn, chuỗi ngủ đúng giờ không bị mất. Tu vi vẫn bị trừ 20 như bình thường.',
      ],
      [
        'peace',
        'An Tâm Phù',
        'Nếu cậu ngủ muộn, phù chặn lần trừ 20 tu vi của ngày đó. Chuỗi ngủ đúng giờ vẫn bị mất.',
      ],
    ]) {
      const item = el('section', undefined, 'item-row');
      item.append(itemHeading(name, c.inventory[key], key), el('p', description, 'hint'));
      const use = button(
        c.active[key]
          ? state.live
            ? 'Đã kích hoạt hôm nay'
            : 'Đã kích hoạt trong demo'
          : 'Dùng hôm nay',
        () =>
          confirm(
            'Dùng ' + name + '?',
            description +
              (state.live
                ? ' Chỉ áp dụng ngày sinh hoạt hiện tại.'
                : ' Chỉ áp dụng ngày sinh hoạt này trong demo.'),
            () => {
              if (c.active[key] || c.inventory[key] < 1) return;
              if (state.live) {
                performLive('cultivation', { operation: 'protect', item: key });
                return;
              }
              c.inventory[key]--;
              c.active[key] = true;
              c.log.unshift('Dùng ' + name + ' (demo)');
              openInventory();
              render();
            },
          ),
        'secondary',
      );
      use.disabled = c.active[key] || c.inventory[key] < 1;
      item.append(use);
      sheetContent.append(item);
    }
    function appendFusionControls(item, t) {
      const result = el('p', '', 'hint');
      result.hidden = true;
      result.dataset.fusionResult = t.key;
      result.setAttribute('role', 'status');
      const fuse = button(
        '',
        async () => {
          if (fuse.disabled || busy || runtime.saving) return;
          const count = Number(countSelect.value),
            session = runtime.session;
          busy = true;
          syncInventory();
          result.hidden = false;
          result.textContent = 'Đang ghép…';
          try {
            const saved = state.live
              ? await performLive(
                  'cultivation',
                  { operation: 'fuse', item: t.key, count },
                  { keepSheet: true, silent: true },
                )
              : demoFuseBatch(state.cultivation, t.key, count);
            if (!result.isConnected || !sheet.open || runtime.session !== session) return;
            if (!saved) {
              result.textContent = runtime.pendingFusion
                ? 'Chưa xác nhận được kết quả. Kiểm tra lại đợt ghép này.'
                : 'Chưa ghép được. Kiểm tra nguyên liệu và thử lại.';
              return;
            }
            result.textContent =
              saved.count +
              ' lượt · ' +
              saved.successes +
              ' thành công · ' +
              saved.failures +
              ' thất bại. Nhận ' +
              saved.received +
              ' ' +
              talismanName(saved.output) +
              '.';
            if (!state.live) render();
          } finally {
            busy = false;
            syncInventory();
          }
        },
        'secondary',
      );
      fuse.dataset.fuseItem = t.key;
      fusionControls.push({ t, control: fuse });
      item.append(fuse, result);
    }
    sheetContent.append(el('p', 'PHÁ CẢNH', 'inventory-group'), countLabel, fusionHint);
    for (const t of talismans.filter((t) => t.key !== 'immortal')) {
      const item = el('section', undefined, 'item-row');
      item.append(
        itemHeading(talismanName(t.key), c.inventory[t.key], t.key),
        el(
          'p',
          'Khi dùng trong lần đột phá này, cơ hội thành công tăng thêm ' +
            t.boost +
            ' điểm %. Dùng xong sẽ tiêu hao.',
          'hint',
        ),
      );
      if (t.next && t.key !== 'supreme') appendFusionControls(item, t);
      sheetContent.append(item);
    }
    sheetContent.append(
      el('p', 'TÍN VẬT & VẬT PHẨM ĐẶC BIỆT', 'inventory-group'),
      (() => {
        const box = el('section', undefined, 'item-row');
        box.append(
          itemHeading('Tín vật Minh Anh', c.inventory.keepsake, 'keepsake'),
          el(
            'p',
            'Dùng cùng phù cực phẩm để ghép Hộ Đạo Tiên Phù. Mỗi lượt cần 3 tín vật.',
            'hint',
          ),
        );
        return box;
      })(),
    );
    const immortal = el('section', undefined, 'item-row');
    immortal.append(
      itemHeading('Hộ Đạo Tiên Phù', c.inventory.immortal, 'immortal'),
      el(
        'p',
        'Tăng 25 điểm % tỷ lệ đột phá. Thất bại mất 1 tu vi và bỏ qua tích lũy thất bại để hưởng hỗ trợ +5 điểm % từ lần thử sau.',
        'hint',
      ),
      el('p', 'Khi sử dụng, nhận 1 Hộ Tâm Phù và 1 An Tâm Phù.', 'hint'),
    );
    appendFusionControls(
      immortal,
      talismans.find((t) => t.key === 'supreme'),
    );
    sheetContent.append(immortal);
    syncInventory();
  }
  async function openBreakthrough() {
    if (state.live && state.beastV2?.active) {
      if (runtime.saving) return;
      openSheet('Đột phá');
      const loading = el('p', 'Đang cập nhật năng lực đột phá…', 'hint');
      loading.setAttribute('role', 'status');
      sheetContent.append(loading);
      const revision = runtime.revision;
      try {
        // Do not coalesce with a background bootstrap started before this preview.
        const latest = await liveRequest('bootstrap?breakthroughPreview=' + crypto.randomUUID());
        if (!state.loaded || !sheet.open || !loading.isConnected || revision !== runtime.revision)
          return;
        state.cultivation = mapAccount(latest.account, latest.day?.day);
        state.day = latest.day;
        state.beastV2 = latest.beastV2 ?? null;
        state.breakthroughPenalties = latest.breakthroughPenalties;
      } catch (error) {
        if (!state.loaded || !sheet.open || !loading.isConnected || revision !== runtime.revision)
          return;
        loading.textContent = error.message;
        sheetContent.append(button('Thử lại', openBreakthrough, 'primary'));
        return;
      }
    }
    const c = state.cultivation,
      target = realms[c.rank + 1];
    if (!target) {
      if (state.live && state.beastV2?.active) {
        openSheet('Đột phá');
        sheetContent.append(el('p', 'Đã đạt cảnh giới cao nhất hiện có.', 'hint'));
      }
      return;
    }
    openSheet('Đột phá · ' + target.name);
    const modifier = state.live && state.beastV2?.active ? state.beastV2.breakthrough : null;
    const basePenalty = (state.breakthroughPenalties ?? breakthroughPenalties)[c.rank];
    const penalty = () =>
      modifier?.preventLoss
        ? 0
        : (select.value === 'immortal' ? 1 : basePenalty) * (modifier?.penaltyMultiplier ?? 1);
    sheetContent.append(
      el(
        'p',
        'Cần ' +
          target.qi +
          ' tu vi và ' +
          target.days +
          ' ngày ngủ đúng giờ. Thành công không tiêu hao tu vi. Mức phạt thất bại theo phù và bảo hộ đã chọn được hiển thị bên dưới.',
        'hint',
      ),
    );
    const select = el('select'),
      label = el('label', 'Chọn phù đột phá', 'form-field'),
      none = el('option', 'Không dùng phù');
    none.value = '';
    select.append(none);
    for (const t of talismans) {
      if (c.inventory[t.key] > 0) {
        const option = el('option', t.name + ' · +' + t.boost + ' điểm %');
        option.value = t.key;
        select.append(option);
      }
    }
    label.append(select);
    sheetContent.append(label);
    const info = el('p', undefined, 'hint'),
      result = el('div', undefined, 'loot-result');
    result.hidden = true;
    result.setAttribute('role', 'status');
    const chance = () =>
      Math.min(
        100,
        target.chance +
          (modifier?.chancePoints ?? 0) +
          breakthroughPity(c) +
          (talismans.find((t) => t.key === select.value)?.boost ?? 0),
      );
    const explain = () => {
      info.textContent =
        'Lần này có ' +
        chance() +
        '% cơ hội thành công. Tỷ lệ cơ bản lên ' +
        target.name +
        ': ' +
        target.chance +
        '%. Thất bại −' +
        penalty() +
        ' tu vi, giữ cảnh giới và chuỗi ngủ. Phù đã chọn vẫn tiêu hao. Thất bại 1 lần chưa cộng; 2/3/4 lần liên tiếp cộng 5/10/15 điểm % cho lần sau, tối đa +15 điểm %. Thành công đặt lại chuỗi thất bại. Phù cộng thêm tỷ lệ, tổng tối đa 100%. Mỗi ngày sinh hoạt chỉ thử 1 lần.';
      if (modifier?.chancePoints)
        info.textContent += ` Linh thú cộng thêm ${modifier.chancePoints} điểm % thành công cho lần này.`;
      if (c.immortalPity)
        info.textContent += ' Hộ Đạo: đã có hỗ trợ đột phá, không cần tích lũy thất bại.';
      if (select.value === 'immortal')
        info.textContent +=
          ' Hộ Đạo Tiên Phù: thất bại bỏ qua tích lũy để hưởng hỗ trợ +5 điểm % từ lần thử sau. Khi sử dụng, nhận 1 Hộ Tâm Phù + 1 An Tâm Phù.';
      if (modifier?.preventLoss)
        info.textContent +=
          ' Mai Đá Hộ Thể: lần này thất bại không mất tu vi; thử xong tiêu hao bảo hộ.';
    };
    select.addEventListener('change', explain);
    explain();
    const attempt = button(
      'Đột phá',
      async () => {
        if (attempt.disabled) return;
        attempt.disabled = true;
        attempt.textContent = 'Đang đột phá…';
        await playEffect(attempt, 'breakthrough', 860);
        if (state.live) {
          const saved = await performLive(
            'cultivation',
            { operation: 'breakthrough', item: select.value || null },
            { keepSheet: true, silent: true },
          );
          if (saved === null && attempt.isConnected) {
            if (state.beastV2?.active) {
              await openBreakthrough();
              return;
            }
            attempt.disabled = false;
            attempt.textContent = 'Đột phá';
            return;
          }
          if (!attempt.isConnected) return;
          select.disabled = true;
          result.hidden = false;
          result.classList.add(saved.success ? 'effect-success' : 'effect-failure');
          result.textContent = saved.success
            ? 'Đột phá thành công ✦ ' + target.name + ' · Được bảo vệ hạ bậc 72 giờ.'
            : 'Chưa thành công · −' +
              saved.penalty +
              ' tu vi. Cảnh giới và chuỗi vẫn giữ; mình thử lại khi đủ điều kiện nhé.';
          if (!saved.success && saved.effect?.refundQi > 0)
            result.textContent += ` Linh thú hoàn lại ${saved.effect.refundQi} tu vi.`;
          if (select.value === 'immortal')
            result.textContent +=
              ' Đã thêm 1 Hộ Tâm Phù + 1 An Tâm Phù vào túi.' +
              (!saved.success ? ' Đã mở hỗ trợ đột phá cho lần thử sau.' : '');
          attempt.textContent = 'Đã thử hôm nay';
          return;
        }
        const r = demoBreakthrough(c, demoDay(), select.value || null);
        if (!r) {
          attempt.disabled = false;
          attempt.textContent = 'Đột phá';
          return;
        }
        select.disabled = true;
        result.hidden = false;
        result.classList.add(r.success ? 'effect-success' : 'effect-failure');
        result.textContent = r.success
          ? 'Đột phá thành công ✦ ' + realms[c.rank].name + ' · Được bảo vệ hạ bậc 72 giờ.'
          : 'Chưa thành công · −' + r.penalty + ' tu vi. Cảnh giới và chuỗi vẫn giữ.';
        if (select.value === 'immortal')
          result.textContent +=
            ' Đã thêm 1 Hộ Tâm Phù + 1 An Tâm Phù vào túi.' +
            (!r.success ? ' Đã mở hỗ trợ đột phá cho lần thử sau.' : '');
        attempt.textContent = 'Đã thử hôm nay';
        render();
      },
      'primary',
    );
    attempt.disabled =
      c.suspended || c.attemptDay === demoDay() || c.qi < target.qi || c.streak < target.days;
    sheetContent.append(info, attempt, result);
  }
  return {
    openShare,
    demoDay,
    claimCheckin,
    openRewardCalendar,
    openDailyReward,
    openDraw,
    openInventory,
    openBreakthrough,
  };
}
