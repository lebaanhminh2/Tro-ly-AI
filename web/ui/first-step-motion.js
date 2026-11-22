// Extracted from the immutable approved HTML (SHA-256 5a406bd6...).
import { pbArt, pbCore, pbIcon } from './first-step-art.js';
import { prefersReducedMotion } from '../core/experience.js';
export function createFirstStepMotion(getEntry, getBalances) {
  const pbHoldMs = 3000,
    pbReleaseMs = 1000;
  const pbMotion = {
    get matches() {
      return prefersReducedMotion();
    },
  };
  const pbClamp = (n, min = 0, max = 1) => Math.max(min, Math.min(max, n));
  const pbRand = (n) => {
    const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return v - Math.floor(v);
  };
  let pbCinema = null;
  const timers = new Set();
  function later(run, ms) {
    const id = setTimeout(() => {
      timers.delete(id);
      run();
    }, ms);
    timers.add(id);
  }
  const pbGachaVars = [
    'progress',
    'edge-opacity',
    'done',
    'py',
    'ps',
    'scene-alpha',
    'scene-ink',
    'scene-muted',
    'scene-line',
    'label-out',
    'clock-in',
    'seal-rim',
    'seal-glow',
    'spark-glow',
    'yaw',
    'roll',
    'seal-sweep',
    'seal-flare',
  ];
  let pbMeteor = null;
  function pbMakeMeteor() {
    pbDropMeteor();
    const entry = getEntry(),
      backdrop = entry?.querySelector('.pb-backdrop');
    if (!backdrop) return null;
    const width = entry.clientWidth,
      height = entry.clientHeight,
      ratio = Math.min(devicePixelRatio || 1, 2);
    const canvas = document.createElement('canvas');
    canvas.className = 'pb-hold-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    backdrop.append(canvas);
    let ctx = null;
    if (!pbMotion.matches)
      try {
        ctx = canvas.getContext('2d');
      } catch {
        /* Canvas is optional; the numbered hold remains usable. */
      }
    const clamp = pbClamp,
      random = pbRand,
      fract = (x) => x - Math.floor(x);
    const ramp = (a, b, p) => clamp((p - a) / (b - a)),
      smooth = (a, b, p) => {
        const n = ramp(a, b, p);
        return n * n * (3 - 2 * n);
      };
    const pulse = (p, at, span) => {
      const n = (p - at) / span;
      return n >= 0 && n < 1 ? Math.sin(n * Math.PI) : 0;
    };
    const rgba = (rgb, a) => 'rgba(' + rgb.join(',') + ',' + a + ')',
      mixColor = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
    const luminous = { SSR: [248, 186, 90] };
    function glow(c, x, y, r, color, a) {
      if (a < 0.001 || r <= 0) return;
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, rgba(color, a));
      g.addColorStop(0.12, rgba(color, a * 0.42));
      g.addColorStop(0.42, rgba(color, a * 0.1));
      g.addColorStop(1, rgba(color, 0));
      c.fillStyle = g;
      c.fillRect(x - r, y - r, r * 2, r * 2);
    }
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
        c.quadraticCurveTo(
          -tail * 0.45,
          offset + Math.sin(seconds * 8 + i) * 3,
          -10,
          offset * 0.08,
        );
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

    const stars = Array.from({ length: 78 }, (_, i) => ({
      x: random(i + 1),
      y: random(i + 401),
      z: 0.18 + random(i + 801) * 0.82,
      size: 0.3 + random(i + 1201) * 0.7,
    }));
    function drawScene(p, phase, q) {
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, width, height);
      if (phase === 'idle') return;
      const c = ctx,
        seconds = p * 3.94,
        camera = seconds * 0.18 + seconds * seconds * 0.052,
        released = phase === 'done';
      const shade = c.createLinearGradient(0, 0, width, height);
      shade.addColorStop(0, '#101a2b');
      shade.addColorStop(0.6, '#080d1a');
      shade.addColorStop(1, '#10172a');
      c.fillStyle = shade;
      c.fillRect(0, 0, width, height);
      c.save();
      c.globalCompositeOperation = 'screen';
      glow(c, width * 0.7, height * 0.7, width * 0.5, [55, 85, 130], 0.14);
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i],
          x = fract(s.x - camera * s.z * 0.34) * (width + 80) - 40,
          y = fract(s.y - camera * s.z * 0.15) * (height + 30) - 15;
        const a = (0.13 + s.z * 0.4) * (released ? 1 - clamp(q) : 1),
          size = s.size * (0.55 + s.z * 0.8);
        c.fillStyle = rgba([190, 213, 244], a);
        c.fillRect(x, y, size, size);
        if (p > 0.15 && !released) {
          const speed = (2 + seconds * 3.5 + Math.pow(ramp(3.4, 3.95, seconds), 2) * 45) * s.z;
          c.strokeStyle = rgba([155, 190, 234], a * 0.35);
          c.lineWidth = size * 0.65;
          c.beginPath();
          c.moveTo(x, y);
          c.lineTo(x + speed, y + speed * 0.42);
          c.stroke();
        }
      }
      if (!released) drawComet(c, seconds, { key: 'SSR', level: 2 });
      if (p > 0.885 && !released) {
        const pass = ramp(0.885, 1, p),
          x = width * (0.6 + pass * 0.75),
          half = 8 + Math.sin(pass * Math.PI) * height * 0.55;
        c.save();
        c.translate(x, height * 0.48);
        c.rotate(0.4);
        const wipe = c.createLinearGradient(0, -half, 0, half);
        wipe.addColorStop(0, rgba(luminous.SSR, 0));
        wipe.addColorStop(0.42, rgba(luminous.SSR, 0.34));
        wipe.addColorStop(0.5, 'rgba(255,248,229,.82)');
        wipe.addColorStop(0.58, rgba(luminous.SSR, 0.34));
        wipe.addColorStop(1, rgba(luminous.SSR, 0));
        c.fillStyle = wipe;
        c.globalAlpha = Math.sin(pass * Math.PI);
        c.fillRect(-width, -half, width * 2, half * 2);
        c.restore();
      }
      if (released && q < 0.5) {
        const a = Math.sin(clamp(q / 0.5) * Math.PI),
          cx = width - 67,
          cy = 32;
        glow(c, cx, cy, 90, luminous.SSR, a * 0.6);
        for (let i = 0; i < 14; i++) {
          const angle = (random(i + 44) - 0.5) * Math.PI * 1.4 + Math.PI,
            travel = Math.pow(clamp(q / 0.5), 0.65),
            r = 12 + travel * (18 + random(i + 65) * 56),
            x = cx + Math.cos(angle) * r,
            y = cy + Math.sin(angle) * r * 0.5,
            size = (1 - travel) * (1 + random(i + 77) * 2);
          c.save();
          c.translate(x, y);
          c.rotate(angle);
          c.fillStyle = rgba(i % 3 ? luminous.SSR : [253, 245, 219], a * 0.7);
          c.beginPath();
          c.moveTo(size * 2, 0);
          c.lineTo(-size, -size * 0.5);
          c.lineTo(-size * 0.2, size * 0.5);
          c.closePath();
          c.fill();
          c.restore();
        }
      }
      c.restore();
    }

    const scene = {
      entry,
      canvas,
      ctx,
      width,
      height,
      ratio,
      frame: 0,
      draw(p, phase, q) {
        if (!canvas.isConnected) return;
        const release = phase === 'done',
          moving = !!ctx && !pbMotion.matches;
        const ink = moving ? (release ? 1 - smooth(0.22, 0.78, q) : 1) : 0;
        entry.dataset.refinedPhase = phase;
        entry.dataset.gachaMode = moving ? phase : 'still';
        const set = (key, value) => entry.style.setProperty('--' + key, String(value));
        const done = release ? Math.min(1, q / 0.2) : 0,
          beat = Math.min(2, Math.floor(p * 3));
        set('progress', release ? 1 : p);
        set('edge-opacity', release ? Math.max(0, 1 - q / 0.5) : 1);
        set('done', done);
        const press = moving && phase === 'hold' ? Math.min(1, p * 30) : 0;
        const rebound = moving && release ? 0.025 * Math.exp(-q * 9) * Math.sin(q * 24) : 0;
        set('ps', 1 - press * 0.022 + rebound);
        entry
          .querySelectorAll('.pb-counts b')
          .forEach((n, i) => (n.className = i < beat ? 'past' : i === beat ? 'current' : ''));
        if (release) {
          entry.querySelector('.pb-heading').textContent =
            q < 0.55 ? 'Làm ngay.' : '5 phút đầu tiên';
          entry.querySelector('.pb-note').textContent =
            q < 0.55 ? 'Chỉ 5 phút thôi.' : 'Hết giờ, cậu có thể dừng.';
        }
        set('scene-alpha', ink);
        const dark = document.documentElement.dataset.theme === 'dark',
          base = dark ? [239, 237, 245] : [39, 36, 56],
          muted = dark ? [170, 165, 185] : [111, 106, 130];
        set('scene-ink', rgba(mixColor(base, [244, 237, 221], ink), 1));
        set('scene-muted', rgba(mixColor(muted, [178, 186, 203], ink), 1));
        set('scene-line', ink > 0.5 ? '#b8c5e31a' : 'var(--line)');
        set('label-out', release ? (moving ? clamp(q / 0.09) : 1) : 0);
        set('clock-in', release ? (moving ? ramp(0.1, 0.3, q) : 1) : 0);
        const charge = moving ? (phase === 'hold' ? smooth(0.52, 0.91, p) : 1 - clamp(q / 0.4)) : 0;
        set(
          'seal-rim',
          charge > 0.1 ? 'rgba(225,198,142,' + (0.3 + charge * 0.5) + ')' : '#34404e',
        );
        set('seal-glow', charge * 15 + 'px');
        set('spark-glow', charge * 6 + 'px');
        const tug = pulse(p, 0.63, 0.1) * 0.7 + pulse(p, 0.88, 0.055) * 1.2;
        set(
          'yaw',
          (moving
            ? phase === 'hold'
              ? -6 * charge
              : 4 * Math.exp(-q * 9) * Math.sin(q * 21)
            : 0) + 'deg',
        );
        set('roll', (moving && phase === 'hold' ? -0.45 * charge : 0) + 'deg');
        set('py', (moving && phase === 'hold' ? 0.7 + tug : 0) + 'px');
        set('seal-sweep', -130 + (phase === 'hold' ? smooth(0.5, 0.93, p) : 1) * 260 + '%');
        set(
          'seal-flare',
          moving && phase === 'hold' ? Math.sin(smooth(0.5, 0.93, p) * Math.PI) * 0.4 : 0,
        );
        if (moving) drawScene(p, phase, q);
      },
    };
    pbMeteor = scene;
    return scene;
  }
  function pbDropMeteor() {
    const scene = pbMeteor;
    if (!scene) return;
    pbMeteor = null;
    cancelAnimationFrame(scene.frame);
    scene.canvas.remove();
    delete scene.entry.dataset.refinedPhase;
    delete scene.entry.dataset.gachaMode;
    for (const key of pbGachaVars) scene.entry.style.removeProperty('--' + key);
  }
  function pbDrawMeteor(scene, progress, now, release = null) {
    scene?.draw(
      pbClamp(progress),
      release === null ? 'hold' : 'done',
      release === null ? 0 : pbClamp(release),
    );
  }
  function pbReleaseMeteor() {
    const scene = pbMakeMeteor();
    if (!scene) return;
    const at = performance.now();
    pbDrawMeteor(scene, 1, at, 0);
    function frame(now) {
      if (pbMeteor !== scene) return;
      if (document.hidden || !scene.canvas.isConnected) {
        pbDropMeteor();
        return;
      }
      const q = pbClamp((now - at) / pbReleaseMs);
      pbDrawMeteor(scene, 1, now, q);
      if (q < 1) scene.frame = requestAnimationFrame(frame);
      else pbDropMeteor();
    }
    scene.frame = requestAnimationFrame(frame);
  }

  function pbNebula() {
    const texture = document.createElement('canvas');
    texture.width = 192;
    texture.height = 120;
    const c = texture.getContext('2d');
    if (!c) return null;
    const pixels = c.createImageData(192, 120),
      noise = (x, y) => {
        const ix = Math.floor(x),
          iy = Math.floor(y),
          fx = x - ix,
          fy = y - iy,
          u = fx * fx * (3 - 2 * fx),
          v = fy * fy * (3 - 2 * fy);
        const n = (a, b) => pbRand(a + b * 317);
        return (
          (n(ix, iy) * (1 - u) + n(ix + 1, iy) * u) * (1 - v) +
          (n(ix, iy + 1) * (1 - u) + n(ix + 1, iy + 1) * u) * v
        );
      };
    for (let y = 0; y < 120; y++)
      for (let x = 0; x < 192; x++) {
        const nx = (x - 102) / 100,
          ny = (y - 55) / 63,
          r = Math.hypot(nx, ny),
          a = Math.atan2(ny, nx);
        const n =
          noise(x * 0.036, y * 0.036) * 0.58 +
          noise(x * 0.083, y * 0.083) * 0.27 +
          noise(x * 0.17, y * 0.17) * 0.15;
        const cloud = Math.exp(-Math.pow((r - 0.7 - n * 0.22) / 0.37, 2)) * (0.35 + n * 0.85);
        const filament = 0.5 + 0.5 * Math.sin(a * 2.7 + r * 7 + n * 8);
        const fog = cloud * (0.32 + filament * 0.68),
          grain = (pbRand(x + y * 192) - 0.5) * 2.5;
        const i = (y * 192 + x) * 4;
        pixels.data[i] = 9 + fog * 19 + grain;
        pixels.data[i + 1] = 16 + fog * 26 + grain;
        pixels.data[i + 2] = 27 + fog * 32 + grain;
        pixels.data[i + 3] = 255;
      }
    c.putImageData(pixels, 0, 0);
    return texture;
  }
  function pbMakeScene(kind) {
    pbDropScene(true);
    if (kind === 'hold' && pbMotion.matches) return null;
    const entry = getEntry();
    if (!entry) return null;
    for (const old of document.querySelectorAll('#pb-cinema')) old.remove();
    const r = entry.getBoundingClientRect(),
      w = Math.min(360, innerWidth - 24),
      h = Math.min(226, innerHeight - 32);
    const left = pbClamp(r.left + r.width / 2 - w / 2, 12, innerWidth - w - 12);
    const top =
      r.top > h + 24
        ? r.top - h - 12
        : r.bottom + h + 24 < innerHeight - 55
          ? r.bottom + 12
          : pbClamp(r.top - h * 0.65, 12, innerHeight - h - 16);
    const layer = document.createElement('div');
    layer.id = 'pb-cinema';
    layer.setAttribute('aria-hidden', 'true');
    layer.innerHTML =
      '<div class="pb-theatre" data-kind="' +
      kind +
      '" style="left:' +
      left +
      'px;top:' +
      top +
      'px;width:' +
      w +
      'px;height:' +
      h +
      'px"><canvas class="pb-scene-canvas"></canvas><div class="pb-scene-core">' +
      pbCore('pb-scene-core') +
      '</div><div class="pb-scene-head"><span>ĐÃ GHI NHẬN</span><i></i></div><div class="pb-scene-caption"><span class="pb-scene-count">1</span><span class="pb-scene-copy">Bắt đầu 5 phút thôi.</span></div></div>';
    document.body.append(layer);
    const panel = layer.firstElementChild,
      canvas = panel.querySelector('canvas');
    let ctx = null;
    try {
      ctx = canvas.getContext('2d', { alpha: false });
    } catch {
      /* Static SVG fallback. */
    }
    const ratio = Math.min(devicePixelRatio || 1, 1.75);
    canvas.width = Math.round(w * ratio);
    canvas.height = Math.round(h * ratio);
    const scene = {
      layer,
      panel,
      canvas,
      ctx,
      w,
      h,
      ratio,
      kind,
      frame: 0,
      at: performance.now(),
      background: ctx ? pbNebula() : null,
      beat: 0,
    };
    pbCinema = scene;
    if (ctx) panel.classList.add('has-canvas');
    if (!pbMotion.matches)
      panel.animate(
        [
          { opacity: 0, transform: 'translateY(7px) scale(.96)' },
          { opacity: 1, transform: 'translateY(0) scale(1)' },
        ],
        { duration: 240, easing: 'cubic-bezier(.16,.7,.25,1)' },
      );
    pbDrawScene(scene, 0, performance.now());
    return scene;
  }
  function pbDropScene(immediate = false) {
    const scene = pbCinema;
    if (!scene) return;
    pbCinema = null;
    cancelAnimationFrame(scene.frame);
    if (immediate || pbMotion.matches) {
      scene.layer.remove();
      return;
    }
    scene.layer
      .animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: 180,
        easing: 'ease-out',
        fill: 'forwards',
      })
      .finished.then(() => scene.layer.remove())
      .catch(() => scene.layer.remove());
  }
  function pbDrawScene(scene, progress, now, release = 0) {
    if (!scene.ctx || !scene.layer.isConnected) return;
    const c = scene.ctx,
      w = scene.w,
      h = scene.h,
      clock = (now - scene.at) / 1000,
      p = pbClamp(progress),
      releasing = scene.kind === 'release',
      reward = scene.kind === 'reward';
    const cx = w * 0.53,
      cy = h * 0.46,
      unit = Math.min(w / 350, h / 226),
      q = pbClamp(release),
      kick = releasing ? pbClamp((q - 0.12) / 0.68) : 0;
    const sceneClock = !reward && !releasing ? Math.min(clock, (pbHoldMs * 0.94) / 1000) : clock;
    c.setTransform(scene.ratio, 0, 0, scene.ratio, 0, 0);
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
    c.fillStyle = '#0b131f';
    c.fillRect(0, 0, w, h);
    if (scene.background) {
      const zoom = 1 + (releasing ? kick * 0.29 : p * 0.04),
        bw = w * zoom,
        bh = h * zoom;
      c.drawImage(scene.background, (w - bw) / 2, (h - bh) / 2, bw, bh);
    }
    const pressure = reward ? 0.55 : p,
      fade = releasing ? 1 - pbClamp(q / 0.85) : 1;
    // A distant star field stays quiet behind the moving dust.
    for (let i = 0; i < 38; i++) {
      const x = pbRand(i + 10) * w,
        y = 24 + pbRand(i + 90) * (h - 62),
        size = i % 11 === 0 ? 1.1 : 0.45;
      c.fillStyle = 'rgba(194,210,226,' + (0.09 + pbRand(i + 130) * 0.25) * fade + ')';
      c.fillRect(x, y, size, size);
    }
    c.save();
    c.globalCompositeOperation = 'lighter';
    const halo = c.createRadialGradient(cx, cy, 0, cx, cy, 88 * unit);
    halo.addColorStop(0, 'rgba(242,211,153,' + (0.13 + pressure * 0.18) * fade + ')');
    halo.addColorStop(0.27, 'rgba(167,158,133,' + (0.05 + pressure * 0.12) * fade + ')');
    halo.addColorStop(0.65, 'rgba(73,116,149,.035)');
    halo.addColorStop(1, 'rgba(21,39,59,0)');
    c.fillStyle = halo;
    c.fillRect(0, 0, w, h);
    // Curved inward trails imply depth; seeded positions avoid flickering noise.
    for (let i = 0; i < 58; i++) {
      const velocity = 0.08 + pbRand(i + 170) * 0.13 + pressure * 0.14;
      const travel = (sceneClock * velocity + pbRand(i + 211)) % 1,
        far = 1 - travel;
      const radius = (22 + Math.pow(far, 1.55) * Math.max(w * 0.62, h * 0.7)) * unit;
      const angle = pbRand(i + 317) * Math.PI * 2 + travel * (0.4 + pressure * 0.6);
      const x = cx + Math.cos(angle) * radius,
        y = cy + Math.sin(angle) * radius * 0.57;
      const tail = 0.006 + pressure * pressure * 0.021;
      const prevRadius =
        (22 + Math.pow(Math.min(1, far + tail), 1.55) * Math.max(w * 0.62, h * 0.7)) * unit;
      const prevAngle = angle - tail * (0.4 + pressure * 0.6);
      const alpha =
        Math.sin(travel * Math.PI) * (0.12 + pressure * 0.38) * fade * (reward ? 0.45 : 1);
      c.strokeStyle = 'rgba(' + (i % 4 ? '183,205,222' : '235,207,152') + ',' + alpha + ')';
      c.lineWidth = i % 9 === 0 ? 0.95 : 0.5;
      c.beginPath();
      c.moveTo(cx + Math.cos(prevAngle) * prevRadius, cy + Math.sin(prevAngle) * prevRadius * 0.57);
      c.lineTo(x, y);
      c.stroke();
      if (i % 10 === 0) {
        c.fillStyle = 'rgba(248,229,188,' + alpha + ')';
        c.fillRect(x - 0.6, y - 0.6, 1.2, 1.2);
      }
    }
    c.restore();
    const compress = 1 - 0.21 * Math.pow(p, 4),
      expand = releasing ? 1 + kick * 2.6 : 1;
    const ringFade = fade * (reward ? 0.42 : 1);
    function ring(radius, tilt, rotation, offset) {
      const point = (a) => {
        const x = Math.cos(a) * radius * compress * expand,
          y = Math.sin(a) * radius * compress * expand;
        const z = y * Math.sin(tilt),
          yy = y * Math.cos(tilt),
          perspective = 260 / (260 + z);
        return {
          x: cx + (x * Math.cos(rotation) - yy * Math.sin(rotation)) * perspective,
          y: cy + (x * Math.sin(rotation) + yy * Math.cos(rotation)) * perspective,
          z,
        };
      };
      c.save();
      c.lineCap = 'round';
      const rim = c.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
      rim.addColorStop(0, 'rgba(208,221,229,' + ringFade * 0.52 + ')');
      rim.addColorStop(0.3, 'rgba(75,96,115,' + ringFade * 0.4 + ')');
      rim.addColorStop(0.56, 'rgba(236,216,179,' + ringFade * 0.78 + ')');
      rim.addColorStop(1, 'rgba(107,127,143,' + ringFade * 0.4 + ')');
      c.strokeStyle = rim;
      c.lineWidth = 0.8;
      c.beginPath();
      for (let j = 0; j <= 180; j++) {
        const v = point((j / 180) * Math.PI * 2);
        if (j) c.lineTo(v.x, v.y);
        else c.moveTo(v.x, v.y);
      }
      c.closePath();
      c.stroke();
      for (let j = 0; j < 7; j++) {
        const a = (j / 7) * Math.PI * 2 + offset,
          v = point(a),
          brightness = (0.45 + (v.z / radius + 1) * 0.2) * ringFade;
        c.strokeStyle = 'rgba(' + (j % 3 ? '238,219,182' : '195,215,230') + ',' + brightness + ')';
        c.lineWidth = j % 2 ? 0.6 : 1.1;
        c.beginPath();
        for (let k = 0; k <= 9; k++) {
          const v = point(a + k * 0.012);
          if (k) c.lineTo(v.x, v.y);
          else c.moveTo(v.x, v.y);
        }
        c.stroke();
      }
      c.restore();
    }
    const rotation = pbClamp(p / 0.94),
      time = sceneClock;
    ring(68 * unit, 0.79 - p * 0.14, -0.44 + rotation * 0.08, time * 0.38);
    ring(49 * unit, 0.9 - p * 0.2, -0.17 - rotation * 0.08, -time * 0.54 + 0.5);
    ring(87 * unit, 1.16, -0.63, time * 0.21 + 1.2);
    if (!reward && p > 0.58 && !releasing) {
      const light = Math.pow((p - 0.58) / 0.42, 2),
        g = c.createRadialGradient(cx, cy, 12 * unit, cx, cy, 95 * unit);
      g.addColorStop(0, 'rgba(244,215,165,0)');
      g.addColorStop(0.3, 'rgba(236,202,143,' + light * 0.12 + ')');
      g.addColorStop(1, 'rgba(219,185,121,0)');
      c.save();
      c.globalCompositeOperation = 'lighter';
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
      c.restore();
    }
    // An opaque iris gives the light a dark center and a physical rim.
    if (!reward) {
      c.save();
      c.globalAlpha = fade;
      c.translate(cx, cy);
      c.rotate(-0.35);
      c.fillStyle = '#0b1420';
      c.beginPath();
      c.ellipse(0, 0, 23 * unit * compress, 17 * unit * compress, 0, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = 'rgba(214,186,133,' + (0.4 + p * 0.35) + ')';
      c.lineWidth = 0.8;
      c.stroke();
      c.restore();
    }
    const beatWave = reward ? Math.max(0, 1 - clock * 2) : Math.exp(-((p * 3) % 1) * 10);
    c.save();
    c.globalCompositeOperation = 'lighter';
    const coreRadius = (reward ? 48 : 29 + pressure * 19 + beatWave * 4) * unit;
    const core = c.createRadialGradient(cx, cy, 0, cx, cy, coreRadius);
    core.addColorStop(0, 'rgba(255,238,196,' + (reward ? 0.15 : 0.55) * fade + ')');
    core.addColorStop(
      0.1,
      'rgba(245,213,151,' + (reward ? 0.12 : 0.28 + pressure * 0.22) * fade + ')',
    );
    core.addColorStop(
      0.45,
      'rgba(200,162,96,' + (reward ? 0.05 : 0.07 + pressure * 0.07) * fade + ')',
    );
    core.addColorStop(1, 'rgba(174,139,78,0)');
    c.fillStyle = core;
    c.fillRect(cx - coreRadius, cy - coreRadius, coreRadius * 2, coreRadius * 2);
    if (!reward && !releasing) {
      const star = (9 + p * 7) * unit * (p > 0.94 ? 0.8 : 1);
      c.save();
      c.translate(cx, cy);
      c.rotate(-0.08);
      c.fillStyle = '#f9e9bd';
      c.shadowColor = '#f9dfa3';
      c.shadowBlur = 7 + p * 9;
      c.beginPath();
      c.moveTo(0, -star);
      c.lineTo(star * 0.19, -star * 0.19);
      c.lineTo(star, 0);
      c.lineTo(star * 0.19, star * 0.19);
      c.lineTo(0, star);
      c.lineTo(-star * 0.19, star * 0.19);
      c.lineTo(-star, 0);
      c.lineTo(-star * 0.19, -star * 0.19);
      c.closePath();
      c.fill();
      c.restore();
      c.strokeStyle = 'rgba(240,220,177,' + (0.1 + p * 0.35) + ')';
      c.lineWidth = 0.5;
      c.beginPath();
      c.moveTo(cx - 58 * unit, cy);
      c.lineTo(cx + 58 * unit, cy);
      c.stroke();
    }
    if (releasing) {
      const t = pbClamp((q - 0.14) / 0.72),
        ease = t * t * (3 - 2 * t),
        x = cx + ease * (w - cx + 65),
        y = cy - ease * (cy + 50);
      if (q < 0.3) {
        const flash = Math.sin(pbClamp(q / 0.3) * Math.PI),
          g = c.createRadialGradient(cx, cy, 0, cx, cy, 75 * unit);
        g.addColorStop(0, 'rgba(255,242,209,' + flash * 0.7 + ')');
        g.addColorStop(0.2, 'rgba(239,199,129,' + flash * 0.2 + ')');
        g.addColorStop(1, 'rgba(239,199,129,0)');
        c.fillStyle = g;
        c.fillRect(0, 0, w, h);
      }
      if (t > 0 && t < 1)
        for (const [width, alpha, color] of [
          [13, 0.09, '228,194,134'],
          [5, 0.24, '242,213,159'],
          [1.2, 0.9, '255,244,213'],
        ]) {
          const tail = c.createLinearGradient(cx, cy, x, y);
          tail.addColorStop(0, 'rgba(' + color + ',0)');
          tail.addColorStop(1, 'rgba(' + color + ',' + alpha + ')');
          c.strokeStyle = tail;
          c.lineWidth = width;
          c.lineCap = 'round';
          c.beginPath();
          c.moveTo(cx, cy);
          c.quadraticCurveTo(cx + (x - cx) * 0.45, cy + (y - cy) * 0.22, x, y);
          c.stroke();
        }
      if (t > 0 && t < 1) {
        const glow = c.createRadialGradient(x, y, 0, x, y, 29 * unit);
        glow.addColorStop(0, 'rgba(255,245,218,.85)');
        glow.addColorStop(0.12, 'rgba(247,218,160,.55)');
        glow.addColorStop(0.45, 'rgba(234,187,108,.14)');
        glow.addColorStop(1, 'rgba(234,187,108,0)');
        c.fillStyle = glow;
        c.fillRect(x - 30 * unit, y - 30 * unit, 60 * unit, 60 * unit);
        c.save();
        c.translate(x, y);
        c.rotate(-0.6);
        c.fillStyle = '#fff6db';
        c.shadowColor = '#f9d692';
        c.shadowBlur = 10;
        c.beginPath();
        c.moveTo(-12 * unit, 0);
        c.lineTo(-2 * unit, -1.5 * unit);
        c.lineTo(0, -6 * unit);
        c.lineTo(2 * unit, -1.5 * unit);
        c.lineTo(12 * unit, 0);
        c.lineTo(2 * unit, 1.5 * unit);
        c.lineTo(0, 6 * unit);
        c.lineTo(-2 * unit, 1.5 * unit);
        c.closePath();
        c.fill();
        c.restore();
      }
    }
    c.restore();
    // Fine vignetting keeps the stage edges quiet around the typography.
    const edge = c.createLinearGradient(0, 0, 0, h);
    edge.addColorStop(0, '#080e1899');
    edge.addColorStop(0.23, '#080e1800');
    edge.addColorStop(0.74, '#080e1800');
    edge.addColorStop(1, '#080e18b3');
    c.fillStyle = edge;
    c.fillRect(0, 0, w, h);
  }

  function reward() {
    const entry = getEntry(),
      scene = pbMakeScene('reward');
    if (!entry || !scene) {
      return;
    }
    entry.dataset.flying = 'true';
    const prizes = document.createElement('div');
    prizes.className = 'pb-scene-prizes';
    prizes.innerHTML = ['coin', 'ticket']
      .map(
        (kind) =>
          '<div class="pb-scene-prize ' +
          kind +
          '"><div class="pb-prize-object">' +
          pbArt(kind, 'pb-scene-prize-' + kind) +
          '</div><small><b>+1</b> ' +
          (kind === 'coin' ? 'Tu vi' : 'Vé quay thường') +
          '</small></div>',
      )
      .join('');
    scene.panel.append(prizes);
    scene.panel.querySelector('.pb-scene-copy').textContent = 'Lần này, cậu đã làm thay vì để sau.';
    const layer = document.createElement('div');
    layer.id = 'pb-fx';
    layer.setAttribute('aria-hidden', 'true');
    document.body.append(layer);
    const wallet = document.querySelector('[data-first-step-wallet]'),
      wr = wallet?.getBoundingClientRect(),
      visible = !!wr && wr.top >= 8 && wr.bottom < innerHeight - 8;
    const balances = getBalances();
    if (!visible) {
      const n = balances.coin - 1;
      layer.innerHTML =
        '<div class="pb-flight-target"><span data-fly-target="coin">' +
        pbIcon('spark') +
        '<b>' +
        Math.max(0, n) +
        '</b></span><span data-fly-target="ticket">' +
        pbIcon('ticket') +
        '<b>' +
        Math.max(0, balances.ticket - 1) +
        '</b></span></div>';
    }
    if (pbMotion.matches) {
      for (const [i, b] of [...layer.querySelectorAll('b')].entries())
        b.textContent = String(i ? balances.ticket : balances.coin);
      pbDrawScene(scene, 0.55, performance.now());
      return;
    }
    for (const [index, figure] of /** @type {HTMLElement[]} */ ([...prizes.children]).entries()) {
      figure.style.perspective = '500px';
      figure.querySelector('.pb-prize-object').animate(
        [
          {
            transform:
              'translateY(12px) rotateY(' + (index ? -85 : 85) + 'deg) rotate(0) scale(.55)',
            opacity: 0,
            filter: 'blur(5px) drop-shadow(0 8px 11px #0008)',
          },
          { opacity: 1, offset: 0.25 },
          {
            transform: 'translateY(0) rotateY(0) rotate(' + (index ? 9 : -10) + 'deg) scale(1)',
            opacity: 1,
            filter: 'blur(0) drop-shadow(0 8px 11px #0008)',
          },
        ],
        {
          duration: 650,
          delay: 200 + index * 100,
          easing: 'cubic-bezier(.16,.8,.2,1)',
          fill: 'both',
        },
      );
      figure.querySelector('small').animate(
        [
          { opacity: 0, transform: 'translateY(4px)' },
          { opacity: 1, transform: 'translateY(0)' },
        ],
        { duration: 300, delay: 600 + index * 100, easing: 'ease-out', fill: 'both' },
      );
    }
    function frame(now) {
      if (pbCinema !== scene || document.hidden) return;
      pbDrawScene(scene, 0.55, now);
      scene.frame = requestAnimationFrame(frame);
    }
    scene.frame = requestAnimationFrame(frame);
    later(() => {
      if (!layer.isConnected || pbCinema !== scene) return;
      for (const [index, kind] of ['coin', 'ticket'].entries()) {
        const figure = prizes.querySelector('.pb-scene-prize.' + kind),
          object = /** @type {HTMLElement} */ (figure.querySelector('.pb-prize-object'));
        const source = object.getBoundingClientRect(),
          destination = (
            visible
              ? wallet.querySelector('[data-pb-wallet="' + kind + '"]')
              : layer.querySelector('[data-fly-target="' + kind + '"]')
          ).getBoundingClientRect();
        const fly = document.createElement('div');
        fly.className = 'pb-fly';
        fly.style.cssText =
          'left:' +
          source.left +
          'px;top:' +
          source.top +
          'px;width:' +
          source.width +
          'px;height:' +
          source.height +
          'px';
        fly.innerHTML = pbArt(kind, 'pb-flight-' + kind) + '<small>+1</small>';
        layer.append(fly);
        object.style.visibility = 'hidden';
        figure
          .querySelector('small')
          .animate([{ opacity: 1 }, { opacity: 0 }], { duration: 150, fill: 'forwards' });
        const dx = destination.left + destination.width / 2 - source.left - source.width / 2,
          dy = destination.top + destination.height / 2 - source.top - source.height / 2;
        fly.animate(
          [
            { transform: 'translate(0,0) scale(1)', opacity: 1 },
            {
              transform: 'translate(' + dx * 0.15 + 'px,' + (dy * 0.25 - 18) + 'px) scale(.8)',
              opacity: 1,
              offset: 0.28,
            },
            {
              transform:
                'translate(' +
                dx +
                'px,' +
                dy +
                'px) scale(.18) rotate(' +
                (index ? 20 : -15) +
                'deg)',
              opacity: 0,
            },
          ],
          { duration: 700, delay: index * 80, easing: 'cubic-bezier(.4,.04,.3,1)', fill: 'both' },
        );
      }
    }, 1260);
    later(() => {
      if (!layer.isConnected) return;
      const target = visible ? wallet : layer.querySelector('.pb-flight-target');
      if (!visible)
        for (const [i, b] of [...target.querySelectorAll('b')].entries())
          b.textContent = String(i ? balances.ticket : balances.coin);
      target.animate(
        [
          { transform: 'scale(1)' },
          { transform: 'scale(1.07)', offset: 0.35 },
          { transform: 'scale(1)' },
        ],
        { duration: 260, easing: 'ease-out' },
      );
    }, 1960);
  }
  function clear() {
    for (const id of timers) clearTimeout(id);
    timers.clear();
    pbDropMeteor();
    pbDropScene(true);
    document.querySelector('#pb-fx')?.remove();
    const entry = getEntry();
    if (entry) delete entry.dataset.flying;
  }
  return {
    begin: pbMakeMeteor,
    draw: pbDrawMeteor,
    cancel: pbDropMeteor,
    release: pbReleaseMeteor,
    reward,
    clear,
  };
}
