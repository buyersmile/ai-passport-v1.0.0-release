// แกนกลางที่ใช้ร่วมกัน: อ่าน flag, path, JSON/JSONL, การขออนุมัติ
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';

const VALUE_FLAGS = new Set(['target', 'registry', 'min', 'tags', 'limit', 'keep']);
export const flags = {};
export const pos = [];
{
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      if (VALUE_FLAGS.has(k)) flags[k] = argv[++i];
      else flags[k] = true;
    } else pos.push(a);
  }
}

export const ROOT = process.cwd();
export const STATE = path.join(ROOT, '.skills');
export const CLI = path.relative(ROOT, process.argv[1] || 'skill-manager.mjs') || 'skill-manager.mjs';
export const log = (...a) => console.log(...a);
export const today = () => new Date().toISOString().slice(0, 10);

export class UserError extends Error {}
export const fail = (msg) => { throw new UserError(msg); };

export const readJSON = (f, d) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : d);
export const writeJSON = (f, v) => {
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify(v, null, 2));
};
export const readJSONL = (f) =>
  fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
export const appendJSONL = (f, obj) => {
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.appendFileSync(f, JSON.stringify(obj) + '\n');
};
export const writeJSONL = (f, arr) => {
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, arr.map((o) => JSON.stringify(o)).join('\n') + (arr.length ? '\n' : ''));
};

const SKIP = new Set(['node_modules', '.git', '.skills', 'dist', 'build', '.claude', '.cursor', '.agents', '.next', 'coverage']);
export function walkFiles(dir, skip = SKIP) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walkFiles(p, skip));
    else out.push(p);
  }
  return out;
}

export async function confirm(msg) {
  log(msg);
  if (flags.yes) return true;
  if (!process.stdin.isTTY) {
    log('ต้องรออนุมัติ แต่ไม่มี terminal แบบโต้ตอบ — เพิ่ม --yes ถ้าตรวจแล้วและยืนยัน');
    return false;
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ans = (await rl.question('อนุมัติ? (y/N) ')).trim().toLowerCase();
  rl.close();
  return ans === 'y' || ans === 'yes';
}
