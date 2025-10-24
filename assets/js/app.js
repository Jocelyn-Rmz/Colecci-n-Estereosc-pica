/* ===== Config ===== */
const TOTAL = 15;
const IDS = Array.from({ length: TOTAL }, (_, i) => String(i + 1).padStart(2, '0'));
const PATHS = {
  L: i => `assets/images/left/${i}_L.jpg`,
  R: i => `assets/images/right/${i}_R.jpg`,
  A: i => `assets/images/anaglyph/${i}_A.jpg`,
};

/* ===== Grupos ===== */
const POSITIVAS = ['01','02','03','04','05'];
const NEGATIVAS = ['06','07','08','09','10'];
const NULAS     = ['11','12','13','14','15'];

/* ===== Helpers ===== */
const $ = (s,r=document)=>r.querySelector(s);
const yearSpan = $('#y'); if (yearSpan) yearSpan.textContent = new Date().getFullYear();
function showToast(msg, variant='primary'){
  const el=document.createElement('div');
  el.className=`toast align-items-center text-bg-${variant} border-0 show mb-2`;
  el.innerHTML=`<div class="d-flex"><div class="toast-body">${msg}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div>`;
  $('#toastPlace').appendChild(el); setTimeout(()=>el.remove(),3200);
}

/* ===== Lazy ===== */
const io=new IntersectionObserver((entries)=>{
  entries.forEach(e=>{
    if(!e.isIntersecting) return;
    const img=e.target, src=img.dataset.src; if(!src) return;
    img.src=src;
    img.onload=()=>img.closest('.skeleton')?.classList.remove('skeleton');
    img.onerror=()=>{ img.alt='Imagen no disponible'; img.closest('.skeleton')?.classList.remove('skeleton'); showToast('No se pudo cargar una miniatura.','warning'); };
    io.unobserve(img);
  });
},{rootMargin:'200px'});

/* ===== Etiquetas ===== */
const TYPE_BY_ID=new Map([
  ...POSITIVAS.map(id=>[id,'Positiva']),
  ...NEGATIVAS.map(id=>[id,'Negativa']),
  ...NULAS.map(id=>[id,'Nula']),
]);
const chip=(id)=>{ const t=TYPE_BY_ID.get(id)||'Nula';
  const tone=t==='Positiva'?'primary':(t==='Negativa'?'danger':'secondary');
  return `<span class="badge bg-${tone} rounded-pill">${t}</span>`; };

/* ===== Tarjetas ===== */
function cardTemplate(id){
  const anag=PATHS.A(id);
  return `
  <div class="col-12 col-md-6 col-lg-4">
    <div class="card glass border-0 shadow-sm h-100 card-hover">
      <div class="skeleton"><img class="card-img-top lazy" data-src="${anag}" alt="Miniatura ${id} - Anaglifo"></div>
      <div class="card-body d-flex flex-column">
        <div class="d-flex align-items-center justify-content-between mb-2"><h3 class="h6 mb-0">Escena ${id}</h3>${chip(id)}</div>
        <div class="mt-auto d-flex gap-2">
          <button class="btn btn-primary flex-fill" data-open-scene="${id}">Ver</button>
          <a class="btn btn-outline-light" href="${anag}" download="Escena_${id}_A.jpg">Descargar</a>
        </div>
      </div>
    </div>
  </div>`;}
function renderGrid(ids, containerId){
  const cont=document.getElementById(containerId);
  cont.innerHTML=ids.map(cardTemplate).join('');
  cont.querySelectorAll('img.lazy').forEach(img=>io.observe(img));
}

/* ===== Carrusel (la imagen se ajusta por CSS con object-fit: contain) ===== */
function buildIndicators(len){
  const f=document.createDocumentFragment();
  for(let i=0;i<len;i++){
    const b=document.createElement('button');
    b.type='button'; b.setAttribute('data-bs-target','#carouselMain'); b.setAttribute('data-bs-slide-to',String(i));
    b.setAttribute('aria-label',`Slide ${i+1}`); if(i===0){b.className='active'; b.ariaCurrent='true';}
    f.appendChild(b);
  } return f;
}
function buildCarouselInner(){
  const f=document.createDocumentFragment();
  IDS.forEach((id,idx)=>{
    const item=document.createElement('div'); item.className=`carousel-item ${idx===0?'active':''}`;
    const wrap=document.createElement('div'); wrap.className='stage';
    const img=document.createElement('img'); img.dataset.src=PATHS.A(id); img.alt=`Anaglifo ${id}`; img.className='lazy';
    img.addEventListener('click',()=>openZoom(PATHS.A(id),`Anaglifo ${id}`));
    wrap.appendChild(img); item.appendChild(wrap); f.appendChild(item);
    setTimeout(()=>io.observe(img),0);
  });
  return f;
}
function mountCarousel(){
  $('#carousel-indicators').innerHTML='';
  $('#carousel-inner').innerHTML='';
  $('#carousel-indicators').appendChild(buildIndicators(IDS.length));
  $('#carousel-inner').appendChild(buildCarouselInner());
}

