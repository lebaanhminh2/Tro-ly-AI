// Canvas/DOM rendering adapted from the approved v12. No summon mutations.
export const REVEAL_RANKS = {
  R: { color: '#3868ad', rgb: [56, 104, 173], name: 'Lam', ms: 7000, level: 0 },
  SR: { color: '#8150b0', rgb: [129, 80, 176], name: 'Tím', ms: 7000, level: 1 },
  SSR: { color: '#a76823', rgb: [167, 104, 35], name: 'Kim', ms: 7000, level: 2 },
  UR: { color: '#b63d53', rgb: [182, 61, 83], name: 'Đỏ', ms: 7000, level: 3 },
};
export function createRevealMotion({ dialog, nodes, queue, isReduced, onComplete }) {
  const $ = (id) => nodes[id];
  const ranks = REVEAL_RANKS;
  const seal = $('seal'),
    cardStage = $('card-stage'),
    portrait = $('portrait'),
    outgoing = $('outgoing'),
    cinematic = $('cinematic'),
    omen = $('omen'),
    veil = $('impact-veil'),
    identity = $('identity'),
    anticipation = $('anticipation');
  const scene = $('scene'),
    particles = $('particles');
  let ctx, background;
  try {
    ctx = particles.getContext('2d');
    background = scene.getContext('2d', { alpha: false });
  } catch {
    return null;
  }
  if (!ctx || !background) return null;
  const motion = {
    get matches() {
      return isReduced();
    },
  };
  let index = 0,
    mode = 'intro',
    progress = 0,
    duration = 7000,
    frame = 0,
    startedAt = 0,
    complete = false,
    disposed = false,
    paused = false;
  let width = 390,
    height = 844,
    originY = 340,
    ratio = 1,
    heroSize = 350,
    cardWidth = 300,
    cardHeight = 420;
  const clamp = (n) => Math.max(0, Math.min(1, n));
  const ramp = (a, b, p) => clamp((p - a) / (b - a));
  const smooth = (a, b, p) => {
    const t = ramp(a, b, p);
    return t * t * (3 - 2 * t);
  };
  const ease = (n) => 1 - Math.pow(1 - clamp(n), 3);
  const easeInOut = (n) => {
    const t = clamp(n);
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  };
  const impulse = (p, at, span) => {
    const q = (p - at) / span;
    return q >= 0 && q <= 1 ? Math.sin(q * Math.PI * 3) * Math.exp(-q * 4) : 0;
  };
  const rgba = (rgb, a) => 'rgba(' + rgb.join(',') + ',' + a + ')';
  // The batch advertises its highest rarity before the first card turns.
  const introRank = () =>
    queue.length > 1 && index === 0
      ? Object.values(ranks).find(
          (r) => r.level === Math.max(...queue.map((s) => ranks[s.rank].level)),
        )
      : ranks[queue[index].rank];

  const luminous = {
    R: [101, 165, 248],
    SR: [186, 139, 248],
    SSR: [248, 186, 90],
    UR: [252, 88, 112],
  };
  const nextTiming = { R: 400, SR: 740, SSR: 1120, UR: 1680 };
  let ambientFrame = 0;
  let ambientTime = 0;
  const mixColor = (from, to, t) => from.map((v, i) => Math.round(v + (to[i] - v) * t));
  const pulse = (p, at, span) => {
    const n = (p - at) / span;
    return n >= 0 && n < 1 ? Math.sin(n * Math.PI) : 0;
  };
  // This is a card treatment, shared by every species. No elemental scenery.
  // A bright filament only travels along a small portion of the perimeter.
  function drawFrameEnergy(rank, centerY, opacity, release, clock, charge = 0) {
    if (opacity < 0.001) return;
    const c = ctx;
    const color = luminous[rank.key];
    const w = cardWidth,
      h = cardHeight;
    const top = centerY - h / 2;
    c.save();
    c.globalAlpha = opacity;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    // Sparse light on the bevel. The static card remains readable between pulses.
    for (const side of [-1, 1]) {
      const x = width / 2 + side * (w / 2 - 1.5);
      const travel = fract(clock * 0.13 + (side === 1 ? 0.54 : 0));
      const y = top + 18 + travel * (h - 40);
      const span = 22 + rank.level * 5;
      const g = c.createLinearGradient(x, y - span, x, y + span);
      g.addColorStop(0, rgba(color, 0));
      g.addColorStop(0.42, rgba(color, 0.38 + rank.level * 0.1));
      g.addColorStop(0.5, rgba(mixColor(color, [243, 239, 225], 0.65), 0.65 + rank.level * 0.1));
      g.addColorStop(0.58, rgba(color, 0.38 + rank.level * 0.1));
      g.addColorStop(1, rgba(color, 0));
      c.strokeStyle = g;
      c.lineWidth = 1.2;
      c.beginPath();
      c.moveTo(x, Math.max(top + 4, y - span));
      c.lineTo(x, Math.min(top + h - 4, y + span));
      c.stroke();
    }
    // Before the face appears, a short light travels from the lower bevel to the crown.
    // Its route follows the square corners of the visible card.
    if (charge > 0.001 && rank.level > 0) {
      for (const side of [-1, 1]) {
        const edge = width / 2 + side * (w / 2 - 1.5);
        const points = [
          { x: width / 2, y: top + h - 1.5 },
          { x: edge, y: top + h - 1.5 },
          { x: edge, y: top + 1.5 },
          { x: width / 2, y: top + 1.5 },
        ];
        const lengths = points
          .slice(1)
          .map((point, i) => Math.hypot(point.x - points[i].x, point.y - points[i].y));
        const total = lengths.reduce((sum, n) => sum + n, 0);
        const pointAt = (position) => {
          let remain = position * total;
          for (let i = 0; i < lengths.length; i++) {
            if (remain <= lengths[i]) {
              const t = remain / lengths[i];
              return {
                x: points[i].x + (points[i + 1].x - points[i].x) * t,
                y: points[i].y + (points[i + 1].y - points[i].y) * t,
              };
            }
            remain -= lengths[i];
          }
          return points.at(-1);
        };
        const lead = Math.min(1, charge * 1.05);
        for (let i = 0; i < 20; i++) {
          const from = Math.max(0, lead - 0.22 + i * 0.011);
          const to = Math.max(0, Math.min(1, from + 0.012));
          const a = pointAt(from),
            b = pointAt(to);
          c.strokeStyle = rgba(
            i > 16 ? [241, 238, 228] : color,
            (i / 20) * Math.sin(charge * Math.PI * 0.8) * 0.9,
          );
          c.lineWidth = i > 16 ? 1.35 : 1.8;
          c.beginPath();
          c.moveTo(a.x, a.y);
          c.lineTo(b.x, b.y);
          c.stroke();
        }
      }
    }
    // Arc bursts have a quiet interval and a stable seeded shape, not white noise.
    const arcs = rank.level;
    for (let i = 0; i < arcs; i++) {
      const cycle = clock * 0.36 + i * 0.39;
      const age = fract(cycle);
      const resting = age < 0.13 ? Math.sin((age / 0.13) * Math.PI) * 0.55 : 0;
      const power = Math.max(resting, release * (0.75 + rank.level * 0.08));
      if (power < 0.01) continue;
      const side = i % 2 ? -1 : 1;
      const seed = Math.floor(cycle) + i * 71;
      const startY = top + h * (0.13 + random(seed + 14) * 0.47);
      const length = h * (0.12 + random(seed + 18) * 0.2);
      const edge = width / 2 + side * (w / 2 + 1);
      const points = Array.from({ length: 8 }, (_, k) => ({
        x:
          edge +
          side * Math.sin((k / 7) * Math.PI) * (2 + random(seed * 11 + k) * (5 + rank.level * 2)),
        y: startY + (k / 7) * length,
      }));
      const trace = () => {
        c.beginPath();
        points.forEach((point, k) => (k ? c.lineTo(point.x, point.y) : c.moveTo(point.x, point.y)));
        c.stroke();
      };
      c.strokeStyle = rgba(color, power * 0.13);
      c.lineWidth = 8;
      trace();
      c.strokeStyle = rgba(color, power * 0.85);
      c.lineWidth = 2;
      trace();
      c.strokeStyle = rgba([246, 243, 255], power * 0.8);
      c.lineWidth = 0.65;
      trace();
      c.strokeStyle = rgba(color, power * 0.6);
      c.lineWidth = 0.7;
      c.beginPath();
      c.moveTo(points[3].x, points[3].y);
      c.lineTo(points[3].x + side * 8, points[3].y - 6);
      c.lineTo(points[3].x + side * 13, points[3].y - 4);
      c.stroke();
    }
    if (release > 0.01) {
      for (let i = 0; i < 9 + rank.level * 5; i++) {
        const side = i % 2 ? -1 : 1;
        const distance = (1 - release) * (14 + random(i + 90) * 46);
        const x = width / 2 + side * (w / 2 + distance);
        const y = top + h * (0.1 + random(i + 102) * 0.8) - distance * 0.6;
        c.fillStyle = rgba(i % 3 ? color : [244, 238, 225], release * 0.65);
        c.fillRect(x, y, i % 5 ? 1 : 1.8, 2 + release * 3);
      }
    }
    c.restore();
  }

  // A quiet, cached dust field leaves contrast for the moving comet and the card.
  // All live rendering uses Canvas2D, including devices without WebGL.
  function makeNebula() {
    const texture = document.createElement('canvas');
    texture.width = 640;
    texture.height = 1100;
    const c = texture.getContext('2d');
    const depth = c.createLinearGradient(0, 0, 500, 1100);
    depth.addColorStop(0, '#101d36');
    depth.addColorStop(0.5, '#070e21');
    depth.addColorStop(1, '#060a16');
    c.fillStyle = depth;
    c.fillRect(0, 0, 640, 1100);
    c.save();
    c.translate(230, 370);
    c.rotate(-0.52);
    c.scale(1, 0.34);
    const dust = c.createRadialGradient(0, 0, 12, 0, 0, 650);
    dust.addColorStop(0, 'rgba(92,124,176,.16)');
    dust.addColorStop(0.35, 'rgba(63,88,143,.10)');
    dust.addColorStop(1, 'rgba(25,42,85,0)');
    c.fillStyle = dust;
    c.fillRect(-700, -700, 1400, 1400);
    c.restore();
    return texture;
  }
  let nebula;
  const fract = (x) => x - Math.floor(x);
  const random = (n) => fract(Math.sin(n * 127.1 + 311.7) * 43758.5453);
  const stars = Array.from({ length: 230 }, (_, i) => ({
    x: random(i + 1),
    y: random(i + 401),
    z: 0.18 + random(i + 801) * 0.82,
    size: 0.3 + random(i + 1201) * 0.7,
    tint: random(i + 1601),
  }));

  function glow(c, x, y, radius, color, opacity) {
    if (opacity < 0.001 || radius <= 0) return;
    const paint = c.createRadialGradient(x, y, 0, x, y, radius);
    paint.addColorStop(0, rgba(color, opacity));
    paint.addColorStop(0.12, rgba(color, opacity * 0.42));
    paint.addColorStop(0.42, rgba(color, opacity * 0.1));
    paint.addColorStop(1, rgba(color, 0));
    c.fillStyle = paint;
    c.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  // The camera tracks the comet before it overtakes us. It never parks in midair.
  function meteorPosition(seconds) {
    const t = ramp(0, 3.4, seconds);
    const pass = Math.pow(ramp(3.4, 3.94, seconds), 2.5);
    return {
      x: width * (0.19 + 0.43 * t - 0.045 * Math.sin(t * Math.PI) + pass * 1.75),
      y: height * (0.2 + 0.3 * t - 0.085 * Math.sin(t * Math.PI) + pass * 0.37),
    };
  }

  function drawComet(c, seconds, rank) {
    if (seconds > 4.02) return;
    const approach = smooth(0, 3.5, seconds);
    const signal = smooth(2.2, 2.45, seconds);
    const pass = ramp(3.4, 3.94, seconds);
    const head = meteorPosition(seconds);
    const flash = pulse(seconds, 2.28, 0.52);
    const color = mixColor([135, 191, 251], luminous[rank.key], signal);
    const previous = meteorPosition(Math.max(0, seconds - 0.04));
    const angle = Math.atan2(head.y - previous.y || 0.1, head.x - previous.x || 0.1);
    const mass = 0.34 + approach * 0.85 + Math.pow(pass, 2) * 3.5;
    const length = width * (0.42 + approach * 0.75 + pass * 0.7);
    const breadth = 8 + approach * 26 + pass * 45;
    c.save();
    c.translate(head.x, head.y);
    c.rotate(angle);
    c.globalAlpha = smooth(0.02, 0.3, seconds);
    c.globalCompositeOperation = 'lighter';
    // Shaped, asymmetric ribbons taper into the distance; a crisp core carries speed.
    for (let layer = 0; layer < 3; layer++) {
      const tail = length * (1 - layer * 0.12);
      const spread = breadth * [1.5, 0.78, 0.14][layer];
      const paint = c.createLinearGradient(-tail, 0, 8, 0);
      paint.addColorStop(0, rgba(color, 0));
      paint.addColorStop(0.3, rgba(color, [0.035, 0.12, 0.3][layer]));
      paint.addColorStop(
        0.82,
        rgba(layer === 2 ? [227, 242, 255] : color, [0.22, 0.8, 0.98][layer]),
      );
      paint.addColorStop(1, 'rgba(255,255,255,.95)');
      const flutter = Math.sin(seconds * 3.7 + layer * 0.8) * spread * 0.17;
      c.beginPath();
      c.moveTo(11 * mass, 0);
      c.bezierCurveTo(
        -tail * 0.1,
        -spread * 0.35,
        -tail * 0.5,
        -spread + flutter,
        -tail,
        -spread * 0.24,
      );
      c.bezierCurveTo(-tail * 0.47, spread * 0.4, -tail * 0.15, spread * 0.18, 11 * mass, 0);
      c.closePath();
      c.fillStyle = paint;
      c.fill();
    }
    for (let i = 0; i < 4; i++) {
      const offset = (i - 1.5) * (2.8 + approach * 2.5);
      const tail = length * (0.35 + random(i + 73) * 0.65);
      const paint = c.createLinearGradient(-tail, 0, -15, 0);
      paint.addColorStop(0, rgba(color, 0));
      paint.addColorStop(0.58, rgba(color, 0.18));
      paint.addColorStop(1, rgba([231, 244, 255], 0.65));
      c.strokeStyle = paint;
      c.lineWidth = i === 3 ? 1.2 : 0.6;
      c.beginPath();
      c.moveTo(-tail, offset * 1.7);
      c.quadraticCurveTo(-tail * 0.45, offset + Math.sin(seconds * 8 + i) * 3, -10, offset * 0.08);
      c.stroke();
    }
    // The white, pointed head is readable without a large blurry light ball.
    glow(c, 0, 0, (32 + flash * 38) * mass, color, 0.6);
    c.fillStyle = '#f7fcff';
    c.beginPath();
    c.moveTo(12 * mass, 0);
    c.lineTo(-6 * mass, -4.5 * mass);
    c.lineTo(-39 * mass, 0);
    c.lineTo(-6 * mass, 3.6 * mass);
    c.closePath();
    c.fill();
    glow(c, 0, 0, 9 * mass, [255, 255, 255], 0.95);
    // Rank comes from an unmistakable colored release, rather than a tinted screen.
    if (signal > 0) {
      const strength = signal * (0.38 + flash * (0.4 + rank.level * 0.11));
      const flare = c.createLinearGradient(0, -40 * mass, 0, 40 * mass);
      flare.addColorStop(0, rgba(color, 0));
      flare.addColorStop(0.49, rgba(color, strength));
      flare.addColorStop(0.5, '#fff8ee');
      flare.addColorStop(0.51, rgba(color, strength));
      flare.addColorStop(1, rgba(color, 0));
      c.fillStyle = flare;
      c.fillRect(-0.8, -40 * mass, 1.6, 80 * mass);
      for (let i = 0; i < 2 + Math.ceil(rank.level / 2); i++) {
        const side = i % 2 ? 1 : -1;
        const offset = side * (8 + (i % 3) * 6) * signal;
        const tail = length * (0.25 + random(i + 301) * 0.55);
        c.strokeStyle = rgba(color, 0.45 + flash * 0.4);
        c.lineWidth = (rank.level >= 2 ? 1.6 : 1) * mass;
        c.beginPath();
        c.moveTo(-tail, offset * 2.8);
        c.quadraticCurveTo(-tail * 0.45, offset * 1.5, -14 * mass, offset * 0.16);
        c.stroke();
      }
      // The white shell breaks into colored fragments at the rank signal.
      // They are immediately swept backward by the flight rather than orbiting it.
      const release = ramp(2.22, 2.9, seconds);
      if (release > 0 && release < 1) {
        for (let i = 0; i < 6 + rank.level * 3; i++) {
          const travel = Math.pow(release, 0.7);
          const x = -15 - travel * width * (0.12 + random(i + 440) * 0.52);
          const y = (random(i + 540) - 0.5) * travel * width * 0.55;
          const size = (2 + random(i + 640) * 5) * Math.sin(release * Math.PI);
          c.save();
          c.translate(x, y);
          c.rotate((random(i + 740) - 0.5) * 0.9);
          c.beginPath();
          c.moveTo(size * 2.2, 0);
          c.lineTo(-size, -size * 0.6);
          c.lineTo(-size * 0.3, size * 0.5);
          c.closePath();
          c.fillStyle = rgba(color, Math.sin(release * Math.PI) * 0.85);
          c.fill();
          c.strokeStyle = rgba([244, 248, 255], (1 - release) * 0.8);
          c.lineWidth = 0.6;
          c.stroke();
          c.restore();
        }
      }
    }
    // Flecks detach and fall behind along the same trajectory, with stable seeds.
    for (let i = 0; i < 24; i++) {
      const age = fract(seconds * (0.9 + random(i) * 0.7) + random(i + 211));
      const x = -age * length * 0.75;
      const y = (random(i + 71) - 0.5) * (6 + age * breadth * 3);
      const size = (0.5 + random(i + 101) * 1.2) * mass;
      c.strokeStyle = rgba(i % 5 ? color : [245, 248, 255], (1 - age) * 0.72 * approach);
      c.lineWidth = size;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x - (3 + age * 12) * mass, y);
      c.stroke();
    }
    c.restore();
  }

  function drawSpace(p, rank, centerY) {
    const c = background;
    const quick = mode === 'next';
    const seconds = quick ? 7 : p * 7;
    const flight = Math.min(seconds, 3.85);
    const camera = flight * 0.18 + flight * flight * 0.052;
    const settled = quick ? 1 : smooth(4, 6.2, seconds);
    c.setTransform(ratio, 0, 0, ratio, 0, 0);
    c.fillStyle = '#070d1c';
    c.fillRect(0, 0, width, height);
    c.globalAlpha = 1 - settled * 0.55;
    c.drawImage(nebula, -camera * 9, -camera * 5, width + 25, height + 20);
    c.globalAlpha = 1;
    c.lineCap = 'round';
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      const x = fract(s.x - camera * s.z * 0.34) * (width + 80) - 40;
      const y = fract(s.y - camera * s.z * 0.15) * (height + 80) - 40;
      const alpha = (0.18 + s.z * 0.48) * (1 - settled * 0.72);
      const size = s.size * (0.55 + s.z * 0.8);
      c.fillStyle = rgba(s.tint > 0.92 ? [240, 218, 184] : [190, 213, 244], alpha);
      c.fillRect(x, y, size, size);
      if (!quick && seconds > 0.45 && seconds < 3.95 && s.z > 0.46) {
        const speed = (2 + flight * 3.5 + Math.pow(ramp(3.4, 3.95, seconds), 2) * 45) * s.z;
        c.strokeStyle = rgba([155, 190, 234], alpha * 0.45);
        c.lineWidth = size * 0.65;
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x + speed, y + speed * 0.5);
        c.stroke();
      }
    }
    drawComet(c, seconds, rank);

    // Passing close to the lens joins the flight and the card, hiding the handoff.
    if (!quick && seconds > 3.5 && seconds < 4.2) {
      const pass = ramp(3.5, 4.2, seconds);
      c.save();
      c.translate(width * (1.35 - pass * 1.7), height * 0.43);
      c.rotate(0.52);
      const reach = width * 1.9;
      const half = 14 + Math.sin(pass * Math.PI) * width * 0.34;
      const wipe = c.createLinearGradient(0, -half, 0, half);
      wipe.addColorStop(0, rgba(luminous[rank.key], 0));
      wipe.addColorStop(0.4, rgba(luminous[rank.key], 0.58));
      wipe.addColorStop(0.5, 'rgba(242,249,255,.92)');
      wipe.addColorStop(0.6, rgba(luminous[rank.key], 0.58));
      wipe.addColorStop(1, rgba(luminous[rank.key], 0));
      c.fillStyle = wipe;
      c.globalAlpha = Math.sin(pass * Math.PI);
      c.fillRect(-reach, -half, reach * 2, half * 2);
      c.restore();
    }

    const charge = quick ? 0 : smooth(4.1, 4.9, seconds) * (1 - smooth(5.3, 5.55, seconds));
    if (charge > 0) {
      c.save();
      c.globalCompositeOperation = 'screen';
      glow(c, width / 2, centerY, heroSize * 0.64, luminous[rank.key], charge * 0.28);
      // Thin drifting embers retain the rank around the actual illustration.
      for (let i = 0; i < 16; i++) {
        const side = i % 2 ? 1 : -1;
        const age = fract(seconds * 0.4 + random(i + 301));
        const x = width / 2 + side * heroSize * (0.34 + random(i + 91) * 0.12);
        const y = centerY + (0.5 - age) * heroSize * 1.15;
        c.fillStyle = rgba(luminous[rank.key], charge * Math.sin(age * Math.PI) * 0.75);
        c.fillRect(x, y, 1, 3 + random(i + 51) * 4);
      }
      c.restore();
    }
    // A restrained pool of depth behind the final creature, with readable edges.
    if (settled > 0) {
      glow(
        c,
        width / 2,
        centerY,
        heroSize * 0.85,
        mixColor([60, 79, 119], luminous[rank.key], 0.28),
        settled * 0.23,
      );
    }
  }

  function drawBackground(p, rank, centerY, cue, release) {
    const c = background;
    dialog.style.setProperty('--rank', rgba(luminous[rank.key], 1));
    dialog.style.setProperty('--scene-label', '#c2c7d7');
    dialog.style.setProperty('--title-color', '#f7f4fc');
    dialog.style.setProperty('--detail-color', '#a8acc1');
    drawSpace(p, rank, centerY);
    if (cue > 0) {
      c.fillStyle = rgba([3, 5, 13], cue * rank.level * 0.095);
      c.fillRect(0, 0, width, height);
      glow(c, width / 2, centerY, heroSize * 0.84, luminous[rank.key], cue * 0.2);
    }
    if (release > 0) {
      c.save();
      c.globalCompositeOperation = 'screen';
      glow(c, width / 2, centerY, heroSize * 0.95, luminous[rank.key], release * 0.38);
      c.restore();
    }
  }

  function drawParticles(
    rank,
    centerY,
    opacity,
    release,
    clock,
    charge = 0,
    offset = 0,
    scale = 1,
    angle = 0,
  ) {
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.translate(width / 2, centerY + offset);
    ctx.rotate((angle * Math.PI) / 180);
    ctx.scale(scale, scale);
    ctx.translate(-width / 2, -centerY);
    drawFrameEnergy(rank, centerY, opacity, release, clock, charge);
    ctx.restore();
  }

  function draw(time) {
    progress = time;
    const item = queue[index];
    if (!item) return;
    const rank = { ...ranks[item.rank], key: item.rank };
    const fx = mode === 'intro' ? { ...introRank() } : rank;
    fx.key = Object.keys(ranks).find((k) => ranks[k].level === fx.level);
    const seconds = time * 7;
    const quick = mode === 'next';
    const level = rank.level;
    const revealAt = quick ? [0.12, 0.31, 0.44, 0.51][level] : 5.48 / 7;
    const revealEnd = quick ? [0.8, 0.85, 0.86, 0.85][level] : 6.5 / 7;
    const unveil = ease(ramp(revealAt, revealEnd, time));
    const arrival = quick ? smooth(0.08, 0.34, time) : smooth(5.38, 5.8, seconds);
    const releaseAt = quick ? [0.13, 0.32, 0.45, 0.52][level] : 5.58 / 7;
    const release = pulse(time, releaseAt, quick ? 0.39 : 0.1);
    const cue = quick
      ? smooth(0.08, revealAt, time) * (1 - smooth(revealAt, revealEnd, time))
      : smooth(4.4, 5.1, seconds) * (1 - smooth(5.5, 5.8, seconds));
    // The batch omen resolves to this card's rank as its face turns toward us.
    const lighting = seconds < 5.24 && !quick ? { ...fx } : rank;
    const centerY = originY;
    dialog.style.setProperty('--visual-y', centerY + 'px');
    cardStage.style.top = portrait.style.top = centerY + 'px';
    outgoing.style.top = centerY + 'px';
    dialog.dataset.rank = item.rank;
    dialog.style.setProperty('--card-light', rgba(luminous[item.rank], 0.48));
    drawBackground(time, lighting, centerY, cue, release);
    drawParticles(
      rank,
      centerY,
      arrival,
      Math.max(release, quick ? cue * 0.32 : 0),
      ambientTime + (quick ? time * 1.6 : seconds),
      quick ? ramp(0.1, revealAt, time) * (1 - smooth(revealAt, revealEnd, time)) : 0,
      (1 - unveil) * (quick ? 11 : 5),
      1 + (1 - unveil) * (quick ? 0.018 : 0.015),
      (1 - unveil) * (quick ? -1.1 : 0.3),
    );
    dialog.style.setProperty('--omen-color', rgba(luminous[fx.key], 1));
    const presence = quick ? 0 : smooth(2.2, 2.45, seconds) * (1 - smooth(5.26, 5.6, seconds));
    dialog.style.setProperty('--omen-presence', presence);
    dialog.style.setProperty('--omen-shadow', rgba(luminous[fx.key], 0.24 * presence));
    dialog.style.setProperty('--reflection-x', 150 - smooth(4.1, 5.05, seconds) * 220 + '%');
    dialog.style.setProperty('--opening-labels', quick ? 1 : smooth(3.95, 4.4, seconds));
    const signal = $('rarity-signal');
    signal.textContent = item.rank;
    signal.style.opacity =
      quick && level > 0
        ? smooth(0.1, revealAt - 0.07, time) * (1 - smooth(revealAt - 0.04, revealAt + 0.035, time))
        : 0;
    signal.style.transform = 'translate(-50%, -50%) scale(' + (0.96 + cue * 0.04) + ')';
    // A single damped recoil on release, with no looping camera vibration.
    const kick = pulse(time, releaseAt, quick ? 0.22 : 0.065) * level;
    const recoil = quick ? kick * 0.7 : kick;
    cinematic.style.transform =
      motion.matches || time === 1 || recoil < 0.005
        ? 'none'
        : 'translate(' +
          impulse(time, releaseAt, quick ? 0.25 : 0.075) * level * 1.8 +
          'px,' +
          -recoil * 0.7 +
          'px) scale(' +
          (1 + recoil * 0.0025) +
          ')';
    omen.style.opacity = 0;
    veil.style.opacity = pulse(time, releaseAt, quick ? 0.07 : 0.018) * (level >= 2 ? 0.12 : 0.035);
    outgoing.style.opacity = quick ? 1 - smooth(0, 0.24, time) : 0;
    outgoing.style.transform =
      'translate(calc(-50% - ' +
      (quick ? ease(ramp(0, 0.35, time)) * 14 : 0) +
      'px),-50%) scale(.99)';
    portrait.style.opacity = arrival;
    portrait.querySelector('.rarity-frame').style.opacity = quick ? 1 : smooth(5.52, 5.85, seconds);
    portrait.style.transform =
      'translate(-50%,calc(-50% + ' +
      (1 - unveil) * (quick ? 11 : 5) +
      'px)) scale(' +
      (1 + (1 - unveil) * (quick ? 0.018 : 0.015)) +
      ') rotate(' +
      (1 - unveil) * (quick ? -1.1 : 0.3) +
      'deg)';
    portrait.style.filter = 'none';
    $('beast-art').style.opacity = smooth(revealAt, revealAt + (quick ? 0.23 : 0.045), time);
    $('beast-art').style.transform =
      'translateY(' + (1 - unveil) * 8 + 'px) scale(' + (1.035 - unveil * 0.035) + ')';
    $('beast-art').style.filter = 'brightness(' + (0.8 + unveil * 0.2) + ')';
    const identityAt = quick ? Math.min(revealAt + 0.16, 0.67) : 6.13 / 7;
    identity.style.opacity = smooth(identityAt, quick ? 0.96 : 6.72 / 7, time);
    identity.style.transform =
      'translateY(' + (1 - ease(ramp(identityAt, quick ? 0.96 : 6.72 / 7, time))) * 7 + 'px)';
    anticipation.style.opacity = quick
      ? 0
      : smooth(4.3, 4.55, seconds) * (1 - smooth(4.9, 5.1, seconds));
    anticipation.textContent = 'Giao ước đang thức tỉnh';
    if (quick) {
      cardStage.style.opacity = 0;
      dialog.dataset.phase =
        time === 1
          ? 'complete'
          : time < revealAt
            ? 'rank-anticipation'
            : time < revealEnd
              ? 'card-release'
              : 'settle';
      return;
    }
    const charge = smooth(4.2, 5.1, seconds);
    const flip = easeInOut(ramp(5.12, 5.58, seconds));
    const settle = ease(ramp(3.65, 4.45, seconds));
    // A decelerating approach and two small tugs replace constant sine shaking.
    const tug =
      impulse(seconds, 4.65, 0.28) * 1.1 + impulse(seconds, 4.95, 0.14) * (0.6 + fx.level * 0.25);
    const yaw = (27 * (1 - settle) - 8 * charge) * (1 - flip) + 180 * flip;
    cardStage.style.opacity = smooth(3.65, 4.08, seconds) * (1 - smooth(5.5, 5.84, seconds));
    cardStage.style.filter = 'none';
    cardStage.style.transform =
      'translate(calc(-50% + ' +
      (1 - settle) * 12 +
      'px),calc(-50% + ' +
      ((1 - settle) * 18 + tug) +
      'px)) rotateZ(' +
      (-9 * (1 - settle) - (1 - flip) * charge * 1.4) +
      'deg) scale(' +
      (0.93 + settle * 0.07) +
      ')';
    seal.style.transform = 'rotateY(' + yaw + 'deg) rotateX(' + -3 * charge * (1 - flip) + 'deg)';
    $('front-mat').style.opacity = 1;
    $('front-art').style.visibility = 'visible';
    $('front-art').style.opacity = 0;
    $('front-art').style.filter = 'brightness(' + (0.8 + flip * 0.2) + ')';
    $('front-rank').style.opacity = 0;
    dialog.dataset.phase =
      seconds < 0.55
        ? 'space'
        : seconds < 2.2
          ? 'flight'
          : seconds < 3.4
            ? 'rarity'
            : seconds < 4.2
              ? 'condense'
              : seconds < 4.95
                ? 'charge'
                : seconds < 5.12
                  ? 'hold'
                  : seconds < 5.58
                    ? 'flip'
                    : seconds < 6.5
                      ? 'card-release'
                      : seconds < 7
                        ? 'settle'
                        : 'complete';
  }

  function fit() {
    if (disposed) return;
    const box = dialog.getBoundingClientRect();
    width = box.width;
    height = box.height;
    const top = $('top').getBoundingClientRect().bottom - box.top + 26;
    const bottom = $('dock').getBoundingClientRect().top - box.top - 24;
    const available = Math.max(140, bottom - top);
    cardWidth = Math.min(326, width - 48, (available * 5) / 7);
    cardHeight = (cardWidth * 7) / 5;
    originY = top + available / 2;
    dialog.style.setProperty('--card-width', cardWidth + 'px');
    dialog.style.setProperty('--card-height', cardHeight + 'px');
    const pictureHeight = Math.max(0, cardHeight - identity.offsetHeight - 58);
    heroSize = Math.max(0, Math.min(cardWidth - 12, pictureHeight));
    dialog.style.setProperty('--art-top', 18 + (pictureHeight - heroSize) / 2 + 'px');
    dialog.style.setProperty('--hero-size', heroSize + 'px');
    dialog.style.setProperty('--hero-y', originY + 'px');
    ratio = Math.min(devicePixelRatio || 1, 2, Math.sqrt(1100000 / (width * height)));
    scene.width = particles.width = Math.max(1, Math.round(width * ratio));
    scene.height = particles.height = Math.max(1, Math.round(height * ratio));
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    if (dialog.open && !dialog.classList.contains('is-summary')) draw(progress);
  }
  function stopAmbient() {
    cancelAnimationFrame(ambientFrame);
    ambientFrame = 0;
  }
  function stop() {
    stopAmbient();
    cancelAnimationFrame(frame);
    frame = 0;
  }
  function startAmbient() {
    stopAmbient();
    if (isReduced() || disposed || document.hidden || paused) return;
    let last = 0;
    const animate = (now) => {
      if (disposed || !dialog.open || !complete || document.hidden || paused) return;
      if (now - last >= 48) {
        ambientTime += last ? Math.min((now - last) / 1000, 0.1) : 0;
        last = now;
        drawParticles(
          { ...ranks[queue[index].rank], key: queue[index].rank },
          originY,
          1,
          0,
          ambientTime,
        );
      }
      ambientFrame = requestAnimationFrame(animate);
    };
    ambientFrame = requestAnimationFrame(animate);
  }
  function finish() {
    if (disposed) return;
    stop();
    complete = true;
    progress = 1;
    draw(1);
    dialog.dataset.progress = '1';
    onComplete();
    startAmbient();
  }
  function tick(now) {
    if (disposed || complete || paused || !dialog.open) return;
    const p = clamp((now - startedAt) / duration);
    draw(p);
    dialog.dataset.progress = String(p);
    if (p >= 1) finish();
    else frame = requestAnimationFrame(tick);
  }
  function play(nextIndex, kind) {
    if (disposed) return;
    stop();
    index = nextIndex;
    mode = kind;
    complete = false;
    progress = 0;
    duration = kind === 'intro' ? 7000 : nextTiming[queue[index].rank];
    dialog.dataset.mode = kind;
    dialog.dataset.duration = String(duration);
    dialog.dataset.progress = '0';
    paused = document.hidden;
    fit();
    startedAt = performance.now();
    if (isReduced()) finish();
    else if (!paused) frame = requestAnimationFrame(tick);
  }
  function pause() {
    if (disposed) return;
    paused = true;
    stop();
  }
  function resume() {
    if (disposed || !paused) return;
    paused = false;
    if (complete) startAmbient();
    else {
      startedAt = performance.now() - progress * duration;
      frame = requestAnimationFrame(tick);
    }
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    stop();
    scene.width = scene.height = particles.width = particles.height = 1;
    nebula = null;
  }
  try {
    nebula = makeNebula();
  } catch {
    return null;
  }
  return { play, finish, fit, pause, resume, stop, dispose };
}
