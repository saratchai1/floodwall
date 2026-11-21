// Numerical routines and survey ingestion for the Floodwall Studio prototype.
// IMPORTANT: the stability formulas here are preliminary SCREENING approximations.
// They do not constitute a signed engineering design or a code-compliance check.

export const DEFAULTS = {
  projectName: "โครงการตัวอย่าง • เขื่อนป้องกันตลิ่ง",
  projectCode: "FW-DEMO-001",
  standard: "แนวทางอ้างอิงแบบมาตรฐาน ส.0005 (ต้องตรวจสอบฉบับจริง)",
  site: "พื้นที่สาธิต",
  geometry: {
    wallType: "gravity", wallHeight: 4.2, baseWidth: 3.2, baseThickness: 0.65,
    stemThickness: 0.45, embedment: 1.3, slopeRatio: 2, rockThickness: 0.3,
    filterThickness: 0.25, pileSpacing: 3, drainageSpacing: 20
  },
  soil: {
    unitWeight: 18, phi: 30, cohesion: 0, friction: 0.57,
    surcharge: 12, allowableBearing: 180, concreteWeight: 24,
    waterUnitWeight: 9.81
  },
  levels: { crest: 95, ground: 91.3, highWater: 92.4, lowWater: 87.5, groundwater: 91.8 },
  price: {
    excavation: 220, concrete: 3100, reinforcement: 29,
    rock: 1050, filter: 620, geotextile: 110, drain: 390, piling: 2600
  },
  alignment: [],
  survey: [],
  selectedStation: 250,
  note: "ตัวเลขเริ่มต้นเป็นข้อมูลสาธิต ไม่ใช่ข้อมูลสำรวจโครงการจริง"
};

export function sampleAlignment() {
  const pts = [];
  for (let i = 0; i <= 56; i++) {
    const t = i / 56;
    pts.push({
      x: 1320 * t,
      y: 83 * Math.sin(t * 3.3 * Math.PI) + 30 * Math.sin(t * 7.2 * Math.PI + 0.2)
    });
  }
  return pts;
}

export function lengthOf(points) {
  if (!points || points.length < 2) return 0;
  let out = 0;
  for (let i = 1; i < points.length; i++) {
    out += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return out;
}

export function pointAt(points, station) {
  if (!points || points.length < 2) return { x: 0, y: 0, nx: 0, ny: 1 };
  const target = Math.max(0, Math.min(station, lengthOf(points)));
  let covered = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-10) continue;
    if (covered + len >= target || i === points.length - 1) {
      const t = Math.max(0, Math.min(1, (target - covered) / len));
      return { x: a.x + dx * t, y: a.y + dy * t, nx: -dy / len, ny: dx / len };
    }
    covered += len;
  }
  return { ...points[points.length - 1], nx: 0, ny: 1 };
}

export function sampleSurvey(alignment) {
  const n = lengthOf(alignment);
  const rows = [];
  for (let s = 0; s <= n + 0.001; s += 25) {
    const t = n ? s / n : 0;
    rows.push({
      station: Math.round(s * 100) / 100,
      ground: +(91.3 + 1.0 * Math.sin(t * 11) + 0.45 * Math.cos(t * 19)).toFixed(3),
      left: +(94.7 + 0.9 * Math.sin(t * 6)).toFixed(3),
      bed: +(85.8 + 0.7 * Math.sin(t * 8)).toFixed(3)
    });
  }
  if (n && rows[rows.length - 1].station < n - 1) {
    rows.push({ ...rows[rows.length - 1], station: +n.toFixed(2) });
  }
  return rows;
}

export function createDemoProject() {
  const alignment = sampleAlignment();
  return JSON.parse(JSON.stringify({ ...DEFAULTS, alignment, survey: sampleSurvey(alignment) }));
}

export function formatStation(meters) {
  const m = Math.max(0, Math.round(Number(meters) || 0));
  return String(Math.floor(m / 1000)) + "+" + String(m % 1000).padStart(3, "0");
}

export function groundAt(survey, station, fallback = 91.3) {
  if (!survey || !survey.length) return fallback;
  const sorted = [...survey].sort((a, b) => a.station - b.station);
  if (station <= sorted[0].station) return Number(sorted[0].ground) || fallback;
  for (let i = 1; i < sorted.length; i++) {
    if (station <= sorted[i].station) {
      const l = sorted[i - 1], r = sorted[i];
      const t = (station - l.station) / (r.station - l.station || 1);
      return l.ground + (r.ground - l.ground) * t;
    }
  }
  return sorted[sorted.length - 1].ground;
}

