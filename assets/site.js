(function(){
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // reveal
  var els = document.querySelectorAll('.reveal');
  if('IntersectionObserver' in window){
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); }});
    },{threshold:0.12, rootMargin:'0px 0px -40px 0px'});
    els.forEach(function(el){ io.observe(el); });
  } else { els.forEach(function(el){ el.classList.add('in'); }); }

  // mobile drawer
  var btn = document.querySelector('[data-menu-toggle]');
  var drawer = document.querySelector('[data-menu-drawer]');
  function closeMenu(){
    if(!drawer) return;
    drawer.classList.remove('open');
    document.body.classList.remove('menu-open');
    if(btn){ btn.setAttribute('aria-expanded','false'); }
    // collapse niche group when drawer closes
    document.querySelectorAll('[data-nav-group]').forEach(function(g){
      var t=g.querySelector('[data-nav-group-toggle]');
      var p=g.querySelector('[data-nav-group-panel]');
      if(t) t.setAttribute('aria-expanded','false');
      if(p) p.classList.remove('open');
    });
  }
  function openMenu(){
    if(!drawer) return;
    drawer.classList.add('open');
    document.body.classList.add('menu-open');
    if(btn){ btn.setAttribute('aria-expanded','true'); }
  }
  if(btn && drawer){
    btn.addEventListener('click', function(){
      if(drawer.classList.contains('open')) closeMenu(); else openMenu();
    });
    drawer.addEventListener('click', function(e){
      if(e.target === drawer) closeMenu();
    });
    drawer.querySelectorAll('a').forEach(function(a){ a.addEventListener('click', closeMenu); });
  }

  // desktop Who's $YPOP for dropdown
  var dds = document.querySelectorAll('[data-nav-dd]');
  function closeAllDd(except){
    dds.forEach(function(dd){
      if(except && dd===except) return;
      var b=dd.querySelector('[data-nav-dd-toggle]');
      var p=dd.querySelector('[data-nav-dd-panel]');
      if(b) b.setAttribute('aria-expanded','false');
      if(p) p.classList.remove('open');
    });
  }
  dds.forEach(function(dd){
    var b=dd.querySelector('[data-nav-dd-toggle]');
    var p=dd.querySelector('[data-nav-dd-panel]');
    if(!b||!p) return;
    b.addEventListener('click', function(e){
      e.stopPropagation();
      var open=b.getAttribute('aria-expanded')==='true';
      closeAllDd();
      if(!open){ b.setAttribute('aria-expanded','true'); p.classList.add('open'); }
    });
    p.querySelectorAll('a').forEach(function(a){
      a.addEventListener('click', function(){ closeAllDd(); });
    });
    // keyboard: Escape closes; ArrowDown opens/focuses first
    b.addEventListener('keydown', function(e){
      if(e.key==='ArrowDown'){
        e.preventDefault();
        b.setAttribute('aria-expanded','true'); p.classList.add('open');
        var first=p.querySelector('a'); if(first) first.focus();
      }
    });
    p.addEventListener('keydown', function(e){
      var items=[].slice.call(p.querySelectorAll('a'));
      var i=items.indexOf(document.activeElement);
      if(e.key==='ArrowDown'){ e.preventDefault(); items[Math.min(i+1, items.length-1)]?.focus(); }
      if(e.key==='ArrowUp'){ e.preventDefault(); if(i<=0) b.focus(); else items[i-1].focus(); }
      if(e.key==='Home'){ e.preventDefault(); items[0]?.focus(); }
      if(e.key==='End'){ e.preventDefault(); items[items.length-1]?.focus(); }
      if(e.key==='Escape'){ e.preventDefault(); closeAllDd(); b.focus(); }
      if(e.key==='Tab'){ closeAllDd(); }
    });
  });
  document.addEventListener('click', function(e){
    if(!e.target.closest('[data-nav-dd]')) closeAllDd();
  });

  // mobile niche group
  document.querySelectorAll('[data-nav-group]').forEach(function(g){
    var t=g.querySelector('[data-nav-group-toggle]');
    var p=g.querySelector('[data-nav-group-panel]');
    if(!t||!p) return;
    t.addEventListener('click', function(){
      var open=t.getAttribute('aria-expanded')==='true';
      t.setAttribute('aria-expanded', open?'false':'true');
      p.classList.toggle('open', !open);
    });
  });

  window.addEventListener('keydown', function(e){
    if(e.key==='Escape'){ closeAllDd(); closeMenu(); }
  });

  // hash niche highlight (no new claims — just mark existing hero)
  var hash=(location.hash||'').replace(/^#/,'').toLowerCase();
  var nicheMap={creators:'Creators',athletes:'Athletes',events:'Events',brands:'Brands',communities:'Communities'};
  if(nicheMap[hash]){
    var hero=document.querySelector('.calc-hero, .r-hero, .home-hero-copy');
    if(hero){
      hero.classList.add('niche-hl');
      var lab=hero.querySelector('.label');
      if(lab && !lab.querySelector('.niche-pill')){
        var pill=document.createElement('span');
        pill.className='niche-pill';
        pill.textContent=nicheMap[hash];
        lab.appendChild(pill);
      }
    }
  }

  // phone tilt
  var wrap = document.querySelector('.phone-wrap');
  var stage = document.querySelector('.phone-stage');
  if(wrap && stage && !reduce && window.matchMedia('(pointer:fine)').matches){
    var rx=8, ry=-12, trx=8, try_=-12;
    stage.addEventListener('pointermove', function(e){
      var r = stage.getBoundingClientRect();
      var x = (e.clientX - r.left)/r.width - .5;
      var y = (e.clientY - r.top)/r.height - .5;
      trx = 8 - y*14; try_ = -12 + x*18;
    });
    stage.addEventListener('pointerleave', function(){ trx=8; try_=-12; });
    (function tick(){
      rx += (trx-rx)*.08; ry += (try_-ry)*.08;
      wrap.style.transform = 'rotateX('+rx.toFixed(2)+'deg) rotateY('+ry.toFixed(2)+'deg)';
      requestAnimationFrame(tick);
    })();
  } else if(wrap){
    wrap.style.transform = 'rotateX(8deg) rotateY(-12deg)';
  }
})();
