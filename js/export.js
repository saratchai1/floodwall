import { formatStation, groundAt, lengthOf, quantities, totalCost } from "./model.js";

const xml = s => String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const f2 = v => Number(v).toFixed(2);

export function sectionSVG(project, station) {
  const g = project.geometry, lev = project.levels;
  const localGround = groundAt(project.survey, station, lev.ground);
  const crest = Math.max(lev.crest, localGround + g.wallHeight);
  const y = value => Math.max(55, Math.min(365, 335 - (value - lev.lowWater) * 22.5));
  const groundY = y(localGround), waterY = y(lev.highWater), lowY = y(lev.lowWater), crestY = y(crest);
  const wallX = 498, baseY = groundY + 38, baseW = g.baseWidth * 32;
  const wallTop = Math.max(65, groundY - g.wallHeight * 22.5);
  const isConcrete = g.wallType === "gravity", isSheet = g.wallType === "sheetpile";
  const layers = [];
  layers.push('<path d="M0 ' + (groundY - 32) + ' L250 ' + (groundY - 18) + ' L410 ' + groundY + ' L' + wallX + ' ' + groundY + ' L' + wallX + ' 410 L0 410Z" fill="#e7d8b5" stroke="#bcb08c"/>');
  layers.push('<path d="M0 ' + (groundY - 32) + ' L250 ' + (groundY - 18) + ' L410 ' + groundY + ' L' + wallX + ' ' + groundY + '" fill="none" stroke="#7d9474" stroke-width="5"/>');
  layers.push('<path d="M' + wallX + ' ' + (baseY + 10) + ' L610 ' + (groundY + 10) + ' L780 ' + (groundY + 80) + ' L960 ' + (groundY + 95) + ' L960 410 L' + wallX + ' 410Z" fill="#e0d8b6" stroke="#bcb090"/>');
  layers.push('<path d="M610 ' + (groundY + 10) + ' L780 ' + (groundY + 80) + ' L960 ' + (groundY + 95) + '" fill="none" stroke="#88957a" stroke-width="5"/>');
  layers.push('<path d="M620 ' + waterY + ' L960 ' + waterY + ' L960 410 L620 410Z" fill="#9fcfda" opacity=".60"/>');
  if (isConcrete) {
    layers.push('<path d="M' + (wallX - baseW * .43) + ' ' + baseY + ' h' + baseW + ' v' + g.baseThickness * 22 + ' h-' + baseW + 'Z" fill="#bfc9ce" stroke="#647988" stroke-width="2"/>');
    layers.push('<path d="M' + (wallX - 4) + ' ' + wallTop + ' h' + g.stemThickness * 32 + ' v' + (baseY - wallTop) + ' h-' + g.stemThickness * 32 + 'Z" fill="#aebcc5" stroke="#516879" stroke-width="2"/>');
    layers.push('<path d="M' + (wallX + 3) + ' ' + (wallTop + 10) + ' v' + (baseY - wallTop - 14) + '" stroke="#737988" stroke-width="2" stroke-dasharray="4 5" fill="none"/>');
  } else if (isSheet) {
    layers.push('<rect x="' + wallX + '" y="' + wallTop + '" width="12" height="' + (baseY + g.embedment * 22 - wallTop) + '" fill="#7893a5" stroke="#445a6e" stroke-width="2"/>');
    for (let i = 0; i < 5; i++) layers.push('<path d="M' + (wallX + 2) + ' ' + (wallTop + 12 + i * 20) + ' l8 8" stroke="#e0ebed"/>');
  } else {
    const toe = wallX + 145 + g.slopeRatio * 15;
    layers.push('<path d="M' + (wallX - 15) + ' ' + (groundY - 45) + ' L' + (wallX + 25) + ' ' + (groundY - 45) + ' L' + toe + ' ' + (groundY + 65) + ' L' + (toe + 20) + ' ' + (groundY + 65) + ' L' + (wallX + 25) + ' ' + (groundY - 48) + 'Z" fill="#a7a89b" stroke="#77796b" stroke-width="2"/>');
    layers.push('<path d="M' + (wallX + 25) + ' ' + (groundY - 48) + ' L' + (toe + 20) + ' ' + (groundY + 65) + '" stroke="#748f84" stroke-width="4"/>');
  }
  const drawing = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="980" height="430" viewBox="0 0 980 430" role="img" aria-label="รูปตัดเขื่อนป้องกันตลิ่ง">',
    '<defs><pattern id="soil" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M0 12L12 0" stroke="#b6aa8c" stroke-width=".55"/></pattern></defs>',
    '<rect width="980" height="430" fill="#fbfcfc"/>',
    '<path d="M0 70H980 M0 140H980 M0 210H980 M0 280H980 M0 350H980" stroke="#edf0ef" stroke-width="1" stroke-dasharray="3 4"/>',
    ...layers,
    '<path d="M620 ' + waterY + 'H980" stroke="#3486a9" stroke-width="2.5" stroke-dasharray="10 5"/>',
    '<path d="M620 ' + lowY + 'H980" stroke="#6398ab" stroke-width="1.3" stroke-dasharray="3 5"/>',
    '<path d="M0 ' + y(lev.groundwater) + 'H460" stroke="#5c9cae" stroke-dasharray="5 6" fill="none"/>',
    '<path d="M' + (wallX + 17) + ' ' + crestY + ' v-32 M' + (wallX + 17) + ' ' + crestY + ' h160" stroke="#617c84" fill="none" stroke-width="1"/>',
    '<text x="' + (wallX + 183) + '" y="' + (crestY - 4) + '" fill="#385d6a" font-size="12">ระดับสัน +' + f2(crest) + ' ม.</text>',
    '<text x="675" y="' + Math.max(98, waterY - 11) + '" fill="#14628a" font-size="12">ระดับน้ำสูง +' + f2(lev.highWater) + ' ม.</text>',
    '<text x="680" y="' + Math.min(402, lowY - 8) + '" fill="#457b90" font-size="11">ระดับน้ำต่ำ +' + f2(lev.lowWater) + ' ม.</text>',
    '<text x="24" y="' + (Math.max(75, groundY - 48)) + '" fill="#597064" font-size="12">ดินถมหลังเขื่อน (แนวคิดเบื้องต้น)</text>',
    '<text x="30" y="28" fill="#253c4c" font-size="16" font-weight="700">TYPICAL SECTION • ' + xml(formatStation(station)) + '</text>',
    '<text x="30" y="47" fill="#728493" font-size="11">' + xml(project.geometry.wallType === "gravity" ? "คอนกรีตเสริมเหล็ก / Gravity concept" : project.geometry.wallType === "sheetpile" ? "Sheet pile concept" : "หินเรียงป้องกันลาด / Revetment concept") + '</text>',
    '<rect x="15" y="395" width="635" height="23" rx="5" fill="#fff2da" stroke="#e8ce9e"/>',
    '<text x="26" y="411" fill="#8c632b" font-size="11">PRELIMINARY CONCEPT • ต้องยืนยันระดับสำรวจ, ธรณีเทคนิค, ไฮดรอลิก และแบบมาตรฐานก่อนใช้ออกแบบจริง</text>',
    '</svg>'
  ].join("");
  return drawing;
}

