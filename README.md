# Portfolio 03 Gallery — คู่มือติดตั้ง

React + Vite / Firebase Authentication + Firestore / Vercel Functions

ตามแบบดำ–เขียว มีโมเสก โมดัลรายละเอียด iframe แอดมิน และ Dashboard
ยังไม่ได้เชื่อมบัญชีหรือ deploy จริง หน้าแรกแสดงข้อมูลตัวอย่างก่อนบันทึกครั้งแรก

## 1. เตรียมเครื่อง — บนคอมพิวเตอร์ของคุณ

ติดตั้ง Node.js 22 หรือ 24 LTS และ Git

แตก ZIP แล้วเปิด Terminal ในโฟลเดอร์ที่มี package.json:

```sh
npm install
npm run dev
```

เปิด URL ที่ Terminal แจ้ง ปกติ http://localhost:5173

คำสั่งนี้ทดสอบหน้าเว็บเท่านั้น ไม่มี backend จึงยังไม่บันทึกหรือเก็บสถิติ

ตรวจโค้ดด้วย:

```sh
npm test
npm run build
```

## 2. Firebase — ที่ console.firebase.google.com

1. Add project → ตั้งชื่อ → Project settings → General → Your apps → Web (</>) → Register app
2. จด apiKey, authDomain และ projectId จาก Web configuration
3. Build → Authentication → Get started → Sign-in method → เปิด Email/Password
4. Authentication → Users → Add user → สร้างอีเมล/รหัสผ่านผู้ดูแล → คัดลอก User UID
5. Build → Firestore Database → Create database → เลือกภูมิภาค → Production mode
6. Firestore → Rules → แทนที่ด้วยเนื้อหาไฟล์ firestore.rules → Publish ห้ามเปิดสิทธิ์อ่านเขียนสาธารณะ เพราะ API ใช้ Admin SDK
7. Project settings → Service accounts → Generate new private key → เก็บ JSON ไว้ส่วนตัว ห้ามอัป GitHub จด project_id, client_email, private_key
8. แนะนำ Firestore → Time-to-live → เพิ่ม policy collection group limits / field expiresAt เพื่อล้างเอกสาร rate limit การหมดเวลาจำกัดทำงานได้แม้ยังไม่เปิด TTL

## 3. GitHub — ทำเองใน Terminal และ github.com

ที่ https://github.com/new สร้าง repository ว่าง ไม่เพิ่ม README
จากนั้นรันในโฟลเดอร์โปรเจกต์:

```sh
git init
git add .
git commit -m "Build Portfolio Gallery 03"
git branch -M main
git remote add origin https://github.com/YOUR_ACCOUNT/YOUR_REPOSITORY.git
git push -u origin main
```

แทน YOUR_ACCOUNT/YOUR_REPOSITORY ด้วยชื่อจริง

หากถามการเข้าสู่ระบบ ใช้ Git Credential Manager หรือ gh auth login
ห้ามใส่ token ในโค้ด

## 4. Vercel — ที่ vercel.com

Add New → Project → Import Git Repository → เลือก repo

- Framework: Vite
- Root: โฟลเดอร์ที่มี package.json
- Build: npm run build
- Output: dist

เพิ่ม Environment Variables เลือก Production และ Preview:

| ชื่อ | ค่าจากที่ไหน |
|---|---|
| VITE_FIREBASE_API_KEY | Firebase Web configuration → apiKey |
| VITE_FIREBASE_AUTH_DOMAIN | Firebase Web configuration → authDomain |
| VITE_FIREBASE_PROJECT_ID | Firebase Web configuration → projectId |
| FIREBASE_PROJECT_ID | Service account JSON → project_id |
| FIREBASE_CLIENT_EMAIL | Service account JSON → client_email |
| FIREBASE_PRIVATE_KEY | Service account JSON → private_key รวม BEGIN/END PRIVATE KEY ไม่ครอบคำพูด ใช้ newline จริงหรือ \n ได้ |
| ADMIN_UID | Firebase Authentication → Users → UID ผู้ดูแล ไม่ใช่อีเมล |
| RATE_LIMIT_SECRET | สุ่ม 32 ไบต์ด้วยคำสั่งด้านล่างใน Terminal |

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

