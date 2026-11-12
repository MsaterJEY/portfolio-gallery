import React, {useEffect, useRef, useState} from 'react';
import {safeUrl} from './data';
import './project-manager.css';

const formatDate = value => Number.isFinite(value) && value > 0
  ? new Date(value).toLocaleString('th-TH', {
      dateStyle: 'medium',
      timeStyle: 'short'
    })
  : 'ไม่มีข้อมูลเดิม';

export default function ProjectManager({
  projects, categories, busy, onChange, onUpload, Art
}) {
  const [editor, setEditor] = useState(null);
  const [localCategories, setLocalCategories] = useState([]);
  const [addingCategory, setAddingCategory] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(null);
  const [over, setOver] = useState(null);
  const [announcement, setAnnouncement] = useState('');
  const pointer = useRef(null);
  const opener = useRef(null);
  const dialog = useRef(null);
  const scrollFrame = useRef(null);
  const pointerY = useRef(0);

  useEffect(() => {
    if (!editor) return;

    const container = document.querySelector('.admin-main');
    const oldOverflow = container?.style.overflow;

    const background = [
      ...document.querySelectorAll(
        '.admin-shell > aside, .admin-main > *'
      )
    ].filter(node => !node.classList.contains('pm-manager'));

    const inertValues = background.map(node => node.inert);
    background.forEach(node => {node.inert = true;});

    if (container) container.style.overflow = 'hidden';
    dialog.current?.querySelector('input')?.focus();

    return () => {
      background.forEach((node, index) => {
        node.inert = inertValues[index];
      });
      if (container) container.style.overflow = oldOverflow;
      opener.current?.focus();
    };
  }, [editor?.id]);

  useEffect(() => () => {
    cancelAnimationFrame(scrollFrame.current);
  }, []);

  function openEditor(project, element) {
    opener.current = element;

    setEditor(structuredClone(project || {
      id: crypto.randomUUID(),
      title: '',
      category: categories[0] || '',
      description: '',
      url: '',
      cover: '',
      year: String(new Date().getFullYear()),
      status: 'กำลังทำ',
      art: 'rings',
      visible: true,
      featured: true
    }));

    setLocalCategories([...categories]);
    setAddingCategory(false);
    setCategoryName('');
    setError('');
  }

  function closeEditor() {
    if (!busy) setEditor(null);
  }

  function change(key, value) {
    setEditor(previous => ({...previous, [key]: value}));
  }

  function addCategory() {
    const name = categoryName.trim();

    if (!name || name.length > 80) {
      setError('ชื่อหมวดหมู่ต้องมี 1–80 ตัวอักษร');
      return;
    }

    if (localCategories.includes(name)) {
      setError('มีหมวดหมู่นี้แล้ว');
      return;
    }

    if (localCategories.length >= 100) {
      setError('เพิ่มได้สูงสุด 100 หมวดหมู่');
      return;
    }

    setLocalCategories(previous => [...previous, name]);
    change('category', name);
    setAddingCategory(false);
    setCategoryName('');
    setError('');
  }

  function commit(event) {
    event.preventDefault();
    if (busy) return;

    const title = editor.title.trim();

    if (!title) {
      setError('กรุณาระบุชื่อผลงาน');
      return;
    }

    if (!localCategories.includes(editor.category)) {
      setError('กรุณาเลือกหมวดหมู่');
      return;
    }

    if (
      editor.url &&
      !/^https?:\/\//i.test(editor.url) &&
      !/^\/(?!\/)/.test(editor.url)
    ) {
      setError('URL ต้องเริ่มด้วย https:// หรือ /');
      return;
    }

    const value = {...editor, title};
    const exists = projects.some(project => project.id === value.id);

    if (!exists && projects.length >= 100) {
      setError('เพิ่มได้สูงสุด 100 ผลงาน');
      return;
    }

    onChange(
      exists
        ? projects.map(project =>
            project.id === value.id ? value : project
          )
        : [...projects, value],
      localCategories
    );

    setEditor(null);
    setAnnouncement(
      'ปรับรายการแล้ว กดยืนยันและรีเฟรชด้านซ้ายเพื่อเผยแพร่'
    );
  }

  async function upload(file) {
    if (!file) return;
    setError('');

    try {
      change('cover', await onUpload(file));
    } catch (exception) {
      setError(exception.message);
    }
  }

  function reorder(sourceId, targetId) {
    const from = projects.findIndex(project => project.id === sourceId);
    const to = projects.findIndex(project => project.id === targetId);

    if (from < 0 || to < 0 || from === to || busy) return;

    const next = [...projects];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);

    onChange(next, categories);

    setAnnouncement(
      `ย้าย ${item.title} ไปตำแหน่ง ${to + 1} แล้ว กดยืนยันด้านซ้ายเพื่อเผยแพร่`
    );
  }

  function targetAt(x, y) {
    return document.elementFromPoint(x, y)
      ?.closest('[data-project-card]')
      ?.dataset.projectCard;
  }

  function autoScroll() {
    if (!pointer.current) return;

    const area = document.querySelector('.admin-main');

    if (area) {
      const bounds = area.getBoundingClientRect();

      if (pointerY.current > bounds.bottom - 70) {
        area.scrollTop += 12;
      } else if (pointerY.current < bounds.top + 70) {
        area.scrollTop -= 12;
      }
    }

    scrollFrame.current = requestAnimationFrame(autoScroll);
  }

  function startDrag(event, id) {
    if (busy || event.button !== 0) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);

    pointer.current = {
      id,
      pointerId: event.pointerId,
      target: id
    };

    pointerY.current = event.clientY;
    setDragging(id);
    setOver(id);
    autoScroll();
  }

  function moveDrag(event) {
    if (
      !pointer.current ||
      pointer.current.pointerId !== event.pointerId
    ) return;

    pointerY.current = event.clientY;

    const target = targetAt(event.clientX, event.clientY);
    if (target) {
      pointer.current.target = target;
      setOver(target);
    }
  }

  function finishDrag(event, cancelled = false) {
    if (!pointer.current) return;

    const active = pointer.current;
    const target = targetAt(event.clientX, event.clientY);

    pointer.current = null;
    cancelAnimationFrame(scrollFrame.current);
    setDragging(null);
    setOver(null);

    if (!cancelled && target) reorder(active.id, target);
  }

  function modalKeys(event) {
    event.stopPropagation();

    if (event.key === 'Escape') {
      event.preventDefault();
      closeEditor();
    }

    if (event.key !== 'Tab') return;

    const elements = [
      ...dialog.current.querySelectorAll(
        'button,input,select,textarea,a[href]'
      )
    ].filter(element =>
      !element.disabled && element.getClientRects().length
    );

    const first = elements[0];
    const last = elements[elements.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="pm-manager">
      <div className="pm-toolbar">
        <div>
          <h3>ผลงานทั้งหมด <span>({projects.length})</span></h3>
          <p>
            ลากที่ปุ่ม ⠿ เพื่อเรียงลำดับหน้าเว็บหลัก
            แล้วกดยืนยันด้านซ้าย
          </p>
        </div>

        <button
          className="primary"
          disabled={busy || projects.length >= 100}
          onClick={event => openEditor(null, event.currentTarget)}
        >
          + เพิ่มผลงาน
        </button>
      </div>

      <p className="pm-announcement" role="status">
        {announcement}
      </p>

      <div className="pm-cards">
        {projects.map((project, index) => (
          <article
            key={project.id}
            data-project-card={project.id}
            className={[
              'pm-card',
              dragging === project.id ? 'pm-dragging' : '',
              over === project.id && dragging !== project.id
                ? 'pm-drop-target'
                : ''
            ].filter(Boolean).join(' ')}
          >
            <div className="pm-cover">
              {project.cover ? (
                <img
                  src={safeUrl(project.cover)}
                  alt={project.title}
                  loading="lazy"
                />
              ) : <Art type={project.art}/>}

              <button
                className="pm-grip"
                aria-label={`ลากเรียง ${project.title}`}
                disabled={busy}
                onPointerDown={event => startDrag(event, project.id)}
                onPointerMove={moveDrag}
                onPointerUp={finishDrag}
                onPointerCancel={event => finishDrag(event, true)}
                onLostPointerCapture={event => {
                  if (pointer.current) finishDrag(event, true);
                }}
                onKeyDown={event => {
                  if (event.key === 'ArrowUp' && index > 0) {
                    event.preventDefault();
                    reorder(project.id, projects[index - 1].id);
                  }

                  if (
                    event.key === 'ArrowDown' &&
                    index < projects.length - 1
                  ) {
                    event.preventDefault();
                    reorder(project.id, projects[index + 1].id);
                  }
                }}
              >⠿</button>

              <span className={
                'pm-status ' +
                (project.status === 'เสร็จแล้ว' ? 'pm-complete' : '')
              }>
                {project.status === 'เสร็จแล้ว'
                  ? 'เสร็จสิ้น'
                  : 'กำลังพัฒนา'}
              </span>
            </div>

            <div className="pm-card-body">
              <small>
                {String(index + 1).padStart(2, '0')} /{' '}
                {project.category || 'ยังไม่เลือกหมวดหมู่'}
              </small>

              <h3>{project.title}</h3>

              <p className="pm-description">
                {project.description || 'ยังไม่มีรายละเอียด'}
              </p>

              {project.url ? (
                <a
                  className="pm-url"
                  href={safeUrl(project.url)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {project.url} ↗
                </a>
              ) : <span className="pm-url">ยังไม่มี URL</span>}

              <div className="pm-dates">
                <div>
                  <small>วันที่สร้าง</small>
                  <span>{formatDate(project.createdAt)}</span>
                </div>
                <div>
                  <small>อัปเดตล่าสุด</small>
                  <span>{formatDate(project.updatedAt)}</span>
                </div>
              </div>

              <div className="pm-flags">
                <span>{project.visible ? 'เผยแพร่' : 'ซ่อนอยู่'}</span>
                <span>
                  {project.featured
                    ? 'แสดงในแกลเลอรี'
                    : 'แสดงในรายการทั้งหมด'}
                </span>
              </div>

<div className="pm-card-actions">
  <button
    disabled={busy}
    onClick={event =>
      openEditor(project, event.currentTarget)
    }
  >
    แก้ไข
  </button>

  <button
    className="pm-delete"
    disabled={busy}
    onClick={() => {
      if (window.confirm(
        `ลบผลงาน “${project.title}” หรือไม่?`
      )) {
        onChange(
          projects.filter(item => item.id !== project.id),
          categories
        );
      }
    }}
  >
    ลบ
  </button>
</div>
            </div>
          </article>
        ))}
      </div>

      {projects.length === 0 && (
        <p className="panel">
          ยังไม่มีผลงาน กด “+ เพิ่มผลงาน” เพื่อเริ่มต้น
        </p>
      )}

      {editor && (
        <div className="pm-overlay" onClick={closeEditor}>
          <form
            ref={dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="pm-dialog-title"
            className="pm-editor"
            onSubmit={commit}
            onClick={event => event.stopPropagation()}
            onKeyDown={modalKeys}
          >
            <div className="pm-editor-heading">
              <h2 id="pm-dialog-title">
                {projects.some(project => project.id === editor.id)
                  ? 'แก้ไขผลงาน'
                  : 'เพิ่มผลงาน'}
              </h2>

              <button
                type="button"
                disabled={busy}
                aria-label="ปิดหน้าต่างแก้ไข"
                onClick={closeEditor}
              >×</button>
            </div>

            <fieldset disabled={busy} className="pm-fields">
              <label>
                ชื่อผลงาน
                <input
                  required
                  value={editor.title}
                  maxLength={10000}
                  onChange={event => change('title', event.target.value)}
                />
              </label>

              <label>
                หมวดหมู่
                <select
                  value={editor.category}
                  onChange={event => {
                    if (event.target.value === '__add_category__') {
                      setAddingCategory(true);
                      return;
                    }

                    change('category', event.target.value);
                  }}
                >
                  <option value="" disabled>เลือกหมวดหมู่</option>
                  {localCategories.map(category => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                  <option value="__add_category__">
                    ＋ เพิ่มหมวดหมู่
                  </option>
                </select>
              </label>

              {addingCategory && (
                <div className="pm-new-category pm-full">
                  <label>
                    หมวดหมู่ใหม่
                    <input
                      value={categoryName}
                      maxLength={80}
                      onChange={event =>
                        setCategoryName(event.target.value)
                      }
                      onKeyDown={event => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          addCategory();
                        }
                      }}
                    />
                  </label>

                  <button type="button" onClick={addCategory}>
                    เพิ่ม
                  </button>

                  <button
                    type="button"
                    onClick={() => setAddingCategory(false)}
                  >
                    ยกเลิก
                  </button>
                </div>
              )}

              <label className="pm-full">
                รายละเอียด
                <textarea
                  rows={4}
                  maxLength={10000}
                  value={editor.description}
                  onChange={event =>
                    change('description', event.target.value)
                  }
                />
              </label>

              <label className="pm-full">
                URL เว็บไซต์
                <input
                  placeholder="https://... หรือ /projects/..."
                  value={editor.url}
                  onChange={event => change('url', event.target.value)}
                />
              </label>

              <div className="pm-cover-field">
                <label>
                  ภาพปกผลงาน
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={event => {
                      const file = event.target.files?.[0];
                      event.target.value = '';
                      upload(file);
                    }}
                  />
                </label>

                <div className="pm-preview">
                  {editor.cover ? (
                    <img
                      src={safeUrl(editor.cover)}
                      alt="ตัวอย่างภาพปก"
                    />
                  ) : <Art type={editor.art}/>}
                </div>

                {editor.cover && (
                  <button
                    type="button"
                    onClick={() => change('cover', '')}
                  >
                    เอาภาพปกออก
                  </button>
                )}

                <small>JPG / PNG / WebP ไม่เกิน 5 MB</small>
              </div>

              <div className="pm-options">
                <label>
                  สถานะ
                  <select
                    value={editor.status}
                    onChange={event =>
                      change('status', event.target.value)
                    }
                  >
                    <option value="เสร็จแล้ว">เสร็จสิ้น</option>
                    <option value="กำลังทำ">กำลังพัฒนา</option>
                  </select>
                </label>

                <label>
                  ปี
                  <input
                    value={editor.year}
                    onChange={event => change('year', event.target.value)}
                  />
                </label>

                <label>
                  ภาพสำรอง
                  <select
                    value={editor.art}
                    onChange={event => change('art', event.target.value)}
                  >
                    {['rings', 'poster', 'research'].map(art => (
                      <option key={art}>{art}</option>
                    ))}
                  </select>
                </label>

                <label className="check">
                  <input
                    type="checkbox"
                    checked={editor.visible}
                    onChange={event =>
                      change('visible', event.target.checked)
                    }
                  />
                  เผยแพร่
                </label>

                <label className="check">
                  <input
                    type="checkbox"
                    checked={editor.featured}
                    onChange={event =>
                      change('featured', event.target.checked)
                    }
                  />
                  แสดงในแกลเลอรี
                </label>
              </div>
            </fieldset>

            {error && <p className="notice" role="alert">{error}</p>}

            <p className="pm-note">
              {busy
                ? 'กำลังอัปโหลดรูป…'
                : 'บันทึกเข้ารายการ แล้วกดยืนยันและรีเฟรชด้านซ้ายเพื่อเผยแพร่'}
            </p>

            <div className="pm-editor-actions">
              <button
                type="submit"
                className="primary"
                disabled={busy}
              >บันทึก</button>

              <button
                type="button"
                disabled={busy}
                onClick={closeEditor}
              >ยกเลิก</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
