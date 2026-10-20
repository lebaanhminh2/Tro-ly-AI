// One presentation timeline. The receipt has already committed the evolution.
export const EVOLUTION_STYLES = {
  pyropup: { kind: 'fire', color: '#ff9a53', light: '#ffe5a5', ink: '#35110d' },
  rubblet: { kind: 'earth', color: '#e6ac6a', light: '#ffedbb', ink: '#261a15' },
  frostnip: { kind: 'ice', color: '#8cdbf2', light: '#e1fbff', ink: '#102633' },
  zappur: { kind: 'storm', color: '#baa0ff', light: '#f3e5ff', ink: '#211635' },
  skinklet: { kind: 'prism', color: '#8ae6c6', light: '#e6fff2', ink: '#10282b' },
  punchimp: { kind: 'earth', color: '#e9be74', light: '#fff0c6', ink: '#2a2016' },
  shardsnail: { kind: 'ice', color: '#cfb2ff', light: '#f4e6ff', ink: '#251e3a' },
  flameow: { kind: 'fire', color: '#ffb481', light: '#fff1c5', ink: '#321b19' },
  manteeny: { kind: 'bloom', color: '#f3b1d7', light: '#fff1e9', ink: '#301d30' },
  fluffle: { kind: 'wind', color: '#a7e3e1', light: '#e9fff7', ink: '#142b31' },
  maskfry: { kind: 'tide', color: '#78c6e7', light: '#cef4ff', ink: '#0b2337' },
  goonbug: { kind: 'earth', color: '#bcd299', light: '#eff5d4', ink: '#1e2b22' },
  humbug: { kind: 'prism', color: '#d8b67d', light: '#fff0cb', ink: '#282115' },
  hootlet: { kind: 'dream', color: '#c9b4f4', light: '#f1e9ff', ink: '#211b36' },
  gibber: { kind: 'earth', color: '#d6af79', light: '#ffedcb', ink: '#27221e' },
  voltfawn: { kind: 'storm', color: '#a4dce1', light: '#e5fcff', ink: '#12282f' },
  cheerling: { kind: 'dream', color: '#e7b4df', light: '#fff0f9', ink: '#2e2034' },
  funglet: { kind: 'bloom', color: '#b7cbe8', light: '#eff4ff', ink: '#1e2536' },
};

const clamp = (n) => Math.max(0, Math.min(1, n));
const ramp = (a, b, n) => clamp((n - a) / (b - a));
const smooth = (a, b, n) => {
  const t = ramp(a, b, n);
  return t * t * (3 - 2 * t);
};
const out = (n) => 1 - (1 - clamp(n)) ** 3;
const tau = Math.PI * 2;
const noise = (i) => {
  const n = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return n - Math.floor(n);
};

