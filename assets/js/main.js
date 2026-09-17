/* Valour — site behavior: view routing, hero grid, 3D card scene, gameplay gallery. */
(function(){
  "use strict";
  var yr=document.getElementById('yr'); if(yr) yr.textContent=new Date().getFullYear();
  var ART=(window.HERO_ART||[]).concat(window.HERO_ART_EXTRA||[]);

  /* ---------- View routing (hash based) ---------- */
  var views=document.querySelectorAll('.view');
  function show(id){
    var found=false;
    views.forEach(function(v){ var on=v.id===id; v.classList.toggle('active',on); if(on)found=true; });
    if(!found){ id='home'; document.getElementById('home').classList.add('active'); }
    document.querySelectorAll('nav.main a, .mobile-nav a').forEach(function(a){
      a.classList.toggle('active', a.getAttribute('data-nav')===id);
    });
    window.scrollTo(0,0);
    if(scene){ id==='home' ? play() : pause(); }
    onScroll();
  }
  function route(){ show((location.hash||'#home').replace('#','')); }
  window.addEventListener('hashchange', route);

  /* ---------- Header scroll state ---------- */
  var hdr=document.getElementById('hdr');
  function onScroll(){ hdr.classList.toggle('scrolled', window.scrollY>40 || !document.getElementById('home').classList.contains('active')); }
  window.addEventListener('scroll', onScroll, {passive:true});

  /* ---------- Heroes grid (finished card images) ---------- */
  var grid=document.getElementById('heroGrid');
  if(grid){
    ART.forEach(function(h){
      var el=document.createElement('div'); el.className='hcard';
      el.innerHTML='<img class="art" alt="'+h.name+'" src="'+h.img+'" loading="lazy" style="width:100%;height:100%;object-fit:cover">'+
                   '<div class="glare"></div>';
      grid.appendChild(el);
    });
    grid.querySelectorAll('.hcard').forEach(function(card){
      card.addEventListener('pointermove',function(e){
        var r=card.getBoundingClientRect();
        var px=(e.clientX-r.left)/r.width, py=(e.clientY-r.top)/r.height;
        card.style.transform='perspective(900px) rotateY('+((px-.5)*14)+'deg) rotateX('+((.5-py)*16)+'deg) translateZ(6px)';
        card.style.setProperty('--mx',(px*100)+'%'); card.style.setProperty('--my',(py*100)+'%');
      });
      card.addEventListener('pointerleave',function(){ card.style.transform=''; });
    });
  }

  /* ---------- Home gameplay gallery ---------- */
  (function(){
    var host=document.getElementById('shotGallery'); if(!host)return;
    (window.VALOUR_SHOTS||[]).forEach(function(s,i){
      var row=document.createElement('div'); row.className='shot'+(i%2?' alt':'');
      row.innerHTML='<div class="shot-img"><img src="'+s.src+'" alt="'+s.title+'" loading="lazy"></div>'+
                    '<div class="shot-cap"><h3>'+s.title+'</h3><p>'+s.blurb+'</p></div>';
      host.appendChild(row);
    });
  })();

  /* ---------- Three.js floating card scene ---------- */
  var scene,camera,renderer,cards=[],particles,raf=null,running=false,mouse={x:0,y:0};
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canvas=document.getElementById('cardCanvas');

  function init(){
    if(!canvas || !window.THREE){ if(canvas) canvas.style.display='none'; return; }
    try{
      renderer=new THREE.WebGLRenderer({canvas:canvas,alpha:true,antialias:true});
      renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
      scene=new THREE.Scene();
      scene.fog=new THREE.FogExp2(0x0b0e17,0.05);
      camera=new THREE.PerspectiveCamera(52,1,0.1,100); camera.position.set(0,0,9.4);
      resize();

      var N=260,pos=new Float32Array(N*3),spd=new Float32Array(N);
      for(var i=0;i<N;i++){pos[i*3]=(Math.random()-.5)*18;pos[i*3+1]=(Math.random()-.5)*12;pos[i*3+2]=(Math.random()-.5)*8;spd[i]=0.004+Math.random()*0.012;}
      var pg=new THREE.BufferGeometry(); pg.setAttribute('position',new THREE.BufferAttribute(pos,3));
      var pm=new THREE.PointsMaterial({color:0xc8a24b,size:0.05,transparent:true,opacity:.7,depthWrite:false,blending:THREE.AdditiveBlending});
      particles=new THREE.Points(pg,pm); particles.userData.spd=spd; scene.add(particles);

      window.addEventListener('resize',resize);
      window.addEventListener('pointermove',function(e){mouse.x=(e.clientX/window.innerWidth-.5);mouse.y=(e.clientY/window.innerHeight-.5);},{passive:true});
      document.addEventListener('visibilitychange',function(){document.hidden?pause():(document.getElementById('home').classList.contains('active')&&play());});

      buildCards();
    }catch(err){ if(canvas) canvas.style.display='none'; }
  }

  function buildCards(){
    var geo=new THREE.PlaneGeometry(2.0,2.8);
    var loader=new THREE.TextureLoader();
    var floatArt=ART.filter(function(a){return a.pos && a.tex;});
    var total=floatArt.length, done=0;
    if(!total){ startRender(); return; }
    floatArt.forEach(function(d){
      loader.load(d.tex, function(tex){
        tex.anisotropy=8;
        var mat=new THREE.MeshBasicMaterial({map:tex,transparent:true});
        var m=new THREE.Mesh(geo,mat); var p=d.pos;
        m.position.set(p[0],p[1],p[2]); m.rotation.z=p[3];
        m.userData={baseX:p[0],baseY:p[1],baseZ:p[2],baseR:p[3],ph:Math.random()*6.28,sp:0.5+Math.random()*0.5};
        scene.add(m); cards.push(m);
        if(reduce)renderOnce();
        if(++done===total)startRender();
      }, undefined, function(){ if(++done===total)startRender(); });
    });
  }
  function startRender(){ if(reduce){renderOnce();} else if(document.getElementById('home').classList.contains('active')){play();} else {renderOnce();} }
  function resize(){ if(!renderer)return; var w=window.innerWidth,h=window.innerHeight; renderer.setSize(w,h,false); camera.aspect=w/h; camera.updateProjectionMatrix(); }

  var t0=performance.now();
  function frame(now){
    var t=(now-t0)/1000;
    cards.forEach(function(m){
      var u=m.userData;
      m.position.y=u.baseY+Math.sin(t*u.sp+u.ph)*0.28;
      m.position.x=u.baseX+Math.cos(t*u.sp*0.6+u.ph)*0.12 + mouse.x*(1.2 - u.baseZ*0.15);
      m.rotation.z=u.baseR+Math.sin(t*0.4+u.ph)*0.05;
      m.rotation.y=mouse.x*0.5; m.rotation.x=mouse.y*0.35;
    });
    if(particles){
      var p=particles.geometry.attributes.position.array,sp=particles.userData.spd;
      for(var i=0;i<sp.length;i++){p[i*3+1]+=sp[i];if(p[i*3+1]>6)p[i*3+1]=-6;}
      particles.geometry.attributes.position.needsUpdate=true;
      particles.rotation.y=mouse.x*0.15;
    }
    renderer.render(scene,camera);
    raf=requestAnimationFrame(frame);
  }
  function play(){ if(reduce){renderOnce();return;} if(running||!renderer)return; running=true; t0=performance.now(); raf=requestAnimationFrame(frame); }
  function pause(){ running=false; if(raf)cancelAnimationFrame(raf); raf=null; }
  function renderOnce(){ if(renderer) renderer.render(scene,camera); }

  init(); route(); onScroll();
})();
