import { useEffect, useState } from 'react';
import './loading-screen.css';

export default function LoadingScreen({ ready = false }) {
  const [visible, setVisible] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [minimumPassed, setMinimumPassed] = useState(false);
  const [resourcesReady, setResourcesReady] = useState(
    () => document.readyState === 'complete'
  );

  // รอไฟล์หน้าเว็บ และแสดงอย่างน้อย 1.2 วินาที
  useEffect(() => {
    function handleLoad() {
      setResourcesReady(true);
    }

    window.addEventListener('load', handleLoad);

    // ตรวจอีกครั้ง เผื่อโหลดเสร็จก่อนติดตั้ง listener
    if (document.readyState === 'complete') {
      handleLoad();
    }

    const minimumTimer = window.setTimeout(() => {
      setMinimumPassed(true);
    }, 1200);

    // ไม่ให้ไฟล์ภายนอกที่โหลดค้างขวางการแสดงเว็บ
    // แต่ยังต้องรอ ready จากการโหลดข้อมูล
    const resourceTimer = window.setTimeout(handleLoad, 8000);

    return () => {
      window.removeEventListener('load', handleLoad);
      window.clearTimeout(minimumTimer);
      window.clearTimeout(resourceTimer);
    };
  }, []);

  // เริ่มจางออกเมื่อข้อมูลและไฟล์พร้อมแล้ว
  useEffect(() => {
    if (!ready || !resourcesReady || !minimumPassed) return;

    setLeaving(true);

    const exitTimer = window.setTimeout(() => {
      setVisible(false);
    }, 450);

    return () => window.clearTimeout(exitTimer);
  }, [ready, resourcesReady, minimumPassed]);

  // ล็อกการเลื่อนระหว่างแสดง Loading
  useEffect(() => {
    if (!visible) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      className={`wg-loading-screen${leaving ? ' is-leaving' : ''}`}
      role="status"
      aria-live="polite"
      aria-label="กำลังโหลดเว็บไซต์"
    >
      <div className="wg-loading-content">
        <div className="wg-loading-tiles" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </div>

        <p>กำลังโหลดทรัพยากรเว็บไซต์</p>
      </div>
    </div>
  );
}