#!/usr/bin/env node
// Agent Kit — 5 ชั้น: สกิล · สเปกก่อนโค้ด · เมมโมรี่ · design audit · เรียนรู้จาก feedback
// ไม่มี dependency, Node 18+   ใช้: node skill-manager.mjs help
import { pos, log, UserError } from './lib/core.mjs';
import { commands as skillCmds } from './lib/skills.mjs';
import { mem } from './lib/memory.mjs';
import { spec } from './lib/spec.mjs';
import { audit } from './lib/audit.mjs';
import { init } from './lib/init.mjs';

function help() {
  log(`Agent Kit
ชั้น 1  สกิล        list | search <คำค้น> | install <สกิล> [--target claude,cursor,agents|all] [--global] | update [สกิล] | status
ชั้น 2  สเปกก่อนโค้ด  spec new|check|approve|gate|tick|status   (spec help)
ชั้น 3  เมมโมรี่      mem add|recall|start|end|compact|list|forget (mem help)
ชั้น 4  ดีไซน์       audit [--soft] [--json]
ชั้น 5  เรียนรู้      feedback <สกิล> "<ข้อความ>" | suggest [--min 2] | apply <สกิล> "<กฎ>"
เชื่อม Agent        init   (เขียน AGENTS.md / CLAUDE.md / Cursor rule)
ทุกการติดตั้ง/แก้สกิล/อนุมัติสเปก ต้องได้รับการอนุมัติจากผู้ใช้ (--yes เมื่อตรวจแล้ว)`);
}

const table = { ...skillCmds, mem, spec, audit, init, help };
const [cmd = 'help', ...args] = pos;
try {
  if (!table[cmd]) throw new UserError(`ไม่รู้จักคำสั่ง: ${cmd} (ลอง help)`);
  const code = await table[cmd](args);
  process.exitCode = typeof code === 'number' ? code : 0;
} catch (e) {
  console.error(e instanceof UserError ? `ผิดพลาด: ${e.message}` : e);
  process.exitCode = 1;
}
