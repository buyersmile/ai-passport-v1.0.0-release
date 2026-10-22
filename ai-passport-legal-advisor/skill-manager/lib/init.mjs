// เชื่อมระบบเข้ากับ Agent: เขียนขั้นตอนการทำงานลง AGENTS.md / CLAUDE.md / Cursor rule (ต้องอนุมัติ)
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, CLI, log, confirm } from './core.mjs';

const START = '<!-- agent-kit:start -->';
const END = '<!-- agent-kit:end -->';
const run = `node ${CLI}`;

const block = () => `${START}
## Agent Workflow (agent-kit)
ทำตามลำดับนี้ทุกงานพัฒนา:
1. **เริ่ม session:** \`${run} mem start "<งานวันนี้>"\` แล้วอ่านผลก่อนเริ่ม
2. **ก่อนเขียนโค้ด:** \`${run} spec new <slug>\` กรอก requirement → สเปก → แผน → แผนทดสอบ ให้ผู้ใช้อนุมัติ (\`spec approve\`) และต้องผ่าน \`${run} spec gate <slug>\` ก่อนลงมือ (งานแก้เล็กน้อยย่อสเปกได้ แต่ห้ามข้ามการเข้าใจโจทย์)
3. **ระหว่างงาน:** บันทึกด้วย \`${run} mem add decision|attempt|constraint "<ข้อความ>"\` เมื่อตัดสินใจสำคัญ ลองแล้วไม่ได้ผล หรือพบข้อจำกัด — เก็บเฉพาะบริบททางเทคนิค ห้ามใส่ข้อมูลคดีหรือข้อมูลส่วนบุคคล
4. **งาน front-end:** รัน \`${run} audit\` ต้องไม่มี warn ก่อนส่งงาน
5. **เมื่อผู้ใช้แก้งานซ้ำ:** \`${run} feedback <สกิล> "<สิ่งที่ถูกแก้>"\` เพื่อให้เสนอปรับปรุงสกิล
6. **จบ session:** \`${run} mem end "<สรุปสถานะ>"\`
7. **ข้อห้าม:** ห้ามแก้สกิล กฎความปลอดภัย หรือกฎกฎหมายเอง เสนอเป็นข้อเสนอให้ผู้ใช้อนุมัติเท่านั้น
${END}
`;

function upsert(file, text, header = '') {
  const cur = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : header;
  const a = cur.indexOf(START), b = cur.indexOf(END);
  const next = a !== -1 && b > a
    ? cur.slice(0, a) + text.trim() + cur.slice(b + END.length)
    : `${cur.replace(/\s*$/, '')}${cur.trim() ? '\n\n' : ''}${text}`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, next.endsWith('\n') ? next : `${next}\n`);
}

export async function init() {
  const files = [
    { f: path.join(ROOT, 'AGENTS.md'), header: '' },
    { f: path.join(ROOT, 'CLAUDE.md'), header: '' },
    { f: path.join(ROOT, '.cursor', 'rules', 'agent-workflow.mdc'), header: '---\ndescription: ขั้นตอนทำงานของ Agent (spec-first, memory, audit)\nalwaysApply: true\n---\n\n' },
  ];
  const ok = await confirm(`จะเขียนบล็อก Agent Workflow (แทนที่เฉพาะส่วนระหว่าง agent-kit:start/end) ลงใน:\n${files.map((x) => `  - ${path.relative(ROOT, x.f)}`).join('\n')}`);
  if (!ok) return log('ยกเลิก ไม่มีการเปลี่ยนแปลง');
  for (const x of files) upsert(x.f, block(), x.header);
  log('เชื่อมกับ Agent แล้ว');
}
