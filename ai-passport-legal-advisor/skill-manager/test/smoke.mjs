// รัน: node test/smoke.mjs  — ทดสอบครบทุกชั้นในโฟลเดอร์ชั่วคราว
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const kit = path.resolve(here, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-kit-'));
fs.cpSync(path.join(kit, 'skills'), path.join(tmp, 'skills'), { recursive: true });
fs.cpSync(path.join(kit, 'lib'), path.join(tmp, 'lib'), { recursive: true });
fs.copyFileSync(path.join(kit, 'skill-manager.mjs'), path.join(tmp, 'skill-manager.mjs'));

const run = (...a) => {
  const r = spawnSync('node', ['skill-manager.mjs', ...a], { cwd: tmp, encoding: 'utf8', stdin: 'ignore' });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
};
const ok = (name, fn) => { fn(); console.log(`PASS ${name}`); };
const rd = (f) => fs.readFileSync(path.join(tmp, f), 'utf8');

// ---- ชั้น 1: สกิล ----
ok('search พบสกิล', () => assert.match(run('search', 'design').out, /design-language/));
ok('install ไม่มี --yes แล้วไม่ติดตั้ง', () => {
  const r = run('install', 'design-language');
  assert.match(r.out, /ยกเลิก/);
  assert.ok(!fs.existsSync(path.join(tmp, '.claude')));
});
ok('install --yes ลงครบ 3 ปลายทาง', () => {
  run('install', 'design-language', '--target', 'all', '--yes');
  for (const f of ['.claude/skills/design-language/SKILL.md', '.cursor/rules/design-language.mdc', '.agents/skills/design-language/SKILL.md']) assert.ok(fs.existsSync(path.join(tmp, f)), f);
});
ok('กันชื่อสกิลที่พยายามออกนอกโฟลเดอร์', () => assert.notEqual(run('install', '../evil', '--yes').code, 0));

// ---- ชั้น 3: เมมโมรี่ ----
ok('mem add + dedupe', () => {
  assert.match(run('mem', 'add', 'decision', 'ใช้ Express + SQLite เก็บ log ฝั่ง server').out, /บันทึกแล้ว/);
  assert.match(run('mem', 'add', 'decision', 'ใช้ Express + SQLite เก็บ log ฝั่ง server').out, /มีรายการนี้อยู่แล้ว/);
});
ok('mem add constraint / attempt', () => {
  run('mem', 'add', 'constraint', 'ต้องรันบน Termux ได้ ห้ามพึ่ง native module');
  run('mem', 'add', 'attempt', 'ลอง better-sqlite3 บน Termux แล้ว build ไม่ผ่าน');
});
ok('guard ปฏิเสธเลขบัตรประชาชน (ไม่ override ด้วย --force)', () => {
  const r = run('mem', 'add', 'note', 'ผู้ใช้เลข 1234567890123', '--force');
  assert.notEqual(r.code, 0); assert.match(r.out, /ปฏิเสธ/);
});
ok('guard ปฏิเสธ token', () => assert.notEqual(run('mem', 'add', 'note', 'key sk-abcdefghijklmnopqrstuv').code, 0));
ok('guard เตือนข้อมูลคดี และ --force ผ่านเมื่อเป็นบริบททางเทคนิค', () => {
  assert.notEqual(run('mem', 'add', 'note', 'เพิ่มฟิลด์ จำเลย ในตาราง').code, 0);
  assert.equal(run('mem', 'add', 'note', 'เพิ่มฟิลด์ จำเลย ในตาราง', '--force').code, 0);
});
ok('mem recall ภาษาไทยไม่มีช่องว่าง', () => assert.match(run('mem', 'recall', 'sqlite บน termux').out, /better-sqlite3/));
ok('mem start แสดงข้อจำกัดเสมอ', () => assert.match(run('mem', 'start', 'ทำหน้า login').out, /ห้ามพึ่ง native module/));
ok('mem end สร้าง MEMORY.md', () => {
  run('mem', 'end', 'ตั้งค่า log เสร็จ เหลือทดสอบบน Termux');
  const m = rd('MEMORY.md');
  assert.match(m, /ข้อจำกัดของระบบ/); assert.match(m, /ตั้งค่า log เสร็จ/);
});
ok('compact เก็บถาวรของเก่า (status เกิน 3)', () => {
  for (let i = 1; i <= 6; i++) run('mem', 'add', 'status', `สถานะรอบ ${i}`);
  run('mem', 'compact');
  assert.ok(fs.existsSync(path.join(tmp, '.skills/memory/archive.jsonl')));
  const statuses = rd('.skills/memory/entries.jsonl').split('\n').filter(Boolean).map(JSON.parse).filter((e) => e.type === 'status');
  assert.equal(statuses.length, 3);
});
ok('mem forget ลบจริง', () => {
  const id = run('mem', 'list').out.match(/\[attempt\].*\((\w{6}),/)[1];
  run('mem', 'forget', id, '--yes');
  assert.doesNotMatch(run('mem', 'list').out, /better-sqlite3/);
});

// ---- ชั้น 2: สเปก ----
ok('spec ที่ยังไม่กรอกถูกปฏิเสธ', () => {
  run('spec', 'new', 'login-flow');
  const r = run('spec', 'approve', 'login-flow', '--yes');
  assert.equal(r.code, 2); assert.match(r.out, /TODO/);
});
ok('spec gate ปิดจนกว่าจะอนุมัติ', () => assert.equal(run('spec', 'gate', 'login-flow').code, 2));
const specPath = path.join(tmp, 'docs/specs/login-flow.md');
fs.writeFileSync(specPath, rd('docs/specs/login-flow.md')
  .replace(/TODO: สรุปสิ่งที่ต้องการและเหตุผล/, 'ผู้ใช้ต้องการเข้าสู่ระบบด้วย PIN')
  .replace(/TODO: ใส่ "- \[ \] คำถาม".*/, 'ไม่มี')
  .replace(/TODO: เขียนสเปก/, 'เป้าหมาย: login ด้วย PIN 6 หลัก; ไม่ทำ: social login; เสร็จเมื่อ: เข้าได้และล็อกหลังผิด 5 ครั้ง')
  .replace(/- \[ \] TODO: ขั้นตอนที่ 1.*/, '- [ ] เพิ่ม route /login ใน server.ts\n- [ ] เพิ่มหน้า login')
  .replace(/TODO: ทดสอบอย่างไรว่าเสร็จจริง/, 'ลอง PIN ถูก/ผิด 5 ครั้งแล้วล็อก'));
ok('spec check ผ่านเมื่อกรอกครบ', () => assert.equal(run('spec', 'check', 'login-flow').code, 0));
ok('spec approve --yes แล้ว gate ผ่าน และบันทึก decision ลงเมมโมรี่', () => {
  assert.equal(run('spec', 'approve', 'login-flow', '--yes').code, 0);
  assert.equal(run('spec', 'gate', 'login-flow').code, 0);
  assert.match(run('mem', 'recall', 'อนุมัติสเปก').out, /login-flow/);
});
ok('ติ๊กแผนไม่ทำให้ gate หลุด', () => {
  run('spec', 'tick', 'login-flow', '1');
  assert.equal(run('spec', 'gate', 'login-flow').code, 0);
  assert.match(run('spec', 'status').out, /1\/2/);
});
ok('แก้สเปกหลังอนุมัติ → gate ปิด', () => {
  fs.writeFileSync(specPath, rd('docs/specs/login-flow.md').replace('PIN 6 หลัก', 'PIN 4 หลัก'));
  assert.equal(run('spec', 'gate', 'login-flow').code, 2);
});

// ---- ชั้น 4: audit ----
fs.writeFileSync(path.join(tmp, 'index.css'), `body{font-family:'Prompt',system-ui;background-color:#050b1a;color:#e2e8f0}\n.g{box-shadow:0 0 15px rgba(34,211,238,.4)}\n`);
fs.mkdirSync(path.join(tmp, 'src'));
fs.writeFileSync(path.join(tmp, 'src/Clean.tsx'), `export const A=()=> <div style={{color:'#e2e8f0'}} className="bg-[#050b1a]">ok</div>;\n`);
ok('audit ผ่านเมื่อตรง palette', () => assert.equal(run('audit').code, 0));
fs.writeFileSync(path.join(tmp, 'src/Bad.tsx'), [
  `export const B=()=> <div className="bg-gradient-to-r from-purple-500 to-indigo-600" style={{color:'#ff00ff',fontSize:'12px'}}>`,
  `<button className="h-6 w-6" onClick={x}>+</button>`,
  ...Array(6).fill(`<div className="rounded-xl bg-slate-800 p-4">c</div>`),
  `</div>;`].join('\n'));
fs.writeFileSync(path.join(tmp, 'src/bad.css'), `.x{font-family: Arial, sans-serif;font-size:11px}\n`);
ok('audit จับ gradient ม่วง, สีนอก palette, ฟอนต์, ตัวเล็ก, ปุ่มเล็ก, การ์ดซ้ำ', () => {
  const r = run('audit');
  assert.equal(r.code, 1);
  for (const rule of ['ai-gradient', 'color-off-palette', 'font-off-system', 'tiny-font', 'small-tap-target', 'repeated-card']) assert.match(r.out, new RegExp(rule), rule);
});
ok('audit --soft ไม่ล้มงาน', () => assert.equal(run('audit', '--soft').code, 0));

// ---- ชั้น 5: เรียนรู้จาก feedback ----
ok('feedback ซ้ำ → suggest → apply (ต้องอนุมัติ) → update', () => {
  run('feedback', 'design-language', 'ปุ่มเล็กเกินไปบนมือถือ');
  run('feedback', 'design-language', 'ปุ่มเล็กอีกแล้ว');
  assert.match(run('suggest').out, /สร้างข้อเสนอ 1/);
  const before = rd('skills/design-language/SKILL.md');
  assert.match(run('apply', 'design-language', 'ปุ่มทุกปุ่มสูงอย่างน้อย 44px').out, /ยกเลิก/);
  assert.equal(rd('skills/design-language/SKILL.md'), before, 'ไม่มี --yes ต้องไม่แก้');
  run('apply', 'design-language', 'ปุ่มทุกปุ่มสูงอย่างน้อย 44px', '--yes');
  const after = rd('skills/design-language/SKILL.md');
  assert.match(after, /## กฎที่เรียนรู้จาก feedback\n- ปุ่มทุกปุ่มสูงอย่างน้อย 44px/);
  assert.match(after, /version: 1\.0\.1/);
  assert.equal(rd('.skills/feedback.jsonl').trim(), '');
  assert.ok(fs.existsSync(path.join(tmp, '.skills/feedback.applied.jsonl')));
  assert.match(run('status').out, /มีเวอร์ชันใหม่/);
  run('update', '--yes');
  assert.match(rd('.cursor/rules/design-language.mdc'), /44px/);
  assert.match(run('status').out, /ล่าสุด/);
});
ok('apply ครั้งที่ 2 เพิ่มในหัวข้อเดิม ไม่สร้างหัวข้อซ้ำ', () => {
  run('apply', 'design-language', 'ตัวอักษรไม่เล็กกว่า 14px', '--yes');
  const t = rd('skills/design-language/SKILL.md');
  assert.equal(t.split('## กฎที่เรียนรู้จาก feedback').length, 2);
  assert.match(t, /version: 1\.0\.2/);
});

// ---- เชื่อม Agent ----
ok('init เขียนครบ 3 ไฟล์ และ idempotent', () => {
  assert.match(run('init').out, /ยกเลิก/);
  run('init', '--yes'); run('init', '--yes');
  for (const f of ['AGENTS.md', 'CLAUDE.md', '.cursor/rules/agent-workflow.mdc']) {
    const t = rd(f);
    assert.equal(t.split('agent-kit:start').length, 2, f);
    assert.match(t, /spec gate/);
  }
  assert.match(rd('.cursor/rules/agent-workflow.mdc'), /alwaysApply: true/);
});
ok('init ไม่ทับเนื้อหาเดิมของ AGENTS.md', () => {
  fs.writeFileSync(path.join(tmp, 'AGENTS.md'), '# กฎของฉัน\nอย่าลบบรรทัดนี้\n');
  run('init', '--yes');
  assert.match(rd('AGENTS.md'), /อย่าลบบรรทัดนี้/);
});

fs.rmSync(tmp, { recursive: true, force: true });
console.log('\nทุกการทดสอบผ่าน');
