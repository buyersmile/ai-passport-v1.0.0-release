// ชั้นที่ 2: เข้าใจก่อนเขียน — สเปก + แผน + ด่านอนุมัติ (gate) ก่อนลงมือโค้ด
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ROOT, log, today, fail, confirm } from './core.mjs';
import { addEntry } from './memory.mjs';

const DIR = path.join(ROOT, 'docs', 'specs');
const file = (slug) => path.join(DIR, `${slug}.md`);
const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/i;
const CHECKBOX = /^\s*-\s*\[( |x|X)\]/;

const template = (slug) => `---
slug: ${slug}
status: draft
created: ${today()}
---
# สเปก: ${slug}

## 1. Requirement (สิ่งที่ผู้ใช้ต้องการ ด้วยคำของผู้ใช้)
TODO: สรุปสิ่งที่ต้องการและเหตุผล

## 2. คำถามที่ยังค้าง
TODO: ใส่ "- [ ] คำถาม" ถ้ามี (ติ๊กเป็น "- [x]" เมื่อได้คำตอบ) หรือเขียนว่า "ไม่มี"

## 3. สเปก (เป้าหมาย / ขอบเขต / สิ่งที่ไม่ทำ / เกณฑ์ว่างานเสร็จ)
TODO: เขียนสเปก

## 4. Implementation Plan
- [ ] TODO: ขั้นตอนที่ 1 (ระบุไฟล์ที่เกี่ยวข้อง)

## 5. แผนทดสอบ
TODO: ทดสอบอย่างไรว่าเสร็จจริง

## 6. บันทึกการตัดสินใจ
(เติมระหว่างทำงาน)
`;

