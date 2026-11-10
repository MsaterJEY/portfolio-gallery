import {initializeApp, getApps, cert} from 'firebase-admin/app';
import {getFirestore, FieldValue} from 'firebase-admin/firestore';
import {getAuth} from 'firebase-admin/auth';
import {hashCode, checkCode, fingerprint, validate} from '../lib/core.js';

function database() {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
      })
    });
  }
  return getFirestore();
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  const route = req.query.path || [];
  const path = Array.isArray(route) ? route.join('/') : route;
  const fail = (status, message) =>
    res.status(status).json({error: message});

  try {
    if (
      !process.env.FIREBASE_PROJECT_ID ||
      !process.env.ADMIN_UID ||
      !process.env.RATE_LIMIT_SECRET
    ) {
      return fail(503, 'ยังไม่ได้ตั้งค่า Firebase และสิทธิ์ผู้ดูแล');
    }

    const db = database();
    const body = typeof req.body === 'string'
      ? JSON.parse(req.body)
      : req.body || {};

    if (Buffer.byteLength(JSON.stringify(body)) > 200000) {
      return fail(413, 'ข้อมูลใหญ่เกินไป');
    }

    if (req.method === 'POST') {
      const origin = req.headers.origin;
      const host = req.headers['x-forwarded-host'] || req.headers.host;
      if (!origin || new URL(origin).host !== host) {
        return fail(403, 'Origin ไม่ถูกต้อง');
      }
    }

    const publicRef = db.doc('site/public');
    const privateRef = db.doc('private/security');

    async function admin() {
      const token = req.headers.authorization?.replace(/^Bearer /, '');
      if (!token) {
        throw Object.assign(
          Error('กรุณาเข้าสู่ระบบผู้ดูแล'),
          {status: 401}
        );
      }

      const user = await getAuth().verifyIdToken(token, true);

      if (user.uid !== process.env.ADMIN_UID) {
        throw Object.assign(
          Error('บัญชีนี้ไม่มีสิทธิ์ผู้ดูแล'),
          {status: 403}
        );
      }

      return user;
    }

    async function limit(scope, max, milliseconds) {
      const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
        req.socket?.remoteAddress || 'unknown';
      const id = fingerprint(
        scope + ':' + ip,
        process.env.RATE_LIMIT_SECRET
      );

      return db.runTransaction(async transaction => {
        const ref = db.doc('limits/' + id);
        const snapshot = await transaction.get(ref);
        const value = snapshot.data();
        const now = Date.now();

        if (value && value.until > now && value.count >= max) {
          return false;
        }

        transaction.set(ref, {
          count: value && value.until > now ? value.count + 1 : 1,
          until: value && value.until > now
            ? value.until
            : now + milliseconds,
          expiresAt: new Date(now + 86400000)
        });

        return true;
      });
    }

    if (path === 'public' && req.method === 'GET') {
      const snapshot = await publicRef.get();
      return res.json(snapshot.data() || {});
    }

    if (path === 'unlock' && req.method === 'POST') {
      if (!(await limit('unlock', 3, 60000))) {
        return fail(429, 'ลองใหม่อีกครั้งใน 1 นาที');
      }

      if (typeof body.code !== 'string' || body.code.length > 128) {
        return fail(400, 'รหัสไม่ถูกต้อง');
      }

      const snapshot = await privateRef.get();

      if (!snapshot.exists || !checkCode(body.code, snapshot.data().hash)) {
        return fail(401, 'รหัสลับไม่ถูกต้อง');
      }

      return res.json({ok: true});
    }

    if (path === 'admin' && req.method === 'GET') {
      await admin();

      const [site, metrics, visitors, projects] = await Promise.all([
        publicRef.get(),
        db.doc('stats/total').get(),
        db.collection('visitors').orderBy('lastSeen', 'desc').limit(30).get(),
        db.collection('projectStats').get()
      ]);

      return res.json({
        ...site.data(),
        stats: {
          ...metrics.data(),
          recent: visitors.docs.map(doc => ({id: doc.id, ...doc.data()})),
          projects: Object.fromEntries(
            projects.docs.map(doc => [doc.id, doc.data()])
          )
        }
      });
    }

    if (path === 'save' && req.method === 'POST') {
      await admin();

      try {
        validate(body);
      } catch (error) {
        return fail(400, error.message);
      }

      await db.runTransaction(async transaction => {
        const snapshot = await transaction.get(privateRef);

        if (!snapshot.exists && !body.code) {
          throw Object.assign(
            Error('ครั้งแรกต้องตั้งรหัสลับที่เมนูคีย์ลัดและรหัสลับ'),
            {status: 400}
          );
        }

        transaction.set(publicRef, {
          content: body.content,
          shortcut: body.shortcut,
          updatedAt: Date.now()
        });

        if (body.code) {
          transaction.set(privateRef, {hash: hashCode(body.code)});
        }
      });

      return res.json({ok: true});
    }

    if (path === 'event' && req.method === 'POST') {
      if (
        !['visit', 'detail', 'open'].includes(body.kind) ||
        typeof body.visitor !== 'string' ||
        !/^[a-zA-Z0-9-]{16,80}$/.test(body.visitor)
      ) {
        return fail(400, 'เหตุการณ์ไม่ถูกต้อง');
      }

      if (!(await limit('event', 90, 60000))) {
        return fail(429, 'ส่งข้อมูลบ่อยเกินไป');
      }

      if (body.kind !== 'visit') {
        const site = await publicRef.get();
        const exists = site.data()?.content?.projects?.some(
          project => project.id === body.project && project.visible
        );
        if (!exists) return fail(400, 'ไม่พบผลงาน');
      }

      const visitor = fingerprint(
        body.visitor,
        process.env.RATE_LIMIT_SECRET
      );

      await db.runTransaction(async transaction => {
        const visitorRef = db.doc('visitors/' + visitor);
        const visitorSnapshot = await transaction.get(visitorRef);
        let projectVisitorSnapshot;
        let projectVisitorRef;

        if (body.kind !== 'visit') {
          projectVisitorRef = db.doc(
            'projectStats/' + body.project + '/visitors/' + visitor
          );
          projectVisitorSnapshot = await transaction.get(projectVisitorRef);
        }

        transaction.set(visitorRef, {
          visits: FieldValue.increment(body.kind === 'visit' ? 1 : 0),
          lastSeen: Date.now()
        }, {merge: true});

        const increments = {};

        if (body.kind === 'visit') {
          increments.visits = FieldValue.increment(1);
          if (!visitorSnapshot.exists) {
            increments.visitors = FieldValue.increment(1);
          }
        } else {
          const key = body.kind === 'detail' ? 'details' : 'opens';
          increments[key] = FieldValue.increment(1);

          transaction.set(db.doc('projectStats/' + body.project), {
            [key]: FieldValue.increment(1),
            ...(!projectVisitorSnapshot.exists
              ? {visitors: FieldValue.increment(1)}
              : {})
          }, {merge: true});

          transaction.set(projectVisitorRef, {lastSeen: Date.now()});
        }

        transaction.set(db.doc('stats/total'), increments, {merge: true});
      });

      return res.json({ok: true});
    }

    return fail(404, 'ไม่พบ API');
  } catch (error) {
    const status = error.status ||
      (/auth\//.test(error.code || '') ? 401 : 500);

    if (status === 500) {
      console.error('API error:', error.code || error.name);
    }

    return fail(
      status,
      status === 500
        ? 'บันทึกหรือเชื่อมต่อไม่สำเร็จ ตรวจสอบการตั้งค่าเซิร์ฟเวอร์'
        : error.message
    );
  }
}
