import {
  scryptSync,
  randomBytes,
  timingSafeEqual,
  createHmac
} from 'node:crypto';

export function hashCode(code, salt = randomBytes(16).toString('hex')) {
  return salt + ':' + scryptSync(code, salt, 64).toString('hex');
}

export function checkCode(code, stored) {
  try {
    const [salt, hash] = stored.split(':');
    const expected = Buffer.from(hash, 'hex');
    const actual = scryptSync(code, salt, 64);
    return expected.length === actual.length &&
      timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export const fingerprint = (value, key) =>
  createHmac('sha256', key).update(value).digest('hex');

export function validate(data) {
  const {content: c, shortcut, code} = data;

  if (!c || !Array.isArray(c.projects) || c.projects.length > 100) {
    throw Error('ข้อมูลผลงานไม่ถูกต้อง (สูงสุด 100 รายการ)');
  }

  for (const key of ['brand', 'headline', 'accentLine', 'intro', 'about', 'email']) {
    if (typeof c[key] !== 'string' || c[key].length > 5000) {
      throw Error('ข้อมูลหน้าเว็บไม่ถูกต้อง');
    }
  }

  if (
    !/^#[0-9a-f]{6}$/i.test(c.accent) ||
    !['mosaic', 'grid', 'list'].includes(c.layout) ||
    !Number.isFinite(c.radius) || c.radius < 0 || c.radius > 48 ||
    !Number.isFinite(c.gap) || c.gap < 8 || c.gap > 48
  ) {
    throw Error('การแสดงผลไม่ถูกต้อง');
  }

  if (c.categories !== undefined) {
    if (
      !Array.isArray(c.categories) ||
      c.categories.length > 100 ||
      c.categories.some(category =>
        typeof category !== 'string' ||
        category.trim() !== category ||
        category.length < 1 ||
        category.length > 80
      ) ||
      new Set(c.categories).size !== c.categories.length
    ) {
      throw Error('รายการหมวดหมู่ไม่ถูกต้อง');
    }

    if (c.projects.some(project =>
      !c.categories.includes(project.category)
    )) {
      throw Error('กรุณาเลือกหมวดหมู่ให้ครบทุกผลงาน');
    }
  }

  const ids = new Set();

  for (const project of c.projects) {
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(project.id) || ids.has(project.id)) {
      throw Error('ID โปรเจกต์ซ้ำหรือไม่ถูกต้อง');
    }
    ids.add(project.id);

    for (const key of [
      'title', 'category', 'description', 'year',
      'status', 'url', 'cover', 'art'
    ]) {
      if (typeof project[key] !== 'string' || project[key].length > 10000) {
        throw Error('ข้อมูลโปรเจกต์ไม่ถูกต้อง');
      }
    }

    for (const key of ['url', 'cover']) {
      if (
        project[key] &&
        !/^https?:\/\//i.test(project[key]) &&
        !/^\/(?!\/)/.test(project[key])
      ) {
        throw Error('URL ต้องเริ่มด้วย https:// หรือ /');
      }
    }

    if (
      typeof project.visible !== 'boolean' ||
      typeof project.featured !== 'boolean'
    ) {
      throw Error('สถานะเผยแพร่ไม่ถูกต้อง');
    }
  }

  if (
    !/^(?:(?:Ctrl|Alt|Shift|Meta)\+)+[A-Z0-9]$/.test(shortcut) ||
    !/(Ctrl|Alt|Meta)/.test(shortcut)
  ) {
    throw Error('คีย์ลัดไม่ถูกต้อง');
  }

  if (
    code !== undefined &&
    (typeof code !== 'string' || code.length < 8 || code.length > 128)
  ) {
    throw Error('รหัสลับต้องมี 8–128 ตัวอักษร');
  }

  return c;
}
