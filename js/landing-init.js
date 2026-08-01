/**
 * Landing page behaviors — runs after cinematic handoff
 */
(function () {
  'use strict';

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function initLanding() {
    if (window.__llLandingInit) return;
    window.__llLandingInit = true;

    const toggle = document.getElementById('llNavToggle');
    const menu = document.getElementById('llNavMenu');
    const links = document.getElementById('llNavLinks');
    const closeNav = () => {
      if (toggle) {
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-label', 'Open menu');
      }
      menu?.classList.remove('is-open');
      links?.classList.remove('is-open');
    };
    toggle?.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      menu?.classList.toggle('is-open', open);
      links?.classList.toggle('is-open', open);
    });
    links?.querySelectorAll('a').forEach((a) => a.addEventListener('click', closeNav));

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          const el = en.target;
          const d = parseInt(el.getAttribute('data-reveal-delay') || '0', 10);
          el.style.transitionDelay = d + 'ms';
          el.style.opacity = '1';
          el.style.transform = 'none';
          io.unobserve(el);
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    );
    document.querySelectorAll('#landingSite [data-reveal]').forEach((el) => {
      if (!reduced) {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition =
          'opacity .85s cubic-bezier(.16,1,.3,1), transform .85s cubic-bezier(.16,1,.3,1)';
      }
      io.observe(el);
    });

    const setupLoop = (aId, bId) => {
      const a = document.getElementById(aId);
      const b = document.getElementById(bId);
      if (!a || !b) return;
      const FADE = 1.2;
      let active = a;
      let idle = b;
      [a, b].forEach((v) => {
        v.muted = true;
        v.playsInline = true;
        v.play().catch(() => {});
      });
      b.pause();
      b.currentTime = 0;
      const tick = () => {
        if (!active.duration || isNaN(active.duration)) return;
        if (active.currentTime >= active.duration - FADE) {
          idle.currentTime = 0;
          idle.play().catch(() => {});
          idle.style.opacity = '1';
          active.style.opacity = '0';
          const prev = active;
          active = idle;
          idle = prev;
          setTimeout(() => prev.pause(), FADE * 1000);
        }
      };
      a.addEventListener('timeupdate', tick);
      b.addEventListener('timeupdate', tick);
    };
    setupLoop('closeVidA', 'closeVidB');

    const nav = document.getElementById('lnav');
    const onNavScroll = () => {
      const y = window.LL_getScrollY ? window.LL_getScrollY() : window.scrollY;
      if (!nav) return;
      const solid = y > 40;
      nav.style.background = solid ? 'rgba(255,255,255,.9)' : 'transparent';
      nav.style.backdropFilter = solid ? 'saturate(180%) blur(14px)' : 'none';
      nav.style.webkitBackdropFilter = solid ? 'saturate(180%) blur(14px)' : 'none';
      nav.style.boxShadow = solid ? '0 6px 26px rgba(26,26,26,.08)' : 'none';
      nav.style.borderBottomColor = solid ? 'rgba(26,26,26,.06)' : 'transparent';
    };
    onNavScroll();
    window.addEventListener('scroll', onNavScroll, { passive: true });
  }

  window.LL_initLanding = initLanding;
})();