export function parseCSV(text) {
  const lines = text.replace(/^\uFEFF/, "").trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 3) throw new Error("ไฟล์ CSV ต้องมีหัวตารางและข้อมูลอย่างน้อย 2 แถว");
  const sep = (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length ? ";" : ",";
  const headers = lines[0].split(sep).map(x => x.trim().toLowerCase().replace(/[\s_\-()]/g, ""));
  const idx = (...names) => headers.findIndex(x => names.some(n => x === n || x.includes(n)));
  const xIndex = idx("easting", "coordx", "utmex", "x");
  const yIndex = idx("northing", "coordy", "utmny", "y");
  const zIndex = idx("elevation", "level", "ground", "ระดับดิน", "z");
  const sIndex = idx("chainage", "station", "ระยะ", "สถานี");
  const bedIndex = idx("bedlevel", "riverbed", "ท้องน้ำ");
  const rows = lines.slice(1).map(line => line.split(sep).map(x => x.trim().replace(/^"|"$/g, "")));
  const number = (r, i) => i < 0 ? NaN : Number((r[i] || "").replace(/,/g, ""));
  if (sIndex >= 0 && zIndex >= 0) {
    const survey = rows.map(r => ({ station: number(r, sIndex), ground: number(r, zIndex), bed: number(r, bedIndex) }))
      .filter(r => Number.isFinite(r.station) && Number.isFinite(r.ground))
      .sort((a, b) => a.station - b.station);
    if (survey.length < 2) throw new Error("ไม่พบข้อมูล station และ ground ที่เป็นตัวเลขอย่างน้อย 2 แถว");
    return { type: "survey", survey };
  }
  if (xIndex >= 0 && yIndex >= 0) {
    const alignment = rows.map(r => ({ x: number(r, xIndex), y: number(r, yIndex), z: number(r, zIndex) }))
      .filter(r => Number.isFinite(r.x) && Number.isFinite(r.y));
    if (alignment.length < 2 || lengthOf(alignment) < 1) throw new Error("แนวพิกัด X/Y ใช้งานไม่ได้");
    return { type: "alignment", alignment };
  }
  throw new Error("CSV ต้องมีคอลัมน์ station,ground หรือ x,y (รองรับ easting,northing,z)");
}

// ASCII DXF geometry reader: LWPOLYLINE, older POLYLINE/VERTEX, and LINE.
// Does not read binary DXF or DWG. Coordinates are assumed to be in metres.
export function parseDxfPolyline(text) {
  if (!/\bSECTION\b/.test(text) || !/\bENTITIES\b/.test(text)) {
    throw new Error("ต้องเป็น ASCII DXF ที่มีส่วน ENTITIES; ไม่รองรับ DWG/Binary DXF");
  }
  const lines = text.split(/\r?\n/);
  const pairs = [];
  for (let i = 0; i + 1 < lines.length; i += 2) pairs.push([lines[i].trim(), lines[i + 1].trim()]);
  const paths = []; let current = null; let vertex = null; let legacy = false;
  function flush() {
    if (current && current.length >= 2) paths.push(current);
    current = null;
  }
  for (const [code, value] of pairs) {
    if (code === "0") {
      if (value === "LWPOLYLINE") { flush(); current = []; vertex = null; legacy = false; }
      else if (value === "POLYLINE") { flush(); current = []; vertex = null; legacy = true; }
      else if (value === "VERTEX" && legacy) { vertex = {}; current.push(vertex); }
      else if (value === "SEQEND") { flush(); legacy = false; vertex = null; }
      else if (value === "LINE") { flush(); current = []; vertex = null; legacy = false; }
      else if (value !== "VERTEX") { flush(); legacy = false; vertex = null; }
    } else if (current) {
      if (code === "10") {
        if (legacy && vertex) vertex.x = Number(value);
        else { vertex = { x: Number(value) }; current.push(vertex); }
      }
      if (code === "20" && vertex) vertex.y = Number(value);
    }
  }
  flush();
  const best = paths.filter(p => p.every(pt => Number.isFinite(pt.x) && Number.isFinite(pt.y)))
    .sort((a, b) => lengthOf(b) - lengthOf(a))[0];
  if (!best) throw new Error("ไม่พบ LWPOLYLINE/POLYLINE/LINE ที่เป็นแนวสำรวจใน DXF");
  if (lengthOf(best) > 1000000) throw new Error("แนวสำรวจยาวผิดปกติ ตรวจหน่วยพิกัด DXF ก่อน");
  return best;
}

