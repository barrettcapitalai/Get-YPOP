/* $YPOP motion kit — Linea techniques adapted (MIT). */
(function () {
  var reduce = false;
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  var supportsTimeline = false;
  try { supportsTimeline = CSS.supports('animation-timeline: view()'); } catch (e) {}
  if (!reduce && supportsTimeline) {
    document.documentElement.setAttribute('data-ypop-live', '');
  }

  var ease = 'cubic-bezier(.2,.7,.2,1)';
  var root = document.documentElement;

  /* Nav scrolled state */
  function onScrollNav() {
    if (window.scrollY > 18) root.classList.add('is-scrolled');
    else root.classList.remove('is-scrolled');
  }
  onScrollNav();
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
      // Keep existing <br> structure as hard breaks
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

  /* Enhanced reveals — observe .reveal and [data-split] */
  function armReveals() {
    var els = document.querySelectorAll('.reveal, [data-split="lines"]');
    if (!els.length) return;
    function show(el) {
      el.classList.add('in');
      if (el.classList.contains('motion-lines') || el.querySelector('.motion-lines')) {
        (el.classList.contains('motion-lines') ? el : el.querySelector('.motion-lines')).classList.add('is-in');
      }
      var lines = el.querySelector('.motion-lines');
      if (lines) lines.classList.add('is-in');
    }
    if (reduce) {
      els.forEach(show);
      return;
    }
    if (!('IntersectionObserver' in window)) {
      els.forEach(show);
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        show(e.target);
        io.unobserve(e.target);
      });
    }, { threshold: 0.14, rootMargin: '0px 0px -8% 0px' });
    els.forEach(function (el) { io.observe(el); });
  }
  armReveals();

  /* Auto-mark common home clusters for stagger if not already */
  function autoStagger() {
    ['.who-grid', '.feat', '.flow', '.fly', '.cards', '.closing', '.faq-list'].forEach(function (sel) {
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
  // Re-arm observers for newly tagged nodes
  armReveals();

  /* Subtle parallax on [data-parallax] — transform only */
  function armParallax() {
    if (reduce) return;
    if (window.matchMedia('(max-width:900px)').matches) return;
    var nodes = Array.prototype.slice.call(document.querySelectorAll('[data-parallax]'));
    if (!nodes.length) return;
    var ticking = false;
    function update() {
      ticking = false;
      var vh = window.innerHeight;
      nodes.forEach(function (el) {
        var rect = el.getBoundingClientRect();
        var mid = rect.top + rect.height / 2;
        var p = (mid - vh / 2) / vh; // -1..1 around center
        var amp = parseFloat(el.getAttribute('data-parallax')) || 12;
        var y = Math.max(-amp, Math.min(amp, -p * amp));
        var scale = el.hasAttribute('data-parallax-scale') ? 1.06 : 1;
        el.style.transform = 'translate3d(0,' + y.toFixed(2) + 'px,0) scale(' + scale + ')';
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
        el.classList.toggle('is-active', j === i);
        el.setAttribute('aria-hidden', j === i ? 'false' : 'true');
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
})();
