---
name: memory-handoff
description: บันทึกการตัดสินใจระหว่าง session บีบอัดตอนจบ และดึงบริบทที่เกี่ยวข้องตอนเปิด session ใหม่
version: 1.1.0
---
# Memory Handoff
- เริ่ม session: `mem start "<งานวันนี้>"` แล้วอ่านผลก่อนทำอะไร
- ระหว่างงาน: `mem add decision|attempt|constraint "<ข้อความ>"` เมื่อตัดสินใจสำคัญ ลองแล้วไม่ได้ผล หรือพบข้อจำกัด
- จบ session: `mem end "<สรุปสถานะ>"` (บีบอัดและสร้าง MEMORY.md)
- ค้นย้อนหลัง: `mem recall "<คำค้น>"`
- ห้ามเก็บข้อมูลคดี ข้อมูลส่วนบุคคล เลขบัตร หรือ token ระบบจะปฏิเสธให้ ผู้ใช้ลบรายการได้ด้วย `mem forget <id>`