export function evaluateStability(project) {
  const g = project.geometry, s = project.soil, lev = project.levels;
  const H = +g.wallHeight, B = +g.baseWidth;
  if (g.wallType !== "gravity") return { supported: false, cases: [], reason: "การวิเคราะห์โครงสร้างชนิดนี้ต้องใช้แบบจำลองเฉพาะ (เช่น pile embedment / erosion / uplift) ซึ่งต้นแบบนี้ยังไม่ได้คำนวณ" };
  const valid = [H, B, s.unitWeight, s.phi, s.friction, s.concreteWeight, s.allowableBearing, lev.ground].every(Number.isFinite)
    && H > 0 && B > 0 && s.unitWeight > 0 && s.phi > 0 && s.phi < 60 && s.friction > 0 && s.allowableBearing > 0;
  if (!valid) return { supported: false, cases: [], reason: "พารามิเตอร์ดินหรือหน้าตัดไม่ถูกต้อง" };
  const Ka = Math.pow(Math.tan(Math.PI / 4 - s.phi * Math.PI / 360), 2);
  const baseW = B * g.baseThickness * s.concreteWeight;
  const stemW = H * g.stemThickness * s.concreteWeight;
  const weight = baseW + stemW;
  // Idealized stem at a fixed portion of the base. Real toe/heel geometry is NOT modeled.
  const resistingMoment = baseW * (B / 2) + stemW * (B * 0.46);
  const groundwater = Number(lev.groundwater);
  const scenarios = [
    { id: "construction", name: "ระหว่างก่อสร้าง", river: lev.ground - 1.0, inland: Math.min(groundwater, lev.ground + 0.2), q: s.surcharge * 0.5 },
    { id: "service", name: "ระยะใช้งาน", river: lev.highWater, inland: groundwater, q: s.surcharge },
    { id: "drawdown", name: "น้ำลดเร็ว", river: lev.lowWater, inland: Math.max(groundwater, lev.highWater), q: s.surcharge }
  ];
  const cases = scenarios.map(c => {
    const paEarth = 0.5 * Ka * s.unitWeight * H * H;
    const paSurcharge = Ka * c.q * H;
    const head = Math.min(H, Math.max(0, c.inland - c.river));
    const paWater = 0.5 * s.waterUnitWeight * head * head;
    const demand = paEarth + paSurcharge + paWater;
    const overturn = paEarth * H / 3 + paSurcharge * H / 2 + paWater * head / 3;
    const sliding = demand > 0 ? weight * s.friction / demand : Infinity;
    const overturning = overturn > 0 ? resistingMoment / overturn : Infinity;
    const xFromToe = (resistingMoment - overturn) / weight;
    const e = B / 2 - xFromToe;
    const qMax = weight / B * (1 + 6 * Math.abs(e) / B);
    const bearing = qMax <= s.allowableBearing && Math.abs(e) <= B / 6;
    const screening = sliding >= 1.5 && overturning >= 2 && bearing;
    return { ...c, Ka, paEarth, paSurcharge, paWater, head, weight, demand, sliding, overturning, eccentricity: e, qMax, bearing, screening };
  });
  return { supported: true, cases, disclaimer: "Rankine active pressure + gravity-wall idealization. ไม่ได้ตรวจการทรุดตัว, global stability, scour, uplift, seepage, reinforcement หรือ pile capacity" };
}

export function quantities(project) {
  const g = project.geometry;
  const L = lengthOf(project.alignment);
  const rows = [];
  const add = (code, name, qty, unit, key, basis) => {
    const price = +project.price[key] || 0;
    rows.push({ code, name, quantity: Math.max(0, qty), unit, unitPrice: price, amount: Math.max(0, qty) * price, key, basis });
  };
  if (g.wallType === "gravity") {
    const concretePerM = g.baseWidth * g.baseThickness + g.stemThickness * g.wallHeight;
    add("C-01", "คอนกรีตฐานและผนัง", concretePerM * L, "ม³", "concrete", "(B × tฐาน + tผนัง × H) × L");
    add("E-01", "ดินขุดฐาน (สมมติการขุดเบื้องต้น)", g.baseWidth * (g.baseThickness + 0.3) * L, "ม³", "excavation", "B × (tฐาน + 0.30) × L");
    add("R-01", "เหล็กเสริม (อัตราสมมติ 95 กก./ม³)", concretePerM * L * 95, "กก.", "reinforcement", "คอนกรีต × 95 กก./ม³ • ต้องถอดแบบจริง");
  } else if (g.wallType === "sheetpile") {
    add("P-01", "ผนังชีทไพล์ (พื้นที่ตามหน้าตัดสมมติ)", (g.wallHeight + g.embedment) * L, "ม²", "piling", "(H + ฝังดิน) × L");
    add("E-01", "งานขุดเตรียมแนวเขื่อน (สมมติ)", 0.8 * L, "ม³", "excavation", "0.8 × L");
  } else {
    const faceLength = g.wallHeight * Math.hypot(1, g.slopeRatio);
    add("S-01", "หินเรียง/ป้องกันลาด", faceLength * g.rockThickness * L, "ม³", "rock", "ความยาวลาด × หนาหิน × L");
    add("F-01", "กรวดชั้นกรอง", faceLength * g.filterThickness * L, "ม³", "filter", "ความยาวลาด × หนาชั้นกรอง × L");
    add("G-01", "แผ่นใยสังเคราะห์ Geotextile", faceLength * L, "ม²", "geotextile", "ความยาวลาด × L");
  }
  add("D-01", "ท่อระบายน้ำ (สมมติแนวท่อ)", Math.ceil(L / Math.max(1, g.drainageSpacing)), "จุด", "drain", "ceil(L / ระยะท่อ)");
  return rows;
}

export function totalCost(rows) { return rows.reduce((n, row) => n + row.amount, 0); }

export function validateProject(p) {
  if (!p || !p.geometry || !p.soil || !p.levels || !Array.isArray(p.alignment) || !p.price) return false;
  return p.alignment.length >= 2 && Number.isFinite(lengthOf(p.alignment));
}
