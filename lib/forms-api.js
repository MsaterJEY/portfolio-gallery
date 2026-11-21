import {
    validateForm,
    validateAnswers,
    validFormId,
    validSlug,
    isFormOpen
} from './forms.js';

function invalid(message, status = 400) {
    throw Object.assign(Error(message), { status });
}

export async function handleForms({
    req, res, db, body, path, admin, limit
}) {
    if (path !== 'forms' && !path.startsWith('forms/')) {
        return false;
    }

    const parts = path.split('/');
    const method = req.method;

    if (parts[1] === 'admin') {
        await admin();

        if (parts.length === 2 && method === 'GET') {
            const snapshot = await db
                .collection('forms')
                .where('status', 'in', ['draft', 'published', 'closed'])
                .select(
                    'id', 'slug', 'title', 'status',
                    'revision', 'updatedAt', 'questionCount'
                )
                .limit(100)
                .get();

            const forms = snapshot.docs.map(doc => doc.data());
            forms.sort((a, b) => b.updatedAt - a.updatedAt);
            res.json({ forms });
            return true;
        }

        if (
            parts.length === 3 &&
            validFormId(parts[2]) &&
            method === 'GET'
        ) {
            const snapshot = await db.doc('forms/' + parts[2]).get();

            if (
                !snapshot.exists ||
                snapshot.data().status === 'deleted'
            ) {
                invalid('ไม่พบฟอร์ม', 404);
            }

            res.json({ form: snapshot.data() });
            return true;
        }

        if (
            parts.length === 3 &&
            parts[2] === 'delete' &&
            method === 'POST'
        ) {
            if (
                !validFormId(body.id) ||
                !Number.isSafeInteger(body.baseRevision) ||
                body.baseRevision < 1
            ) {
                invalid('ข้อมูลการลบฟอร์มไม่ถูกต้อง');
            }

            if (!(await limit('form-delete', 20, 60000))) {
                invalid('ดำเนินการบ่อยเกินไป กรุณารอสักครู่', 429);
            }

            await db.runTransaction(async transaction => {
                const ref = db.doc('forms/' + body.id);
                const registryRef = db.doc('formsMeta/registry');

                const [snapshot, registry] = await Promise.all([
                    transaction.get(ref),
                    transaction.get(registryRef)
                ]);

                if (!snapshot.exists) {
                    invalid('ไม่พบฟอร์ม', 404);
                }

                const current = snapshot.data();

                if (current.status === 'deleted') return;

                if (current.revision !== body.baseRevision) {
                    invalid(
                        'ฟอร์มถูกแก้ไขจากที่อื่น กรุณาโหลดรายการใหม่ก่อนลบ',
                        409
                    );
                }

                const now = Date.now();

                transaction.set(ref, {
                    ...current,
                    status: 'deleted',
                    deletedAt: now,
                    updatedAt: now,
                    revision: current.revision + 1
                });

                transaction.set(registryRef, {
                    ids: (registry.data()?.ids || [])
                        .filter(id => id !== body.id)
                });
            });

            res.json({ ok: true });
            return true;
        }

        if (
            parts[2] === 'save' &&
            parts.length === 3 &&
            method === 'POST'
        ) {
            if (!(await limit('form-save', 60, 60000))) {
                invalid('บันทึกบ่อยเกินไป กรุณารอสักครู่', 429);
            }

            let form;

            try {
                form = validateForm(body.form);
            } catch (error) {
                invalid(error.message);
            }

            if (
                !Number.isSafeInteger(body.baseRevision) ||
                body.baseRevision < 0
            ) {
                invalid('รุ่นฟอร์มไม่ถูกต้อง');
            }

            const result = await db.runTransaction(async transaction => {
                const ref = db.doc('forms/' + form.id);
                const slugRef = db.doc('formSlugs/' + form.slug);
                const registryRef = db.doc('formsMeta/registry');

                const [current, slug, registry] = await Promise.all([
                    transaction.get(ref),
                    transaction.get(slugRef),
                    transaction.get(registryRef)
                ]);

                const previous = current.data();

                if (previous?.status === 'deleted') {
                    invalid(
                        'ฟอร์มนี้ถูกลบแล้ว กรุณากลับรายการฟอร์ม',
                        410
                    );
                }

                if ((previous?.revision || 0) !== body.baseRevision) {
                    invalid(
                        'ฟอร์มถูกแก้ไขจากที่อื่น กรุณากลับไปรายการแล้วเปิดใหม่',
                        409
                    );
                }

                if (previous && previous.slug !== form.slug) {
                    invalid('ลิงก์ฟอร์มเปลี่ยนได้ก่อนบันทึกครั้งแรก');
                }

                if (slug.exists && slug.data().id !== form.id) {
                    invalid('ลิงก์ฟอร์มนี้ถูกใช้แล้ว', 409);
                }

                const ids = registry.data()?.ids || [];

                if (!current.exists && ids.length >= 100) {
                    invalid('สร้างได้สูงสุด 100 ฟอร์ม');
                }

                const saved = {
                    ...form,
                    questionCount: form.questions.length,
                    revision: body.baseRevision + 1,
                    createdAt: previous?.createdAt ?? Date.now(),
                    updatedAt: Date.now()
                };

                transaction.set(ref, saved);
                transaction.set(slugRef, { id: form.id });

                if (!current.exists) {
                    transaction.set(registryRef, { ids: [...ids, form.id] });
                }

                return saved;
            });

            res.json({ form: result });
            return true;
        }

        if (
            parts.length === 4 &&
            validFormId(parts[2]) &&
            parts[3] === 'responses' &&
            method === 'GET'
        ) {
            const formRef = db.doc('forms/' + parts[2]);
            const form = await formRef.get();

            if (!form.exists) {
                invalid('ไม่พบฟอร์ม', 404);
            }

            const params = new URL(req.url, 'http://localhost').searchParams;
            const cursor = params.get('cursor');

            let query = formRef
                .collection('responses')
                .orderBy('submittedAt', 'desc');

            if (cursor) {
                if (!validFormId(cursor)) {
                    invalid('ตำแหน่งหน้าไม่ถูกต้อง');
                }

                const last = await formRef
                    .collection('responses')
                    .doc(cursor)
                    .get();

                if (!last.exists) {
                    invalid('ตำแหน่งหน้าไม่ถูกต้อง');
                }

                query = query.startAfter(last);
            }

            const snapshot = await query.limit(11).get();
            const docs = snapshot.docs.slice(0, 10);

            res.json({
                responses: docs.map(doc => ({ ...doc.data(), id: doc.id })),
                nextCursor: snapshot.docs.length > 10
                    ? docs.at(-1).id
                    : null
            });

            return true;
        }

        invalid('ไม่พบ API ฟอร์ม', 404);
    }

    if (path === 'forms' && method === 'GET') {
        const snapshot = await db
            .collection('forms')
            .where('status', '==', 'published')
            .select(
                'id', 'slug', 'title', 'description',
                'endsAt', 'startsAt', 'status'
            )
            .limit(100)
            .get();

        const forms = snapshot.docs
            .map(doc => doc.data())
            .filter(form => isFormOpen(form));

        res.json({
            forms: forms.map(({ id, slug, title, description, endsAt }) => ({
                id, slug, title, description, endsAt
            }))
        });

        return true;
    }

    if (!validSlug(parts[1]) || parts.length > 3) {
        invalid('ไม่พบฟอร์ม', 404);
    }

    const slug = await db.doc('formSlugs/' + parts[1]).get();

    if (!slug.exists) {
        invalid('ไม่พบฟอร์ม', 404);
    }

    const ref = db.doc('forms/' + slug.data().id);

    if (parts.length === 2 && method === 'GET') {
        const snapshot = await ref.get();
        const form = snapshot.data();

        if (!form || ['draft', 'deleted'].includes(form.status)) {
            invalid('ไม่พบฟอร์ม', 404);
        }

        if (!isFormOpen(form)) {
            invalid('ฟอร์มนี้ยังไม่เปิดรับหรือปิดรับคำตอบแล้ว', 410);
        }

        res.json({ form });
        return true;
    }

    if (
        parts.length === 3 &&
        parts[2] === 'submit' &&
        method === 'POST'
    ) {
        if (
            !(await limit(
                'form-submit:' + slug.data().id,
                10,
                60000
            ))
        ) {
            invalid('ส่งบ่อยเกินไป กรุณารอ 1 นาที', 429);
        }

        if (
            typeof body.requestId !== 'string' ||
            !/^[a-f0-9-]{36}$/.test(body.requestId)
        ) {
            invalid('รหัสการส่งไม่ถูกต้อง');
        }

        const responseRef = ref
            .collection('responses')
            .doc(body.requestId);

        const result = await db.runTransaction(async transaction => {
            const [snapshot, previous] = await Promise.all([
                transaction.get(ref),
                transaction.get(responseRef)
            ]);

            if (previous.exists) {
                return {
                    id: previous.id,
                    successMessage: previous.data().successMessage
                };
            }

            const form = snapshot.data();

            if (!form || !isFormOpen(form)) {
                invalid('ฟอร์มปิดรับคำตอบแล้ว', 410);
            }

            if (body.revision !== form.revision) {
                invalid(
                    'ฟอร์มมีการเปลี่ยนแปลง กรุณาโหลดหน้าใหม่ก่อนส่ง',
                    409
                );
            }

            let answers;

            try {
                answers = validateAnswers(form, body.answers);
            } catch (error) {
                invalid(error.message);
            }

            transaction.set(responseRef, {
                formTitle: form.title,
                revision: form.revision,
                questions: form.questions,
                answers,
                submittedAt: Date.now(),
                successMessage: form.successMessage
            });

            return {
                id: responseRef.id,
                successMessage: form.successMessage
            };
        });

        res.json(result);
        return true;
    }

    invalid('ไม่พบ API ฟอร์ม', 404);
}