export const initial = {
  brand: 'Portfolio',
  headline: 'Designing digital systems',
  accentLine: 'that feel inevitable',
  intro: 'ออกแบบและพัฒนาระบบดิจิทัล สื่อประชาสัมพันธ์ และงานวิจัย\nรวมผลงานที่เสร็จแล้วไว้ในที่เดียว',
  about: 'เชื่อว่างานออกแบบที่ดี เริ่มจากการเข้าใจผู้คน แล้วเปลี่ยนความซับซ้อนให้เป็นประสบการณ์ที่เรียบง่าย ตั้งแต่ระบบดิจิทัล สื่อสร้างสรรค์ ไปจนถึงงานวิจัย',
  email: 'hello@example.com',
  accent: '#d5fee0',
  layout: 'mosaic',
  radius: 24,
  gap: 20,
  projects: [
    {
      id: 'voc',
      title: 'ระบบรับฟังเสียงลูกค้า',
      category: 'Digital experience',
      description: 'เปลี่ยนทุกความคิดเห็นให้เป็นข้อมูลที่ใช้งานได้ ออกแบบระบบรวบรวม วิเคราะห์ และติดตามเสียงของลูกค้าในที่เดียว',
      year: '2026',
      status: 'เสร็จแล้ว',
      url: '/projects/voc.html',
      cover: '',
      art: 'rings',
      featured: true,
      visible: true
    },
    {
      id: 'media',
      title: 'สื่อประชาสัมพันธ์แคมเปญ',
      category: 'Brand & communication',
      description: 'สร้างภาษาภาพที่จดจำได้ ถ่ายทอดแนวคิดของแบรนด์ผ่านสื่อดิจิทัลที่เชื่อมโยงกัน',
      year: '2026',
      status: 'เสร็จแล้ว',
      url: '/projects/media.html',
      cover: '',
      art: 'poster',
      featured: true,
      visible: true
    },
    {
      id: 'research',
      title: 'งานวิจัยพฤติกรรมผู้ใช้',
      category: 'Research & strategy',
      description: 'สำรวจความต้องการและพฤติกรรมของผู้ใช้ เพื่อเปลี่ยนข้อค้นพบให้เป็นทิศทางการออกแบบ',
      year: '2025',
      status: 'เสร็จแล้ว',
      url: '/projects/research.html',
      cover: '',
      art: 'research',
      featured: true,
      visible: true
    }
  ]
};

export function safeUrl(value) {
  if (!value) return '';
  try {
    const url = new URL(value, window.location.origin);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}
