// ชั้นที่ 1 + 5: ค้นหา/ติดตั้ง/อัปเดตสกิล และเรียนรู้จาก feedback (ผู้ใช้อนุมัติทุกการเปลี่ยน)
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { flags, ROOT, STATE, log, fail, confirm, readJSON, writeJSON, readJSONL, appendJSONL, writeJSONL } from './core.mjs';
import { addEntry } from './memory.mjs';

const REGISTRY = path.resolve(flags.registry || process.env.SKILLS_REGISTRY || path.join(ROOT, 'skills'));
const LOCK = path.join(STATE, 'lock.json');
const FEEDBACK = path.join(STATE, 'feedback.jsonl');
const APPLIED = path.join(STATE, 'feedback.applied.jsonl');
const PROPOSALS = path.join(STATE, 'proposals.md');
const ALL_TARGETS = ['claude', 'cursor', 'agents'];
const NAME_RE = /^[a-z0-9][a-z0-9_-]*$/i;

function walk(dir, base = dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p, base) : [path.relative(base, p)];
  }).sort();
}
function hashDir(dir) {
  const h = crypto.createHash('sha256');
  for (const rel of walk(dir)) { h.update(rel); h.update(fs.readFileSync(path.join(dir, rel))); }
  return h.digest('hex').slice(0, 12);
}
function parseSkill(dir) {
  const file = path.join(dir, 'SKILL.md');
  if (!fs.existsSync(file)) return null;
  const text = fs.readFileSync(file, 'utf8');
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  const meta = {};
  let body = text;
  if (m) {
    for (const line of m[1].split(/\r?\n/)) {
      const kv = line.match(/^([\w-]+):\s*(.*)$/);
      if (kv) meta[kv[1]] = kv[2].replace(/^["']|["']$/g, '');
    }
    body = m[2];
  }
  const name = meta.name || path.basename(dir);
  if (!NAME_RE.test(name)) fail(`ชื่อสกิลไม่ปลอดภัย: ${name}`);
  return { name, description: meta.description || '', version: meta.version || '0.0.0', dir, body, hash: hashDir(dir) };
}
function loadRegistry() {
  if (!fs.existsSync(REGISTRY)) fail(`ไม่พบ registry: ${REGISTRY}`);
  return fs.readdirSync(REGISTRY, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => parseSkill(path.join(REGISTRY, e.name)))
    .filter(Boolean);
}
function destinations(skill, targets, isGlobal) {
  const out = [];
  for (const t of targets) {
    if (t === 'claude') out.push({ target: t, kind: 'dir', dest: path.join(isGlobal ? os.homedir() : ROOT, '.claude', 'skills', skill.name) });
    if (t === 'agents') out.push({ target: t, kind: 'dir', dest: path.join(ROOT, '.agents', 'skills', skill.name) });
    if (t === 'cursor') out.push({ target: t, kind: 'file', dest: path.join(ROOT, '.cursor', 'rules', `${skill.name}.mdc`) });
  }
  return out;
}
function writeSkill(skill, d) {
  if (d.kind === 'dir') {
    fs.rmSync(d.dest, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(d.dest), { recursive: true });
    fs.cpSync(skill.dir, d.dest, { recursive: true });
  } else {
    fs.mkdirSync(path.dirname(d.dest), { recursive: true });
    fs.writeFileSync(d.dest, `---\ndescription: ${skill.description}\nalwaysApply: false\n---\n\n${skill.body.trim()}\n`);
  }
}
function parseTargets() {
  if (!flags.target || flags.target === 'all') return ALL_TARGETS;
  const t = String(flags.target).split(',').map((s) => s.trim());
  const bad = t.filter((x) => !ALL_TARGETS.includes(x));
  if (bad.length) fail(`target ไม่รู้จัก: ${bad.join(', ')} (ใช้ได้: ${ALL_TARGETS.join(', ')}, all)`);
  return t;
}
const bump = (v) => {
  const m = v.match(/^(\d+)\.(\d+)\.(\d+)$/);
  return m ? `${m[1]}.${m[2]}.${Number(m[3]) + 1}` : '0.0.1';
};

export const commands = {
  list() {
    for (const s of loadRegistry()) log(`${s.name}@${s.version}  ${s.description}`);
  },

  search(args) {
    const terms = args.join(' ').toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) fail('ใช้: search <คำค้น>');
    const scored = loadRegistry().map((s) => {
      const nm = s.name.toLowerCase(), ds = s.description.toLowerCase(), bd = s.body.toLowerCase();
      const score = terms.reduce((n, t) => n + (nm.includes(t) ? 3 : 0) + (ds.includes(t) ? 2 : 0) + (bd.includes(t) ? 1 : 0), 0);
      return { s, score };
    }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
    if (!scored.length) return log('ไม่พบสกิลที่ตรงกับคำค้น');
    for (const { s, score } of scored) log(`[${score}] ${s.name}@${s.version}  ${s.description}`);
    log(`\nติดตั้ง: install ${scored[0].s.name}`);
  },

  async install(args) {
    const name = args[0];
    if (!name) fail('ใช้: install <ชื่อสกิล> [--target claude,cursor,agents|all] [--global] [--yes]');
    const skill = loadRegistry().find((s) => s.name === name);
    if (!skill) fail(`ไม่พบสกิล: ${name}`);
    const targets = parseTargets();
    const dests = destinations(skill, targets, !!flags.global);
    const ok = await confirm(`จะติดตั้ง ${skill.name}@${skill.version}\n${skill.description}\nปลายทาง:\n${dests.map((d) => `  - [${d.target}] ${d.dest}`).join('\n')}`);
    if (!ok) return log('ยกเลิก ไม่มีการเปลี่ยนแปลง');
    dests.forEach((d) => writeSkill(skill, d));
    const lock = readJSON(LOCK, {});
    lock[skill.name] = { version: skill.version, hash: skill.hash, targets, global: !!flags.global, installedAt: new Date().toISOString() };
    writeJSON(LOCK, lock);
    log(`ติดตั้งแล้ว: ${skill.name}`);
  },

  async update(args) {
    const lock = readJSON(LOCK, {});
    const names = args[0] ? [args[0]] : Object.keys(lock);
    if (!names.length) return log('ยังไม่มีสกิลที่ติดตั้ง');
    const reg = loadRegistry();
    for (const name of names) {
      const cur = lock[name];
      const skill = reg.find((s) => s.name === name);
      if (!cur) { log(`${name}: ยังไม่ได้ติดตั้ง`); continue; }
      if (!skill) { log(`${name}: ไม่อยู่ใน registry แล้ว (ข้าม)`); continue; }
      if (skill.hash === cur.hash) { log(`${name}: เป็นเวอร์ชันล่าสุด`); continue; }
      const dests = destinations(skill, cur.targets, cur.global);
      const ok = await confirm(`${name}: ${cur.version} (${cur.hash}) → ${skill.version} (${skill.hash})\nจะเขียนทับ:\n${dests.map((d) => `  - [${d.target}] ${d.dest}`).join('\n')}`);
      if (!ok) { log(`${name}: ข้าม`); continue; }
      dests.forEach((d) => writeSkill(skill, d));
      lock[name] = { ...cur, version: skill.version, hash: skill.hash, updatedAt: new Date().toISOString() };
      writeJSON(LOCK, lock);
      log(`${name}: อัปเดตแล้ว`);
    }
  },

  status() {
    const lock = readJSON(LOCK, {});
    const reg = loadRegistry();
    const names = Object.keys(lock);
    if (!names.length) return log('ยังไม่มีสกิลที่ติดตั้ง');
    for (const n of names) {
      const s = reg.find((x) => x.name === n);
      const state = !s ? 'ไม่อยู่ใน registry' : s.hash === lock[n].hash ? 'ล่าสุด' : `มีเวอร์ชันใหม่ (${s.version})`;
      log(`${n}@${lock[n].version}  [${lock[n].targets.join(',')}]  ${state}`);
    }
  },

  feedback(args) {
    const [skill, ...note] = args;
    if (!skill || !note.length) fail('ใช้: feedback <ชื่อสกิล> "<สิ่งที่ต้องแก้/ขาด>"');
    appendJSONL(FEEDBACK, { ts: new Date().toISOString(), skill, note: note.join(' ') });
    log('บันทึก feedback แล้ว');
  },

  // สรุปรูปแบบที่ถูกแก้ซ้ำเป็น "ข้อเสนอ" — ไม่แก้สกิลเอง
  suggest() {
    const rows = readJSONL(FEEDBACK);
    if (!rows.length) return log('ยังไม่มี feedback');
    const min = Number(flags.min || 2);
    const by = {};
    for (const r of rows) (by[r.skill] ||= []).push(r);
    const sections = Object.entries(by).filter(([, v]) => v.length >= min).map(([skill, v]) =>
      `## ${skill}  (พบ ${v.length} ครั้ง)\n${v.map((r) => `- ${r.ts.slice(0, 10)}: ${r.note}`).join('\n')}\n\n**ข้อเสนอ:** รวมประเด็นข้างต้นเป็นกฎใน SKILL.md ของ ${skill}\n**ถ้าเห็นด้วย:** apply ${skill} "<กฎที่จะเพิ่ม>"\n**สถานะ:** รอรีวิวจากผู้ใช้ (ยังไม่มีการแก้ไขอัตโนมัติ)\n`);
    if (!sections.length) return log(`ยังไม่มีสกิลที่ถูกแก้ซ้ำถึง ${min} ครั้ง`);
    fs.mkdirSync(STATE, { recursive: true });
    fs.writeFileSync(PROPOSALS, `# ข้อเสนอปรับปรุงสกิล\n\n${sections.join('\n')}`);
    log(`สร้างข้อเสนอ ${sections.length} รายการที่ ${PROPOSALS}\nรีวิวแล้วใช้ apply เพื่อเพิ่มกฎ (ต้องอนุมัติ) จากนั้นรัน update`);
  },

  // เพิ่มกฎลงสกิลหลังผู้ใช้อนุมัติ + bump เวอร์ชัน + เก็บ feedback ที่ใช้แล้ว
  async apply(args) {
    const [name, ...parts] = args;
    const rule = parts.join(' ').trim();
    if (!name || !rule) fail('ใช้: apply <สกิล> "<กฎที่จะเพิ่ม>" [--yes]');
    const skill = loadRegistry().find((s) => s.name === name);
    if (!skill) fail(`ไม่พบสกิล: ${name}`);
    const all = readJSONL(FEEDBACK);
    const mine = all.filter((r) => r.skill === name);
    const next = bump(skill.version);
    const ok = await confirm(`จะแก้ ${path.join(skill.dir, 'SKILL.md')}\n  + ${rule}\n  เวอร์ชัน ${skill.version} → ${next}\n  feedback ที่เกี่ยวข้อง ${mine.length} รายการจะถูกย้ายไปเก็บถาวร`);
    if (!ok) return log('ยกเลิก ไม่มีการเปลี่ยนแปลง');

    const file = path.join(skill.dir, 'SKILL.md');
    let text = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
    const heading = '## กฎที่เรียนรู้จาก feedback';
    const at = text.indexOf(heading);
    if (at === -1) {
      text = `${text.replace(/\s*$/, '')}\n\n${heading}\n- ${rule}\n`;
    } else {
      const after = text.indexOf('\n## ', at + heading.length);
      const end = after === -1 ? text.length : after;
      text = `${text.slice(0, end).replace(/\s*$/, '')}\n- ${rule}\n${after === -1 ? '' : text.slice(end)}`;
    }
    if (/^version:/m.test(text)) text = text.replace(/^version:.*$/m, `version: ${next}`);
    else text = text.replace(/^---\n([\s\S]*?)\n---/, `---\n$1\nversion: ${next}\n---`);
    fs.writeFileSync(file, text);

    writeJSONL(FEEDBACK, all.filter((r) => r.skill !== name));
    for (const r of mine) appendJSONL(APPLIED, { ...r, appliedRule: rule, appliedAt: new Date().toISOString() });
    try { addEntry({ type: 'decision', text: `ปรับสกิล ${name} เป็น v${next}: ${rule}`, tags: ['skill', name] }); } catch { /* guard ปฏิเสธก็ข้าม */ }
    log(`แก้สกิลแล้ว (v${next}) — รัน update เพื่อติดตั้งเวอร์ชันใหม่`);
  },
};
