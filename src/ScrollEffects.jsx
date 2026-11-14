import React, {useEffect} from 'react';

export default function ScrollEffects({
  contentKey = '',
  disabled = false
}) {
  useEffect(() => {
    const root = document.querySelector('.site');

    if (!root || disabled) return;

    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    );

    const mobile = window.matchMedia(
      '(max-width: 600px)'
    );

    let observers = [];
    const animations = new Map();

    let disposed = false;
    let version = 0;

    function stop() {
      version++;

      observers.forEach(observer => observer.revert());
      observers = [];

      animations.forEach(animation => animation.revert());
      animations.clear();
    }

    async function setup() {
      stop();

      if (disposed || reducedMotion.matches) return;

      const request = version;

      try {
        const {animate, onScroll} = await import('animejs');

        if (
          disposed ||
          request !== version ||
          reducedMotion.matches
        ) {
          return;
        }

        function reveal(target, elements) {
          const nodes = [...elements];

          if (!nodes.length) return;

          const rect = target.getBoundingClientRect();

          // ตอนโหลดหรืออัปเดตข้อมูล:
          // ส่วนที่เห็นอยู่แล้วจะแสดงตามปกติ
          let skipInitial =
            rect.top < window.innerHeight - 24 &&
            rect.bottom > 24;

          const observer = onScroll({
            target,
            enter: 'bottom-=24 top',
            leave: 'top+=24 bottom',
            repeat: true,
            debug: false,

            onEnter(self) {
              if (
                disposed ||
                request !== version ||
                reducedMotion.matches
              ) {
                return;
              }

              if (skipInitial) {
                skipInitial = false;
                return;
              }

              animations.get(target)?.revert();

              const distance = mobile.matches ? 12 : 20;

              const animation = animate(nodes, {
                opacity: [0, 1],

                // เลื่อนขึ้น: เริ่มเหนือจุดปกติ
                // เลื่อนลง: เริ่มใต้จุดปกติ
                y: [
                  self.backward ? -distance : distance,
                  0
                ],

                duration: 1000,
                ease: 'out(3)'
              });

              animations.set(target, animation);
            },

            onLeave() {
              skipInitial = false;
              animations.get(target)?.pause();
            }
          });

          observers.push(observer);
        }

        root.querySelectorAll(
          '#work .gallery > .project'
        ).forEach(card => {
          reveal(card, card.children);
        });

        const about = root.querySelector('#about');

        if (about) {
          reveal(about, about.children);
        }
      } catch (error) {
        stop();

        console.warn(
          'Scroll animation unavailable:',
          error.message
        );
      }
    }

    setup();

    reducedMotion.addEventListener('change', setup);
    mobile.addEventListener('change', setup);

    return () => {
      disposed = true;
      stop();

      reducedMotion.removeEventListener('change', setup);
      mobile.removeEventListener('change', setup);
    };
  }, [contentKey, disabled]);

  return null;
}