---
name: design-language
description: กำหนด design language ของโปรเจกต์และ audit front-end ไม่ให้ดูเหมือนเว็บที่ AI ทำทุกเว็บ
version: 1.0.0
---
# Design Language
- ธีมหลัก: มืดโทนน้ำเงินกรมท่า พื้นหลัง #050b1a, ฟอนต์ Prompt / Plus Jakarta Sans, แอกเซนต์ฟ้า-ไซแอน, เอฟเฟกต์ glow-shield
- กำหนด token (สี ระยะห่าง มุมโค้ง เงา) ก่อนเขียนหน้าจอ
- Audit ก่อนส่ง: token สม่ำเสมอ, contrast อ่านออก, รองรับมือถือ, ตัดคำภาษาไทยถูกที่, ไม่ใช้การ์ดซ้ำทั้งหน้าหรือสีไล่ระดับสำเร็จรูป
- หน้าฉุกเฉิน: ปุ่มใหญ่ กดง่าย ลำดับข้อมูลชัด
- ก่อนส่งงาน front-end ให้รัน `audit` ต้องไม่มี warn (กำหนด palette เพิ่มได้ใน .skills/design.json)
