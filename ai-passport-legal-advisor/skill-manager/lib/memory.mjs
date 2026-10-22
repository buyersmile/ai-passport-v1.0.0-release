// ชั้นที่ 3: เมมโมรี่ข้าม session — บันทึก → บีบอัด → ดึงเฉพาะที่เกี่ยวข้อง
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { flags, ROOT, STATE, log, today, fail, confirm, readJSONL, appendJSONL, writeJSONL } from './core.mjs';

const DIR = path.join(STATE, 'memory');
const ENTRIES = path.join(DIR, 'entries.jsonl');
const ARCHIVE = path.join(DIR, 'archive.jsonl');
const MEMORY_MD = path.join(ROOT, 'MEMORY.md');

export const TYPES = ['decision', 'attempt', 'constraint', 'status', 'note'];
const LABEL = { constraint: 'ข้อจำกัดของระบบ', decision: 'การตัดสินใจ', attempt: 'สิ่งที่ลองแล้ว (อย่าทำซ้ำ)', status: 'สถานะล่าสุด', note: 'บันทึกอื่น' };
const WEIGHT = { constraint: 2, decision: 1.5, attempt: 1, status: 0.5, note: 0.3 };
const LIMIT = { attempt: 15, status: 3, note: 5 };

// ห้ามเก็บข้อมูลส่วนบุคคล/ข้อมูลคดี: HARD ไม่มีทาง override, SOFT ใช้ --force ได้เมื่อมั่นใจว่าเป็นบริบททางเทคนิค
const HARD = [
  { re: /\b\d{13}\b|\b\d-\d{4}-\d{5}-\d{2}-\d\b/, why: 'เลขบัตรประชาชน 13 หลัก (หรือตัวเลข 13 หลักที่หน้าตาเหมือนกัน — ย่อให้สั้นลงหากเป็นเลขอื่น)' },
  { re: /\b(?:\d{4}[ -]){3}\d{4}\b/, why: 'เลขบัตร/บัญชี' },
  { re: /(sk-[A-Za-z0-9]{16,}|eyJ[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY)/, why: 'API key / token / private key' },
];
const SOFT = [
  { re: /[\w.+-]+@[\w-]+\.[\w.]+/, why: 'อีเมล' },
  { re: /\b0[689]\d[- ]?\d{3}[- ]?\d{4}\b|\b0\d{1,2}-\d{3}-\d{4}\b/, why: 'เบอร์โทร' },
  { re: /(จำเลย|โจทก์|หมายจับ|ผู้ต้องหา|ผู้เสียหาย|เลขคดี)/, why: 'ข้อมูลคดี' },
];

export function guard(text) {
  for (const r of HARD) if (r.re.test(text)) fail(`ปฏิเสธการบันทึก: พบ${r.why} — ห้ามเก็บในเมมโมรี่`);
  if (!flags.force) {
    for (const r of SOFT) if (r.re.test(text)) fail(`ข้อความอาจมี${r.why} — เมมโมรี่เก็บเฉพาะบริบททางเทคนิคของระบบ ถ้าแน่ใจว่าไม่ใช่ข้อมูลส่วนบุคคล/ข้อมูลคดี ใส่ --force`);
  }
}

export function addEntry({ type, text, tags = [] }) {
  if (!TYPES.includes(type)) fail(`ชนิดไม่ถูกต้อง: ${type} (ใช้ได้: ${TYPES.join(', ')})`);
  text = String(text || '').trim();
  if (!text) fail('ข้อความว่าง');
  guard(text);
  if (readJSONL(ENTRIES).some((e) => e.type === type && e.text === text)) return null;
  const e = { id: crypto.randomBytes(3).toString('hex'), ts: new Date().toISOString(), type, text, tags };
  appendJSONL(ENTRIES, e);
  return e;
}

const tri = (s) => {
  const t = s.toLowerCase().replace(/\s+/g, '');
  const set = new Set();
  for (let i = 0; i <= t.length - 3; i++) set.add(t.slice(i, i + 3));
  return set;
};

export function recall(query, limit = 8, exclude = []) {
  const entries = readJSONL(ENTRIES).filter((e) => !exclude.includes(e.type));
  const q = (query || '').trim();
  const qTri = tri(q);
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  const now = Date.now();
  return entries.map((e) => {
    const hay = `${e.text} ${(e.tags || []).join(' ')}`.toLowerCase();
    let rel = 0;
    if (q) {
      const eTri = tri(hay);
      const overlap = qTri.size ? [...qTri].filter((t) => eTri.has(t)).length / qTri.size : 0;
      rel = 3 * overlap + 2 * terms.filter((t) => hay.includes(t)).length;
      if (rel === 0) return { e, score: -1 };
    }
    const ageDays = (now - Date.parse(e.ts)) / 86400000;
    return { e, score: rel + WEIGHT[e.type] + 1 / (1 + ageDays / 14) };
  }).filter((x) => x.score >= 0).sort((a, b) => b.score - a.score).slice(0, limit).map((x) => x.e);
}

const line = (e) => `- [${e.type}] ${e.text}  (${e.id}, ${e.ts.slice(0, 10)})`;

export function compact() {
  const seen = new Map();
  for (const e of readJSONL(ENTRIES)) seen.set(`${e.type}\u0000${e.text}`, e);
  const entries = [...seen.values()].sort((a, b) => a.ts.localeCompare(b.ts));
  const keepDecisions = Number(flags.keep || 40);
  const kept = [];
  const archived = [];
  kept.push(...entries.filter((e) => e.type === 'constraint'));
  const decisions = entries.filter((e) => e.type === 'decision');
  const cut = Math.max(0, decisions.length - keepDecisions);
  kept.push(...decisions.slice(cut));
  archived.push(...decisions.slice(0, cut));
  for (const t of Object.keys(LIMIT)) {
    const list = entries.filter((e) => e.type === t);
    kept.push(...list.slice(-LIMIT[t]));
    archived.push(...list.slice(0, Math.max(0, list.length - LIMIT[t])));
  }
  kept.sort((a, b) => a.ts.localeCompare(b.ts));
  writeJSONL(ENTRIES, kept);
  for (const e of archived) appendJSONL(ARCHIVE, e);

  const sections = Object.keys(LABEL).map((t) => {
    const list = kept.filter((e) => e.type === t);
    return list.length ? `## ${LABEL[t]}\n${list.map((e) => `- ${t === 'constraint' ? '' : e.ts.slice(0, 10) + ' '}${e.text} \`${e.id}\``).join('\n')}\n` : '';
  }).filter(Boolean);
  const archivedTotal = readJSONL(ARCHIVE).length;
  fs.writeFileSync(MEMORY_MD, `# MEMORY (สร้างอัตโนมัติ ${today()})\n> แก้ไขผ่าน \`mem add\` / \`mem forget <id>\` ไม่ใช่แก้ไฟล์นี้ตรง ๆ — ไฟล์นี้ถูกสร้างใหม่ทุกครั้งที่ compact\n\n${sections.join('\n')}${archivedTotal ? `\n_เก็บถาวร ${archivedTotal} รายการใน .skills/memory/archive.jsonl_\n` : ''}`);
  return { kept: kept.length, archived: archived.length };
}

function printContext(query) {
  const all = readJSONL(ENTRIES);
  if (!all.length) return log('ยังไม่มีเมมโมรี่ของโปรเจกต์นี้');
  const constraints = all.filter((e) => e.type === 'constraint');
  const lastStatus = all.filter((e) => e.type === 'status').slice(-1)[0];
  const related = recall(query, Number(flags.limit || 8), ['constraint', 'status']);
  log('=== บริบทจาก session ก่อนหน้า ===');
  if (constraints.length) log(`ข้อจำกัด:\n${constraints.map((e) => `- ${e.text}`).join('\n')}`);
  if (lastStatus) log(`สถานะล่าสุด (${lastStatus.ts.slice(0, 10)}): ${lastStatus.text}`);
  if (related.length) log(`${query ? 'ที่เกี่ยวข้องกับงานนี้' : 'ล่าสุด'}:\n${related.map(line).join('\n')}`);
}

export async function mem(args) {
  const [sub = 'help', ...rest] = args;
  switch (sub) {
    case 'add': {
      const [type, ...t] = rest;
      const e = addEntry({ type, text: t.join(' '), tags: flags.tags ? String(flags.tags).split(',').map((s) => s.trim()) : [] });
      return log(e ? `บันทึกแล้ว (${e.id})` : 'มีรายการนี้อยู่แล้ว (ข้าม)');
    }
    case 'recall': {
      const r = recall(rest.join(' '), Number(flags.limit || 8));
      return log(r.length ? r.map(line).join('\n') : 'ไม่พบเมมโมรี่ที่เกี่ยวข้อง');
    }
    case 'start': return printContext(rest.join(' '));
    case 'end': {
      const text = rest.join(' ').trim();
      if (text) addEntry({ type: 'status', text });
      const r = compact();
      return log(`จบ session: เก็บ ${r.kept} รายการ, เก็บถาวร ${r.archived} รายการ → MEMORY.md`);
    }
    case 'compact': {
      const r = compact();
      return log(`บีบอัดแล้ว: เก็บ ${r.kept}, เก็บถาวร ${r.archived} → MEMORY.md`);
    }
    case 'list': {
      const all = readJSONL(ENTRIES);
      return log(all.length ? all.map(line).join('\n') : 'ยังไม่มีเมมโมรี่');
    }
    case 'forget': {
      const id = rest[0];
      if (!id) fail('ใช้: mem forget <id>');
      const all = readJSONL(ENTRIES);
      const hit = all.find((e) => e.id === id);
      if (!hit) fail(`ไม่พบ id: ${id}`);
      if (!(await confirm(`จะลบ: ${hit.text}`))) return log('ยกเลิก');
      writeJSONL(ENTRIES, all.filter((e) => e.id !== id));
      compact();
      return log('ลบแล้ว');
    }
    default:
      log(`mem add <${TYPES.join('|')}> "<ข้อความ>" [--tags a,b] [--force]
mem recall "<คำค้น>" [--limit N]
mem start ["<งานวันนี้>"]     ดึงบริบทตอนเปิด session
mem end ["<สรุป>"]            บันทึกสถานะ + บีบอัด + สร้าง MEMORY.md
mem compact | list | forget <id>`);
  }
}