function csvCell(value) {
  const s = String(value === undefined ? "" : value);
  return /[,"\r\n]/.test(s) ? '"' + s.replaceAll('"', '""') + '"' : s;
}
function csv(rows) { return "\ufeff" + rows.map(r => r.map(csvCell).join(",")).join("\r\n"); }
export function quantityCSV(project) {
  const rows = [["เลขรายการ", "รายละเอียด", "ปริมาณ", "หน่วย", "ราคาต่อหน่วย (บาท)", "มูลค่า (บาท)", "สูตร/ที่มา"]];
  quantities(project).forEach(r => rows.push([r.code, r.name, r.quantity.toFixed(3), r.unit, r.unitPrice, r.amount.toFixed(2), r.basis]));
  rows.push(["", "รวม (ราคาสาธิต ไม่รวม VAT/ค่าเผื่อ)", "", "", "", totalCost(quantities(project)).toFixed(2), "ต้องตรวจปร.4กับแบบและอัตราราคาจริง"]);
  return csv(rows);
}
export function stationsCSV(project) {
  return csv([["station_m", "chainage", "ground_level_m", "river_bed_m", "survey_source"], ...project.survey.map(s => [s.station, formatStation(s.station), s.ground, s.bed ?? "", project.surveySource || "DEMO"])]);
}

function dxfLine(a, b, layer) {
  return ["0","LINE","8",layer,"10",f2(a[0]),"20",f2(a[1]),"30","0","11",f2(b[0]),"21",f2(b[1]),"31","0"].join("\n") + "\n";
}
function dxfText(x, y, text, layer = "TEXT") {
  return ["0","TEXT","8",layer,"10",f2(x),"20",f2(y),"40",".25","1",text].join("\n") + "\n";
}
export function sectionDXF(project, station) {
  const g = project.geometry, lev = project.levels;
  let out = "0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n";
  const drawPoly = (pts, layer) => { for (let i = 1; i < pts.length; i++) out += dxfLine(pts[i-1],pts[i],layer); };
  const ground = groundAt(project.survey, station, lev.ground);
  drawPoly([[-14,ground+1],[-5,ground+.3],[0,ground],[4,ground-.5],[12,ground-3],[18,ground-3]],"GROUND");
  drawPoly([[3,lev.highWater],[18,lev.highWater]],"WATER_HIGH");
  drawPoly([[3,lev.lowWater],[18,lev.lowWater]],"WATER_LOW");
  const H = g.wallHeight, B = g.baseWidth, t = g.baseThickness;
  if (g.wallType === "gravity") {
    drawPoly([[-B*.48,ground-1],[-B*.48+B,ground-1],[-B*.48+B,ground-1+t],[-B*.48,ground-1+t],[-B*.48,ground-1]],"CONCRETE");
    drawPoly([[0,ground-1+t],[g.stemThickness,ground-1+t],[g.stemThickness,ground-1+t+H],[0,ground-1+t+H],[0,ground-1+t]],"CONCRETE");
  } else if (g.wallType === "sheetpile") {
    drawPoly([[0,ground-g.embedment],[0,ground+H]],"SHEETPILE");
  } else {
    drawPoly([[0,ground+H],[g.slopeRatio*H,ground]],"RIPRAP");
    drawPoly([[.2,ground+H],[g.slopeRatio*H+.2,ground]],"FILTER");
  }
  out += dxfText(-13,ground+5,"FLOODWALL CONCEPT - STA "+formatStation(station));
  out += dxfText(-13,ground+4.5,"PRELIMINARY ONLY - NOT FOR CONSTRUCTION");
  out += "0\nENDSEC\n0\nEOF\n";
  return out;
}

export function download(name, data, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

export function cleanFilename(project) {
  return (project.projectCode || "floodwall").replace(/[^a-zA-Z0-9_-]/g, "_");
}
