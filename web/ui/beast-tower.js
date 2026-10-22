import { button, el } from './dom.js';
import { beastRewardLabel } from '../models/linh-thu.js';
import { prefersReducedMotion } from '../core/experience.js';
import { waitForWrite } from '../core/state.js';
import { towerCardBack, towerCardSafe, towerCardTrap, towerReceipt } from './beast-tower-art.js';

// Presentation only: run outcomes, versions, credits and balances come from the API.
export async function openBeastTowerSheet(options) {
  const { context, loadTower, mutateBeast, currentSheet, recoverBeast, confirmedClaim } = options;
  const { state, runtime, openSheet, closeSheet, sheetContent } = context;
  const reopen = () => openBeastTowerSheet(options);
  openSheet('Tháp giao ước');
  context.sheet.classList.add('beast-sheet-open');
  const isCurrent = currentSheet();
  // Original flat card artwork with a shared frame and a single focal crest.
  let artSequence = 0;
  function vector(viewBox, paths, className) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', viewBox);
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('class', className);
    svg.innerHTML = paths.replaceAll('oath-', 'oath-' + ++artSequence + '-');
    return svg;
  }
  function engraving() {
    return vector('0 0 248 320', towerCardBack, 'tower-card-art');
  }
  function outcomeArt(kind) {
    return vector(
      '0 0 248 320',
      kind === 'safe' ? towerCardSafe : towerCardTrap,
      'tower-card-art tower-outcome-art tower-outcome-' + kind,
    );
  }
  function setCardResult(card, kind, reward = run.atRisk) {
    const safe = kind === 'safe';
    const rescued = kind === 'rescued';
    card.dataset.result = kind;
    card.dataset.reward = reward?.summonTickets ? 'summon' : 'normal';
    const label = card.querySelector('.tower-result-label');
    const amount = reward?.summonTickets || reward?.tickets || 0;
    const ticketName = reward?.summonTickets ? 'vé triệu hồi' : 'vé thường';
    label.replaceChildren(
      el('strong', safe ? String(amount) : rescued ? 'Được cứu' : 'Gặp bẫy'),
      el('span', safe ? ticketName : rescued ? 'Bảo hộ đã dùng' : 'Lượt kết thúc'),
    );
    card.setAttribute(
      'aria-label',
      safe ? 'An toàn: ' + amount + ' ' + ticketName : rescued ? 'Đã được bảo hộ cứu' : 'Gặp bẫy',
    );
  }

  const root = el('section', undefined, 'tower-experience');
  root.setAttribute('aria-label', 'Lượt Tháp giao ước');
  const track = el('ol', undefined, 'tower-path');
  track.setAttribute('aria-label', 'Tiến độ bốn tầng');
  const floorRewards = ['2 vé thường', '3 vé thường', '5 vé thường', '1 vé triệu hồi'];
  const displayRewards = [
    { tickets: 0, summonTickets: 0 },
    { tickets: 2, summonTickets: 0 },
    { tickets: 3, summonTickets: 0 },
    { tickets: 5, summonTickets: 0 },
    { tickets: 0, summonTickets: 1 },
  ];
  const steps = floorRewards.map((label, i) => {
    const step = el('li', undefined, 'tower-path-step');
    step.append(el('span', 'Tầng ' + (i + 1), 'tower-path-number'));
    step.setAttribute('aria-label', `Tầng ${i + 1}: ${label}`);
    track.append(step);
    return step;
  });
  const stage = el('div', undefined, 'tower-stage');
  const stageHead = el('div', undefined, 'tower-stage-head');
  const floorLabel = el('span', '', 'tower-floor-label');
  const protection = el('span', '', 'tower-protection');
  stageHead.append(floorLabel, protection);
  const stageTitle = el('h3', 'Đang mở tháp…', 'tower-stage-title');
  const stageHint = el('p', '', 'tower-stage-hint');
  const board = el('div', undefined, 'tower-board');
  const status = el('p', '', 'tower-status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  stage.append(stageHead, stageTitle, stageHint, board, status);
  const purse = el('div', undefined, 'tower-purse');
  const purseCopy = el('div');
  const purseLabel = el('span', 'Quà chưa nhận', 'tower-purse-label');
  const purseValue = el('strong', 'Chưa có quà', 'tower-purse-value');
  purseCopy.append(purseLabel, purseValue);
  const purseIcon = vector(
    '0 0 24 24',
    '<path d="M3 6h18v4a2 2 0 0 0 0 4v4H3v-4a2 2 0 0 0 0-4V6z M9 6v3m0 2v2m0 2v3" fill="none" stroke="currentColor" stroke-width="1.5"/>',
    'tower-purse-icon',
  );
  purse.append(purseIcon, purseCopy);
  const actions = el('div', undefined, 'tower-actions');
  const note = el('p', '', 'tower-footnote');
  root.append(track, purse, stage, actions, note);
  sheetContent.append(root);
  let data,
    run,
    busy = false,
    selected = null,
    lossReward = null,
    receivedReward = null;
  const active = () => isCurrent() && root.isConnected;
  const wait = (ms) =>
    new Promise((resolve) => setTimeout(resolve, prefersReducedMotion() ? 0 : ms));
  async function motion(node, frames, duration = 300, delay = 0) {
    if (!active()) return;
    const animation = node.animate(frames, {
      duration: prefersReducedMotion() ? 1 : duration,
      delay: prefersReducedMotion() ? 0 : delay,
      easing: 'cubic-bezier(.22,.7,.25,1)',
      fill: 'backwards',
    });
    try {
      await animation.finished;
    } catch {}
  }
  function say(text) {
    status.textContent = text;
  }
  function action(text, handler, kind = 'primary') {
    const control = button(text, handler, kind + ' tower-action');
    actions.append(control);
    return control;
  }
  function focusActions() {
    if (!active()) return;
    const target = actions.querySelector('button:not(:disabled)');
    target?.focus({ preventScroll: true });
  }
  function updateSummary() {
    steps.forEach((step, i) => {
      const cleared = (run?.cleared ?? 0) > i;
      step.classList.toggle('is-cleared', cleared);
      step.classList.toggle('is-current', !!run && run.floor === i + 1);
      if (run?.floor === i + 1) step.setAttribute('aria-current', 'step');
      else step.removeAttribute('aria-current');
      step.firstElementChild.textContent = (cleared ? '✓ ' : '') + 'Tầng ' + (i + 1);
    });
    floorLabel.textContent = run ? `Tầng ${run.floor} / 4` : '';
    protection.textContent = (
      run ? run.rescueAvailable && run.floor < 4 : data?.eligibility.rescueAvailable
    )
      ? '◇ Bảo hộ ×1'
      : run?.rescued
        ? 'Bảo hộ đã dùng'
        : '';
    const playing = !!run && ['choosing', 'decision'].includes(run.status);
    purse.hidden = !playing;
    track.hidden = !run || ['claimed', 'expired'].includes(run.status);
    stageHead.hidden = !run || ['claimed', 'expired'].includes(run.status);
    root.classList.toggle('is-playing', playing);
    root.classList.toggle('has-run', !!run && !['claimed', 'expired'].includes(run.status));
    purseValue.textContent = run?.cleared
      ? beastRewardLabel(run.atRisk)
      : floorRewards[(run?.floor ?? 1) - 1];
    purseLabel.textContent = run?.cleared ? 'Thưởng có thể nhận' : 'Thưởng khi qua tầng này';
  }
  function makeCards(animate = true) {
    board.replaceChildren();
    board.className = 'tower-board';
    const count = run.cards;
    board.style.setProperty('--tower-card-count', count);
    selected = null;
    for (let index = 0; index < count; index++) {
      const card = button('', () => choose(index, card), 'tower-card beast-tower-card');
      card.setAttribute('aria-label', `Lật lá ${index + 1}`);
      const inner = el('span', undefined, 'tower-card-inner');
      const back = el('span', undefined, 'tower-card-back');
      back.setAttribute('aria-hidden', 'true');
      back.append(engraving());
      const front = el('span', undefined, 'tower-card-front');
      front.setAttribute('aria-hidden', 'true');
      front.append(outcomeArt('safe'), outcomeArt('trap'), el('small', '', 'tower-result-label'));
      inner.append(back, front);
      card.append(inner);
      board.append(card);
      if (animate)
        motion(
          card,
          [
            { opacity: 0, transform: 'translateY(18px) scale(.94)' },
            { opacity: 1, transform: 'translateY(0) scale(1)' },
          ],
          350,
          index * 65,
        );
    }
  }
  function showChoosing(animate = true) {
    actions.replaceChildren();
    stage.classList.remove('is-failed', 'is-received', 'is-confirming', 'is-entry');
    stage.querySelector('.tower-entry-art')?.remove();
    stageTitle.textContent = 'Chọn một lá để lật';
    stageHint.textContent = `${run.cards} lá · 1 lá bẫy`;
    note.textContent = run.cleared ? `Gặp bẫy: mất ${beastRewardLabel(run.atRisk)} chưa nhận.` : '';
    say(run.lastResult === 'rescued' ? 'Đã dùng bảo hộ. Chọn lại một lá.' : '');
    makeCards(animate);
    updateSummary();
  }
  function showDecision(moveFocus = false) {
    stage.classList.remove('is-confirming');
    actions.replaceChildren();
    stageTitle.textContent = run.floor === 4 ? 'Đã vượt cả bốn tầng' : `Đã qua tầng ${run.floor}`;
    stageHint.textContent = '';
    say('');
    const claimButton = action('Nhận thưởng', claim);
    claimButton.classList.add('beast-tower-claim');

    if (run.floor < 4) {
      const nextButton = action('Lên tầng ' + (run.floor + 1), nextFloor, 'secondary');
      nextButton.classList.add('beast-tower-continue');
      nextButton.append(el('small', 'Qua tầng: ' + beastRewardLabel(run.nextReward)));
    }
    note.textContent =
      run.floor < 4 ? 'Đi tiếp đổi sang quà tầng sau. Gặp bẫy: mất quà chưa nhận.' : '';
    if (run.floor === 3 && run.rescueAvailable) stageHint.textContent = 'Tầng 4 không có bảo hộ.';
    updateSummary();
    if (moveFocus) focusActions();
  }
  async function command(operation, extra = {}, message = 'Đang xử lý…') {
    if (busy || runtime.pendingBeast || !active()) return null;
    busy = true;
    root.setAttribute('aria-busy', 'true');
    root.querySelectorAll('button').forEach((control) => (control.disabled = true));
    say(message);
    const result = await mutateBeast({
      operation,
      ...(operation === 'tower_start' ? {} : { runVersion: run.version }),
      ...extra,
    });
    // mutateBeast refreshes the authoritative wallet and run in the background.
    // A successful receipt already contains the authoritative run and wallet.
    // Recovery/rejection still needs a fresh read before another command.
    if (!result?.tower) await loadTower();
    if (!active()) return null;
    data = state.beastTower;
    if (result?.tower) {
      run = { ...result.tower, version: result.runVersion ?? data.run?.version };
      data.run = run;
    }
    root.removeAttribute('aria-busy');
    if (!result) {
      busy = false;
      if (runtime.pendingBeast) {
        say('Chưa xác nhận được kết quả. Kiểm tra để tiếp tục đúng lượt này.');
        actions.replaceChildren();
        action('Kiểm tra kết quả', recoverBeast);
        focusActions();
        note.textContent = '';
      } else if (state.towerError) {
        say('Chưa đồng bộ được lượt tháp. Tải lại kết quả trước khi tiếp tục.');
        actions.replaceChildren();
        action('Thử lại', reopen);
        focusActions();
      } else {
        run = data.run;
        presentRun();
        status.hidden = false;
        say(state.beastError || 'Chưa thực hiện được. Cậu thử lại nhé.');
      }
      return null;
    }
    return result;
  }
  async function choose(index, card) {
    if (busy || !active()) return;
    selected = card;
    lossReward = run.cleared ? { ...run.atRisk } : null;
    card.classList.add('is-selected');
    board.classList.add('has-selection');
    const result = await command('tower_pick', { card: index }, 'Đang mở lá cậu chọn…');
    if (!result || !active()) {
      if (active() && card.isConnected && !runtime.pendingBeast) {
        card.classList.remove('is-selected');
        board.classList.remove('has-selection');
      }
      return;
    }
    const outcome = run.lastResult;
    // Only reveal the selected card; no invented results for the other cards.
    setCardResult(card, outcome === 'safe' ? 'safe' : 'trap');
    if (outcome === 'rescued')
      card.querySelector('.tower-result-label span').textContent = 'Bảo hộ ×1';
    await wait(120);
    if (!active()) return;
    card.classList.add('is-revealed');
    await wait(640);
    if (!active()) return;
    if (outcome !== 'safe') {
      card.classList.add('is-impact');
      await motion(
        card,
        [
          { transform: 'translateY(-4px) translateX(0)' },
          { transform: 'translateY(-4px) translateX(-4px)', offset: 0.2 },
          { transform: 'translateY(-4px) translateX(3px)', offset: 0.4 },
          { transform: 'translateY(-4px) translateX(-2px)', offset: 0.6 },
          { transform: 'translateY(-4px) translateX(1px)', offset: 0.8 },
          { transform: 'translateY(-4px) translateX(0)' },
        ],
        340,
      );
      if (!active()) return;
      card.classList.add('is-settled');
      await wait(340);
      if (!active()) return;
      card.classList.remove('is-impact');
    }
    if (outcome === 'rescued') {
      note.textContent = '';
      stageTitle.textContent = 'Bảo hộ đã kích hoạt';
      say('Quà chưa nhận được giữ nguyên.');
      await wait(600);
      if (!active()) return;
      setCardResult(card, 'rescued');
      await motion(
        card,
        [{ filter: 'brightness(1)' }, { filter: 'brightness(1.7)' }, { filter: 'brightness(1)' }],
        650,
      );
      stageTitle.textContent = 'Đã dùng 1 bảo hộ';
      say('Đang xáo lại bài…');
      await wait(550);
      if (!active()) return;
      await motion(
        board,
        [
          { opacity: 1, transform: 'translateY(0)' },
          { opacity: 0, transform: 'translateY(12px)' },
        ],
        240,
      );
      if (!active()) return;
      busy = false;
      showChoosing();
      board.querySelector('button')?.focus({ preventScroll: true });
    } else if (outcome === 'safe') {
      await motion(
        purseIcon,
        [
          { transform: 'translateY(0)' },
          { transform: 'translateY(-3px)' },
          { transform: 'translateY(0)' },
        ],
        380,
      );
      if (!active()) return;
      busy = false;
      showDecision(true);
      motion(
        actions,
        [
          { opacity: 0, transform: 'translateY(8px)' },
          { opacity: 1, transform: 'translateY(0)' },
        ],
        260,
      );
    } else {
      busy = false;
      finish(false);
      motion(stageTitle, [{ opacity: 0 }, { opacity: 1 }], 240);
      motion(
        purseCopy,
        [
          { opacity: 0.2, transform: 'translateY(-3px)' },
          { opacity: 1, transform: 'translateY(0)' },
        ],
        300,
      );
      motion(
        actions,
        [
          { opacity: 0, transform: 'translateY(6px)' },
          { opacity: 1, transform: 'translateY(0)' },
        ],
        300,
        100,
      );
    }
  }
  async function nextFloor() {
    const result = await command('tower_continue', {}, 'Đang mở lối lên tầng tiếp theo…');
    if (!result || !active()) return;
    await motion(
      board,
      [
        { opacity: 1, transform: 'translateY(0)' },
        { opacity: 0, transform: 'translateY(-18px)' },
      ],
      260,
    );
    if (!active()) return;
    busy = false;
    showChoosing();
    board.querySelector('button')?.focus({ preventScroll: true });
  }
  async function claim() {
    const control = actions.querySelector('.beast-tower-claim');
    if (control) control.textContent = 'Đang nhận thưởng…';
    const result = await command('tower_claim', {}, 'Đang xác nhận cộng phần thưởng vào ví…');
    if (!result || !active()) {
      if (active() && !runtime.pendingBeast && control) control.textContent = 'Nhận thưởng';
      return;
    }
    receivedReward = result.reward || run.atRisk;
    if (selected)
      await motion(
        selected,
        [
          { transform: 'translateY(-6px) scale(1.02)', opacity: 1 },
          { transform: 'translateY(38px) scale(.75)', opacity: 0 },
        ],
        450,
      );
    if (!active()) return;
    busy = false;
    finish(true);
    motion(
      board,
      [
        { opacity: 0, transform: 'translateY(8px) scale(.97)' },
        { opacity: 1, transform: 'translateY(0) scale(1)' },
      ],
      360,
    );
  }
  function finish(received) {
    actions.replaceChildren();
    updateSummary();
    stage.classList.toggle('is-failed', !received);
    stage.classList.toggle('is-received', received);
    stage.classList.remove('is-confirming');
    purse.hidden = true;
    note.textContent = '';
    if (received) {
      const heading = sheetContent.querySelector('#sheet-title');
      heading.textContent = 'Đã nhận thưởng';
      track.hidden = true;
      stageHead.hidden = true;
      stageTitle.hidden = true;
      stageHint.hidden = true;
      status.hidden = true;
      board.className = 'tower-board is-receipt';
      board.replaceChildren();
      const receipt = el('div', undefined, 'tower-receipt');
      const receivedArt = el('span', undefined, 'tower-receipt-check');
      receivedArt.setAttribute('aria-hidden', 'true');
      receivedArt.append(vector('0 0 240 170', towerReceipt, 'tower-receipt-illustration'));
      const reward = receivedReward || run.atRisk;
      receipt.append(
        receivedArt,
        el('strong', '+' + beastRewardLabel(reward), 'tower-receipt-reward'),
      );
      if (reward.tickets)
        receipt.append(
          el(
            'p',
            `Số dư: ${data.wallet.state.tickets.toLocaleString('vi-VN')} vé thường`,
            'tower-receipt-balance',
          ),
        );
      if (reward.summonTickets)
        receipt.append(
          el(
            'p',
            `Số dư: ${data.account.state.summonTickets.toLocaleString('vi-VN')} vé triệu hồi`,
            'tower-receipt-balance',
          ),
        );
      board.append(receipt);
    } else {
      purse.hidden = false;
      const forfeited = lossReward || displayRewards[run.cleared] || displayRewards[0];
      const hasForfeitedReward = !!forfeited && !!(forfeited.tickets || forfeited.summonTickets);
      purse.classList.add('is-lost');
      purse.classList.toggle('has-forfeited-reward', hasForfeitedReward);
      purseLabel.textContent = hasForfeitedReward ? 'Quà chưa nhận đã mất' : 'Kết quả lượt này';
      purseValue.textContent = hasForfeitedReward ? beastRewardLabel(forfeited) : 'Không có thưởng';
      stageTitle.textContent = 'Gặp bẫy';
      stageHint.textContent = `Lượt kết thúc ở tầng ${run.floor}.`;
      say('Vé đã có trong ví được giữ nguyên.');
    }
    action('Xong', closeSheet);
    focusActions();
  }
  if (runtime.saving) {
    stageTitle.textContent = 'Đang lấy kết quả…';
    stageHint.textContent = '';
    say('');
    while (runtime.saving && active()) await waitForWrite(runtime);
    if (!active()) return;
  }
  await loadTower();
  if (!active()) return;
  data = state.beastTower;
  if (!data || state.towerError) {
    stageTitle.textContent = 'Chưa mở được tháp';
    stageHint.textContent = state.towerError || 'Cậu thử tải lại nhé.';
    action('Thử lại', reopen);
    return;
  }
  // A committed claim may be recovered after the operating day changed. The
  // current-day GET supplies the wallet, while the receipt supplies that claim.
  run = confirmedClaim?.tower ?? data.run;
  presentRun();

  function presentRun() {
    lossReward = null;
    receivedReward = null;
    actions.replaceChildren();
    board.replaceChildren();
    stage.querySelector('.tower-entry-art')?.remove();
    stage.classList.remove('is-entry', 'is-failed', 'is-received');
    say('');
    note.textContent = '';
    sheetContent.querySelector('#sheet-title').textContent = 'Tháp giao ước';
    stageTitle.hidden = false;
    stageHint.hidden = false;
    status.hidden = false;
    purse.classList.remove('is-lost', 'has-forfeited-reward');
    updateSummary();
    if (runtime.pendingBeast) {
      stageTitle.textContent = 'Chưa xác nhận được kết quả';
      stageHint.textContent = 'Kiểm tra để tiếp tục đúng lượt này.';
      say('');
      action('Kiểm tra kết quả', recoverBeast);
      return;
    }
    if (!run) {
      stage.classList.add('is-entry');
      const entryArt = el('div', undefined, 'tower-entry-art');
      entryArt.setAttribute('aria-hidden', 'true');
      entryArt.append(engraving());
      stage.insertBefore(entryArt, stageTitle);
      stageTitle.textContent = '4 tầng · 1 lượt miễn phí';
      stageHint.textContent =
        'Mỗi tầng có 1 lá bẫy. Lật an toàn để nhận thưởng hoặc lên tầng tiếp.';
      board.className = 'tower-board is-preview';
      const preview = el('div', undefined, 'tower-preview');
      floorRewards.forEach((reward, index) => {
        const row = el('div', undefined, 'tower-preview-row');
        row.append(el('span', `Tầng ${index + 1}`), el('strong', reward));
        preview.append(row);
      });
      board.append(preview);
      status.hidden = true;
      if (!data.eligibility.eligible) {
        const conditions = el('div', undefined, 'tower-conditions');
        [
          [
            data.eligibility.achieved > 0 && data.eligibility.missed === 0,
            'Hoàn thành đủ thói quen hôm nay',
          ],
          [!!data.eligibility.taskId, 'Hoàn thành 1 công việc hợp lệ hôm nay'],
        ].forEach(([met, text]) => {
          if (!met) conditions.append(el('p', '○ ' + text));
        });
        actions.append(conditions);
      }
      const start = action('Bắt đầu · Miễn phí', async () => {
        status.hidden = false;
        const result = await command('tower_start', {}, 'Đang chuẩn bị tầng đầu tiên…');
        if (result && active()) {
          busy = false;
          showChoosing();
          board.querySelector('button')?.focus({ preventScroll: true });
        }
      });
      start.disabled = !data.eligibility.eligible;
      note.textContent = 'Thưởng tầng sau thay quà hiện tại, không cộng dồn.';
    } else if (run.status === 'claimed' || (run.status === 'expired' && run.cleared)) {
      receivedReward = confirmedClaim?.reward ?? run.atRisk;
      finish(true);
      if (run.status === 'expired') {
        stageHint.hidden = false;
        stageHint.textContent = `Tự nhận thưởng đến tầng ${run.cleared} khi hết lượt.`;
      }
    } else if (run.status === 'failed' || run.status === 'expired') {
      makeCards(false);
      const card = board.children[run.lastPick ?? 0];
      if (run.status === 'failed' && card) {
        selected = card;
        card.classList.add('is-selected', 'is-revealed', 'is-settled');
        setCardResult(card, 'trap');
        board.classList.add('has-selection');
      }
      board.querySelectorAll('button').forEach((control) => (control.disabled = true));
      finish(false);
      if (run.status === 'expired') {
        stageTitle.textContent = 'Lượt tháp đã hết hạn';
        stageHint.textContent = 'Chưa có tầng nào được hoàn thành.';
      }
    } else if (run.status === 'decision') {
      makeCards(false);
      selected = board.children[run.lastPick ?? 0];
      if (selected) {
        selected.classList.add('is-selected', 'is-revealed');
        setCardResult(selected, 'safe');
        board.classList.add('has-selection');
      }
      board.querySelectorAll('button').forEach((control) => (control.disabled = true));
      showDecision();
    } else showChoosing();
  }
}
