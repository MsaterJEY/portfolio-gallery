export const QUESTION_TYPES = {
    text: 'ข้อความสั้น',
    textarea: 'ข้อความยาว',
    email: 'อีเมล',
    number: 'ตัวเลข',
    date: 'วันที่',
    radio: 'เลือกคำตอบเดียว',
    checkbox: 'เลือกได้หลายคำตอบ',
    select: 'รายการแบบเลื่อนเลือก'
};

const choiceTypes = new Set(['radio', 'checkbox', 'select']);
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const validFormId = value =>
    typeof value === 'string' &&
    /^[a-zA-Z0-9_-]{1,80}$/.test(value) &&
    !['__proto__', 'constructor', 'prototype'].includes(value);

export const validSlug = value =>
    typeof value === 'string' &&
    value !== 'admin' &&
    value.length <= 80 &&
    slugPattern.test(value);

export const hasChoices = type => choiceTypes.has(type);

function requireText(value, name, max, required = false) {
    if (
        typeof value !== 'string' ||
        value.length > max ||
        (required && !value.trim())
    ) {
        throw Error(name + 'ไม่ถูกต้อง');
    }

    return value.trim();
}

export function validateForm(input) {
    if (
        !input ||
        typeof input !== 'object' ||
        !validFormId(input.id) ||
        !validSlug(input.slug)
    ) {
        throw Error(
            'รหัสฟอร์มหรือลิงก์ไม่ถูกต้อง ใช้อักษรอังกฤษเล็ก ตัวเลข และขีดกลาง'
        );
    }

    if (!['draft', 'published', 'closed'].includes(input.status)) {
        throw Error('สถานะฟอร์มไม่ถูกต้อง');
    }

    if (
        !Array.isArray(input.questions) ||
        input.questions.length < 1 ||
        input.questions.length > 50
    ) {
        throw Error('ฟอร์มต้องมีคำถาม 1–50 ข้อ');
    }

    const startsAt = input.startsAt ?? null;
    const endsAt = input.endsAt ?? null;

    for (const value of [startsAt, endsAt]) {
        if (
            value !== null &&
            (
                !Number.isSafeInteger(value) ||
                value < 0 ||
                value > 8640000000000000
            )
        ) {
            throw Error('วันเวลาเปิดรับไม่ถูกต้อง');
        }
    }

    if (
        startsAt !== null &&
        endsAt !== null &&
        endsAt <= startsAt
    ) {
        throw Error('วันปิดต้องอยู่หลังวันเปิด');
    }

    const ids = new Set();

    const questions = input.questions.map(question => {
        if (
            !question ||
            !validFormId(question.id) ||
            ids.has(question.id) ||
            !Object.hasOwn(QUESTION_TYPES, question.type) ||
            typeof question.required !== 'boolean'
        ) {
            throw Error('คำถามซ้ำหรือประเภทคำถามไม่ถูกต้อง');
        }

        ids.add(question.id);

        const result = {
            id: question.id,
            type: question.type,
            required: question.required,
            label: requireText(question.label, 'หัวข้อคำถาม', 300, true)
        };

        if (hasChoices(question.type)) {
            if (
                !Array.isArray(question.options) ||
                question.options.length < 1 ||
                question.options.length > 50
            ) {
                throw Error('คำถามแบบเลือกตอบต้องมี 1–50 ตัวเลือก');
            }

            result.options = question.options.map(option =>
                requireText(option, 'ตัวเลือก', 200, true)
            );

            if (new Set(result.options).size !== result.options.length) {
                throw Error('ตัวเลือกต้องไม่ซ้ำกัน');
            }
        }

        return result;
    });

    return {
        id: input.id,
        slug: input.slug,
        status: input.status,
        startsAt,
        endsAt,
        title: requireText(input.title, 'ชื่อฟอร์ม', 200, true),
        description: requireText(input.description, 'คำอธิบาย', 5000),
        successMessage: requireText(
            input.successMessage,
            'ข้อความหลังส่ง',
            2000,
            true
        ),
        questions
    };
}

export function isFormOpen(form, now = Date.now()) {
    return (
        form.status === 'published' &&
        (form.startsAt === null || now >= form.startsAt) &&
        (form.endsAt === null || now < form.endsAt)
    );
}

export function validateAnswers(form, input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
        throw Error('คำตอบไม่ถูกต้อง');
    }

    const known = new Set(form.questions.map(question => question.id));

    if (Object.keys(input).some(id => !known.has(id))) {
        throw Error('พบคำตอบที่ไม่อยู่ในฟอร์ม');
    }

    const answers = {};

    for (const question of form.questions) {
        const value = input[question.id];

        const missing =
            value === undefined ||
            value === '' ||
            (Array.isArray(value) && value.length === 0);

        if (missing) {
            if (question.required) {
                throw Error('กรุณาตอบ ' + question.label);
            }

            answers[question.id] = question.type === 'checkbox' ? [] : '';
            continue;
        }

        if (question.type === 'checkbox') {
            if (
                !Array.isArray(value) ||
                value.length > question.options.length ||
                new Set(value).size !== value.length ||
                value.some(option =>
                    typeof option !== 'string' ||
                    !question.options.includes(option)
                )
            ) {
                throw Error('ตัวเลือกไม่ถูกต้องใน ' + question.label);
            }

            answers[question.id] = [...value];
            continue;
        }

        if (
            typeof value !== 'string' ||
            value.length > (question.type === 'textarea' ? 10000 : 1000) ||
            !value.trim()
        ) {
            throw Error('คำตอบไม่ถูกต้องใน ' + question.label);
        }

        if (
            hasChoices(question.type) &&
            !question.options.includes(value)
        ) {
            throw Error('ตัวเลือกไม่ถูกต้อง');
        }

        if (
            question.type === 'number' &&
            !Number.isFinite(Number(value))
        ) {
            throw Error('กรุณากรอกตัวเลข');
        }

        if (
            question.type === 'email' &&
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
        ) {
            throw Error('อีเมลไม่ถูกต้อง');
        }

        if (
            question.type === 'date' &&
            (
                !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
                !Number.isFinite(Date.parse(value)) ||
                new Date(value).toISOString().slice(0, 10) !== value
            )
        ) {
            throw Error('วันที่ไม่ถูกต้อง');
        }

        answers[question.id] = value;
    }

    return answers;
}

export function csvCell(value) {
    const text = Array.isArray(value)
        ? value.join(' | ')
        : String(value ?? '');

    const safe = /^[\s]*[=+\-@\t\r]/.test(text)
        ? "'" + text
        : text;

    return '"' + safe.replace(/"/g, '""') + '"';
}

export function responsesCsv(responses) {
    const columns = new Map();

    for (const response of responses) {
        for (const question of response.questions) {
            columns.set(question.id + ':' + question.label, question);
        }
    }

    const questions = [...columns.values()];

    const rows = [[
        'รหัสคำตอบ',
        'เวลาส่ง (ISO)',
        'ชื่อฟอร์ม',
        'รุ่นฟอร์ม',
        ...questions.map(question => question.label)
    ]];

    for (const response of responses) {
        rows.push([
            response.id,
            new Date(response.submittedAt).toISOString(),
            response.formTitle,
            response.revision,
            ...questions.map(question =>
                response.questions.some(item =>
                    item.id === question.id &&
                    item.label === question.label
                )
                    ? response.answers[question.id]
                    : ''
            )
        ]);
    }

    return '\uFEFF' +
        rows.map(row => row.map(csvCell).join(',')).join('\r\n');
}