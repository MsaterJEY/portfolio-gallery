import React, {useEffect, useRef, useState} from 'react';

const POSITION_KEY = 'portfolio-admin-bubble-position';
const SIZE = 58;
const EDGE = 8;

function clampPosition(position, width = SIZE, height = SIZE) {
  return {
    x: Math.max(
      EDGE,
      Math.min(position.x, window.innerWidth - width - EDGE)
    ),
    y: Math.max(
      EDGE,
      Math.min(position.y, window.innerHeight - height - EDGE)
    )
  };
}

function initialPosition() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(POSITION_KEY)
    );

    if (
      Number.isFinite(saved?.x) &&
      Number.isFinite(saved?.y)
    ) {
      return clampPosition(saved);
    }
  } catch {}

  return clampPosition({
    x: window.innerWidth - SIZE - 25,
    y: window.innerHeight - SIZE - 25
  });
}

function storePosition(position) {
  try {
    localStorage.setItem(
      POSITION_KEY,
      JSON.stringify(position)
    );
  } catch {}
}

export default function AdminBubble({onOpen}) {
  const [position, setPosition] = useState(initialPosition);
  const [dragging, setDragging] = useState(false);

  const button = useRef(null);
  const active = useRef(null);
  const moved = useRef(false);
  const current = useRef(position);

  function update(next) {
    current.current = next;
    setPosition(next);
  }

  useEffect(() => {
    function resize() {
      const rect = button.current?.getBoundingClientRect();

      const next = clampPosition(
        current.current,
        rect?.width,
        rect?.height
      );

      current.current = next;
      setPosition(next);
      storePosition(next);
    }

    resize();
    window.addEventListener('resize', resize);

    return () => {
      window.removeEventListener('resize', resize);
    };
  }, []);

  function start(event) {
    if (event.button !== 0 || !event.isPrimary) return;

    const rect = event.currentTarget.getBoundingClientRect();

    active.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      width: rect.width,
      height: rect.height
    };

    moved.current = false;

    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.focus();
  }

  function move(event) {
    const drag = active.current;

    if (!drag || drag.pointerId !== event.pointerId) return;

    const distance = Math.hypot(
      event.clientX - drag.startX,
      event.clientY - drag.startY
    );

    if (!moved.current && distance < 6) return;

    moved.current = true;
    setDragging(true);

    update(clampPosition({
      x: event.clientX - drag.offsetX,
      y: event.clientY - drag.offsetY
    }, drag.width, drag.height));
  }

  function finish(event) {
    const drag = active.current;

    if (!drag || drag.pointerId !== event.pointerId) return;

    if (moved.current) {
      storePosition(current.current);
    }

    active.current = null;
    setDragging(false);

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <button
      ref={button}
      type="button"
      className={
        'bubble draggable-admin-bubble' +
        (dragging ? ' is-dragging' : '')
      }
      style={{
        left: position.x,
        top: position.y,
        right: 'auto',
        bottom: 'auto'
      }}
      aria-label="เปิด Admin panel"
      title="ลากเพื่อย้ายตำแหน่ง หรือกดเพื่อเปิดแอดมิน"
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={finish}
      onPointerCancel={finish}
      onLostPointerCapture={finish}
      onClick={event => {
        // ลากแล้วไม่เปิดแอดมินโดยไม่ตั้งใจ
        // แต่ยังเปิดด้วย Enter / Space ได้
        if (event.detail !== 0 && moved.current) return;

        onOpen();
      }}
    >
      ✦
    </button>
  );
}