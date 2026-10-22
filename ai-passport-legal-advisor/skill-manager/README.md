# Agent Kit — 5 ชั้นความสามารถให้ Coding Agent

ไม่มี dependency, ใช้ Node 18+ (รันบน Termux ได้ถ้ามี Node) วางโฟลเดอร์นี้ไว้ที่รากโปรเจกต์ แล้วรัน `node skill-manager.mjs help`

| ชั้น | ทำอะไร | คำสั่งหลัก |
|---|---|---|
| 1 สกิล | ค้นหา/ติดตั้ง/อัปเดตสกิลไป Claude Code, Cursor, Agent อื่น | `search` `install` `update` `status` |
| 2 สเปกก่อนโค้ด | requirement → สเปก → แผน → ทดสอบ + ด่านอนุมัติ | `spec new/check/approve/gate/tick/status` |
| 3 เมมโมรี่ | จดการตัดสินใจ บีบอัด ดึงเฉพาะที่เกี่ยวข้องตอนเปิด session ใหม่ | `mem start/add/recall/end/forget` |
| 4 ดีไซน์ | audit ให้ตรง palette/ฟอนต์ และจับลายเซ็น "หน้าตา AI" | `audit` |
| 5 เรียนรู้ | สรุปสิ่งที่ถูกแก้ซ้ำเป็นข้อเสนอ แล้วแก้สกิลเมื่อคุณอนุมัติ | `feedback` `suggest` `apply` |

## เริ่มต้นใช้งาน (ครั้งแรก)
    node skill-manager.mjs install spec-first-planning --target all
    node skill-manager.mjs install memory-handoff --target all
    node skill-manager.mjs install design-language --target all
    node skill-manager.mjs init        # เขียนขั้นตอนทำงานลง AGENTS.md / CLAUDE.md / Cursor rule

หลัง `init` Agent จะอ่านขั้นตอนเองทุก session: ดึงเมมโมรี่ → ทำสเปกและรอคุณอนุมัติ → เขียนโค้ด → audit → จดสถานะ

## วงจรวันต่อวัน
1. เปิด session: `mem start "ทำหน้า login"` (ได้ข้อจำกัด สถานะล่าสุด และการตัดสินใจที่เกี่ยวข้อง)
2. `spec new login-flow` → กรอก → `spec approve login-flow` (คุณเป็นคนอนุมัติ) → `spec gate login-flow` ผ่านจึงเขียนโค้ด
3. ระหว่างทาง: `mem add decision "..."`, `mem add attempt "..."`
4. หน้าจอเสร็จ: `audit` (ปรับ palette เพิ่มได้ที่ `.skills/design.json`: `{"palette":["#22d3ee"],"fonts":["Prompt"],"minFontPx":14}`)
5. คุณแก้งาน AI ซ้ำ: `feedback design-language "ปุ่มเล็กเกินไป"` → พอซ้ำ 2 ครั้ง `suggest` → รีวิว → `apply design-language "ปุ่มสูงอย่างน้อย 44px"` → `update`
6. ปิด session: `mem end "สถานะ..."`

## ความปลอดภัยและกฎเหล็ก
- ติดตั้ง/อัปเดต/แก้สกิล/อนุมัติสเปก/ลบเมมโมรี่ ต้องผ่านการยืนยันจากคุณ (`--yes` ข้ามเมื่อตรวจแล้ว) ถ้าไม่มี terminal แบบโต้ตอบ ระบบจะไม่ทำอะไรเอง
- ระบบไม่แก้สกิลอัตโนมัติ `suggest` สร้างเป็นข้อเสนอเท่านั้น
- เมมโมรี่ปฏิเสธเลขบัตรประชาชน เลขบัตร และ token เสมอ (override ไม่ได้) และเตือนเมื่อพบอีเมล เบอร์โทร หรือคำที่เกี่ยวกับคดี (`--force` ได้เมื่อมั่นใจว่าเป็นบริบททางเทคนิค) ข้อมูลคดีของผู้ใช้ระบบกฎหมายไม่ควรเข้ามาที่นี่
- เมมโมรี่เป็นไฟล์ในโปรเจกต์ (`.skills/memory/`, `MEMORY.md`) ผู้ใช้ตรวจและลบได้ทุกเมื่อ อย่า commit `.skills/` ขึ้น repo สาธารณะ
- ข้อจำกัด: การค้นเมมโมรี่ใช้การจับคู่ข้อความ (ไม่ใช่ AI) การบีบอัดเป็นกฎตายตัว (เก็บข้อจำกัดและการตัดสินใจ, ตัดสถานะ/ความพยายามเก่าไปคลังถาวร) ส่วน audit เป็น heuristic ตรวจรูปแบบที่พบบ่อย ไม่ใช่การรีวิวดีไซน์ครบถ้วน

## ทดสอบ
    node test/smoke.mjs     # 27 รายการ ครอบคลุมทุกชั้น รันในโฟลเดอร์ชั่วคราว