/* ===== Modal ===== */
const sceneModal=new bootstrap.Modal('#sceneModal');
let currentId=null, swapped=false;

const btnModeAnag=$('[data-mode="anaglyph"]');
const btnModeSBS =$('[data-mode="sbs"]');
const viewA=$('#viewAnaglyph'), viewS=$('#viewSBS');
const imgA=$('#imgA'), imgL=$('#imgL'), imgR=$('#imgR');
const btnSwap=$('#btnSwap'), sep=$('#sep'), btnFull=$('#btnFull'), btnShare=$('#btnShare'), btnFit=$('#btnFit');
const modalTitle=$('#sceneTitle'), modalSpinner=$('#modalSpinner');
const dlAnag=$('#dlAnag'), dlLeft=$('#dlLeft'), dlRight=$('#dlRight');

const PREFS={
  get mode(){return localStorage.getItem('mode')||'anaglyph';},
  set mode(v){localStorage.setItem('mode',v);},
  get sep(){return Number(localStorage.getItem('sep')||16);},
  set sep(v){localStorage.setItem('sep',String(v));},
  get swap(){return localStorage.getItem('swap')==='1';},
  set swap(b){localStorage.setItem('swap',b?'1':'0');},
  get fit(){return localStorage.getItem('fit')||'auto';}, /* auto|height|width */
  set fit(v){localStorage.setItem('fit',v);}
};
function setLoading(on){modalSpinner.classList.toggle('d-none',!on);}

/* ====== Ajuste anti-recorte: calcula alto útil del área de imagen ====== */
function computeStageMaxPx(){
  const modal = document.querySelector('#sceneModal .modal-content');
  const header = document.querySelector('#sceneModal .modal-header');
  const footer = document.querySelector('#sceneModal .modal-footer');
  const controls = document.getElementById('controlsBar'); // si no existe, 0
  if(!modal || !header || !footer) return 0;
  const modalH    = modal.clientHeight;
  const headerH   = header.offsetHeight || 0;
  const footerH   = footer.offsetHeight || 0;
  const controlsH = controls ? controls.offsetHeight : 0;
  const padding   = 16; // colchón
  return Math.max(150, modalH - headerH - footerH - controlsH - padding);
}
function applyStageMax(){
  const maxPx = computeStageMaxPx();
  const a = document.getElementById('viewAnaglyph');
  const s = document.getElementById('viewSBS');
  if(a) a.style.setProperty('--stageMax', `${maxPx}px`);
  if(s) s.style.setProperty('--stageMax', `${maxPx}px`);
}

/* ===== Ajuste de imagen: Auto / Alto / Ancho ===== */
function applyFit(mode){
  viewA.classList.remove('fit-height','fit-width','auto');
  viewS.classList.remove('fit-height','fit-width','auto');
  const cls = mode==='width'?'fit-width':mode==='height'?'fit-height':'auto';
  viewA.classList.add(cls); viewS.classList.add(cls);
  btnFit.textContent = `Ajuste: ${mode==='width'?'Ancho':mode==='height'?'Alto':'Auto'}`;
}
function autoFitByAspect(){
  const iw=imgA.naturalWidth||3, ih=imgA.naturalHeight||4;
  const vw=viewA.clientWidth||window.innerWidth, vh=viewA.clientHeight||window.innerHeight;
  const pick = (iw/ih) < (vw/vh) ? 'height' : 'width';   // retrato => alto
  applyFit(pick);
}
btnFit.addEventListener('click',()=>{
  const next=PREFS.fit==='auto'?'height':PREFS.fit==='height'?'width':'auto';
  PREFS.fit=next; if(next==='auto') autoFitByAspect(); else applyFit(next);
  applyStageMax(); // recalcula alto útil
});

