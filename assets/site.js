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

/* ===== HubSpot intake config =====
   Creator Banker portal 48972179 (NA2). With no formGuid we use HubSpot
   non-HubSpot / collected forms via the tracking code. Optional formGuid
   switches the submit path to the Forms API v3. */
window.YPOP_HUBSPOT = window.YPOP_HUBSPOT || {
  portalId: '48972179',
  formGuid: '',
  industryField: 'industry',
  scriptHost: 'js-na2.hs-scripts.com'
};

(function(){
  // FAQ accordion
  document.querySelectorAll('[data-faq]').forEach(function(b){
    b.addEventListener('click', function(){
      var p=document.getElementById(b.getAttribute('aria-controls'));
      var open=b.getAttribute('aria-expanded')==='true';
      b.setAttribute('aria-expanded', open?'false':'true');
      if(p) p.hidden=open;
    });
  });
  // open FAQ item from hash (e.g. /faq/#gen-1-q)
  if(location.hash){
    var t=document.getElementById(location.hash.slice(1));
    if(t && t.hasAttribute('data-faq') && t.getAttribute('aria-expanded')!=='true') t.click();
  }

  var cfg0 = window.YPOP_HUBSPOT || {};
  // Tracking code must load for collected forms. Inject once, after the
  // intake form is in the DOM so HubSpot's scan can find it.
  function injectTracking(){
    if(!cfg0.portalId || document.getElementById('hs-script-loader')) return;
    var host = cfg0.scriptHost || 'js-na2.hs-scripts.com';
    var s = document.createElement('script');
    s.type = 'text/javascript';
    s.id = 'hs-script-loader';
    s.async = true;
    s.defer = true;
    s.src = 'https://' + host + '/' + encodeURIComponent(cfg0.portalId) + '.js';
    document.body.appendChild(s);
  }

  // firstname (not "name") so collected forms map to HubSpot's firstname property.
  var FORM_HTML = "<form class=\"intake\" data-intake-form action=\"/work-with-us/?sent=1\" method=\"get\" novalidate>\n  <div class=\"fld\"><label for=\"md-name\">Name</label><input id=\"md-name\" name=\"firstname\" type=\"text\" autocomplete=\"name\" required maxlength=\"120\"><span class=\"err\" id=\"md-name-err\" aria-live=\"polite\"></span></div>\n  <div class=\"fld\"><label for=\"md-ind\">Industry</label><select id=\"md-ind\" name=\"industry\" required><option value=\"\">Select your industry</option><option>Creator</option><option>Athlete</option><option>Brand</option><option>Agency</option><option>Restaurant</option><option>Event</option><option>Community</option><option>Other</option></select><span class=\"err\" id=\"md-ind-err\" aria-live=\"polite\"></span></div>\n  <div class=\"fld\"><label for=\"md-email\">Email</label><input id=\"md-email\" name=\"email\" type=\"email\" autocomplete=\"email\" required maxlength=\"200\"><span class=\"err\" id=\"md-email-err\" aria-live=\"polite\"></span></div>\n  <button class=\"btn\" type=\"submit\">Send</button>\n  <p class=\"form-status\" role=\"status\" aria-live=\"polite\"></p>\n  <p class=\"privacy-note\">We use your details only to reply about working with $YPOP. See our <a href=\"/faq/#gen-1-q\">privacy policy</a>.</p>\n</form>";
  var modal=null, lastFocus=null;
  function buildModal(){
    if(modal) return;
    modal=document.createElement('div');
    modal.className='intake-modal'; modal.setAttribute('data-intake-modal','');
    modal.innerHTML='<div class="intake-dialog" role="dialog" aria-modal="true" aria-labelledby="intake-title">'+
      '<button type="button" class="intake-close" data-intake-close aria-label="Close"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>'+
      '<div class="label"><span class="dot"></span>Work with us</div><h2 id="intake-title">Get your <span class="lime">Piece.</span></h2>'+
      '<p class="lede">Tell us who you are and we\'ll be in touch.</p>'+FORM_HTML+'</div>';
    document.body.appendChild(modal);
    modal.addEventListener('click', function(e){ if(e.target===modal || e.target.closest('[data-intake-close]')) closeModal(); });
    modal.addEventListener('keydown', function(e){
      if(e.key==='Escape'){ e.stopPropagation(); closeModal(); }
      if(e.key==='Tab'){
        var f=[].slice.call(modal.querySelectorAll('button,input,select,a[href]')).filter(function(x){return !x.disabled && x.offsetParent!==null;});
        if(!f.length) return;
        if(e.shiftKey && document.activeElement===f[0]){ e.preventDefault(); f[f.length-1].focus(); }
        else if(!e.shiftKey && document.activeElement===f[f.length-1]){ e.preventDefault(); f[0].focus(); }
      }
    });
    wireForm(modal.querySelector('[data-intake-form]'));
  }
  function openModal(){
    if(!modal) buildModal();
    lastFocus=document.activeElement;
    modal.classList.add('open'); document.body.classList.add('modal-open');
    setTimeout(function(){ var i=modal.querySelector('input'); if(i) i.focus(); }, 30);
  }
  function closeModal(){
    if(!modal) return;
    modal.classList.remove('open'); document.body.classList.remove('modal-open');
    if(lastFocus && lastFocus.focus) lastFocus.focus();
  }
  window.YPOP_openIntake=openModal;
  document.addEventListener('click', function(e){
    var a=e.target.closest('a[data-intake]');
    if(!a || location.pathname.indexOf('/work-with-us')===0) return;
    if(e.metaKey||e.ctrlKey||e.shiftKey||e.button===1) return;
    e.preventDefault();
    var drawer=document.querySelector('[data-menu-drawer].open'); if(drawer){ drawer.classList.remove('open'); document.body.classList.remove('menu-open'); }
    openModal();
  });

  function nameField(form){ return form.elements.firstname || form.elements.name; }
  function setErr(form, el, msg){
    var e=form.querySelector('#'+el.id+'-err');
    el.setAttribute('aria-invalid', msg?'true':'false');
    if(msg) el.setAttribute('aria-describedby', el.id+'-err'); else el.removeAttribute('aria-describedby');
    if(e) e.textContent=msg||'';
  }
  function validate(form){
    var n=nameField(form), i=form.elements.industry, m=form.elements.email, ok=true, first=null;
    if(!n || !i || !m) return false;
    var nv=n.value.trim(), mv=m.value.trim();
    if(!nv){ setErr(form,n,'Please enter your name.'); ok=false; first=first||n; } else setErr(form,n,'');
    if(!i.value){ setErr(form,i,'Please choose your industry.'); ok=false; first=first||i; } else setErr(form,i,'');
    if(!mv){ setErr(form,m,'Please enter your email.'); ok=false; first=first||m; }
    else if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mv)){ setErr(form,m,'Please enter a valid email address.'); ok=false; first=first||m; }
    else setErr(form,m,'');
    if(first) first.focus();
    return ok;
  }
  function showThanks(form){
    var status=form.querySelector('.form-status');
    form.reset();
    form.querySelectorAll('[aria-invalid]').forEach(function(el){ el.removeAttribute('aria-invalid'); el.removeAttribute('aria-describedby'); });
    form.querySelectorAll('.err').forEach(function(e){ e.textContent=''; });
    if(status){ status.className='form-status ok'; status.textContent='Thanks — we got it. We\'ll be in touch soon.'; }
  }
  function wireForm(form){
    if(!form || form.__wired) return; form.__wired=true;
    // Collected-forms friendly defaults (no hidden fields).
    if(!form.getAttribute('action')) form.setAttribute('action','/work-with-us/?sent=1');
    if(!form.getAttribute('method')) form.setAttribute('method','get');
    var nf=nameField(form);
    if(nf && nf.name==='name') nf.name='firstname';
    var status=form.querySelector('.form-status'), btn=form.querySelector('button[type=submit]');
    function say(cls,msg){ if(!status) return; status.className='form-status '+cls; status.textContent=msg; }

    // Thank-you landing after a native collected-forms submit.
    if(/[?&]sent=1(?:&|$)/.test(location.search) && location.pathname.indexOf('/work-with-us')===0){
      showThanks(form);
    }

    form.addEventListener('submit', function(e){
      say('','');
      if(!validate(form)){ e.preventDefault(); return; }
      var cfg=window.YPOP_HUBSPOT||{};
      // Forms API path when a HubSpot form GUID is configured.
      if(cfg.portalId && cfg.formGuid){
        e.preventDefault();
        var full=nameField(form).value.trim(), parts=full.split(/\s+/);
        var first=parts.shift(), last=parts.join(' ');
        var fields=[{objectTypeId:'0-1',name:'firstname',value:first},{objectTypeId:'0-1',name:'email',value:form.elements.email.value.trim()},{objectTypeId:'0-1',name:cfg.industryField||'industry',value:form.elements.industry.value}];
        if(last) fields.push({objectTypeId:'0-1',name:'lastname',value:last});
        var body={fields:fields,context:{pageUri:location.href,pageName:document.title}};
        var hm=document.cookie.match(/(?:^|;\s*)hubspotutk=([^;]+)/); if(hm) body.context.hutk=hm[1];
        btn.disabled=true; var old=btn.textContent; btn.textContent='Sending…';
        fetch('https://api.hsforms.com/submissions/v3/integration/submit/'+encodeURIComponent(cfg.portalId)+'/'+encodeURIComponent(cfg.formGuid),{
          method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)
        }).then(function(r){
          if(!r.ok) throw new Error('HTTP '+r.status);
          showThanks(form);
        }).catch(function(){
          say('bad','Something went wrong and your details were not sent. Please try again, or email info@getypop.com.');
        }).finally(function(){ btn.disabled=false; btn.textContent=old; });
        return;
      }
      // Collected / non-HubSpot forms path.
      // HubSpot requires no JS that intercepts submit for reliable collection, so
      // we let the browser navigate to action="/work-with-us/?sent=1" (method=get).
      // Do not preventDefault here.
      if(btn){ btn.disabled=true; btn.textContent='Sending…'; }
      // allow native submit
    });
  }
  // Build the modal form at initial load so HubSpot's collected-forms scan can see it.
  if(location.pathname.indexOf('/work-with-us')!==0) buildModal();
  document.querySelectorAll('[data-intake-form]').forEach(wireForm);
  injectTracking();
})();

