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

    var mqPhone = window.matchMedia('(max-width:700px)');
    function useStatic() {
      return reduce || mqPhone.matches;
    }

    function measure() {
      if (useStatic()) {
        root.classList.add('who-rail--static');
        hold.style.height = '';
        track.style.transform = '';
        root.style.removeProperty('--who-travel');
        root.style.removeProperty('--who-p');
        return 0;
      }
      root.classList.remove('who-rail--static');
      // Temporarily clear transform to measure natural width
      track.style.transform = 'translate3d(0,0,0)';
      var travel = Math.max(0, track.scrollWidth - window.innerWidth);
      root.style.setProperty('--who-travel', travel + 'px');
      hold.style.height = ''; // let CSS calc handle it
      return travel;
    }

    var travel = 0;
    var ticking = false;

    function progress() {
      if (useStatic()) {
        track.style.willChange = 'auto';
        return;
      }
      var rect = hold.getBoundingClientRect();
      var vh = window.innerHeight || 1;
      var scrollable = Math.max(1, hold.offsetHeight - vh);
      var p = 0;
      var active = rect.top <= 0 && rect.bottom >= vh;
      if (rect.top <= 0) {
        p = Math.min(1, Math.max(0, (-rect.top) / scrollable));
      }
      /* JS-only translate3d — no CSS var binding on the same element */
      track.style.willChange = active ? 'transform' : 'auto';
      track.style.transform = 'translate3d(' + (-p * travel).toFixed(2) + 'px,0,0)';
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
      travel = measure();
      progress();
    }

    refresh();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', refresh, { passive: true });
    // Recalc after images load (widths settle)
    track.querySelectorAll('img').forEach(function (img) {
      if (!img.complete) img.addEventListener('load', refresh, { once: true });
    });
    if (typeof mqPhone.addEventListener === 'function') {
      mqPhone.addEventListener('change', refresh);
    } else if (mqPhone.addListener) {
      mqPhone.addListener(refresh);
    }
  }
  armWhoRail();

  if (!motionEnabled && !reduce) enableMotion();
})();