function setMode(mode){
  if(mode==='anaglyph'){
    btnModeAnag.classList.replace('btn-outline-primary','btn-primary');
    btnModeSBS.classList.replace('btn-primary','btn-outline-primary');
    viewA.classList.remove('d-none'); viewS.classList.add('d-none'); btnSwap.disabled=true;
  }else{
    btnModeSBS.classList.replace('btn-outline-primary','btn-primary');
    btnModeAnag.classList.replace('btn-primary','btn-outline-primary');
    viewS.classList.remove('d-none'); viewA.classList.add('d-none'); btnSwap.disabled=false;
  } PREFS.mode=mode;
  applyStageMax(); // cada cambio de modo puede variar alturas
}
btnModeAnag.addEventListener('click',()=>setMode('anaglyph'));
btnModeSBS .addEventListener('click',()=>setMode('sbs'));

btnSwap.addEventListener('click',()=>{
  swapped=!swapped; PREFS.swap=swapped;
  if(!currentId) return;
  imgL.src=swapped?PATHS.R(currentId):PATHS.L(currentId);
  imgR.src=swapped?PATHS.L(currentId):PATHS.R(currentId);
});
sep.addEventListener('input',()=>{ const v=Number(sep.value); viewS.style.setProperty('--gap',`${v}px`); PREFS.sep=v; });
btnFull.addEventListener('click',()=>{ const node=!viewA.classList.contains('d-none')?viewA:viewS; node.requestFullscreen?.(); });
btnShare.addEventListener('click',async()=>{
  const url=`${location.origin}${location.pathname}#scene=${currentId}`;
  try{ if(navigator.share){await navigator.share({title:`Escena ${currentId}`, url});} else {await navigator.clipboard.writeText(url); showToast('Enlace copiado.');} }catch{}
});

const preload=(src)=>new Promise(res=>{const i=new Image(); i.onload=res; i.onerror=res; i.src=src;});
function setDownloadLinks(id){
  dlAnag.href=PATHS.A(id); dlAnag.download=`Escena_${id}_A.jpg`;
  dlLeft.href=PATHS.L(id); dlLeft.download=`Escena_${id}_L.jpg`;
  dlRight.href=PATHS.R(id); dlRight.download=`Escena_${id}_R.jpg`;
}
async function openScene(id,opts={mode:PREFS.mode}){
  currentId=id; swapped=PREFS.swap;
  sep.value=PREFS.sep; viewS.style.setProperty('--gap',`${PREFS.sep}px`);
  modalTitle.textContent=`Escena ${id} • ${(TYPE_BY_ID.get(id)||'Nula')}`; setLoading(true);

  imgA.src=PATHS.A(id);
  imgL.src=swapped?PATHS.R(id):PATHS.L(id);
  imgR.src=swapped?PATHS.L(id):PATHS.R(id);
  setDownloadLinks(id);

  await Promise.all([preload(imgA.src),preload(imgL.src),preload(imgR.src)]);

  // Ajustes de imagen y alto útil (anti-recorte)
  if(PREFS.fit==='auto') autoFitByAspect(); else applyFit(PREFS.fit);
  applyStageMax();

  setMode(opts.mode==='sbs'?'sbs':'anaglyph');
  setLoading(false); sceneModal.show();
}

/* Navegación teclado modal */
function nav(delta){ const idx=IDS.indexOf(currentId); if(idx<0) return; openScene(IDS[(idx+delta+IDS.length)%IDS.length], {mode: !viewA.classList.contains('d-none')?'anaglyph':'sbs'}); }
document.addEventListener('keydown',(e)=>{ if(!$('.modal.show')) return; if(e.key==='ArrowRight') nav(+1); if(e.key==='ArrowLeft') nav(-1); });

/* Reajuste cuando el modal se muestra y en redimensionar */
document.addEventListener('shown.bs.modal', (ev)=>{ if(ev.target && ev.target.id==='sceneModal'){ applyStageMax(); }});
window.addEventListener('resize',()=>{
  if($('.modal.show')){ applyStageMax(); if(PREFS.fit==='auto') autoFitByAspect(); }
});

