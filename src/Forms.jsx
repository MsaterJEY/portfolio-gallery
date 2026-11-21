import React, {useEffect, useRef, useState} from 'react';
import {
  QUESTION_TYPES,
  hasChoices,
  validateForm,
  validateAnswers,
  responsesCsv
} from '../lib/forms';
import './forms.css';

const statuses = {
  draft: 'ฉบับร่าง',
  published: 'เผยแพร่',
  closed: 'ปิดรับ'
};

const dateText = value =>
  new Date(value).toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok'
  });

const timeInput = value =>
  value === null
    ? ''
    : new Date(value + 25200000).toISOString().slice(0, 16);

function timeValue(value) {
  if (!value) return null;

  const separator = value.indexOf('-');
  const enteredYear = Number(value.slice(0, separator));

  const year =
    enteredYear >= 2400 && enteredYear <= 2999
      ? enteredYear - 543
      : enteredYear;

  const normalized =
    String(year).padStart(4, '0') +
    value.slice(separator);

  return Date.parse(normalized + ':00+07:00');
}

function Field({
  label, value, onChange, multiline, options, ...props
}) {
  const dateInput = useRef(null);

  const isDate = ['date', 'datetime-local'].includes(props.type);

  const input = {
    value,
    onChange: event => onChange(event.target.value),
    ...props
  };

  const choices = Array.isArray(options)
    ? options
    : Object.entries(options || {});

  function openCalendar() {
    const element = dateInput.current;

    if (!element || element.disabled) return;

    element.focus();

    try {
      element.showPicker?.();
    } catch {
      element.focus();
    }
  }

  return (
    <label>
      <span>{label}</span>

      {multiline ? (
        <textarea {...input} rows={3}/>
      ) : options ? (
        <select {...input}>
          {choices.map(([id, text]) => (
            <option key={id} value={id}>
              {text}
            </option>
          ))}
        </select>
      ) : isDate ? (
        <div className="fm-date-control">
          <input {...input} ref={dateInput}/>

          <button
            type="button"
            disabled={props.disabled}
            aria-label={'เลือกวันที่ ' + label}
            onClick={openCalendar}
          >
            เลือกจากปฏิทิน
          </button>
        </div>
      ) : (
        <input {...input}/>
      )}
    </label>
  );
}

function Questions({form, answers, setAnswers}) {
  function change(question, value) {
    setAnswers(previous => ({
      ...previous,
      [question.id]: value
    }));
  }

  return form.questions.map(question => {
    const label =
      question.label + (question.required ? ' *' : '');

    if (['radio', 'checkbox'].includes(question.type)) {
      return (
        <fieldset className="fm-question" key={question.id}>
          <legend>{label}</legend>

          {question.options.map(option => (
            <label className="fm-choice" key={option}>
              <input
                type={question.type}
                name={question.id}
                checked={
                  question.type === 'checkbox'
                    ? (answers[question.id] || []).includes(option)
                    : answers[question.id] === option
                }
                onChange={event => {
                  if (question.type === 'radio') {
                    change(question, option);
                    return;
                  }

                  const selected = answers[question.id] || [];

                  change(
                    question,
                    event.target.checked
                      ? [...selected, option]
                      : selected.filter(item => item !== option)
                  );
                }}
              />

              {option}
            </label>
          ))}
        </fieldset>
      );
    }

    const options = question.type === 'select'
      ? [
          ['', 'เลือกคำตอบ'],
          ...question.options.map(option => [option, option])
        ]
      : undefined;

    return (
      <div className="fm-question" key={question.id}>
        <Field
          label={label}
          value={answers[question.id] || ''}
          onChange={value => change(question, value)}
          type={
            question.type === 'textarea'
              ? 'text'
              : question.type
          }
          multiline={question.type === 'textarea'}
          options={options}
          required={question.required}
          step={question.type === 'number' ? 'any' : undefined}
          maxLength={
            question.type === 'textarea' ? 10000 : 1000
          }
        />
      </div>
    );
  });
}