function parse(text) {
  text = text.replace(/\r\n/g, '\n');
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  const fm = {};
  let body = text;
  if (m) {
    for (const l of m[1].split('\n')) { const kv = l.match(/^(\w+):\s*(.*)$/); if (kv) fm[kv[1]] = kv[2]; }
    body = m[2];
  }
  const sections = {};
  let cur = null;
  for (const l of body.split('\n')) {
    const h = l.match(/^##\s*(\d)\./);
    if (h) { cur = h[1]; sections[cur] = []; continue; }
    if (cur) sections[cur].push(l);
  }
  return { fm, sections, text };
}
const content = (lines = []) => lines.map((l) => l.trim()).filter((l) => l && !l.startsWith('<!--') && !l.startsWith('(เติม'));
function specHash(sections) {
  const raw = ['1', '3', '4', '5'].map((k) => (sections[k] || []).join('\n').replace(/\[[xX]\]/g, '[ ]')).join('\n#\n');
  return crypto.createHash('sha256').update(raw.replace(/\s+/g, ' ')).digest('hex').slice(0, 12);
}
function setFM(text, key, val) {
  const re = new RegExp(`^${key}:.*$`, 'm');
  const head = text.indexOf('\n---', 4);
  const fm = text.slice(0, head);
  const rest = text.slice(head);
  return (re.test(fm) ? fm.replace(re, `${key}: ${val}`) : `${fm}\n${key}: ${val}`) + rest;
}
function load(slug) {
  if (!slug || !SLUG_RE.test(slug)) fail('ชื่อสเปกต้องเป็นตัวอักษร/ตัวเลข/ขีด (เช่น login-flow)');
  if (!fs.existsSync(file(slug))) fail(`ไม่พบสเปก: ${file(slug)} (สร้างด้วย spec new ${slug})`);
  return parse(fs.readFileSync(file(slug), 'utf8'));
}
function check(p) {
  const problems = [];
  const names = { 1: 'Requirement', 3: 'สเปก', 4: 'Implementation Plan', 5: 'แผนทดสอบ' };
  for (const k of ['1', '3', '4', '5']) {
    const c = content(p.sections[k]);
    if (!c.length) problems.push(`หัวข้อ ${k} (${names[k]}) ยังว่าง`);
    else if (c.some((l) => /\bTODO\b/.test(l))) problems.push(`หัวข้อ ${k} (${names[k]}) ยังมี TODO ค้าง`);
  }
  const plan = (p.sections['4'] || []).filter((l) => CHECKBOX.test(l));
  if (!plan.length && content(p.sections['4']).length) problems.push('แผนต้องเป็นรายการ "- [ ] ..." อย่างน้อย 1 ข้อ');
  const q = content(p.sections['2']);
  if (!q.length || q.some((l) => /\bTODO\b/.test(l))) problems.push('หัวข้อ 2 (คำถามที่ยังค้าง) ต้องตอบ: ใส่คำถาม หรือเขียนว่า "ไม่มี"');
  else if (q.some((l) => /^\s*-\s*\[ \]/.test(l))) problems.push('หัวข้อ 2 ยังมีคำถามที่ไม่ได้รับคำตอบ');
  return { problems, done: plan.filter((l) => /\[[xX]\]/.test(l)).length, total: plan.length };
}

export async function spec(args) {
  const [sub = 'help', slug, ...rest] = args;
  switch (sub) {
    case 'new': {
      if (!slug || !SLUG_RE.test(slug)) fail('ใช้: spec new <slug>');
      if (fs.existsSync(file(slug))) fail(`มีสเปกนี้แล้ว: ${file(slug)}`);
      fs.mkdirSync(DIR, { recursive: true });
      fs.writeFileSync(file(slug), template(slug));
      return log(`สร้างแล้ว: ${path.relative(ROOT, file(slug))}\nกรอกให้ครบ แล้วรัน spec check ${slug} → spec approve ${slug} ก่อนเริ่มเขียนโค้ด`);
    }
    case 'check': {
      const r = check(load(slug));
      if (r.problems.length) { log(`ยังไม่พร้อม:\n${r.problems.map((x) => `- ${x}`).join('\n')}`); return 2; }
      return log(`สเปกครบถ้วน (แผน ${r.done}/${r.total} ข้อเสร็จ)`);
    }
    case 'approve': {
      const p = load(slug);
      const r = check(p);
      if (r.problems.length) { log(`อนุมัติไม่ได้ — สเปกยังไม่ครบ:\n${r.problems.map((x) => `- ${x}`).join('\n')}`); return 2; }
      if (!(await confirm(`ผู้ใช้อนุมัติสเปก "${slug}" (แผน ${r.total} ข้อ) ให้เริ่มเขียนโค้ดได้?`))) return log('ยกเลิก');
      let t = setFM(p.text, 'status', 'approved');
      t = setFM(t, 'approvedHash', specHash(p.sections));
      t = setFM(t, 'approvedAt', new Date().toISOString());
      fs.writeFileSync(file(slug), t);
      try { addEntry({ type: 'decision', text: `อนุมัติสเปก ${slug} (แผน ${r.total} ข้อ)`, tags: ['spec', slug] }); } catch { /* ไม่บล็อกการอนุมัติ */ }
      return log('อนุมัติแล้ว — เริ่มลงมือได้');
    }
    case 'gate': {
      const p = load(slug);
      if (p.fm.status !== 'approved') { log(`ปิดด่าน: สเปก ${slug} ยังไม่ได้รับอนุมัติ (status: ${p.fm.status})`); return 2; }
      if (p.fm.approvedHash !== specHash(p.sections)) { log(`ปิดด่าน: สเปก ${slug} ถูกแก้หลังอนุมัติ — ต้อง spec approve ใหม่`); return 2; }
      return log(`ผ่านด่าน: ${slug} อนุมัติแล้ว`);
    }
    case 'tick': {
      const n = Number(rest[0]);
      if (!Number.isInteger(n) || n < 1) fail('ใช้: spec tick <slug> <ลำดับข้อในแผน>');
      load(slug);
      const lines = fs.readFileSync(file(slug), 'utf8').split('\n');
      let inPlan = false, i = 0, hit = false;
      for (let k = 0; k < lines.length; k++) {
        const h = lines[k].match(/^##\s*(\d)\./);
        if (h) inPlan = h[1] === '4';
        if (inPlan && CHECKBOX.test(lines[k]) && ++i === n) { lines[k] = lines[k].replace(/\[ \]/, '[x]'); hit = true; break; }
      }
      if (!hit) fail(`ไม่พบข้อที่ ${n} ในแผน`);
      fs.writeFileSync(file(slug), lines.join('\n'));
      return log(`ติ๊กข้อ ${n} แล้ว`);
    }
    case 'status': {
      if (!fs.existsSync(DIR)) return log('ยังไม่มีสเปก');
      const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.md'));
      if (!files.length) return log('ยังไม่มีสเปก');
      for (const f of files) {
        const p = parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
        const r = check(p);
        log(`${f.replace(/\.md$/, '')}  [${p.fm.status || 'draft'}]  แผน ${r.done}/${r.total}${r.problems.length ? `  (ยังไม่ครบ ${r.problems.length} จุด)` : ''}`);
      }
      return;
    }
    default:
      log(`spec new <slug>        สร้างแม่แบบ requirement → สเปก → แผน → ทดสอบ
spec check <slug>      ตรวจว่ากรอกครบ (exit 2 ถ้าไม่ครบ)
spec approve <slug>    ผู้ใช้อนุมัติ (ต้องยืนยัน)
spec gate <slug>       ด่านก่อนเขียนโค้ด: ผ่านเฉพาะสเปกที่อนุมัติและไม่ถูกแก้ทีหลัง
spec tick <slug> <n>   ติ๊กข้อ n ในแผนว่าเสร็จ
spec status            ดูทุกสเปกและความคืบหน้า`);
  }
}
