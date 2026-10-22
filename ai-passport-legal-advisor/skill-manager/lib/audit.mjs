// ชั้นที่ 4: audit front-end ให้ตรง design language และไม่ดู "เหมือน AI ทำทุกเว็บ"
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, STATE, flags, log, readJSON, walkFiles } from './core.mjs';

const EXT = new Set(['.css', '.html', '.jsx', '.tsx', '.vue', '.svelte']);
const SOURCES = ['index.css', 'src/index.css', 'app.css', 'src/app.css'];
const GENERIC = new Set(['system-ui', 'sans-serif', 'serif', 'monospace', '-apple-system', 'blinkmacsystemfont', 'segoe ui', 'roboto', 'inherit', 'ui-sans-serif']);

const normHex = (h) => {
  h = h.toLowerCase().replace('#', '');
  if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('');
  return `#${h.slice(0, 6)}`;
};
const rgbHex = (r, g, b) => `#${[r, g, b].map((n) => Number(n).toString(16).padStart(2, '0')).join('')}`;
function colorsIn(text) {
  const set = new Set();
  for (const m of text.matchAll(/#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/g)) set.add(normHex(m[0]));
  for (const m of text.matchAll(/rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/g)) set.add(rgbHex(+m[1], +m[2], +m[3]));
  return set;
}
function fontsIn(text) {
  const set = new Set();
  for (const m of text.matchAll(/font-family:\s*([^;}]+)/g)) {
    for (const f of m[1].split(',')) {
      const n = f.trim().replace(/^["']|["']$/g, '').toLowerCase();
      if (n && !GENERIC.has(n)) set.add(n);
    }
  }
  return set;
}

export function audit() {
  const cfg = readJSON(path.join(STATE, 'design.json'), {});
  const palette = new Set((cfg.palette || []).map(normHex));
  const fonts = new Set((cfg.fonts || []).map((f) => f.toLowerCase()));
  const srcFiles = new Set();
  for (const s of SOURCES) {
    const f = path.join(ROOT, s);
    if (!fs.existsSync(f)) continue;
    srcFiles.add(f);
    const t = fs.readFileSync(f, 'utf8');
    colorsIn(t).forEach((c) => palette.add(c));
    fontsIn(t).forEach((x) => fonts.add(x));
  }
  const minFont = cfg.minFontPx || 14;
  const ignore = new Set(cfg.ignore || []);
  const findings = [];
  const add = (file, line, sev, rule, msg) => { if (!ignore.has(rule)) findings.push({ file: path.relative(ROOT, file), line, sev, rule, msg }); };

  const targets = walkFiles(ROOT).filter((f) => EXT.has(path.extname(f)));
  for (const f of targets) {
    const ext = path.extname(f);
    const lines = fs.readFileSync(f, 'utf8').split('\n');
    const isSource = srcFiles.has(f);

    lines.forEach((l, i) => {
      const n = i + 1;
      if (!isSource && palette.size) {
        for (const c of colorsIn(l)) if (!palette.has(c)) add(f, n, 'warn', 'color-off-palette', `สี ${c} ไม่อยู่ใน palette ของโปรเจกต์ (เพิ่มใน index.css หรือ .skills/design.json)`);
      }
      if (/(from|via|to)-(purple|violet|fuchsia|indigo|pink)-\d{2,3}/.test(l) || /gradient\([^)]*(#6366f1|#8b5cf6|#a855f7|#7c3aed)/i.test(l)) {
        add(f, n, 'warn', 'ai-gradient', 'ไล่สีม่วง/อินดิโกสำเร็จรูป — เป็นลายเซ็นของเว็บที่ AI ทำ ให้ใช้สีจาก palette');
      }
      if (ext === '.css' && /font-family:/.test(l) && fonts.size) {
        const v = fontsIn(l);
        if (v.size && ![...v].some((x) => fonts.has(x)) && !/var\(/.test(l)) add(f, n, 'warn', 'font-off-system', `ฟอนต์ ${[...v].join(', ')} ไม่ใช่ฟอนต์ของโปรเจกต์ (${[...fonts].join(', ')})`);
      }
      const px = l.match(/font-size:\s*(\d+(?:\.\d+)?)px|text-\[(\d+)px\]/);
      if (px) { const v = Number(px[1] || px[2]); if (v < minFont) add(f, n, 'warn', 'tiny-font', `ตัวอักษร ${v}px เล็กกว่า ${minFont}px อ่านยากบนมือถือ`); }
      if (/<button|onClick/.test(l) && /\b(h|w)-([4-8])\b/.test(l)) add(f, n, 'info', 'small-tap-target', 'ปุ่มอาจเล็กกว่า 44px สำหรับนิ้วมือ (สำคัญในหน้าฉุกเฉิน)');
      if (ext === '.html' && /<html/i.test(l) && !/lang=/.test(l)) add(f, n, 'warn', 'html-lang-missing', '<html> ไม่มี lang (ควรเป็น lang="th")');
    });

    const counts = {};
    lines.forEach((l, i) => {
      for (const m of l.matchAll(/class(?:Name)?="([^"]+)"/g)) {
        if (/rounded/.test(m[1]) && /(bg-|border)/.test(m[1])) (counts[m[1]] ||= []).push(i + 1);
      }
    });
    for (const [cls, ls] of Object.entries(counts)) {
      if (ls.length >= 6) add(f, ls[0], 'info', 'repeated-card', `การ์ดสไตล์เดียวกันซ้ำ ${ls.length} ครั้ง ("${cls.slice(0, 40)}…") — หน้าจอดูเป็นเทมเพลต ลองสร้างลำดับความสำคัญ/ขนาดที่ต่างกัน`);
    }
  }

  const warns = findings.filter((x) => x.sev === 'warn').length;
  if (flags.json) log(JSON.stringify(findings, null, 2));
  else {
    if (!palette.size) log('หมายเหตุ: ไม่พบ index.css/palette จึงข้ามกฎสีและฟอนต์ (สร้าง .skills/design.json เพื่อกำหนดเอง)');
    for (const x of findings) log(`${x.file}:${x.line} [${x.sev}:${x.rule}] ${x.msg}`);
    log(`\nตรวจ ${targets.length} ไฟล์ — warn ${warns}, info ${findings.length - warns}`);
  }
  return warns && !flags.soft ? 1 : 0;
}