export function PublicForms({api}) {
  const slug = location.pathname
    .replace(/\/+$/, '')
    .split('/')[2];

  const [data, setData] = useState(null);
  const [answers, setAnswers] = useState({});
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState(null);
  const [busy, setBusy] = useState(false);

  const lock = useRef(false);
  const requestId = useRef(crypto.randomUUID());

  useEffect(() => {
    let active = true;

    api('forms' + (slug ? '/' + encodeURIComponent(slug) : ''))
      .then(result => {
        if (active) setData(result);
      })
      .catch(exception => {
        if (active) setError(exception.message);
      });

    return () => {
      active = false;
    };
  }, [slug]);

  async function submit(event) {
    event.preventDefault();

    if (lock.current) return;

    lock.current = true;
    setBusy(true);
    setError('');

    try {
      const clean = validateAnswers(data.form, answers);

      const result = await api(
        'forms/' + data.form.slug + '/submit',
        {
          answers: clean,
          revision: data.form.revision,
          requestId: requestId.current
        }
      );

      setReceipt(result);
    } catch (exception) {
      setError(exception.message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="fm-page fm-root">
      <div className="fm-top">
        <a href="/">กลับ Portfolio</a>
        <a href="/forms">แบบฟอร์มทั้งหมด</a>
      </div>

      <main className="fm-public">
        {receipt ? (
          <section className="fm-card" role="status">
            <h1>ส่งคำตอบสำเร็จ</h1>
            <p>{receipt.successMessage}</p>
            <p>รหัสคำตอบ {receipt.id}</p>
          </section>
        ) : data?.form ? (
          <>
            <h1>{data.form.title}</h1>
            <p>{data.form.description}</p>

            {data.form.endsAt !== null && (
              <p>
                ปิดรับ {dateText(data.form.endsAt)} น.
                {' '}(เวลาประเทศไทย)
              </p>
            )}

            <p>* หมายถึงคำถามที่จำเป็น</p>

            <form className="fm-card" onSubmit={submit}>
              <fieldset className="fm-fields" disabled={busy}>
                <Questions
                  form={data.form}
                  answers={answers}
                  setAnswers={setAnswers}
                />

                <button className="primary">
                  {busy ? 'กำลังส่ง…' : 'ส่งคำตอบ'}
                </button>
              </fieldset>
            </form>
          </>
        ) : (
          <>
            <h1>แบบฟอร์ม</h1>

            {!data && !error && (
              <p role="status">กำลังโหลด…</p>
            )}

            {data?.forms.map(form => (
              <a
                className="fm-card"
                key={form.id}
                href={'/forms/' + form.slug}
              >
                <h2>{form.title}</h2>
                <p>{form.description}</p>
                <span>เปิดกรอกฟอร์ม</span>
              </a>
            ))}

            {data?.forms.length === 0 && (
              <p>ขณะนี้ยังไม่มีฟอร์มที่เปิดรับคำตอบ</p>
            )}
          </>
        )}

        {error && (
          <p className="fm-error" role="alert">{error}</p>
        )}
      </main>
    </div>
  );
}

export default function FormsManager({api}) {
  const [forms, setForms] = useState([]);
  const [editor, setEditor] = useState(null);
  const [view, setView] = useState(null);
  const [responses, setResponses] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [preview, setPreview] = useState(false);
  const [answers, setAnswers] = useState({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const lock = useRef(false);
  const dragged = useRef(null);

  async function run(operation) {
    if (lock.current) return;

    lock.current = true;
    setBusy(true);
    setMessage('');

    try {
      await operation();
    } catch (exception) {
      setMessage(exception.message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  useEffect(() => {
    run(async () => {
      setForms((await api('forms/admin')).forms);
    });
  }, []);

  function change(key, value) {
    setEditor(previous => ({
      ...previous,
      [key]: value
    }));
  }

  function changeQuestion(id, values) {
    change(
      'questions',
      editor.questions.map(question =>
        question.id === id
          ? {...question, ...values}
          : question
      )
    );
  }

  function move(source, target) {
    const questions = [...editor.questions];

    const from = questions.findIndex(
      question => question.id === source
    );

    const to = questions.findIndex(
      question => question.id === target
    );

    if (from < 0 || to < 0 || from === to) return;

    questions.splice(to, 0, questions.splice(from, 1)[0]);
    change('questions', questions);
  }

  function create() {
    setEditor({
      id: crypto.randomUUID(),
      slug: '',
      title: '',
      description: '',
      successMessage: 'ขอบคุณสำหรับคำตอบ',
      revision: 0,
      status: 'draft',
      startsAt: null,
      endsAt: null,
      questions: []
    });

    setPreview(false);
    setMessage('');
  }

  async function open(form) {
    await run(async () => {
      const result = await api('forms/admin/' + form.id);
      setEditor(result.form);
      setPreview(false);
    });
  }

  function back() {
    if (
      editor &&
      !window.confirm(
        'กลับรายการฟอร์ม? กรุณาบันทึกการแก้ไขก่อนออก'
      )
    ) {
      return;
    }

    setEditor(null);
    setView(null);
    setMessage('');
  }

  async function save(event) {
    event.preventDefault();

    await run(async () => {
      const result = await api('forms/admin/save', {
        form: validateForm(editor),
        baseRevision: editor.revision
      });

      setEditor(result.form);

      setForms(previous => [
        result.form,
        ...previous.filter(form => form.id !== result.form.id)
      ]);

      setMessage('บันทึกฟอร์มแล้ว');
    });
  }

  async function loadResponses(form, next = null) {
    await run(async () => {
      const result = await api(
        'forms/admin/' + form.id + '/responses' +
        (next ? '?cursor=' + encodeURIComponent(next) : '')
      );

      setView(form);

      setResponses(previous =>
        next
          ? [...previous, ...result.responses]
          : result.responses
      );

      setCursor(result.nextCursor);
    });
  }

  async function exportCsv() {
    await run(async () => {
      const all = [];
      let next = null;

      do {
        const result = await api(
          'forms/admin/' + view.id + '/responses' +
          (next ? '?cursor=' + encodeURIComponent(next) : '')
        );

        all.push(...result.responses);
        next = result.nextCursor;
      } while (next);

      const url = URL.createObjectURL(
        new Blob([responsesCsv(all)], {
          type: 'text/csv;charset=utf-8'
        })
      );

      const link = document.createElement('a');
      link.href = url;
      link.download = view.slug + '-responses.csv';
      link.click();

      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage('ส่งออกแล้ว ' + all.length + ' คำตอบ');
    });
  }

  return (
    <div className="fm-root">
      {message && (
        <p role="status" className="fm-notice">{message}</p>
      )}

      {busy && (
        <p role="status">กำลังดำเนินการ…</p>
      )}

      <fieldset className="fm-fields" disabled={busy}>
        {editor ? (
          <>
            <div className="fm-toolbar">
              <button type="button" onClick={back}>
                กลับรายการฟอร์ม
              </button>

              <button
                type="button"
                onClick={() => {
                  setPreview(!preview);
                  setAnswers({});
                }}
              >
                {preview ? 'กลับแก้ไข' : 'ดูตัวอย่าง'}
              </button>
            </div>

            {preview ? (
              <section className="fm-card">
                <h2>{editor.title || 'ชื่อฟอร์ม'}</h2>
                <p>{editor.description}</p>

                <Questions
                  form={editor}
                  answers={answers}
                  setAnswers={setAnswers}
                />

                <p>ตัวอย่างฟอร์ม</p>
              </section>
            ) : (
              <form onSubmit={save}>
                <div className="fm-card fm-grid">
                  <Field
                    label="ชื่อฟอร์ม"
                    value={editor.title}
                    onChange={value => change('title', value)}
                    required
                    maxLength={200}
                  />

                  <Field
                    label="ลิงก์ฟอร์ม เช่น event-registration"
                    value={editor.slug}
                    onChange={value => change('slug', value)}
                    required
                    maxLength={80}
                    pattern="[a-z0-9]+(-[a-z0-9]+)*"
                    disabled={editor.revision > 0}
                  />

                  <Field
                    label="คำอธิบาย"
                    value={editor.description}
                    onChange={value => change('description', value)}
                    multiline
                    maxLength={5000}
                  />

                  <Field
                    label="ข้อความหลังส่งสำเร็จ"
                    value={editor.successMessage}
                    onChange={value =>
                      change('successMessage', value)
                    }
                    multiline
                    required
                    maxLength={2000}
                  />

                  <Field
                    label="สถานะ"
                    value={editor.status}
                    onChange={value => change('status', value)}
                    options={statuses}
                  />

                  <div>
                    <p>/forms/{editor.slug || 'ชื่อฟอร์ม'}</p>
                    <small>กำหนดลิงก์ก่อนบันทึกครั้งแรก</small>
                  </div>

                  <Field
                    label="เริ่มรับ (เวลาประเทศไทย)"
                    type="datetime-local"
                    value={timeInput(editor.startsAt)}
                    onChange={value =>
                      change('startsAt', timeValue(value))
                    }
                  />

                  <Field
                    label="สิ้นสุด (เวลาประเทศไทย)"
                    type="datetime-local"
                    value={timeInput(editor.endsAt)}
                    onChange={value =>
                      change('endsAt', timeValue(value))
                    }
                  />
                </div>

                <h3>คำถาม {editor.questions.length}/50</h3>

                {editor.questions.map((question, index) => (
                  <section
                    className="fm-card"
                    key={question.id}
                    onDragOver={event => event.preventDefault()}
                    onDrop={event => {
                      event.preventDefault();
                      move(dragged.current, question.id);
                      dragged.current = null;
                    }}
                  >
                    <div className="fm-toolbar">
                      <span
                        draggable
                        onDragStart={() => {
                          dragged.current = question.id;
                        }}
                        onDragEnd={() => {
                          dragged.current = null;
                        }}
                      >
                        ลากย้ายคำถาม {index + 1}
                      </span>

                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() =>
                          move(
                            question.id,
                            editor.questions[index - 1]?.id
                          )
                        }
                      >
                        ขึ้น
                      </button>

                      <button
                        type="button"
                        disabled={
                          index === editor.questions.length - 1
                        }
                        onClick={() =>
                          move(
                            question.id,
                            editor.questions[index + 1]?.id
                          )
                        }
                      >
                        ลง
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          change(
                            'questions',
                            editor.questions.filter(
                              item => item.id !== question.id
                            )
                          )
                        }
                      >
                        นำคำถามออก
                      </button>
                    </div>

                    <div className="fm-grid">
                      <Field
                        label={'หัวข้อคำถาม ' + (index + 1)}
                        value={question.label}
                        required
                        maxLength={300}
                        onChange={value =>
                          changeQuestion(
                            question.id,
                            {label: value}
                          )
                        }
                      />

                      <Field
                        label="ประเภทคำตอบ"
                        value={question.type}
                        options={QUESTION_TYPES}
                        onChange={value =>
                          changeQuestion(question.id, {
                            type: value,
                            options: question.options || [
                              'ตัวเลือก 1',
                              'ตัวเลือก 2'
                            ]
                          })
                        }
                      />
                    </div>

                    <label className="fm-choice">
                      <input
                        type="checkbox"
                        checked={question.required}
                        onChange={event =>
                          changeQuestion(question.id, {
                            required: event.target.checked
                          })
                        }
                      />

                      จำเป็นต้องตอบ
                    </label>

                    {hasChoices(question.type) && (
                      <Field
                        label="ตัวเลือก (หนึ่งตัวเลือกต่อบรรทัด)"
                        multiline
                        required
                        value={question.options.join('\n')}
                        onChange={value =>
                          changeQuestion(question.id, {
                            options: value.split('\n')
                          })
                        }
                      />
                    )}
                  </section>
                ))}

                <div className="fm-toolbar">
                  <button
                    type="button"
                    disabled={editor.questions.length >= 50}
                    onClick={() =>
                      change('questions', [
                        ...editor.questions,
                        {
                          id: crypto.randomUUID(),
                          label: '',
                          type: 'text',
                          required: false
                        }
                      ])
                    }
                  >
                    เพิ่มคำถาม
                  </button>

                  <button className="primary" type="submit">
                    บันทึกฟอร์ม
                  </button>
                </div>
              </form>
            )}
          </>
        ) : view ? (
          <>
            <div className="fm-toolbar">
              <button onClick={back}>กลับรายการฟอร์ม</button>

              <button onClick={exportCsv}>
                ส่งออก CSV ทั้งหมด
              </button>

              <button onClick={() => loadResponses(view)}>
                รีเฟรชคำตอบ
              </button>
            </div>

            <h3>{view.title}</h3>
            <p>โหลดแล้ว {responses.length} คำตอบ</p>

            {responses.map(response => (
              <details className="fm-card" key={response.id}>
                <summary>
                  {dateText(response.submittedAt)}
                  {' '}· รุ่น {response.revision}
                  {' '}· {response.id}
                </summary>

                <p>{response.formTitle}</p>

                <dl>
                  {response.questions.map(question => (
                    <div key={question.id}>
                      <dt>{question.label}</dt>

                      <dd>
                        {Array.isArray(
                          response.answers[question.id]
                        )
                          ? response.answers[question.id]
                              .join(', ') || 'เว้นว่าง'
                          : response.answers[question.id] ||
                            'เว้นว่าง'}
                      </dd>
                    </div>
                  ))}
                </dl>
              </details>
            ))}

            {!responses.length && <p>ยังไม่มีคำตอบ</p>}

            {cursor && (
              <button
                onClick={() => loadResponses(view, cursor)}
              >
                โหลดคำตอบเพิ่ม
              </button>
            )}
          </>
        ) : (
          <>
            <div className="fm-toolbar">
              <button
                className="primary"
                onClick={create}
                disabled={forms.length >= 100}
              >
                สร้างฟอร์ม
              </button>

              <a
                href="/forms"
                target="_blank"
                rel="noreferrer"
              >
                เปิดหน้ารวมฟอร์ม
              </a>
            </div>

            {!busy && forms.length === 0 && (
              <p>ยังไม่มีฟอร์ม</p>
            )}

            {forms.map(form => (
              <section className="fm-card" key={form.id}>
                <h3>{form.title}</h3>

                <p>
                  {statuses[form.status]}
                  {' '}· {form.questionCount} คำถาม
                </p>

                <p>/forms/{form.slug}</p>

                <div className="fm-toolbar">
                  <button onClick={() => open(form)}>
                    แก้ไขฟอร์ม
                  </button>

                  <button onClick={() => loadResponses(form)}>
                    ดูคำตอบ
                  </button>

                  <button
                    onClick={() =>
                      run(async () => {
                        await navigator.clipboard.writeText(
                          location.origin + '/forms/' + form.slug
                        );

                        setMessage('คัดลอกลิงก์แล้ว');
                      })
                    }
                  >
                    คัดลอกลิงก์
                  </button>
                </div>
              </section>
            ))}
          </>
        )}
      </fieldset>
    </div>
  );
}