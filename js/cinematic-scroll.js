/**
 * Leche Leche — 7-slide cinematic scroll
 * Brand → Tunnel (once) → Orbit → Street → Stats → Finale → CTA
 */
(function () {
  'use strict';

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const CFG = window.LL_CINEMATIC || {};
  const CLIPS = CFG.clips || [];
  const POSTER = CFG.poster || 'assets/hero-still.jpg';

  const TUNNEL_CLIP = 1;
  const PLAYFUL_CLIP = 4;
  const FINALE_CLIP = 5;
  const CTA_CLIP = 6;
  const CROSSFADE = 0.08;
  const HARD_CUT_SECTIONS = new Set(['tunnel']);

  const SECTIONS = [
    { id: 'brand', scroll: 1.4, label: 'Brand', clip: 0 },
    { id: 'tunnel', scroll: 2.2, label: 'Tunnel', clip: 1 },
    { id: 'hero', scroll: 1.5, label: 'Orbit', clip: 2 },
    { id: 'street', scroll: 1.5, label: 'Street', clip: 3 },
    { id: 'engineering', scroll: 1.2, label: 'Stats', clip: 4 },
    { id: 'finale', scroll: 1.3, label: 'Finale', clip: 5 },
    { id: 'cta', scroll: 0.9, label: 'Join', clip: 6 },
  ];

  let lenis = null;
  let totalScroll = 0;
  let sectionOffsets = [];
  let clipEls = [];
  let seeking = false;
  let landingReady = false;

  const stage = document.getElementById('cinStage');
  const copyPanels = [...document.querySelectorAll('[data-panel]')];
  const progressBar = document.getElementById('scrollProgressFill');
  const navDots = document.getElementById('navDots');
  const blobCache = new Map();

  function vh(n) {
    return (window.innerHeight * n) / 100;
  }

  function computeLayout() {
    totalScroll = SECTIONS.reduce((sum, s) => sum + vh(s.scroll * 100), 0);
    sectionOffsets = [];
    let acc = 0;
    SECTIONS.forEach((s, i) => {
      sectionOffsets.push({ id: s.id, start: acc, end: acc + vh(s.scroll * 100), index: i, section: s });
      acc += vh(s.scroll * 100);
    });
    const track = document.getElementById('scrollTrack');
    if (track) track.style.height = totalScroll + 'px';
  }

  async function blobUrl(src) {
    if (!src) return null;
    if (blobCache.has(src)) return blobCache.get(src);
    try {
      const res = await fetch(src);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      blobCache.set(src, url);
      return url;
    } catch {
      return src;
    }
  }

  function buildStage() {
    if (!stage) return;
    stage.innerHTML = '';
    clipEls = CLIPS.map((src, i) => {
      const layer = document.createElement('div');
      layer.className = 'cin-vid-layer';
      layer.dataset.clip = String(i);
      const vid = document.createElement('video');
      vid.muted = true;
      vid.playsInline = true;
      vid.preload = 'auto';
      vid.setAttribute('poster', POSTER);
      layer.appendChild(vid);
      stage.appendChild(layer);
      return { layer, vid, src, ready: false };
    });
    const poster = document.createElement('img');
    poster.className = 'cin-poster';
    poster.src = POSTER;
    poster.alt = '';
    stage.insertBefore(poster, stage.firstChild);
  }

  async function loadClips() {
    await Promise.all(
      clipEls.map(async (c) => {
        if (!c.src) return;
        const url = await blobUrl(c.src);
        if (url) {
          c.vid.src = url;
          c.vid.load();
          await new Promise((resolve) => {
            const done = () => resolve();
            c.vid.addEventListener('loadeddata', done, { once: true });
            c.vid.addEventListener('error', done, { once: true });
          });
          c.ready = c.vid.duration > 0;
        }
      })
    );
  }

  function getScrollY() {
    return lenis ? lenis.scroll : window.scrollY;
  }

  window.LL_getScrollY = getScrollY;
  window.LL_getCinematicEnd = () => totalScroll;

  function globalProgress(y) {
    return totalScroll <= 0 ? 0 : Math.max(0, Math.min(1, y / totalScroll));
  }

  function sectionProgress(y, sec) {
    const len = sec.end - sec.start;
    if (len <= 0) return 0;
    return Math.max(0, Math.min(1, (y - sec.start) / len));
  }

  function activeSection(y) {
    for (let i = sectionOffsets.length - 1; i >= 0; i--) {
      if (y >= sectionOffsets[i].start - 1) return sectionOffsets[i];
    }
    return sectionOffsets[0];
  }

  function seekClip(entry, t) {
    if (!entry || !entry.ready) return;
    const time = Math.max(0, Math.min(entry.vid.duration - 0.04, t * entry.vid.duration));
    if (Math.abs(entry.vid.currentTime - time) > 0.025 && !seeking) {
      seeking = true;
      entry.vid.currentTime = time;
    }
  }

  function findVideoSection(y) {
    let activeClip = null;
    let localT = 0;
    let mix = { a: null, b: null, t: 0 };
    let activeId = null;

    for (let i = 0; i < sectionOffsets.length; i++) {
      const sec = sectionOffsets[i];
      const s = sec.section;
      if (y >= sec.start && y < sec.end) activeId = s.id;
      if (s.clip == null) continue;
      if (y >= sec.start && y < sec.end) {
        localT = sectionProgress(y, sec);
        activeClip = s.clip;
        const next = SECTIONS[i + 1];
        const allowBlend = !HARD_CUT_SECTIONS.has(s.id);
        if (allowBlend && next && next.clip != null && localT > 1 - CROSSFADE) {
          mix = {
            a: s.clip,
            b: next.clip,
            t: (localT - (1 - CROSSFADE)) / CROSSFADE,
          };
        }
        break;
      }
    }

    return { activeClip, localT, mix, activeId };
  }

  function updateStage(y) {
    const eng = sectionOffsets.find((s) => s.id === 'engineering');
    const fin = sectionOffsets.find((s) => s.id === 'finale');
    const ctaSec = sectionOffsets.find((s) => s.id === 'cta');
    const inEng = eng && y >= eng.start && y < eng.end;
    const inFin = fin && y >= fin.start && y < fin.end;
    const inCta = ctaSec && y >= ctaSec.start;

    if (stage) {
      stage.classList.toggle('is-stats', !!inEng);
      stage.classList.toggle('is-finale', !!inFin);
      stage.classList.toggle('is-cta', !!inCta);
      stage.classList.toggle('is-cinema', !inEng && !inFin && !inCta);
    }
    document.body.classList.toggle('stats-mode', !!inEng || !!inFin || !!inCta);

    const { activeClip, localT, mix, activeId } = findVideoSection(y);
    const blending = mix.a != null && mix.b != null;

    clipEls.forEach((c, i) => {
      let op = 0;
      let t = 0;

      if (i === TUNNEL_CLIP && activeId !== 'tunnel') {
        c.layer.classList.remove('is-visible');
        c.layer.style.opacity = '0';
        return;
      }

      if (inEng) {
        const p = sectionProgress(y, eng);
        if (blending && i === PLAYFUL_CLIP && mix.a === PLAYFUL_CLIP) {
          op = 1 - mix.t;
          t = Math.min(0.95, 0.08 + p * 0.88);
        } else if (blending && i === FINALE_CLIP && mix.b === FINALE_CLIP) {
          op = mix.t;
          t = Math.min(0.2, mix.t * 0.25);
        } else if (i === PLAYFUL_CLIP) {
          op = Math.min(1, 0.5 + p * 0.5);
          t = Math.min(0.95, 0.08 + p * 0.88);
        }
      } else if (inCta) {
        const p = sectionProgress(y, ctaSec);
        if (blending && i === FINALE_CLIP && mix.a === FINALE_CLIP) {
          op = 1 - mix.t;
          t = Math.min(1, 0.75 + mix.t * 0.2);
        } else if (blending && i === CTA_CLIP && mix.b === CTA_CLIP) {
          op = mix.t;
          t = Math.min(0.95, mix.t * 0.85);
        } else if (i === CTA_CLIP) {
          op = Math.min(1, 0.4 + p * 0.6);
          t = Math.min(0.95, 0.1 + p * 0.85);
        }
      } else if (blending && !inEng && !inCta) {
        if (i === mix.a) {
          op = 1 - mix.t;
          t = Math.max(0, 1 - CROSSFADE * 0.2);
        } else if (i === mix.b) {
          op = mix.t;
          t = Math.min(1, CROSSFADE * 0.2 + mix.t * 0.2);
        }
      } else if (activeClip === i && !inEng && !inCta) {
        op = 1;
        t = localT;
      }

      c.layer.classList.toggle('is-visible', op > 0.04);
      c.layer.style.opacity = String(op);
      if (op > 0.04) seekClip(c, t);
    });
  }

  function updateCopy(y) {
    const active = activeSection(y);
    copyPanels.forEach((panel) => {
      const pid = panel.getAttribute('data-panel');
      const sec = sectionOffsets.find((s) => s.id === pid);
      if (!sec) return;
      const p = sectionProgress(y, sec);
      const inView = y >= sec.start && y < sec.end;
      panel.classList.toggle('is-active', inView);
      panel.classList.toggle('is-light', pid === 'engineering' || pid === 'cta');
      if (reduced) {
        panel.style.opacity = inView ? '1' : '0';
        panel.style.transform = 'none';
        return;
      }
      const enter = Math.max(0, Math.min(1, (p - 0.05) / 0.18));
      const exit = Math.max(0, Math.min(1, (p - 0.72) / 0.2));
      const opacity = enter * (1 - exit);
      const yOff = (1 - enter) * 28 + exit * -16;
      panel.style.opacity = String(opacity);
      panel.style.transform = 'translate3d(0,' + yOff + 'px,0)';
    });
    if (navDots) {
      navDots.querySelectorAll('[data-nav]').forEach((dot) => {
        dot.classList.toggle('is-active', dot.getAttribute('data-nav') === active.id);
      });
    }
    const hint = document.querySelector('.cin-scroll-hint');
    if (hint) hint.style.opacity = y > 80 ? '0' : '1';
  }

  function updateHandoff(y) {
    const handoffStart = totalScroll * 0.86;
    const handoffEnd = totalScroll;
    const t = handoffEnd <= handoffStart
      ? 1
      : Math.max(0, Math.min(1, (y - handoffStart) / (handoffEnd - handoffStart)));

  document.documentElement.style.setProperty('--cin-handoff', String(1 - t * 0.92));
    const cinExp = document.getElementById('cinExperience');
    if (cinExp) cinExp.style.opacity = String(1 - t * 0.92);
    document.body.classList.toggle('cinematic-handoff', t > 0.02);
    document.body.classList.toggle('cinematic-complete', y >= handoffEnd - 8);

    if (y >= handoffEnd - 8 && !landingReady) {
      landingReady = true;
      if (typeof window.LL_initLanding === 'function') window.LL_initLanding();
    }
  }

  function onScroll() {
    const y = getScrollY();
    updateHandoff(y);
    if (y < totalScroll) {
      updateCopy(y);
      updateStage(y);
    } else {
      clipEls.forEach((c) => {
        c.layer.style.opacity = '0';
        c.layer.classList.remove('is-visible');
      });
    }
    if (progressBar) {
      const docH = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
      progressBar.style.transform = 'scaleX(' + Math.max(0, Math.min(1, y / docH)) + ')';
    }
  }

  function buildNav() {
    if (!navDots) return;
    navDots.innerHTML = '';
    SECTIONS.forEach((s) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('data-nav', s.id);
      btn.setAttribute('aria-label', s.label);
      btn.addEventListener('click', () => {
        const sec = sectionOffsets.find((o) => o.id === s.id);
        if (sec && lenis) lenis.scrollTo(sec.start, { duration: 1.1 });
        else window.scrollTo({ top: sec?.start || 0, behavior: 'smooth' });
      });
      navDots.appendChild(btn);
    });
  }

  async function init() {
    document.addEventListener('seeked', () => { seeking = false; }, true);
    buildStage();
    computeLayout();
    buildNav();
    await loadClips();

    if (typeof Lenis !== 'undefined' && !reduced) {
      lenis = new Lenis({ duration: 1.1, smoothWheel: true });
      window.lenisInstance = lenis;
      lenis.on('scroll', onScroll);
      (function raf(t) {
        lenis.raf(t);
        requestAnimationFrame(raf);
      })(performance.now());
    } else {
      window.addEventListener('scroll', onScroll, { passive: true });
    }

    window.addEventListener('resize', () => {
      computeLayout();
      onScroll();
    });

    onScroll();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