กด Deploy → รอ Ready → เปิด URL จาก Vercel

กลับ Firebase → Authentication → Settings → Authorized domains → Add domain
ใส่ชื่อจริง เช่น your-site.vercel.app ไม่ใส่ https://
เพิ่ม custom domain หากมี

ถ้าแก้ env ภายหลัง:
Vercel → Deployments → deployment ล่าสุด → Redeploy

เฉพาะตัวแปร VITE_ เปิดเผยต่อ browser ได้
ที่เหลือเป็น server-only ห้ามเติม VITE_ ข้างหน้า

## 5. แอดมินครั้งแรก — ในเว็บที่ Deploy แล้ว

1. เปิด https://YOUR_SITE.vercel.app/admin
2. ล็อกอินด้วยอีเมลและรหัสผ่านจาก Firebase Authentication
3. ไป “คีย์ลัดและรหัสลับ” → คลิกช่องแล้วกด เช่น Ctrl+Shift+K เลี่ยงคีย์ที่ระบบจอง
4. ตั้งรหัสลับ 8–128 ตัวอักษร เป็นคนละรหัสกับบัญชี Firebase
5. แก้ “เนื้อหาและการแสดงผล” เพื่อเปลี่ยนแบรนด์ หัวเรื่อง คำเกริ่น เกี่ยวกับ อีเมล สี โมเสก/กริด/รายการ ความโค้งมุม และระยะห่าง
6. แก้ “จัดการผลงาน” เพื่อเพิ่ม/ลบ ชื่อ รายละเอียด หมวด ปี URL ภาพปก สถานะ ซ่อน/เผยแพร่ แสดงในแกลเลอรี และ ↑↓ เปลี่ยนลำดับ
7. กด “ยืนยันและรีเฟรช” จะบันทึกทุกเมนู ออกจากบัญชีและกลับหน้าแรกหนึ่งครั้ง

ครั้งถัดไป:

คีย์ลัด → หน้าเบลอและคลิกไม่ได้ → พิมพ์รหัสกลางจอไร้กรอบ → Enter
→ bubble มุมขวาล่าง → กด bubble → ล็อกอินผู้ดูแล

ผิด 3 ครั้งช่องปิด ต้องกดคีย์ลัดใหม่
เซิร์ฟเวอร์จำกัด 3 ครั้ง/นาที/IP จึงอาจต้องรอ 1 นาที
Escape ปิดหน้าต่างได้

/admin ยังเปิดตรงได้เพื่อกู้คืน แต่ต้องผ่านบัญชีและ ADMIN_UID เสมอ
Bubble ไม่ใช่ตัวแทนการยืนยันตัวตน
รหัสลับเก็บเป็น salted scrypt ฝั่งเซิร์ฟเวอร์

ลืมรหัสลับ: เปิด /admin → ล็อกอิน → ตั้งใหม่
ลืมรหัสบัญชี: จัดการใน Firebase Authentication → Users

## 6. เว็บไซต์ผลงานและ iframe — ในแอดมินและ Hosting ปลายทาง

คลิกผลงาน → โมดัล → เปิดเว็บไซต์
→ แสดง iframe ภายใน Portfolio พร้อมปุ่มกลับเว็บหลัก

ไฟล์ HTML ของตัวเอง:

วางที่ public/projects/ชื่อ/index.html พร้อม assets
→ push GitHub → ใส่ URL /projects/ชื่อ/index.html ในแอดมิน

เว็บภายนอก:

ใส่ URL https://...
เจ้าของ Hosting ของเว็บปลายทางต้องตั้ง:

