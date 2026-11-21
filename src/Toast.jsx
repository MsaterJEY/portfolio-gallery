import React, {
  useCallback,
  useEffect,
  useRef,
  useState
} from 'react';

export function useToast() {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);
  const sequence = useRef(0);

  const dismiss = useCallback(() => {
    clearTimeout(timer.current);
    setToast(null);
  }, []);

  const notify = useCallback((message, type = 'success') => {
    clearTimeout(timer.current);

    setToast({
      id: ++sequence.current,
      message,
      type
    });

    timer.current = setTimeout(
      () => setToast(null),
      type === 'error' ? 7000 : 4000
    );
  }, []);

  useEffect(() => {
    return () => clearTimeout(timer.current);
  }, []);

  return {toast, notify, dismiss};
}

export default function Toast({toast, onClose}) {
  return (
    <div
      className="fm-toast-region"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {toast && (
        <div
          key={toast.id}
          className={'fm-toast fm-toast-' + toast.type}
        >
          <span className="fm-toast-icon" aria-hidden="true">
            {toast.type === 'error'
              ? '!'
              : toast.type === 'info'
                ? 'i'
                : '✓'}
          </span>

          <span className="fm-toast-text">
            {toast.message}
          </span>

          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดการแจ้งเตือน"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}