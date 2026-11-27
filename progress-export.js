import { checklist } from "./lesson-data.js";

const ns = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const xml = (value) => String(value ?? "")
  .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\ufffe\uffff]/g, "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");
function column(index) {
  let name = "";
  for (index++; index; index = Math.floor((index - 1) / 26))
    name = String.fromCharCode(65 + (index - 1) % 26) + name;
  return name;
}

// A small, uncompressed ZIP writer for the fixed OOXML parts below.
// Keeping the export local avoids sending student records to another service.
function zip(files) {
  const encoder = new TextEncoder(), local = [], central = [];
  let offset = 0;
  const header = (size) => new DataView(new ArrayBuffer(size));
  for (const [path, content] of Object.entries(files)) {
    const name = encoder.encode(path), bytes = encoder.encode(content);
    let crc = 0xffffffff;
    for (const byte of bytes) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    crc = (crc ^ 0xffffffff) >>> 0;
    const h = header(30);
    h.setUint32(0, 0x04034b50, true);
    h.setUint16(4, 20, true);
    h.setUint16(12, 33, true); // 1980-01-01
    h.setUint32(14, crc, true);
    h.setUint32(18, bytes.length, true);
    h.setUint32(22, bytes.length, true);
    h.setUint16(26, name.length, true);
    local.push(h.buffer, name, bytes);
    const c = header(46);
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint16(14, 33, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, bytes.length, true);
    c.setUint32(24, bytes.length, true);
    c.setUint16(28, name.length, true);
    c.setUint32(42, offset, true);
    central.push(c.buffer, name);
    offset += 30 + name.length + bytes.length;
  }
  const end = header(22);
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, central.length / 2, true);
  end.setUint16(10, central.length / 2, true);
  end.setUint32(12, central.reduce((sum, part) => sum + part.byteLength, 0), true);
  end.setUint32(16, offset, true);
  return new Blob([...local, ...central, end.buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export function createProgressWorkbook(students) {
  const date = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });
  const headers = ["학생 번호", "이름", "완료 항목 수", "전체 항목 수", "진행률",
    "캐릭터 이름", "성격과 좋아하는 것", "반드시 유지할 특징 3가지", "마지막 저장 시각 (한국 시간)",
    ...checklist.map((item) => item.label)];
  const rows = [headers, ...students.map((student) => {
    const checks = student.checks || {}, notes = student.notes || {};
    const completed = checklist.filter((item) => checks[item.id] === true).length;
    return [String(student.studentNumber ?? ""), student.name, completed, checklist.length,
      checklist.length ? completed / checklist.length : 0,
      notes.characterName, notes.personality, notes.features,
      student.updatedAt ? date.format(new Date(student.updatedAt * 1000)) : "기록 없음",
      ...checklist.map((item) => checks[item.id] === true ? "완료" : "미완료")];
  })];
  const last = column(headers.length - 1) + rows.length;
  const sheetRows = rows.map((row, r) => `<row r="${r + 1}" ht="${r ? 60 : 90}" customHeight="1">${row.map((value, c) => {
    const ref = column(c) + (r + 1);
    const style = r === 0 ? 1 : c === 4 ? 2 : 0;
    return typeof value === "number"
      ? `<c r="${ref}" s="${style}"><v>${value}</v></c>`
      : `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
  }).join("")}</row>`).join("");
  const relationship = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
  return zip({
    "[Content_Types].xml": `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    "_rels/.rels": `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${relationship}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    "xl/workbook.xml": `<workbook xmlns="${ns}" xmlns:r="${relationship}"><sheets><sheet name="학습기록" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    "xl/_rels/workbook.xml.rels": `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${relationship}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${relationship}/styles" Target="styles.xml"/></Relationships>`,
    "xl/styles.xml": `<styleSheet xmlns="${ns}"><fonts count="2"><font><sz val="11"/><name val="맑은 고딕"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="맑은 고딕"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF365870"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="9" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
    "xl/worksheets/sheet1.xml": `<worksheet xmlns="${ns}"><dimension ref="A1:${last}"/><sheetViews><sheetView workbookViewId="0"><pane xSplit="2" ySplit="1" topLeftCell="C2" activePane="bottomRight" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="5" width="14" customWidth="1"/><col min="6" max="8" width="36" customWidth="1"/><col min="9" max="9" width="25" customWidth="1"/><col min="10" max="${headers.length}" width="26" customWidth="1"/></cols><sheetData>${sheetRows}</sheetData><autoFilter ref="A1:${last}"/></worksheet>`,
  });
}