Content-Security-Policy: frame-ancestors https://YOUR_SITE.vercel.app

และเอา X-Frame-Options: DENY/SAMEORIGIN ที่ขัดกันออก

ไม่สามารถฝังเว็บที่เจ้าของห้าม iframe ได้
ไม่มี proxy ข้ามข้อจำกัด
เว็บที่พึ่ง third-party cookies หรือสิทธิ์พิเศษอาจทำงานไม่ครบ

ภาพปกใส่ HTTPS URL หรือวางไฟล์ใน public/ แล้วใส่ /ชื่อภาพ.webp
เว้นว่างใช้กราฟิก CSS

ไฟล์ public/projects/*.html เป็นตัวอย่าง ให้แทนด้วยผลงานจริง

## 7. สถิติและการอัปเดต — Admin → ภาพรวม

นับเข้าหน้าเว็บทั้งหมด ผู้ชมไม่ซ้ำ คลิกดูรายละเอียด คลิกเปิดเว็บ
มีตารางรายโปรเจกต์และผู้ชมล่าสุด 30 browser IDs

“ใครดู” เป็นรหัสนิรนามของ browser ไม่ใช่ชื่อหรืออีเมล
ล้าง storage หรือเปลี่ยนเครื่องนับใหม่
ไม่มีการเก็บ IP ดิบ ใช้ HMAC สำหรับ rate limit

หน้าเว็บและ Dashboard ดึงข้อมูลใหม่ทุก 60 วินาที
ไม่รีโหลด iframe อัตโนมัติ

สถิติเป็น first-party counters มี rate limit แต่ไม่ใช่ระบบป้องกันบอตขั้นสูง
กำหนดนโยบายลบประวัติผู้ชมตามความต้องการเอง

## 8. ทดสอบ backend ในเครื่อง — Terminal โฟลเดอร์นี้

```sh
npm install -g vercel
vercel login
vercel link
vercel env pull .env.local
vercel dev
```

เพิ่ม localhost ใน Firebase Authorized domains
ใช้ Firebase โปรเจกต์ทดสอบเพื่อไม่แก้ข้อมูลจริง
ห้าม commit .env.local

ทดสอบ browser ระหว่างเปิด npm run dev:

```sh
node tests/browser.mjs
```

ต้องมี Chromium ตั้ง CHROMIUM_PATH หากไม่ใช่ /usr/bin/chromium
การทดสอบ browser นี้ให้รันโดยยังไม่กำหนด VITE_FIREBASE_API_KEY
เพราะตรวจหน้าแอดมินในโหมดที่ยังไม่ตั้งค่า และจำลอง API สำหรับทดสอบ popup

หลัง deploy ทดสอบ:

- โมดัล → iframe → กลับเว็บหลัก
- คีย์ลัดและใส่รหัสผิด 3 ครั้ง
- บันทึกผลงานแล้วเปิดอีก browser รอ 60 วินาที
- ดูสถิติเพิ่มหลังเปิดหน้าเว็บและคลิกโปรเจกต์
- บัญชี UID อื่นต้องเข้าแอดมินไม่ได้

API 503: เติม env
API 500: ตรวจ Vercel Logs, service account และ Firestore
API 401: ล็อกอินใหม่
API 429: รอ rate limit

โค้ดต้นฉบับผ่าน production build, unit tests และ browser UI
ขั้นตอนรหัสลับทดสอบด้วย API จำลอง
ยังไม่ได้ทดสอบกับ Firebase และ Vercel จริง ต้องตรวจหลังตั้งค่าบัญชี

## โครงสร้าง

- src/: React และ CSS
- api/[...path].js: Vercel API
- lib/core.js: ตรวจข้อมูลและ hash
- public/projects/: เว็บโปรเจกต์ตัวอย่าง
- firestore.rules: ปิด client access
- .env.example: ตัวแปรที่ต้องตั้ง
- vercel.json: การ deploy
