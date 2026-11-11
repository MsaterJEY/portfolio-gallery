import React, {useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {initializeApp} from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';
import {initial, safeUrl} from './data';
import './style.css';

const configured = !!import.meta.env.VITE_FIREBASE_API_KEY;

const auth = configured
  ? getAuth(initializeApp({
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID
    }))
  : null;

async function api(path, body, token) {
  const response = await fetch('/api/' + path, {
    method: body ? 'POST' : 'GET',
    headers: {
      ...(body ? {'Content-Type': 'application/json'} : {}),
      ...(token ? {Authorization: 'Bearer ' + token} : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const data = await response.json();
  if (!response.ok) throw Error(data.error || 'เชื่อมต่อไม่สำเร็จ');
  return data;
}

function Art({type = 'rings'}) {
  return (
    <div className={'art ' + type}>
      {type === 'rings' ? (
        <>
          <div className="mini-window"><i/><i/><i/><div/></div>
          <b className="ring one"/>
          <b className="ring two"/>
        </>
      ) : type === 'poster' ? (
        <>
          <small>MAKE SOMETHING</small>
          <strong>worth<br/><em>noticing.</em></strong>
          <span>CREATIVE CAMPAIGN — 2026 ↗</span>
        </>
      ) : (
        <>
          <span>HUMAN INSIGHTS / 025</span>
          <div className="orbit"/>
          <strong>Understand.<br/><em>Then create.</em></strong>
          <small>Research → Insight → Impact</small>
        </>
      )}
    </div>
  );
}

const ADMIN_GRACE_KEY = 'portfolio-admin-grace-until';
const ADMIN_GRACE_DURATION = 15 * 60 * 1000;

function readAdminGraceUntil() {
  try {
    const value = Number(localStorage.getItem(ADMIN_GRACE_KEY));
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

function App() {
  const [data, setData] = useState(initial);
  const [shortcut, setShortcut] = useState('');
  const [mode, setMode] = useState(
    location.pathname === '/admin' ? 'admin' : ''
  );
  const [selected, setSelected] = useState(null);
  const [view, setView] = useState(null);
  const [filter, setFilter] = useState('ทั้งหมด');
  const [secret, setSecret] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState('');
  const [bubble, setBubble] = useState(false);
  const [online, setOnline] = useState(false);
  const input = useRef(null);
  const opener = useRef(null);

  const adminGraceUntil = useRef(readAdminGraceUntil());

async function logoutAdmin() {
  const confirmed = window.confirm(
    'ต้องการออกจากระบบแอดมินหรือไม่?'
  );

  if (!confirmed) return;

  try {
    await signOut(auth);

    const until = Date.now() + ADMIN_GRACE_DURATION;
    adminGraceUntil.current = until;

    try {
      localStorage.setItem(ADMIN_GRACE_KEY, String(until));
    } catch {
      // ถ้าเก็บข้อมูลไม่ได้ ยังใช้ได้ในหน้าปัจจุบัน
    }

    setMode('');
    setBubble(false);
    setSecret('');
    setError('');
    setAttempt(0);

    history.replaceState({}, '', '/');
  } catch {
    window.alert('ออกจากระบบไม่สำเร็จ กรุณาลองใหม่');
  }
}

  useEffect(() => {
    async function load() {
      try {
        const result = await api('public');
        setData(result.content || initial);
        setShortcut(result.shortcut || '');
        setOnline(true);
      } catch {
        setOnline(false);
      }
    }
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!configured) return;

    let visitor = localStorage.getItem('gallery-visitor');
    if (!visitor) {
      visitor = crypto.randomUUID();
      localStorage.setItem('gallery-visitor', visitor);
    }

    api('event', {kind: 'visit', visitor}).catch(() => {});
  }, []);
  
  useEffect(() => {
    if (!auth) return;
  
    let requestId = 0;
  
    const unsubscribe = auth.onAuthStateChanged(async currentUser => {
      const currentRequest = ++requestId;
    
      setBubble(false);
    
      if (!currentUser) return;
    
      try {
        const token = await currentUser.getIdToken();
      
        // ตรวจสิทธิ์ผู้ดูแลกับเซิร์ฟเวอร์ก่อนแสดง bubble
        await api('admin', null, token);
      
        if (currentRequest === requestId) {
          setBubble(true);
        }
      } catch {
        if (currentRequest === requestId) {
          setBubble(false);
        }
      }
    });
  
    return () => {
      requestId++;
      unsubscribe();
    };
  }, []);

  function track(project, kind) {
    if (configured) {
      api('event', {
        kind,
        project: project.id,
        visitor: localStorage.getItem('gallery-visitor')
      }).catch(() => {});
    }
  }

  useEffect(() => {
  function key(event) {
    if (event.defaultPrevented || event.isComposing) return;

    if (event.key === 'Escape') {
      setMode('');
      setSelected(null);
      setView(null);
      opener.current?.focus();
      return;
    }

    let pressedKey = event.key;

    if (/^Key[A-Z]$/.test(event.code)) {
      pressedKey = event.code.slice(3);
    } else if (/^Digit[0-9]$/.test(event.code)) {
      pressedKey = event.code.slice(5);
    } else if (pressedKey.length === 1) {
      pressedKey = pressedKey.toUpperCase();
    }

    const combo = [
      event.ctrlKey ? 'Ctrl' : '',
      event.altKey ? 'Alt' : '',
      event.shiftKey ? 'Shift' : '',
      event.metaKey ? 'Meta' : '',
      pressedKey
    ].filter(Boolean).join('+');

    if (!shortcut || combo !== shortcut) return;

    event.preventDefault();

    if (event.repeat) return;

    const until = Math.max(
      adminGraceUntil.current,
      readAdminGraceUntil()
    );

    if (Date.now() < until) {
      setMode('');
      setSecret('');
      setError('');
      setBubble(previous => !previous);
      return;
    }

    setMode('unlock');
    setAttempt(0);
    setSecret('');
    setError('');
  }

  window.addEventListener('keydown', key);

  return () => {
    window.removeEventListener('keydown', key);
  };
}, [shortcut]);

  useEffect(() => {
    document.body.style.overflow = mode || selected || view ? 'hidden' : '';
    if (mode === 'unlock') input.current?.focus();
    return () => {document.body.style.overflow = '';};
  }, [mode, selected, view]);

  useEffect(() => {
    if (!(mode || selected || view)) return;

    function trap(event) {
      if (event.key !== 'Tab') return;
      const root = document.querySelector(
        '.admin-shell,.unlock,.viewer,.detail'
      );
      const elements = root?.querySelectorAll(
        'button:not(:disabled),a[href],input,select,iframe'
      );
      if (!elements?.length) return;

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

    document.addEventListener('keydown', trap);
    return () => document.removeEventListener('keydown', trap);
  }, [mode, selected, view]);

  async function unlock(event) {
    event.preventDefault();
    try {
      await api('unlock', {code: secret});
      setMode('');
      setBubble(true);
      setSecret('');
      setError('');
    } catch (exception) {
      setSecret('');
      setAttempt(value => value + 1);
      setError(exception.message);
      if (attempt >= 2) setMode('');
    }
  }

  function openDetail(project, element) {
    if (element) opener.current = element;
    setSelected(project);
    track(project, 'detail');
  }

  const visible = data.projects.filter(project => project.visible);
  const categories = [
    'ทั้งหมด',
    ...new Set(visible.map(project => project.category))
  ];

  return (
    <>
      <div
        className={mode === 'unlock' ? 'site blurred' : 'site'}
        inert={mode === 'unlock' ? true : undefined}
        style={{
          '--accent': data.accent,
          '--radius': data.radius + 'px',
          '--gap': data.gap + 'px'
        }}
      >
        <header id="home">
          <nav>
            <a href="#home" className="home-link">หน้าแรก</a>
            <a className="brand" href="#home"><i/>{data.brand}</a>
            <div>
              <a href="#work">ผลงาน</a>
              <a href="#about">เกี่ยวกับ</a>
              <a href="#contact">ติดต่อ</a>
            </div>
          </nav>

          <div className="hero-copy">
            <span className="eyebrow">
              INDEPENDENT DESIGNER & CREATIVE DEVELOPER
            </span>
            <h1>{data.headline}<em>{data.accentLine}</em></h1>
            <p>{data.intro}</p>
          </div>

          <div className="hero-art"><Art/></div>
          <a className="scroll" href="#work">
            เลื่อนเพื่อสำรวจ <span>↓</span>
          </a>
          <div className="star s1"/>
          <div className="star s2"/>
          <div className="star s3"/>
        </header>

        <main>
          <section id="work">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Selected work</span>
                <h2>
                  ผลงานที่ทำเสร็จ
                  <span>
                    {' / ' + String(
                      visible.filter(project => project.featured).length
                    ).padStart(2, '0')}
                  </span>
                </h2>
              </div>
              <span className="muted">
                จากแนวคิด สู่ประสบการณ์จริง ↙
              </span>
            </div>

            <div className={'gallery ' + data.layout}>
              {visible.filter(project => project.featured).map((project, index) => (
                <button
                  className={'project p' + index}
                  key={project.id}
                  onClick={event => openDetail(project, event.currentTarget)}
                >
                  <div className="project-image">
                    {project.cover ? (
                      <img src={safeUrl(project.cover)} alt={project.title}/>
                    ) : <Art type={project.art}/>}
                    <span className="arrow">↗</span>
                  </div>
                  <div className="project-caption">
                    <div>
                      <small>{project.category} · {project.year}</small>
                      <h3>{project.title}</h3>
                    </div>
                    <span>{String(index + 1).padStart(2, '0')}</span>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className="all-projects">
            <div className="section-heading">
              <div>
                <span className="eyebrow">All projects</span>
                <h2>โปรเจกต์ทั้งหมด</h2>
              </div>
              <div className="filters">
                {categories.map(category => (
                  <button
                    className={filter === category ? 'active' : ''}
                    key={category}
                    onClick={() => setFilter(category)}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>

            {visible.filter(project =>
              filter === 'ทั้งหมด' || project.category === filter
            ).map((project, index) => (
              <button
                key={project.id}
                className="project-row"
                onClick={event => openDetail(project, event.currentTarget)}
              >
                <span className="muted">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h3>{project.title}</h3>
                <span className="category">{project.category}</span>
                <span className={
                  'status ' + (project.status === 'เสร็จแล้ว' ? 'done' : '')
                }>● {project.status}</span>
                <span>↗</span>
              </button>
            ))}
          </section>

          <section id="about" className="about">
            <div>
              <span className="eyebrow">About</span>
              <h2>เกี่ยวกับ<span className="serif"> the practice.</span></h2>
            </div>
            <p>{data.about}</p>
          </section>

          <section id="contact">
            <span className="eyebrow">Contact</span>
            <h2>มาสร้างสิ่งดี ๆ <em>ด้วยกัน</em></h2>
            <p>พร้อมคุยงานใหม่ ๆ ทักมาได้ที่ช่องทางด้านล่าง</p>
            <a className="email" href={'mailto:' + data.email}>
              {data.email} ↗
            </a>
          </section>
        </main>

        <footer>
          <a className="brand" href="#home"><i/>{data.brand}</a>
          <span>© {new Date().getFullYear()} · สงวนลิขสิทธิ์</span>
          <span className="sync">
            ● {online ? 'อัปเดตทุก 1 นาที' : 'ตัวอย่าง · ยังไม่เชื่อมต่อฐานข้อมูล'}
          </span>
          <a href="#home">กลับด้านบน ↑</a>
        </footer>
      </div>

      {selected && (
        <div className="overlay" onClick={() => setSelected(null)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-label={selected.title}
            className="detail"
            onClick={event => event.stopPropagation()}
          >
            <button
              autoFocus
              className="close"
              onClick={() => {
                setSelected(null);
                opener.current?.focus();
              }}
              aria-label="ปิด"
            >×</button>

            <div className="detail-art">
              {selected.cover ? (
                <img src={safeUrl(selected.cover)} alt=""/>
              ) : <Art type={selected.art}/>}
            </div>

            <small>{selected.category} / {selected.year}</small>
            <h2>{selected.title}</h2>
            <p>{selected.description}</p>

            <button
              className="primary"
              disabled={!safeUrl(selected.url)}
              onClick={() => {
                setView(selected);
                setSelected(null);
                track(selected, 'open');
              }}
            >เปิดเว็บไซต์โปรเจกต์ ↗</button>
          </section>
        </div>
      )}

      {view && (
        <div className="viewer">
          <div className="viewer-bar">
            <button onClick={() => setView(null)}>← กลับเว็บหลัก</button>
            <span>{view.title}</span>
            <small>เว็บไซต์ภายใน Portfolio</small>
          </div>
          <iframe
            title={view.title}
            src={safeUrl(view.url)}
            sandbox="allow-scripts allow-forms allow-same-origin"
            referrerPolicy="no-referrer"
          />
          <p className="frame-note">
            หากหน้าเว็บไม่แสดง เจ้าของเว็บไซต์ต้องอนุญาตการฝัง iframe
            ดูรายละเอียดใน README
          </p>
        </div>
      )}

      {mode === 'unlock' && (
        <div
          className="unlock"
          role="dialog"
          aria-modal="true"
          aria-label="ใส่รหัสลับ"
        >
          <form onSubmit={unlock}>
            <input
              ref={input}
              type="password"
              aria-label="รหัสลับ"
              placeholder=" "
              value={secret}
              onChange={event => setSecret(event.target.value)}
              autoComplete="off"
            />
            <span className="insertion"/>
            <small>
              {error || 'พิมพ์รหัสลับ แล้วกด Enter'}
              {attempt > 0 && ` · ${attempt}/3`}
            </small>
          </form>
        </div>
      )}

      {bubble && (
        <button
          className="bubble"
          aria-label="เปิด Admin panel"
          onClick={() => setMode('admin')}
        >✦</button>
      )}

      {mode === 'admin' && (
  <Admin
    data={data}
    configured={configured}
    onLogout={logoutAdmin}
    onClose={() => {
      setMode('');
      history.replaceState({}, '', '/');
    }}
  />
)}
    </>
  );
}

function Admin({data, configured, onClose, onLogout}) {
  const [draft, setDraft] = useState(structuredClone(data));
  const [user, setUser] = useState(null);
  const [allowed, setAllowed] = useState(false);
  const [tab, setTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState(-1);
  const [hotkey, setHotkey] = useState('Ctrl+Shift+K');
  const [code, setCode] = useState('');

  const [savedState, setSavedState] = useState(null);

const hasChanges = savedState !== null && (
  JSON.stringify({
    content: draft,
    shortcut: hotkey
  }) !== savedState ||
  code.length > 0
);

function cancelChanges() {
  if (!savedState || busy) return;

  const saved = JSON.parse(savedState);

  setDraft(structuredClone(saved.content));
  setHotkey(saved.shortcut);
  setCode('');
  setEdit(-1);
  setMessage('ยกเลิกการแก้ไขแล้ว');
}

  useEffect(() => auth?.onAuthStateChanged(async currentUser => {
    setUser(currentUser);
    if (currentUser) {
      try {
        const token = await currentUser.getIdToken();
        const result = await api('admin', null, token);
        setAllowed(true);

        const loadedContent = result.content || data;
        const loadedShortcut = result.shortcut || 'Ctrl+Shift+K';

        setDraft(structuredClone(loadedContent));
        setHotkey(loadedShortcut);

        setSavedState(JSON.stringify({
          content: loadedContent,
          shortcut: loadedShortcut
        }));

        setStats(result.stats);
      } catch (error) {
        setMessage(error.message);
      }
    } else {
      setAllowed(false);
    }
  }), []);

  useEffect(() => {
    if (!allowed) return;

    const interval = setInterval(async () => {
      try {
        const token = await auth.currentUser.getIdToken();
        const result = await api('admin', null, token);
        setStats(result.stats);
      } catch (error) {
        setMessage(error.message);
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [allowed]);

  async function login(event) {
    event.preventDefault();
    setBusy(true);
    setMessage('');

    try {
      const form = new FormData(event.target);

      await setPersistence(auth, browserLocalPersistence);

      await signInWithEmailAndPassword(
        auth,
        form.get('email'),
        form.get('password')
      );
    } catch {
      setMessage('เข้าสู่ระบบไม่สำเร็จ ตรวจสอบอีเมลและรหัสผ่าน');
    } finally {
      setBusy(false);
    }
  }

  async function save() {
  setBusy(true);
  setMessage('');

  try {
    const token = await auth.currentUser.getIdToken();

    const payload = {
      content: draft,
      shortcut: hotkey
    };

    // ส่งรหัสใหม่เฉพาะเมื่อกรอกช่องนี้
    // ถ้าเว้นว่าง เซิร์ฟเวอร์จะเก็บรหัสเดิมไว้
    if (code.length > 0) {
      payload.code = code;
    }

    await api('save', payload, token);

    location.replace('/');
  } catch (error) {
    setMessage(error.message);
    setBusy(false);
  }
}

  function updateProject(index, key, value) {
    setDraft(previous => ({
      ...previous,
      projects: previous.projects.map((project, current) =>
        current === index ? {...project, [key]: value} : project
      )
    }));
  }

  function moveProject(index, direction) {
    const projects = [...draft.projects];
    const target = index + direction;
    if (target < 0 || target >= projects.length) return;
    [projects[index], projects[target]] = [projects[target], projects[index]];
    setDraft({...draft, projects});
    setEdit(-1);
  }

  const field = (key, label, type = 'text') => (
    <label>
      {label}
      <input
        type={type}
        value={draft[key]}
        onChange={event => setDraft({...draft, [key]: event.target.value})}
      />
    </label>
  );

  const tabs = [
    ['dashboard', 'ภาพรวม / Dashboard'],
    ['projects', 'จัดการผลงาน'],
    ['appearance', 'เนื้อหาและการแสดงผล'],
    ['security', 'คีย์ลัดและรหัสลับ']
  ];

  const heading = {
    dashboard: 'ภาพรวม',
    projects: 'จัดการผลงาน',
    appearance: 'เนื้อหาและการแสดงผล',
    security: 'การเข้าถึงแอดมิน'
  };
  
  async function uploadCover(index, file) {
    if (!file) return;
  
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setMessage('รองรับ JPG, PNG และ WebP เท่านั้น');
      return;
    }
  
    if (file.size > 5 * 1024 * 1024) {
      setMessage('รูปต้องมีขนาดไม่เกิน 5 MB');
      return;
    }
  
    if (!auth?.currentUser) {
      setMessage('กรุณาเข้าสู่ระบบก่อนอัปโหลด');
      return;
    }
  
    const projectId = draft.projects[index].id;
  
    setBusy(true);
    setMessage('กำลังอัปโหลดรูป…');
  
    try {
      const token = await auth.currentUser.getIdToken();
    
      const permission = await api(
        'upload-signature',
        {},
        token
      );
    
      const form = new FormData();
    
      form.append('file', file);
      form.append('api_key', permission.apiKey);
      form.append('timestamp', String(permission.timestamp));
      form.append('folder', permission.folder);
      form.append('allowed_formats', permission.allowedFormats);
      form.append('signature', permission.signature);
    
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${permission.cloudName}/image/upload`,
        {
          method: 'POST',
          body: form
        }
      );
    
      const result = await response.json();
    
      if (!response.ok || !result.secure_url) {
        throw Error(
          result.error?.message || 'อัปโหลดรูปไม่สำเร็จ'
        );
      }
    
      setDraft(previous => ({
        ...previous,
        projects: previous.projects.map(project =>
          project.id === projectId
            ? {...project, cover: result.secure_url}
            : project
        )
      }));
    
      setMessage(
        'อัปโหลดแล้ว กดยืนยันและรีเฟรชเพื่อเผยแพร่ภาพปก'
      );
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }
  
  return (
    <div className="admin-shell">
      <aside>
        <a className="brand" href="/">✦ Gallery / Admin</a>
        <small>WORKSPACE</small>
        {tabs.map(([id, title]) => (
          <button
            className={tab === id ? 'active' : ''}
            onClick={() => setTab(id)}
            key={id}
          >{title}</button>
        ))}

      <div className="sidebar-bottom">
      {allowed && hasChanges && (
        <div className="sidebar-actions">
          <span className="unsaved-label">
            มีการแก้ไขที่ยังไม่ได้บันทึก
          </span>
          <button
            type="button"
            className="primary sidebar-save"
            disabled={busy}
            onClick={save}
          >
            {busy ? 'กำลังดำเนินการ…' : 'ยืนยันและรีเฟรช ↗'}
          </button>
          <button type="button" className="sidebar-cancel" disabled={busy} onClick={cancelChanges}>ยกเลิก</button>
        </div>
      )}
      <button type="button" className="sidebar-logout" disabled={busy} onClick={onLogout}>← ออกจากระบบ</button>
    </div>
      </aside>
      <div className="admin-main">
        <div className="section-heading">
          <div>
            <span className="eyebrow">PORTFOLIO MANAGEMENT</span>
            <h2>{heading[tab]}</h2>
          </div>
          <button onClick={onClose} aria-label="ปิดแอดมิน">×</button>
        </div>

        {message && <p role="alert" className="notice">{message}</p>}

        {!configured ? (
          <div className="panel">
            <h3>ตั้งค่า Firebase ก่อนใช้งานแอดมิน</h3>
            <p>เปิด README.md แล้วเพิ่ม Environment Variables ใน Vercel</p>
            <p>หน้าแสดงผลนี้ใช้ข้อมูลตัวอย่าง ยังไม่เก็บสถิติหรือบันทึกลงฐานข้อมูล</p>
          </div>
        ) : !allowed ? (
          <form className="panel login" onSubmit={login}>
            <h3>{user ? 'ตรวจสอบสิทธิ์ผู้ดูแล' : 'เข้าสู่ระบบผู้ดูแล'}</h3>
            <p>ครั้งแรก: ใช้อีเมลและรหัสผ่านที่สร้างใน Firebase Authentication</p>
            <label>อีเมล<input name="email" type="email" required/></label>
            <label>รหัสผ่าน<input name="password" type="password" required/></label>
            <button className="primary" disabled={busy}>เข้าสู่ระบบ</button>
          </form>
        ) : (
          <>
            {tab === 'dashboard' && (
              <>
                <div className="metrics">
                  {[
                    ['เข้าชมหน้าเว็บทั้งหมด', stats?.visits || 0],
                    ['ผู้เข้าชมไม่ซ้ำ', stats?.visitors || 0],
                    ['คลิกดูรายละเอียด', stats?.details || 0],
                    ['เปิดเว็บโปรเจกต์', stats?.opens || 0]
                  ].map(([title, count]) => (
                    <div className="panel" key={title}>
                      <small>{title}</small>
                      <strong>{count.toLocaleString()}</strong>
                      <span>ตั้งแต่เริ่มใช้งาน</span>
                    </div>
                  ))}
                </div>

                <div className="panel">
                  <h3>สถิติรายโปรเจกต์</h3>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>ผลงาน</th>
                          <th>รายละเอียด</th>
                          <th>เปิดเว็บ</th>
                          <th>ผู้ชมไม่ซ้ำ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {draft.projects.map(project => (
                          <tr key={project.id}>
                            <td>{project.title}</td>
                            <td>{stats?.projects?.[project.id]?.details || 0}</td>
                            <td>{stats?.projects?.[project.id]?.opens || 0}</td>
                            <td>{stats?.projects?.[project.id]?.visitors || 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <p className="muted">
                    รีเฟรชสถิติทุก 60 วินาที · ระบุผู้ชมด้วยรหัสเบราว์เซอร์นิรนาม
                    ไม่ทราบชื่อบุคคล
                  </p>

                  <h3>ผู้ชมล่าสุด</h3>                  
                  <div
                    className="visitors-scroll"
                    tabIndex={0}
                    role="region"
                    aria-label="รายชื่อผู้ชมล่าสุด เลื่อนเพื่อดูเพิ่มเติม"
                  >
                    {(stats?.recent || []).map(visitor => (
                      <div className="visitor" key={visitor.id}>
                        <code>{visitor.id.slice(0, 12)}</code>
                    
                        <span>{visitor.visits} ครั้ง</span>
                    
                        <span>
                          {new Date(visitor.lastSeen).toLocaleString('th-TH')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {tab === 'projects' && (
              <>
                <button className="primary" onClick={() => {
                  setDraft({
                    ...draft,
                    projects: [...draft.projects, {
                      id: crypto.randomUUID(),
                      title: 'โปรเจกต์ใหม่',
                      description: '',
                      category: 'Digital experience',
                      year: String(new Date().getFullYear()),
                      status: 'กำลังทำ',
                      url: '',
                      cover: '',
                      art: 'rings',
                      visible: true,
                      featured: true
                    }]
                  });
                  setEdit(draft.projects.length);
                }}>+ เพิ่มผลงาน</button>

                {draft.projects.map((project, index) => (
                  <div className="panel" key={project.id}>
                    <div className="section-heading">
                      <h3>{index + 1}. {project.title}</h3>
                      <div className="actions">
                        <button
                          disabled={index === 0}
                          onClick={() => moveProject(index, -1)}
                        >↑</button>
                        <button
                          disabled={index === draft.projects.length - 1}
                          onClick={() => moveProject(index, 1)}
                        >↓</button>
                        <button onClick={() => setEdit(
                          edit === index ? -1 : index
                        )}>แก้ไข</button>
                        <button onClick={() => {
                          if (confirm('ลบผลงานนี้?')) {
                            setDraft({
                              ...draft,
                              projects: draft.projects.filter(
                                item => item.id !== project.id
                              )
                            });
                            setEdit(-1);
                          }
                        }}>ลบ</button>
                      </div>
                    </div>

                    {edit === index && (
                      <div className="form-grid">
                      
                        <label>
                          ภาพปกผลงาน
                    
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            disabled={busy}
                            onChange={event => {
                              const file = event.target.files?.[0];
                              event.target.value = '';
                              uploadCover(index, file);
                            }}
                          />

                          <small>JPG, PNG หรือ WebP ขนาดไม่เกิน 5 MB</small>
                          
                          {project.cover && (
                            <>
                              <img
                                src={safeUrl(project.cover)}
                                alt="ตัวอย่างภาพปก"
                                style={{
                                  width: '100%',
                                  maxHeight: '220px',
                                  objectFit: 'cover',
                                  borderRadius: '12px'
                                }}
                              />

                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => updateProject(index, 'cover', '')}
                              >
                                เอาภาพปกออก
                              </button>
                            </>
                          )}
                        </label>
                        
                        {[
                          ['title', 'ชื่อผลงาน'],
                          ['description', 'รายละเอียด'],
                          ['category', 'หมวดหมู่'],
                          ['year', 'ปี'],
                          ['url', 'URL เว็บไซต์ (/projects/... หรือ https://...)'],
                        ].map(([key, label]) => (
                          <label key={key}>
                            {label}
                            <input
                              value={project[key]}
                              onChange={event => updateProject(
                                index, key, event.target.value
                              )}
                            />
                          </label>
                        ))}

                        {[
                          ['status', 'สถานะ', ['เสร็จแล้ว', 'กำลังทำ']],
                          ['art', 'ภาพกราฟิก', ['rings', 'poster', 'research']]
                        ].map(([key, label, options]) => (
                          <label key={key}>
                            {label}
                            <select
                              value={project[key]}
                              onChange={event => updateProject(
                                index, key, event.target.value
                              )}
                            >
                              {options.map(option => (
                                <option key={option}>{option}</option>
                              ))}
                            </select>
                          </label>
                        ))}

                        {[
                          ['visible', 'เผยแพร่'],
                          ['featured', 'แสดงในแกลเลอรี']
                        ].map(([key, label]) => (
                          <label key={key} className="check">
                            <input
                              type="checkbox"
                              checked={project[key]}
                              onChange={event => updateProject(
                                index, key, event.target.checked
                              )}
                            />
                            {label}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}

            {tab === 'appearance' && (
              <div className="panel form-grid">
                {field('brand', 'ชื่อแบรนด์')}
                {field('headline', 'หัวเรื่อง')}
                {field('accentLine', 'หัวเรื่องตัวเอียง')}
                {field('intro', 'คำเกริ่น')}
                {field('about', 'เกี่ยวกับ')}
                {field('email', 'อีเมลติดต่อ', 'email')}
                {field('accent', 'สีหลัก', 'color')}

                <label>
                  รูปแบบแกลเลอรี
                  <select
                    value={draft.layout}
                    onChange={event => setDraft({
                      ...draft, layout: event.target.value
                    })}
                  >
                    <option value="mosaic">โมเสก</option>
                    <option value="grid">กริด</option>
                    <option value="list">รายการ</option>
                  </select>
                </label>

                {[
                  ['radius', 'ความโค้งมุม', 0, 48],
                  ['gap', 'ระยะห่าง', 8, 48]
                ].map(([key, title, min, max]) => (
                  <label key={key}>
                    {title} · {draft[key]}px
                    <input
                      type="range"
                      min={min}
                      max={max}
                      value={draft[key]}
                      onChange={event => setDraft({
                        ...draft, [key]: Number(event.target.value)
                      })}
                    />
                  </label>
                ))}
              </div>
            )}

            {tab === 'security' && (
              <div className="panel login">
                <h3>ตั้งค่าวิธีเปิด Popup bubble</h3>
                <label>
                  คลิกช่องนี้แล้วกดคีย์ลัด (Ctrl/Alt/Meta + ตัวอักษร)
                  <input
                    readOnly
                    value={hotkey}
                    onKeyDown={event => {
                      event.preventDefault();

                      if (
                        (event.ctrlKey || event.altKey || event.metaKey) &&
                        /^[a-z0-9]$/i.test(event.key)
                      ) {
                        setHotkey([
                          event.ctrlKey ? 'Ctrl' : '',
                          event.altKey ? 'Alt' : '',
                          event.shiftKey ? 'Shift' : '',
                          event.metaKey ? 'Meta' : '',
                          event.key.toUpperCase()
                        ].filter(Boolean).join('+'));
                      }
                    }}
                  />
                </label>

                <label>
                  เปลี่ยนรหัสลับ — เว้นว่างเพื่อใช้รหัสเดิม
                  <input
                    type="password"
                    minLength={8}
                    value={code}
                    placeholder="กรอกเฉพาะเมื่อต้องการเปลี่ยนรหัส"
                    onChange={event => setCode(event.target.value)}
                    autoComplete="new-password"
                  />
                </label>

                <p>
                  ครั้งแรกต้องตั้งรหัสลับก่อนกดยืนยัน ครั้งถัดไปเว้นว่างเพื่อใช้รหัสเดิม
                  หลังบันทึกจะรีเฟรชและออกจากแอดมิน
                  กดคีย์ลัด → พิมพ์รหัส → Enter → กด bubble → เข้าสู่ระบบผู้ดูแล
                </p>
                <p>
                  พิมพ์ผิด 3 ครั้งจะปิดหน้ารหัส และจำกัดการลองจากเซิร์ฟเวอร์
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App/>);