/* Zoom overlay */
const overlay=$('#zoomOverlay'), zoomImg=$('#zoomImg'), closeBtn=overlay.querySelector('.zoom-close');
function openZoom(src,alt){ zoomImg.src=''; overlay.classList.remove('d-none'); document.body.style.overflow='hidden'; setTimeout(()=>{zoomImg.src=src; zoomImg.alt=alt||'Anaglifo';},20); }
function closeZoom(){ overlay.classList.add('d-none'); zoomImg.src=''; document.body.style.overflow=''; }
overlay.addEventListener('click',(e)=>{ if(e.target===overlay||e.target===closeBtn) closeZoom(); });
document.addEventListener('keydown',(e)=>{ if(e.key==='Escape'&&!overlay.classList.contains('d-none')) closeZoom(); });

/* Delegación tarjetas */
function wireGrids(){ ['gridPos','gridNeg','gridNul'].forEach(id=>{ const root=document.getElementById(id);
  root.addEventListener('click',(e)=>{ const btn=e.target.closest('[data-open-scene]'); if(btn) openScene(btn.getAttribute('data-open-scene')); }); }); }

/* Demo disparidad */
const demoAnag=$('#demoAnag'), demoSBS=$('#demoSBS'), layerRed=demoAnag?.querySelector('.layer-red'), layerCyan=demoAnag?.querySelector('.layer-cyan');
const demoModeAnag=$('#demoModeAnag'), demoModeSBS=$('#demoModeSBS'), demoSep=$('#demoSep'), demoSepVal=$('#demoSepVal'), tPos=$('#tPos'), tNul=$('#tNul'), tNeg=$('#tNeg');
let demoMode='anag', demoType='pos', demoOffset=16;
function updateDemo(){
  demoSepVal.textContent=`${demoOffset} px`;
  if(demoMode==='anag'){
    demoAnag.classList.remove('d-none'); demoSBS.classList.add('d-none');
    let rX=0,cX=0; if(demoType==='pos'){rX=-demoOffset; cX= demoOffset;} if(demoType==='neg'){rX= demoOffset; cX=-demoOffset;}
    layerRed.style.transform=`translateX(${rX}px)`; layerCyan.style.transform=`translateX(${cX}px)`;
  }else{
    demoAnag.classList.add('d-none'); demoSBS.classList.remove('d-none');
    demoSBS.style.setProperty('--demo-gap', `${16 + (demoType==='nul'?0:demoOffset)}px`);
  }
}
demoModeAnag?.addEventListener('click',()=>{demoMode='anag'; demoModeAnag.classList.replace('btn-outline-primary','btn-primary'); demoModeSBS.classList.replace('btn-primary','btn-outline-primary'); updateDemo();});
demoModeSBS ?.addEventListener('click',()=>{demoMode='sbs';  demoModeSBS .classList.replace('btn-outline-primary','btn-primary'); demoModeAnag .classList.replace('btn-primary','btn-outline-primary'); updateDemo();});
demoSep?.addEventListener('input',e=>{demoOffset=Number(e.target.value); updateDemo();});
tPos?.addEventListener('change',()=>{demoType='pos'; updateDemo();});
tNul?.addEventListener('change',()=>{demoType='nul'; updateDemo();});
tNeg?.addEventListener('change',()=>{demoType='neg'; updateDemo();});

/* Init */
window.addEventListener('DOMContentLoaded',()=>{
  $('#totalScenes').textContent=String(IDS.length);
  renderGrid(POSITIVAS,'gridPos'); renderGrid(NEGATIVAS,'gridNeg'); renderGrid(NULAS,'gridNul'); wireGrids();
  mountCarousel();
  document.querySelectorAll('#instrucciones [data-action="scroll-galeria"]').forEach(b=>b.addEventListener('click',()=>document.getElementById('galeria').scrollIntoView({behavior:'smooth'})));
  updateDemo();
  const m=location.hash.match(/scene=(\d{2})/); if(m && IDS.includes(m[1])) openScene(m[1],{mode:PREFS.mode});
});
/* Forzar carga del slide siguiente y evitar “pantalla negra” al cambiar */
const carouselEl = document.getElementById('carouselMain');
if (carouselEl) {
  // Inicializa por si el HTML no lo hace automáticamente
  const bsCarousel = bootstrap.Carousel.getInstance(carouselEl) || new bootstrap.Carousel(carouselEl, {
    interval: false, wrap: true, ride: false
  });

  // Al iniciar el cambio de slide, asegúrate de cargar su imagen
  carouselEl.addEventListener('slide.bs.carousel', (e) => {
    const nextImg = e.relatedTarget?.querySelector('img.lazy');
    if (nextImg && !nextImg.src) {
      nextImg.src = nextImg.dataset.src;
    }
  });
}
