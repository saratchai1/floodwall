import { lengthOf, pointAt, groundAt, formatStation } from "./model.js";

// Dependency-free, draggable engineering concept model.
// An orthographic 3D projection is used so the viewer works offline without WebGL/CDNs.
export function mountViewer(canvas, getProject, getStation) {
  const ctx = canvas.getContext("2d");
  const state = { yaw: -0.43, tilt: 0.87, zoom: 1, panX: 0, panY: 0, drag: null, width: 0, height: 0, showLines: true };
  const DPR = () => Math.min(2, window.devicePixelRatio || 1);
  let raf = 0;
  const colors = {
    earthLeft: "#c3c8a9", shoulderLeft: "#bbc29d", water: "#397a95",
    shallow: "#76a3ac", rock: "#aaa994", bank: "#b8baa4", land: "#c9d0b4",
    wall: "#b3b4a7", sideWall: "#7e8c8c"
  };

  function size() {
    const r = canvas.getBoundingClientRect();
    const w = Math.max(280, Math.floor(r.width)), h = Math.max(160, Math.floor(r.height));
    if (w !== state.width || h !== state.height) {
      state.width = w; state.height = h;
      canvas.width = Math.floor(w * DPR()); canvas.height = Math.floor(h * DPR());
      ctx.setTransform(DPR(), 0, 0, DPR(), 0, 0);
    }
    return { w, h };
  }

  function render() {
    raf = 0;
    const { w, h } = size();
    const p = getProject();
    if (!p || !p.alignment || p.alignment.length < 2) return;
    const L = lengthOf(p.alignment);
    const center = pointAt(p.alignment, L / 2);
    const range = Math.max(300, L);
    const yaw = state.yaw, tilt = state.tilt;
    const scale = Math.min(w / (range * 1.03), h / (range * 0.65)) * state.zoom;
    const zFactor = 4.5;
    const cos = Math.cos(yaw), sin = Math.sin(yaw);
    function pr(x, y, z) {
      const dx = x - center.x, dz = z - center.y;
      const rx = dx * cos - dz * sin, rz = dx * sin + dz * cos;
      return {
        x: w / 2 + rx * scale + state.panX,
        y: h * .51 + (rz * Math.sin(tilt) - y * zFactor * Math.cos(tilt)) * scale + state.panY,
        d: rz * Math.cos(tilt) + y * zFactor * Math.sin(tilt)
      };
    }

    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, "#a5cbe2");
    bg.addColorStop(.62, "#e4eaf0");
    bg.addColorStop(1, "#fafcfb");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    // Soft ambient reference grid for visual orientation.
    ctx.strokeStyle = "rgba(102,134,154,.07)"; ctx.lineWidth = 1;
    for (let i = -12; i <= 12; i++) {
      const a = pr(center.x - range, -8, center.y + i * 50);
      const b = pr(center.x + range, -8, center.y + i * 50);
      line(a, b);
    }

    const step = Math.max(10, L / 130);
    const samples = [];
    for (let s = 0; s < L; s += step) samples.push(s);
    samples.push(L);
    const strips = [
      [-65, -35, colors.land, 0], [-35, -18, colors.earthLeft, 1],
      [-18, -12, colors.shoulderLeft, 2], [-12, 12, colors.water, 3],
      [12, 18, colors.shallow, 4], [18, 31, colors.rock, 5],
      [31, 65, colors.bank, 6]
    ];
    const tris = [];
    const cord = (station, offset, vertical = 0) => {
      const a = pointAt(p.alignment, station);
      let hGround = groundAt(p.survey, station, p.levels.ground);
      let dz = 0;
      const aOff = Math.abs(offset);
      if (aOff <= 12) dz = -3.3;
      else if (aOff <= 18) dz = -3.3 + (aOff - 12) * .4;
      else if (aOff <= 31) dz = -0.9 + (aOff - 18) * .27;
      else dz = 2.6 + Math.cos(station / 75) * .22;
      const high = (hGround - p.levels.ground) + dz + vertical;
      return pr(a.x + a.nx * offset, high, a.y + a.ny * offset);
    };
    for (let i = 0; i < samples.length - 1; i++) {
      const s0 = samples[i], s1 = samples[i + 1];
      for (const [offset0, offset1, color, order] of strips) {
        const a = cord(s0, offset0), b = cord(s0, offset1), c = cord(s1, offset1), d = cord(s1, offset0);
        const depth = (a.d + b.d + c.d + d.d) / 4;
        const irregular = (Math.sin(i * 1.71 + order) + Math.cos(i * .38 + order)) / 2;
        tris.push({ pts: [a, b, c, d], depth, color, alpha: order === 3 ? 1 : .95, irregular, order });
      }
      // Concrete or sheet-pile crest is a visually distinct continuous object.
      if (p.geometry.wallType !== "revetment") {
        const off = 19;
        const height = p.geometry.wallType === "sheetpile" ? p.geometry.wallHeight * .95 : p.geometry.wallHeight * .54;
        const a = cord(s0, off, 0), b = cord(s1, off, 0);
        const c = cord(s1, off, height), d = cord(s0, off, height);
        tris.push({ pts: [a, b, c, d], depth: (a.d + b.d + c.d + d.d) / 4 - 1, color: p.geometry.wallType === "sheetpile" ? "#677d88" : colors.sideWall, alpha: 1, irregular: 0, order: 8 });
        const a2 = cord(s0, off + 2, height), b2 = cord(s1, off + 2, height);
        tris.push({ pts: [d, c, b2, a2], depth: (d.d + c.d + b2.d + a2.d) / 4 + 1, color: "#e8e9dd", alpha: 1, irregular: 0, order: 9 });
      }
    }
    tris.sort((a, b) => b.depth - a.depth);
    ctx.lineJoin = "round";
    tris.forEach(poly => {
      ctx.globalAlpha = poly.alpha;
      ctx.fillStyle = poly.color;
      ctx.beginPath(); poly.pts.forEach((a, i) => i ? ctx.lineTo(a.x, a.y) : ctx.moveTo(a.x, a.y));
      ctx.closePath(); ctx.fill();
      if (poly.order === 3) {
        ctx.strokeStyle = "rgba(226,243,242,.12)";
        ctx.lineWidth = .45; ctx.stroke();
      } else if (poly.order > 7) {
        ctx.strokeStyle = "rgba(64,78,87,.32)";
        ctx.lineWidth = .5; ctx.stroke();
      }
    });
    ctx.globalAlpha = 1;

    if (state.showLines) {
      // Site cross-chainages are conceptual, not survey-validated.
      for (let s = 0; s < L; s += 100) {
        const a = cord(s, -38, 0), b = cord(s, 39, 0);
        ctx.strokeStyle = "rgba(48,79,92,.33)"; ctx.lineWidth = .75; ctx.setLineDash([2, 4]); line(a, b); ctx.setLineDash([]);
      }
    }
    const station = Math.max(0, Math.min(L, getStation()));
    const stationPoint = cord(station, 19, p.geometry.wallType === "revetment" ? 0 : p.geometry.wallHeight * .54);
    const end = { x: stationPoint.x, y: stationPoint.y - 25 };
    ctx.strokeStyle = "#eaa348"; ctx.lineWidth = 2.2; line(stationPoint, end);
    ctx.beginPath(); ctx.arc(stationPoint.x, stationPoint.y, 5.2, 0, Math.PI * 2);
    ctx.fillStyle = "#ffbc63"; ctx.fill(); ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke();
    const label = "STA " + formatStation(station);
    ctx.font = "600 11px system-ui";
    const labelWidth = ctx.measureText(label).width + 18;
    let lx = Math.min(w - labelWidth - 8, Math.max(8, end.x - labelWidth / 2)), ly = Math.max(16, end.y - 27);
    roundedRect(ctx, lx, ly, labelWidth, 23, 6);
    ctx.fillStyle = "rgba(17, 41, 62, .92)"; ctx.fill();
    ctx.fillStyle = "#fff"; ctx.fillText(label, lx + 9, ly + 15.5);
    // Bottom right cartographic coordinate cue.
    ctx.strokeStyle = "rgba(40,66,89,.45)";
    ctx.beginPath(); ctx.moveTo(w - 39, h - 36); ctx.lineTo(w - 39, h - 66); ctx.stroke();
    ctx.fillStyle = "#4c6677"; ctx.font = "bold 11px system-ui"; ctx.fillText("N", w - 43, h - 72);
  }

  function line(a, b) {
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  function roundedRect(ctx, x, y, width, height, r) {
    ctx.beginPath(); ctx.roundRect(x, y, width, height, r);
  }
  function repaint() { if (!raf) raf = requestAnimationFrame(render); }
  function down(e) {
    state.drag = { x: e.clientX, y: e.clientY, yaw: state.yaw, tilt: state.tilt, panX: state.panX, panY: state.panY, shift: e.shiftKey };
    canvas.setPointerCapture(e.pointerId);
  }
  function move(e) {
    if (!state.drag) return;
    const dx = e.clientX - state.drag.x, dy = e.clientY - state.drag.y;
    if (state.drag.shift || e.shiftKey) {
      state.panX = state.drag.panX + dx; state.panY = state.drag.panY + dy;
    } else {
      state.yaw = state.drag.yaw + dx * .006;
      state.tilt = Math.min(1.42, Math.max(.2, state.drag.tilt + dy * .004));
    }
    repaint();
  }
  function up() { state.drag = null; }
  function wheel(e) { e.preventDefault(); state.zoom = Math.min(8, Math.max(.45, state.zoom * (e.deltaY > 0 ? .88 : 1.14))); repaint(); }
  canvas.addEventListener("pointerdown", down);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);
  canvas.addEventListener("wheel", wheel, { passive: false });
  const ro = new ResizeObserver(repaint);
  ro.observe(canvas);
  repaint();
  return {
    repaint,
    reset() { state.yaw = -.43; state.tilt = .87; state.zoom = 1; state.panX = state.panY = 0; repaint(); },
    toggleLines() { state.showLines = !state.showLines; repaint(); return state.showLines; },
    downloadPng() {
      render();
      return canvas.toDataURL("image/png");
    },
    destroy() {
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      canvas.removeEventListener("wheel", wheel);
    }
  };
}
