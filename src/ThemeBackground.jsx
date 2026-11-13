import React, {useEffect, useRef} from 'react';

export default function ThemeBackground({
  color = '#8fb69a',
  disabled = false
}) {
  const container = useRef(null);

  useEffect(() => {
    const node = container.current;

    if (!node || disabled) return;

    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    );

    const mobile = window.matchMedia(
      '(max-width: 600px)'
    );

    let effect = null;
    let disposed = false;
    let version = 0;

    function stop() {
      version++;

      if (effect) {
        effect.destroy();
        effect = null;
      }
    }

    async function sync() {
      stop();

      const request = version;

      if (
        disposed ||
        document.hidden ||
        reducedMotion.matches ||
        navigator.connection?.saveData
      ) {
        return;
      }

      try {
        const [THREE, netModule] = await Promise.all([
          import('three'),
          import('vanta/dist/vanta.net.min.js')
        ]);

        if (
          disposed ||
          request !== version ||
          document.hidden
        ) {
          return;
        }

        effect = netModule.default({
          el: node,
          THREE,

          mouseControls: !mobile.matches,
          touchControls: false,
          gyroControls: false,

          minHeight: 200,
          minWidth: 200,

          scale: 1.5,
          scaleMobile: 2,

          color: /^#[0-9a-f]{6}$/i.test(color)
            ? parseInt(color.slice(1), 16)
            : 0x8fb69a,

          backgroundColor: 0x030705,

          points: mobile.matches ? 4 : 6,
          maxDistance: mobile.matches ? 22 : 24,
          spacing: mobile.matches ? 24 : 20,

          showDots: true
        });
      } catch (error) {
        stop();

        // หากโหลดไม่ได้ จะยังมีพื้นหลังนิ่งจาก CSS
        console.warn(
          'Gallery background unavailable:',
          error.message
        );
      }
    }

    sync();

    reducedMotion.addEventListener('change', sync);
    mobile.addEventListener('change', sync);
    document.addEventListener('visibilitychange', sync);

    return () => {
      disposed = true;
      stop();

      reducedMotion.removeEventListener('change', sync);
      mobile.removeEventListener('change', sync);
      document.removeEventListener('visibilitychange', sync);
    };
  }, [color, disabled]);

  return (
    <div
      ref={container}
      className="site-background"
      aria-hidden="true"
    />
  );
}