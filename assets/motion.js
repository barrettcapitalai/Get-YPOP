/* $YPOP motion kit — Linea techniques adapted (MIT). */
(function () {
  var reduce = false;
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  var supportsTimeline = false;
  try { supportsTimeline = CSS.supports('animation-timeline: view()'); } catch (e) {}
  /* Gate applied after first in-view pass (enableMotion) to avoid FOUC */
  var motionEnabled = false;
  var coarsePointer = false;
  try { coarsePointer = window.matchMedia('(hover:none), (pointer:coarse)').matches; } catch (e) {}
  function enableMotion() {
    if (reduce || motionEnabled) return;
    motionEnabled = true;
    document.documentElement.setAttribute('data-ypop-motion', '');
    /* Skip view() timelines on touch — they fight sticky/JS transforms on iPad Safari */
    if (supportsTimeline && !coarsePointer) document.documentElement.setAttribute('data-ypop-live', '');
  }

  var ease = 'cubic-bezier(.2,.7,.2,1)';
  var root = document.documentElement;

  /* Nav scrolled state — rAF-throttled; only toggle when changed (avoids frosted bar thrash) */
  var navScrolled = null;
  var navTick = false;
  function applyNav() {
    navTick = false;
    var on = window.scrollY > 18;
    if (on === navScrolled) return;
    navScrolled = on;
    root.classList.toggle('is-scrolled', on);
  }
  function onScrollNav() {
    if (navTick) return;
    navTick = true;
    requestAnimationFrame(applyNav);
  }
  applyNav();
  window.addEventListener('scroll', onScrollNav, { passive: true });

  /* Number stagger children */
  function numberStaggers(scope) {
    (scope || document).querySelectorAll('.reveal-stagger').forEach(function (group) {
      Array.prototype.forEach.call(group.children, function (child, i) {
        child.style.setProperty('--i', String(i));
      });
    });
  }
  numberStaggers();


  /* Split headings marked [data-split="lines"] into line masks */
  function splitLines() {
    document.querySelectorAll('[data-split="lines"]').forEach(function (el) {
      if (el.getAttribute('data-split-done')) return;
      var text = el.textContent.replace(/\s+/g, ' ').trim();
      if (!text) return;
      var html = el.innerHTML;
      var parts = html.split(/<br\s*\/?>/i);
      el.classList.add('motion-lines');
      el.innerHTML = parts.map(function (part, i) {
        var clean = part.replace(/<[^>]+>/g, '').trim();
        if (!clean) return '';
        return '<span class="line" style="--i:' + i + '"><span class="line__in">' + part.trim() + '</span></span>';
      }).join('');
      el.setAttribute('data-split-done', '1');
    });
  }
  if (!reduce) splitLines();

  function showReveal(el) {
    if (!el) return;
    el.classList.remove('is-waiting');
    el.classList.add('in');
    if (el.classList.contains('motion-lines') || el.hasAttribute('data-split')) {
      el.classList.add('is-in');
      el.classList.remove('is-waiting');
    }
    el.querySelectorAll('.motion-lines').forEach(function (lines) {
      lines.classList.add('is-in', 'in');
      lines.classList.remove('is-waiting');
    });
    // nested stagger groups
    if (el.classList.contains('reveal-stagger')) {
      el.classList.add('in');
      el.classList.remove('is-waiting');
    }
    el.querySelectorAll('.reveal-stagger').forEach(function (g) {
      g.classList.add('in');
      g.classList.remove('is-waiting');
    });
  }

  function revealTargets() {
    return document.querySelectorAll('.reveal, .reveal-stagger, [data-split="lines"], .motion-lines');
  }

  function isInView(el) {
    var r = el.getBoundingClientRect();
    var vh = window.innerHeight || 800;
    // Generous: any pixel in the viewport (with small slack)
    return r.bottom > 0 && r.top < vh;
  }

  function armReveals() {
    var els = revealTargets();
    if (reduce) {
      els.forEach(showReveal);
      document.documentElement.setAttribute('data-ypop-revealed', '');
      return;
    }

    // Opt-in hide only for elements not already in view
    els.forEach(function (el) {
      if (isInView(el)) {
        showReveal(el);
      } else {
        el.classList.add('is-waiting');
      }
    });
    enableMotion();

    if (!('IntersectionObserver' in window)) {
      els.forEach(showReveal);
      document.documentElement.setAttribute('data-ypop-revealed', '');
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        showReveal(e.target);
        io.unobserve(e.target);
      });
    }, { threshold: 0, rootMargin: '0px 0px 0px 0px' });

    els.forEach(function (el) {
      if (!el.classList.contains('in') && !el.classList.contains('is-in')) io.observe(el);
    });

    // Re-check on scroll/resize (fast scroll / jump)
    var ticking = false;
    function sweep() {
      ticking = false;
      revealTargets().forEach(function (el) {
        if (el.classList.contains('in') || el.classList.contains('is-in')) return;
        if (isInView(el)) showReveal(el);
      });
    }
    function onSweep() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(sweep);
    }
    window.addEventListener('scroll', onSweep, { passive: true });
    window.addEventListener('resize', onSweep, { passive: true });

    // Hard fail-open: never leave content invisible
    setTimeout(function () {
      revealTargets().forEach(showReveal);
      document.documentElement.setAttribute('data-ypop-revealed', '');
      // ensure path phone has an active panel
      var panel = document.querySelector('.path-panel.is-active') || document.querySelector('.path-panel');
      if (panel) {
        panel.classList.add('is-active');
        panel.setAttribute('aria-hidden', 'false');
      }
    }, 1800);
  }

  armReveals();

  /* Auto-mark common home clusters for stagger if not already */
  function autoStagger() {
    ['.feat', '.flow', '.fly', '.cards', '.closing', '.faq-list'].forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (el) {
        if (!el.classList.contains('reveal-stagger')) el.classList.add('reveal-stagger');
        if (!el.classList.contains('reveal') && !el.closest('.reveal')) el.classList.add('reveal');
        numberStaggers(el.parentElement || document);
        Array.prototype.forEach.call(el.children, function (child, i) {
          child.style.setProperty('--i', String(i));
        });
      });
    });
  }
  autoStagger();
  // Newly tagged stagger nodes: show if in view, else wait + observe via sweep/timeout
  revealTargets().forEach(function (el) {
    if (el.classList.contains('in') || el.classList.contains('is-in')) return;
    if (isInView(el)) showReveal(el);
    else el.classList.add('is-waiting');
  });

  /* Subtle parallax on [data-parallax] — transform only; off on touch / narrow */
  function armParallax() {
    if (reduce) return;
    if (coarsePointer) return;
    if (window.matchMedia('(max-width:900px)').matches) return;
    var nodes = Array.prototype.slice.call(document.querySelectorAll('[data-parallax]')).filter(function (el) {
      /* Never parallax inside sticky/pinned hosts — fights position:sticky */
      return !el.closest('.who-rail__stage, .path-sticky, [data-who-rail], [data-path]');
    });
    if (!nodes.length) return;
    var ticking = false;
    function update() {
      ticking = false;
      var vh = window.innerHeight;
      nodes.forEach(function (el) {
        var rect = el.getBoundingClientRect();
        if (rect.bottom < -80 || rect.top > vh + 80) {
          el.classList.remove('is-parallaxing');
          return;
        }
        el.classList.add('is-parallaxing');
        var mid = rect.top + rect.height / 2;
        var p = (mid - vh / 2) / vh;
        var amp = Math.min(8, (parseFloat(el.getAttribute('data-parallax')) || 12) * 0.55);
        var y = Math.max(-amp, Math.min(amp, -p * amp));
        /* No scale — layout-adjacent and amplifies jitter */
        el.style.transform = 'translate3d(0,' + y.toFixed(2) + 'px,0)';
      });
    }
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    update();
  }
  armParallax();

  /* Sticky path scrub — golden path phone */
  function armPath() {
    var rootPath = document.querySelector('[data-path]');
    if (!rootPath) return;
    var steps = Array.prototype.slice.call(rootPath.querySelectorAll('[data-path-step]'));
    var panels = Array.prototype.slice.call(rootPath.querySelectorAll('[data-path-panel]'));
    if (!steps.length || !panels.length) return;

    function setActive(i) {
      i = Math.max(0, Math.min(steps.length - 1, i));
      steps.forEach(function (el, j) {
        el.classList.toggle('is-active', j === i);
        el.classList.toggle('is-done', j < i);
        el.setAttribute('aria-current', j === i ? 'step' : 'false');
      });
      panels.forEach(function (el, j) {
        var on = j === i;
        el.classList.toggle('is-active', on);
        el.setAttribute('aria-hidden', on ? 'false' : 'true');
        if (on) {
          el.style.opacity = '1';
          el.style.transform = 'none';
        } else {
          /* Clear fail-open inline styles so inactive panels can hide */
          el.style.opacity = '';
          el.style.transform = '';
        }
      });
      rootPath.style.setProperty('--path-i', String(i));
    }

    if (reduce) {
      // Show all panels stacked for readability
      panels.forEach(function (el) {
        el.classList.add('is-active');
        el.style.position = 'relative';
        el.style.opacity = '1';
        el.style.transform = 'none';
      });
      steps.forEach(function (el) { el.classList.add('is-active'); });
      return;
    }

    setActive(0);

    var ticking = false;
    function sync() {
      ticking = false;
      var vh = window.innerHeight;
      var best = 0;
      var bestDist = Infinity;
      steps.forEach(function (el, i) {
        var r = el.getBoundingClientRect();
        var mid = r.top + r.height / 2;
        var dist = Math.abs(mid - vh * 0.5);
        if (dist < bestDist) { bestDist = dist; best = i; }
      });
      setActive(best);

      // Exit tilt when past last step
      var last = steps[steps.length - 1].getBoundingClientRect();
      if (last.bottom < vh * 0.35) rootPath.classList.add('is-exit');
      else rootPath.classList.remove('is-exit');
    }
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(sync);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    sync();
  }
  armPath();

  /* Who rail — vertical scroll scrubs horizontal track (Linea rooms technique) */
  function armWhoRail() {
    var root = document.querySelector('[data-who-rail]');
    if (!root) return;
    var hold = root.querySelector('.who-rail__hold');
    var track = root.querySelector('[data-who-track]');
    if (!hold || !track) return;

    /* Scroll-driven on every pointer (incl. iPad/phone). Static only for reduced-motion. */
    function useStatic() {
      return reduce;
    }

    /* Cached geometry — measured on load/resize only, never per scroll frame */
    var cache = {
      top: 0,
      holdH: 0,
      vh: 0,
      travel: 0,
      scrollable: 1,
      active: false
    };
    var ticking = false;
    var lastX = 0;

    function measure() {
      if (useStatic()) {
        root.classList.add('who-rail--static');
        track.style.transform = '';
        track.style.willChange = 'auto';
        root.style.removeProperty('--who-travel');
        root.style.removeProperty('--who-p');
        hold.style.height = '';
        return;
      }
      root.classList.remove('who-rail--static');
      /* Clear transform so scrollWidth is natural */
      track.style.transform = 'translate3d(0,0,0)';
      var vw = window.innerWidth || 1;
      var travel = Math.max(0, track.scrollWidth - vw);
      root.style.setProperty('--who-travel', travel + 'px');
      /* Flush layout so hold height reflects new --who-travel */
      void hold.offsetHeight;
      cache.vh = window.innerHeight || 1;
      cache.holdH = hold.offsetHeight;
      /* One layout read on resize/load only — never in the scroll rAF */
      cache.top = hold.getBoundingClientRect().top + (window.pageYOffset || document.documentElement.scrollTop || 0);
      cache.travel = travel;
      cache.scrollable = Math.max(1, cache.holdH - cache.vh);
      track.style.willChange = 'transform';
    }

    function progress() {
      if (useStatic()) return;
      var y = window.pageYOffset || document.documentElement.scrollTop || 0;
      var scrolled = y - cache.top;
      var p = 0;
      if (scrolled > 0) p = Math.min(1, scrolled / cache.scrollable);
      var x = -(p * cache.travel);
      /* Only write when changed enough to matter (~0.25px) */
      if (Math.abs(x - lastX) < 0.25 && p !== 0 && p !== 1) return;
      lastX = x;
      track.style.transform = 'translate3d(' + x.toFixed(2) + 'px,0,0)';
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        ticking = false;
        progress();
      });
    }

    function refresh() {
      measure();
      lastX = -9999;
      progress();
    }

    refresh();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', refresh, { passive: true });
    window.addEventListener('orientationchange', function () {
      setTimeout(refresh, 120);
    }, { passive: true });
    track.querySelectorAll('img').forEach(function (img) {
      if (!img.complete) img.addEventListener('load', refresh, { once: true });
    });
  }
  armWhoRail();


  /* Pitch — big two-tone headlines on pinned Obsidian|Lime split.
     Sticky stage (no transform). Cached geometry. One passive scroll → rAF.
     Writes: --pitch-split, copy width/left, item opacity+translate3d. */
  function armPitch() {
    var root = document.querySelector('[data-pitch]');
    if (!root) return;
    var hold = root.querySelector('.pitch-hold');
    var panels = root.querySelector('[data-pitch-panels]');
    var copyDark = root.querySelector('[data-pitch-copy="dark"]');
    var copyLime = root.querySelector('[data-pitch-copy="lime"]');
    var darkItems = copyDark ? Array.prototype.slice.call(copyDark.querySelectorAll('[data-pitch-step]')) : [];
    var limeItems = copyLime ? Array.prototype.slice.call(copyLime.querySelectorAll('[data-pitch-step]')) : [];
    var bars = Array.prototype.slice.call(root.querySelectorAll('[data-pitch-bar]'));
    if (!hold || !panels || darkItems.length < 2) return;

    function useStatic() { return reduce; }

    var cache = { top: 0, holdH: 0, vh: 0, scrollable: 1, pw: 0, ph: 0, vertical: false };
    var ticking = false;
    var lastP = -1;
    var lastI = -1;
    var n = darkItems.length;

    function setItems(list, i) {
      list.forEach(function (el, j) {
        el.classList.toggle('is-active', j === i);
        el.classList.toggle('is-done', j < i);
        if (j === i) {
          el.style.opacity = '1';
          el.style.transform = 'translate3d(0,-50%,0)';
        } else if (j < i) {
          el.style.opacity = '0';
          el.style.transform = 'translate3d(0,calc(-50% - 28px),0)';
        } else {
          el.style.opacity = '0';
          el.style.transform = 'translate3d(0,calc(-50% + 32px),0)';
        }
      });
    }

    function alignCopies() {
      if (!copyDark || !copyLime) return;
      var pw = cache.pw;
      var ph = cache.ph;
      copyDark.style.width = pw + 'px';
      copyLime.style.width = pw + 'px';
      if (cache.vertical) {
        /* lime on top: copy fills full panel height, offset so text aligns */
        copyDark.style.height = ph + 'px';
        copyLime.style.height = ph + 'px';
        copyDark.style.width = '';
        copyLime.style.width = '';
        copyDark.style.left = '0';
        copyLime.style.left = '0';
        copyDark.style.top = ''; /* JS sets each frame via split */
        copyLime.style.top = '0';
      } else {
        copyDark.style.height = '';
        copyLime.style.height = '';
        copyDark.style.left = '0';
        copyDark.style.top = '0';
        copyLime.style.top = '0';
        /* lime copy shifted left by dark width so text coincides */
      }
    }

    function applySplit(split) {
      split = Math.max(0.28, Math.min(0.72, split));
      panels.style.setProperty('--pitch-split', String(split));
      if (cache.vertical) {
        var limeH = cache.ph * split;
        var darkH = cache.ph - limeH;
        if (copyLime) {
          copyLime.style.height = cache.ph + 'px';
          copyLime.style.top = '0';
        }
        if (copyDark) {
          copyDark.style.height = cache.ph + 'px';
          /* dark half sits at bottom; copy aligned to panel top → shift up by limeH */
          copyDark.style.top = (-limeH) + 'px';
        }
      } else {
        var darkW = cache.pw * (1 - split);
        if (copyLime) {
          copyLime.style.width = cache.pw + 'px';
          copyLime.style.left = (-darkW) + 'px';
        }
        if (copyDark) {
          copyDark.style.width = cache.pw + 'px';
          copyDark.style.left = '0';
        }
      }
    }

    function applyProgress(p) {
      /* Which line is active */
      var i = Math.min(n - 1, Math.floor(p * n));
      if (p >= 0.995) i = n - 1;

      /* Local progress within the active slot — lime sweeps 0.34 → 0.66 */
      var slot = 1 / n;
      var local = (p - i * slot) / slot;
      local = Math.max(0, Math.min(1, local));
      var split = 0.34 + local * 0.32; /* 34% → 66% */

      applySplit(split);

      if (i !== lastI) {
        lastI = i;
        setItems(darkItems, i);
        setItems(limeItems, i);
        bars.forEach(function (el, j) {
          el.classList.toggle('is-on', j <= i);
        });
      }
    }

    function measure() {
      if (useStatic()) {
        root.classList.add('pitch-band--static');
        panels.style.removeProperty('--pitch-split');
        [copyDark, copyLime].forEach(function (c) {
          if (!c) return;
          c.style.width = '';
          c.style.height = '';
          c.style.left = '';
          c.style.top = '';
        });
        darkItems.concat(limeItems).forEach(function (el) {
          el.style.opacity = '';
          el.style.transform = '';
          el.classList.add('is-active');
          el.classList.remove('is-done');
        });
        return;
      }
      root.classList.remove('pitch-band--static');
      cache.vh = window.innerHeight || 1;
      cache.holdH = hold.offsetHeight;
      cache.top = hold.getBoundingClientRect().top + (window.pageYOffset || document.documentElement.scrollTop || 0);
      cache.scrollable = Math.max(1, cache.holdH - cache.vh);
      cache.pw = panels.clientWidth;
      cache.ph = panels.clientHeight;
      cache.vertical = window.matchMedia('(max-width:47.99rem)').matches;
      alignCopies();
    }

    function progress() {
      if (useStatic()) return;
      var y = window.pageYOffset || document.documentElement.scrollTop || 0;
      var scrolled = y - cache.top;
      var p = 0;
      if (scrolled > 0) p = Math.min(1, scrolled / cache.scrollable);
      if (Math.abs(p - lastP) < 0.001 && p !== 0 && p !== 1) return;
      lastP = p;
      applyProgress(p);
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        ticking = false;
        progress();
      });
    }

    function refresh() {
      measure();
      lastP = -1;
      lastI = -1;
      progress();
    }

    if (useStatic()) { measure(); return; }
    refresh();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', refresh, { passive: true });
    window.addEventListener('orientationchange', function () {
      setTimeout(refresh, 120);
    }, { passive: true });
  }

  armPitch();

  if (!motionEnabled && !reduce) enableMotion();
})();