export function createEvolutionMotion({
  dialog,
  canvas,
  before,
  after,
  speciesId,
  form,
  onComplete,
}) {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return null;
  const style = EVOLUTION_STYLES[speciesId] ?? EVOLUTION_STYLES.hootlet;
  const duration = form === 4 ? 6600 : form === 3 ? 6000 : 5600;
  const compressionStart = 0.395;
  const compressionEnd = 0.46;
  const burstAt = compressionEnd + 100 / duration;
  let width = 390,
    height = 844,
    cx = 195,
    cy = 365,
    finalY = 280,
    cinemaY = 375,
    size = 340,
    unit = 1;
  let frame = 0,
    clock,
    disposed = false,
    complete = false,
    progress = 0;
  const glowCache = new Map();
  const silhouettes = new Map();
  function silhouette(image) {
    if (silhouettes.has(image)) return silhouettes.get(image);
    const sprite = document.createElement('canvas');
    sprite.width = image.naturalWidth;
    sprite.height = image.naturalHeight;
    const c = sprite.getContext('2d');
    c.drawImage(image, 0, 0);
    c.globalCompositeOperation = 'source-in';
    c.fillStyle = '#fffdf5';
    c.fillRect(0, 0, sprite.width, sprite.height);
    silhouettes.set(image, sprite);
    return sprite;
  }
  // Pre-render soft particles instead of creating dozens of gradients per frame.
  function glow(color) {
    if (glowCache.has(color)) return glowCache.get(color);
    const sprite = document.createElement('canvas');
    sprite.width = sprite.height = 128;
    const c = sprite.getContext('2d');
    const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, color);
    g.addColorStop(0.12, color + 'd9');
    g.addColorStop(0.45, color + '44');
    g.addColorStop(1, color + '00');
    c.fillStyle = g;
    c.fillRect(0, 0, 128, 128);
    glowCache.set(color, sprite);
    return sprite;
  }
  function halo(x, y, radius, alpha, color = style.color, sy = 1) {
    if (alpha < 0.002 || radius <= 0) return;
    ctx.save();
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.globalCompositeOperation = 'screen';
    ctx.drawImage(glow(color), x - radius, y - radius * sy, radius * 2, radius * 2 * sy);
    ctx.restore();
  }
  function line(points, color, alpha, lineWidth = 1) {
    if (alpha <= 0) return;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
    ctx.restore();
  }
  function ellipse(x, y, rx, ry, alpha, rotation = 0, start = 0, end = tau) {
    if (alpha < 0.002) return;
    ctx.save();
    ctx.strokeStyle = style.color;
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.lineWidth = 0.8 * unit;
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rotation, start, end);
    ctx.stroke();
    ctx.restore();
  }
  function fragment(x, y, radius, angle, alpha, seed = 0) {
    // Chunky illustrated stone, with a small bevel rather than a faceted 3D mesh.
    const shapes = [
      [
        [-0.72, -0.52],
        [-0.1, -0.95],
        [0.75, -0.46],
        [0.84, 0.35],
        [0.12, 0.77],
        [-0.8, 0.43],
      ],
      [
        [-0.85, -0.31],
        [-0.3, -0.68],
        [0.66, -0.57],
        [0.93, 0.11],
        [0.36, 0.64],
        [-0.61, 0.56],
      ],
      [
        [-0.4, -0.91],
        [0.41, -0.7],
        [0.69, 0.16],
        [0.15, 0.9],
        [-0.66, 0.42],
        [-0.75, -0.32],
      ],
    ];
    const points = shapes[seed % shapes.length];
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = seed % 2 ? '#776855' : '#665e55';
    ctx.strokeStyle = '#2c2723';
    ctx.lineWidth = 1.15 * unit;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    points.forEach(([px, py], i) =>
      i ? ctx.lineTo(px * radius, py * radius) : ctx.moveTo(px * radius, py * radius),
    );
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = seed % 2 ? '#b09b7d' : '#9e9485';
    ctx.beginPath();
    ctx.moveTo(points[0][0] * radius, points[0][1] * radius);
    ctx.lineTo(points[1][0] * radius, points[1][1] * radius);
    ctx.lineTo(points[2][0] * radius, points[2][1] * radius);
    ctx.lineTo(radius * 0.2, -radius * 0.18);
    ctx.lineTo(-radius * 0.45, -radius * 0.14);
    ctx.closePath();
    ctx.fill();
    line(
      [
        [points[0][0] * radius, points[0][1] * radius],
        [points[1][0] * radius, points[1][1] * radius],
        [points[2][0] * radius, points[2][1] * radius],
      ],
      '#d7c6a7',
      0.45,
      0.6 * unit,
    );
    ctx.restore();
  }
  function background(p, t) {
    ctx.fillStyle = '#090c16';
    ctx.fillRect(0, 0, width, height);
    const sky = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(height * 0.75, width * 0.65));
    sky.addColorStop(0, style.ink);
    sky.addColorStop(0.55, '#10131e');
    sky.addColorStop(1, '#070a11');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);
    const charge = smooth(0.08, 0.4, p) * (1 - smooth(0.48, 0.65, p));
    // Dim the surroundings during concentration, keeping the portrait dominant.
    halo(cx, cy, size * 1.1, 0.1 + smooth(0.55, 0.7, p) * 0.12);
    ctx.fillStyle = '#050811';
    ctx.globalAlpha = charge * 0.22;
    ctx.fillRect(0, 0, width, height);
    ctx.globalAlpha = 1;
    for (let i = 0; i < 32; i++) {
      const x = noise(i + 13) * width;
      const y = (noise(i + 70) * height - t * (2 + noise(i) * 4) + height * 2) % height;
      ctx.globalAlpha = (0.08 + noise(i + 180) * 0.18) * (1 - charge * 0.8);
      ctx.fillStyle = i % 5 ? style.color : style.light;
      ctx.fillRect(x, y, 0.8 * unit, 0.8 * unit);
    }
    ctx.globalAlpha = 1;
    const floor = cy + size * 0.43;
    halo(cx, floor, size * 0.62, 0.2 + charge * 0.35, style.color, 0.15);
    ritual(p, t, floor, charge);
    // Soft light rises from the ritual beneath the gathering qi.
    const beamHeight = size * (0.55 + charge * 0.7);
    const beamWidth = size * 0.15;
    halo(
      cx,
      floor - beamHeight * 0.5,
      beamWidth,
      charge * 0.5,
      style.color,
      beamHeight / (beamWidth * 2),
    );
    for (let i = 0; i < 3; i++) {
      const side = i === 1 ? -1 : 1;
      const x = cx + side * size * (0.2 + i * 0.05);
      const top = floor - size * (0.8 + i * 0.12);
      const gradient = ctx.createLinearGradient(0, top, 0, floor);
      gradient.addColorStop(0, style.color + '00');
      gradient.addColorStop(0.55, style.color + '88');
      gradient.addColorStop(1, style.light);
      ctx.save();
      ctx.globalAlpha = charge * 0.3;
      ctx.strokeStyle = gradient;
      ctx.lineWidth = (1.2 + i * 0.3) * unit;
      ctx.beginPath();
      ctx.moveTo(x, floor);
      ctx.bezierCurveTo(
        x + side * size * 0.11,
        floor - size * 0.35,
        x - side * size * 0.12,
        top + size * 0.16,
        x + Math.sin(t * 1.8 + i) * size * 0.035,
        top,
      );
      ctx.stroke();
      ctx.restore();
    }
  }
  function ritual(p, t, floor, charge) {
    const a = smooth(0, 0.12, p) * (1 - smooth(0.65, 0.85, p));
    if (!a) return;
    const radius = size * (0.48 - charge * 0.015);
    ellipse(cx, floor, radius, radius * 0.23, a * (0.22 + charge * 0.45));
    ellipse(cx, floor, radius * 0.88, radius * 0.2, a * (0.1 + charge * 0.35));
    ellipse(
      cx,
      floor,
      radius * 1.1,
      radius * 0.253,
      a * (0.12 + charge * 0.2),
      0,
      t * 0.16,
      t * 0.16 + Math.PI * 1.3,
    );
    for (let i = 0; i < 12; i++) {
      const angle = (i * tau) / 12 - t * 0.075;
      const rr = radius * 0.94;
      const point = (r, offset) => [
        cx + Math.cos(angle + offset) * r,
        floor + Math.sin(angle + offset) * r * 0.23,
      ];
      const points =
        i % 3 === 0
          ? [point(rr * 0.95, -0.022), point(rr, 0.022), point(rr * 1.04, -0.022)]
          : [point(rr * 0.96, 0), point(rr * 1.03, 0)];
      line(points, style.light, a * (0.12 + charge * 0.48), 0.9 * unit);
    }
  }
  function absorptionY(p) {
    return cy + size * 0.04 - smooth(0.1, 0.4, p) * 12 * unit;
  }
  function inflow(p, front = false) {
    const targetY = absorptionY(p);
    // Stratified directions keep every surge distributed around the whole creature.
    for (let i = 0; i < 132; i++) {
      const wave = i % 3;
      const start = 0.045 + wave * 0.082 + noise(i + 610) * 0.09;
      const end = Math.min(compressionEnd, start + 0.185 - wave * 0.018 + noise(i + 611) * 0.04);
      const q = ramp(start, end, p);
      if (q <= 0 || q >= 1) continue;
      const angle = (Math.floor(i / 3) * tau) / 44 + wave * 0.43 + noise(i + 612) * 0.13;
      const depth = noise(i + 630);
      const rock = i % 4 === 0;
      const ribbon = !rock && i % 5 === 0;
      const grounded = rock && i % 8 === 0;
      const reachX = Math.min(width * 0.48, size * (0.72 + noise(i + 613) * 0.5));
      const reachY = Math.min(
        Math.sin(angle) < 0 ? Math.max(24, cy - 92) : height * 0.89 - cy,
        size * (0.85 + noise(i + 614) * 0.42),
      );
      const spread = 0.7 + noise(i + 615) * 0.3;
      const originX = cx + Math.cos(angle) * reachX * spread;
      const originY = grounded
        ? Math.min(height * 0.88, cy + size * (0.46 + depth * 0.58))
        : targetY + Math.sin(angle) * reachY * spread;
      const liftHeight = grounded ? size * (0.12 + noise(i + 617) * 0.12) : 0;
      const position = (at) => {
        const pull = ramp(0.13, 1, at) ** 1.9;
        const remaining = 1 - pull;
        const curl =
          Math.sin(pull * Math.PI) * remaining * (0.2 + noise(i + 616) * 0.18) +
          smooth(0.08, 0.3, at) * (1 - smooth(0.3, 0.6, at)) * 0.035;
        const dx = originX - cx,
          dy = originY - targetY;
        const tremble = (1 - smooth(0.14, 0.26, at)) * Math.sin(at * 52 + i * 1.7) * unit;
        return [
          cx + (dx * Math.cos(curl) - dy * Math.sin(curl)) * remaining + tremble * remaining,
          targetY +
            (dx * Math.sin(curl) + dy * Math.cos(curl)) * remaining -
            smooth(0.12, 0.48, at) * remaining * liftHeight,
        ];
      };
      const pull = ramp(0.13, 1, q) ** 1.9;
      // Rear trajectories wrap into the foreground as they reach the same focal point.
      const frontWeight = depth > 0.48 ? 1 : smooth(0.38, 0.72, pull);
      const layer = front ? frontWeight : 1 - frontWeight;
      if (layer < 0.002) continue;
      const [x, y] = position(q);
      const a = smooth(0, 0.1, q) * (1 - smooth(0.95, 1, q)) * layer;
      const perspective = (0.72 + depth * 0.6) * (1 - pull * (rock ? 0.24 : 0.58));
      const radius =
        (rock ? 5.5 + noise(i + 618) * 6.5 : 1.3 + noise(i + 618) * 2.2) * unit * perspective;
      const previous = position(Math.max(0, q - 0.065));
      const middle = position(Math.max(0, q - 0.03));
      const dx = x - previous[0],
        dy = y - previous[1];
      const distance = Math.hypot(dx, dy);
      const trail = Math.min(distance, 38 * unit) / Math.max(distance, 0.01);
      const speed = smooth(0.2, 0.82, q);
      if (distance > 1.2 * unit) {
        const tail = [x - dx * trail, y - dy * trail];
        const mid = [x + (middle[0] - x) * trail, y + (middle[1] - y) * trail];
        line(
          [tail, mid, [x, y]],
          style.color,
          a * speed * (i % 4 === 0 ? 0.52 : 0.32),
          0.85 * unit,
        );
      }
      if (ribbon) {
        const path = [];
        for (let j = 0; j < 10; j++) path.push(position(Math.max(0, q - 0.17 + (j * 0.17) / 9)));
        const qi = ctx.createLinearGradient(path[0][0], path[0][1], x, y);
        qi.addColorStop(0, style.color + '00');
        qi.addColorStop(0.45, style.color + '99');
        qi.addColorStop(1, style.light);
        ctx.save();
        ctx.globalAlpha = a * speed * 0.75;
        ctx.strokeStyle = qi;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.shadowColor = style.color;
        ctx.shadowBlur = 7 * unit;
        ctx.beginPath();
        path.forEach(([px, py], j) => (j ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
        ctx.lineWidth = (1.4 + noise(i + 720) * 1.3) * unit;
        ctx.stroke();
        ctx.globalAlpha *= 0.2;
        ctx.lineWidth *= 3;
        ctx.stroke();
        ctx.restore();
      }
      if (rock) {
        const contact = grounded ? 1 - smooth(0.13, 0.36, q) : 0;
        halo(originX, originY + radius, radius * 3.5, a * contact * 0.2, style.color, 0.2);
        fragment(
          x,
          y,
          radius,
          angle + q * (0.7 + noise(i + 619)),
          a * (0.8 + depth * 0.2) * (1 - smooth(0.94, 1, q)),
          i,
        );
      } else if (['ice', 'prism', 'bloom', 'tide'].includes(style.kind) && i % 7 === 0) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle + q);
        ctx.globalAlpha = a * 0.55;
        ctx.fillStyle = style.color;
        ctx.beginPath();
        if (style.kind === 'ice' || style.kind === 'prism') {
          ctx.moveTo(0, -radius * 1.5);
          ctx.lineTo(radius * 0.55, 0);
          ctx.lineTo(0, radius * 1.5);
          ctx.lineTo(-radius * 0.55, 0);
        } else ctx.ellipse(0, 0, radius * 0.6, radius * 1.4, 0, 0, tau);
        ctx.fill();
        ctx.restore();
      } else halo(x, y, radius * 2, a * 0.58);
      const absorb = smooth(0.78, 0.94, q) * (1 - smooth(0.97, 1, q));
      halo(x, y, rock ? radius * 1.2 : radius * (2 + speed), absorb * 0.7 * layer, style.light);
    }
  }
  function absorption(p, t) {
    const visible = smooth(0.08, 0.145, p) * (1 - smooth(burstAt, burstAt + 0.015, p));
    if (!visible) return;
    const growth = smooth(0.1, 0.355, p);
    const compression = smooth(compressionStart, compressionEnd, p) ** 1.7;
    // The body stays close to portrait size, then compresses to a small bright seed.
    const radius = size * (0.025 + growth * 0.39) * (1 - compression * 0.92);
    const y = absorptionY(p);
    halo(cx, y, radius * 1.4, visible * 0.32);
    // Fade the entire boundary instead of clipping a solid circular surface.
    const core = ctx.createRadialGradient(cx, y, 0, cx, y, radius);
    core.addColorStop(0, '#fffdf5');
    core.addColorStop(0.18, style.light);
    core.addColorStop(0.43, style.color + 'ee');
    core.addColorStop(0.67, style.color + '99');
    core.addColorStop(0.86, style.color + '22');
    core.addColorStop(1, style.color + '00');
    ctx.save();
    ctx.globalAlpha = visible;
    ctx.fillStyle = core;
    ctx.fillRect(cx - radius, y - radius, radius * 2, radius * 2);
    ctx.restore();

    // Uneven, drifting wisps supply volume without dark mottling or a rigid rim.
    for (let i = 0; i < 14; i++) {
      const angle = i * 2.39996 + t * (0.3 + noise(i + 740) * 0.28) + compression * 0.7;
      const orbit = radius * (0.5 + noise(i + 741) * 0.3) * (1 - compression * 0.2);
      halo(
        cx + Math.cos(angle) * orbit,
        y + Math.sin(angle) * orbit,
        radius * (0.3 + noise(i + 750) * 0.2),
        visible * (0.4 + Math.sin(t * 1.6 + i) * 0.08),
        i % 3 ? style.color : style.light,
        0.7 + noise(i + 751) * 0.5,
      );
    }
    for (let i = 0; i < 7; i++) {
      const path = [];
      const bend = 0.8 + noise(i + 760) * 1.4;
      for (let j = 0; j < 30; j++) {
        const q = j / 29;
        const angle =
          i * 2.39996 + t * (0.65 + noise(i + 761) * 0.5) + q * bend + compression * 0.8;
        const r = radius * (1.08 - q * (0.6 + noise(i + 762) * 0.22));
        path.push([cx + Math.cos(angle) * r, y + Math.sin(angle) * r * 0.94]);
      }
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const end = path[path.length - 1];
      const strand = ctx.createLinearGradient(path[0][0], path[0][1], end[0], end[1]);
      strand.addColorStop(0, style.light + '00');
      strand.addColorStop(0.35, style.light + '55');
      strand.addColorStop(0.65, style.light + '99');
      strand.addColorStop(1, style.light + '00');
      ctx.strokeStyle = strand;
      ctx.globalAlpha = visible * (0.24 + noise(i + 763) * 0.2) * (1 - compression * 0.6);
      ctx.shadowColor = style.light;
      ctx.shadowBlur = 6 * unit;
      ctx.beginPath();
      path.forEach(([px, py], j) => (j ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
      ctx.lineWidth = (2 + noise(i + 764) * 2) * unit;
      ctx.stroke();
      ctx.lineWidth = 0.7 * unit;
      ctx.stroke();
      ctx.restore();
    }
    const retained = smooth(0.18, 0.27, p) * (1 - smooth(0.415, compressionEnd, p));
    for (let i = 0; i < 10; i++) {
      const angle = i * 2.39996 + t * (1.05 + noise(i + 700) * 0.5) + compression;
      const orbit = radius * (0.88 + noise(i + 701) * 0.2) * (1 - compression * 0.3);
      fragment(
        cx + Math.cos(angle) * orbit,
        y + Math.sin(angle) * orbit,
        (3 + noise(i + 702) * 3) * unit * (1 - compression * 0.7),
        angle + t,
        visible * retained * 0.85,
        i,
      );
    }
    // Concentrated light stays alive through the 100 ms hold, without expanding yet.
    halo(
      cx,
      y,
      radius * 0.75 + size * compression * 0.09,
      visible * (0.45 + compression * 0.5),
      style.light,
    );
    halo(cx, y, radius * 0.3, visible * compression, '#fffdf5');
  }
  function drawBeast(image, scale, y, alpha, white = 0, rotation = 0) {
    if (alpha <= 0 || !image.complete || !image.naturalWidth) return;
    ctx.save();
    ctx.translate(cx, y);
    ctx.rotate(rotation);
    const s = size * scale;
    ctx.shadowColor = style.color + '88';
    ctx.shadowBlur = (8 + white * 22) * unit;
    // Fully tinted silhouettes conceal illustration details during the morph.
    // Draw only the mask at full white so cross-fading cannot leak original colors.
    if (white < 1) {
      ctx.globalAlpha = alpha;
      ctx.drawImage(image, -s / 2, -s / 2, s, s);
    }
    if (white > 0) {
      if (white === 1) ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = alpha * white;
      ctx.drawImage(silhouette(image), -s / 2, -s / 2, s, s);
    }
    ctx.restore();
  }
  function transformation(p) {
    // The single light release starts only after compression and the held beat.
    const pulse =
      smooth(burstAt, burstAt + 0.009, p) * (1 - smooth(burstAt + 0.018, burstAt + 0.065, p));
    if (!pulse) return;
    halo(cx, absorptionY(p), size * 0.72, pulse, style.light);
    halo(cx, absorptionY(p), size * 0.3, pulse, '#fffdf5');
    halo(cx, cy + size * 0.43, size * 0.65, pulse * 0.65, style.light, 0.2);
  }
  function release(p) {
    const burst = ramp(burstAt, 0.69, p);
    if (burst <= 0 || burst >= 1) return;
    const a = (1 - burst) ** 1.7;
    const power = 1 + (form - 2) * 0.12;
    const radius = size * (0.035 + out(burst) * 0.85 * power);
    const y = absorptionY(p);
    // A soft pressure front and sparks all originate at the compressed seed.
    const wave = ramp(burstAt, burstAt + 0.07, p);
    const waveRadius = size * (0.035 + out(wave) * 0.8 * power);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = smooth(0, 0.08, wave) * (1 - wave) ** 2 * 0.45;
    ctx.strokeStyle = style.light;
    ctx.lineWidth = (2 + (1 - burst) * 2) * unit;
    ctx.shadowColor = style.color;
    ctx.shadowBlur = 9 * unit;
    ctx.beginPath();
    ctx.ellipse(cx, y, waveRadius, waveRadius * 0.88, 0, 0, tau);
    ctx.stroke();
    ctx.restore();
    ellipse(cx, cy + size * 0.43, radius, radius * 0.23, a * 0.7);
    for (let i = 0; i < 38; i++) {
      const angle = i * 2.39996 + noise(i + 21) * 0.12;
      const distance = 0.3 + noise(i + 22) * 0.48;
      const r = size * (0.025 + out(burst) * distance);
      const x = cx + Math.cos(angle) * r;
      const yy = y + Math.sin(angle) * r * 0.88 + burst * burst * size * 0.08;
      const tail = (4 + noise(i + 90) * 18) * unit * a;
      line(
        [
          [x, yy],
          [x - Math.cos(angle) * tail, yy - Math.sin(angle) * tail],
        ],
        i % 3 ? style.color : style.light,
        a * (0.35 + noise(i + 91) * 0.35),
        (0.65 + noise(i + 92) * 0.6) * unit,
      );
      halo(x, yy, (2 + noise(i) * 3) * unit, a * 0.75, style.light);
      if (i % 5 === 0) halo(x, yy, size * (0.045 + burst * 0.035), a * 0.22);
    }
  }
  function coronation(p, t) {
    const a = smooth(0.63, 0.78, p);
    if (!a) return;
    const settle = 1 - smooth(0.76, 1, p);
    const r = size * 0.64;
    ellipse(cx, cy, r, r, a * 0.25, 0, -Math.PI * 0.92, -Math.PI * 0.08);
    for (let i = 0; i < 12; i++) {
      const angle = -Math.PI + (i / 11) * Math.PI;
      const rr = r + (i % 3 ? 8 : 14) * unit;
      const x = cx + Math.cos(angle) * rr;
      const y = cy + Math.sin(angle) * rr;
      line(
        [
          [x, y - 2 * unit],
          [x + 2 * unit, y],
          [x, y + 2 * unit],
          [x - 2 * unit, y],
          [x, y - 2 * unit],
        ],
        style.light,
        a * 0.4,
        0.6 * unit,
      );
    }
    for (let i = 0; i < 14; i++) {
      const angle = i * 2.39996 + t * 0.04;
      const radius = size * (0.48 + noise(i + 530) * 0.22);
      halo(
        cx + Math.cos(angle) * radius,
        cy + Math.sin(angle) * radius * 0.8,
        (2 + noise(i) * 2) * unit,
        a * (0.15 + settle * 0.5),
      );
    }
    halo(cx, cy + size * 0.3, size * 0.65, a * 0.22, style.color, 0.3);
  }
  function draw(p) {
    progress = clamp(p);
    const t = (progress * duration) / 1000;
    const charge = smooth(0.1, 0.4, p);
    const entering = out(ramp(0, 0.1, p));
    const reveal = out(ramp(burstAt, 0.72, p));
    const absorbed = smooth(0.33, compressionStart, p);
    const newForm = smooth(burstAt, burstAt + 0.035, p);
    cy = cinemaY + (finalY - cinemaY) * smooth(0.6, 0.84, p);
    ctx.save();
    const kick =
      smooth(burstAt, burstAt + 0.012, p) * (1 - smooth(burstAt + 0.012, burstAt + 0.04, p));
    ctx.translate(Math.sin(kick * Math.PI * 2) * 1.1 * unit, Math.sin(kick * Math.PI) * 1.5 * unit);
    background(p, t);
    inflow(p);
    const floatY = cy - charge * (1 - reveal) * 12 * unit;
    drawBeast(
      before,
      (0.88 + entering * 0.07 - charge * 0.055) * (1 - absorbed * 0.65),
      floatY + (absorptionY(p) - floatY) * absorbed,
      entering * (1 - absorbed),
      smooth(0.27, 0.345, p),
      Math.sin(t * 1.2) * 0.008 * (1 - absorbed),
    );
    drawBeast(
      after,
      0.8 + reveal * 0.2 + Math.sin(reveal * Math.PI) * 0.015,
      floatY,
      newForm,
      1 - smooth(burstAt + 0.008, burstAt + 0.09, p),
    );
    inflow(p, true);
    absorption(p, t);
    transformation(p);
    release(p);
    coronation(p, t);
    ctx.restore();
    const phase = complete
      ? 'complete'
      : p < 0.08
        ? 'enter'
        : p < 0.32
          ? 'gather'
          : p < 0.46
            ? 'compress'
            : p < 0.57
              ? 'burst'
              : p < 0.78
                ? 'reveal'
                : 'settle';
    if (dialog.dataset.phase !== phase) dialog.dataset.phase = phase;
    dialog.style.setProperty('--evolution-identity', String(smooth(0.72, 0.83, p)));
    dialog.style.setProperty('--evolution-intro', String(1 - smooth(0.16, 0.28, p)));
    dialog.dataset.progress = p.toFixed(3);
  }
  function fit() {
    const box = canvas.getBoundingClientRect();
    width = Math.max(1, box.width);
    height = Math.max(1, box.height);
    const ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const top = dialog.querySelector('.evolution-top').getBoundingClientRect().bottom - box.top;
    const bottom = dialog.querySelector('.evolution-dock').getBoundingClientRect().top - box.top;
    const available = Math.max(110, bottom - top - 35);
    size = Math.max(90, Math.min(width * 0.86, available * 0.86, 560));
    cx = width / 2;
    finalY = top + available * 0.5 + 12;
    cinemaY = Math.max(finalY, Math.min(height * 0.46, height - size * 0.62 - 80));
    unit = Math.max(0.65, Math.min(1.6, size / 340));
    dialog.style.setProperty('--evolution-hero-y', finalY + 'px');
    dialog.style.setProperty('--evolution-hero-size', size + 'px');
    draw(progress);
  }
  function tick() {
    if (disposed || complete || !clock || clock.playState === 'paused') return;
    draw(Number(clock.currentTime ?? 0) / duration);
    frame = requestAnimationFrame(tick);
  }
  function finish() {
    if (disposed) return;
    complete = true;
    cancelAnimationFrame(frame);
    clock?.cancel();
    draw(1);
    onComplete();
  }
  function play() {
    if (disposed) return;
    cancelAnimationFrame(frame);
    clock?.cancel();
    complete = false;
    progress = 0;
    fit();
    clock = dialog.animate([], { duration, fill: 'both' });
    clock.onfinish = finish;
    frame = requestAnimationFrame(tick);
  }
  return {
    play,
    finish,
    fit,
    pause() {
      if (!complete) {
        clock?.pause();
        cancelAnimationFrame(frame);
      }
    },
    resume() {
      if (!complete && !disposed && clock?.playState === 'paused') {
        clock.play();
        frame = requestAnimationFrame(tick);
      }
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      clock?.cancel();
      glowCache.clear();
      silhouettes.clear();
    },
  };
}
