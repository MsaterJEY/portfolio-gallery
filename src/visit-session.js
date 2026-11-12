const STORAGE_KEY = 'portfolio-visit-session-v2';
const ENTRY_KEY = '__portfolioVisitEntry';

export function startsNewVisit({
    hasSession,
    navigationType,
    sameOriginReferrer,
    hasReferrer,
    previousEntry,
    currentEntry,
    restored
}) {
    if (!hasSession) return true;

    if (restored || navigationType === 'back_forward') {
        return previousEntry === currentEntry;
    }

    if (navigationType === 'reload') return false;

    if (hasReferrer) return !sameOriginReferrer;

    return true;
}

export function trackSiteVisit(send) {
    let entry = history.state?.[ENTRY_KEY];

    if (!entry) {
        entry = crypto.randomUUID();

        history.replaceState({
            ...history.state,
            [ENTRY_KEY]: entry
        }, '');
    }

    let memory;

    function read() {
        try {
            return JSON.parse(
                sessionStorage.getItem(STORAGE_KEY)
            ) || memory;
        } catch {
            return memory;
        }
    }

    function write(value) {
        memory = value;

        try {
            sessionStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(value)
            );
        } catch { }
    }

    let visitor;

    try {
        visitor = localStorage.getItem('gallery-visitor');

        if (!visitor) {
            visitor = crypto.randomUUID();
            localStorage.setItem('gallery-visitor', visitor);
        }
    } catch {
        visitor = crypto.randomUUID();
    }

    function enter(restored = false) {
        const old = read();

        const navigationType = performance
            .getEntriesByType('navigation')[0]?.type || 'navigate';

        let sameOriginReferrer = false;

        try {
            sameOriginReferrer =
                new URL(document.referrer).origin === location.origin;
        } catch { }

        const fresh = startsNewVisit({
            hasSession: !!old?.visitId,
            navigationType,
            hasReferrer: !!document.referrer,
            sameOriginReferrer,
            previousEntry: old?.entry,
            currentEntry: entry,
            restored
        });

        const visitId = fresh
            ? crypto.randomUUID()
            : old.visitId;

        write({ visitId, entry });

        // ส่งซ้ำหลังรีเฟรชได้ แต่เซิร์ฟเวอร์จะนับ ID นี้ครั้งเดียว
        Promise.resolve(send(visitor, visitId)).catch(() => { });
    }

    enter();

    const onShow = event => {
        if (event.persisted) enter(true);
    };

    window.addEventListener('pageshow', onShow);

    return () => {
        window.removeEventListener('pageshow', onShow);
    };
}