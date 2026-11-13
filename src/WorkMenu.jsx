import React, {useEffect, useRef, useState} from 'react';

export default function WorkMenu({onShowAll}) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);

  useEffect(() => {
    if (!open) return;

    function outside(event) {
      if (!root.current?.contains(event.target)) {
        setOpen(false);
      }
    }

    document.addEventListener('pointerdown', outside);

    return () => {
      document.removeEventListener('pointerdown', outside);
    };
  }, [open]);

  return (
    <div
      ref={root}
      className="nav-work-menu"
      onPointerEnter={event => {
        if (event.pointerType === 'mouse') {
          setOpen(true);
        }
      }}
      onPointerLeave={event => {
        if (
          event.pointerType === 'mouse' &&
          !event.currentTarget.contains(document.activeElement)
        ) {
          setOpen(false);
        }
      }}
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
        }
      }}
      onKeyDown={event => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
          event.currentTarget.querySelector('button').focus();
        }
      }}
    >
      <button
        type="button"
        className="nav-work-trigger"
        aria-expanded={open}
        aria-controls="nav-work-links"
        onClick={() => setOpen(previous => !previous)}
      >
        ผลงาน <span aria-hidden="true">⌄</span>
      </button>

      <div
        id="nav-work-links"
        className="nav-work-dropdown"
        hidden={!open}
      >
        <div className="nav-work-list">
          <a
            href="#work"
            onClick={() => setOpen(false)}
          >
            ผลงานที่เสร็จ
          </a>

          <a
            href="#all-projects"
            onClick={() => {
              onShowAll?.();
              setOpen(false);
            }}
          >
            ทั้งหมด
          </a>
        </div>
      </div>
    </div>
  );
}