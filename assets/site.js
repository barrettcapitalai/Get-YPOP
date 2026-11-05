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
