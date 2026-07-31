/* ============================================================
   MOTORUL comun pentru vederile pe echipe ale programului #21.
   Datele vin din program.js — ÎNCĂRCAT DE PE SITE-UL MASTER
   (ideoideis.github.io/program-intern-21/program.js), deci orice
   schimbare de program făcută acolo apare aici automat.
   Fiecare pagină definește un obiect de configurare `AUD`:

     window.AUD = {
       key:'formatori',
       cats:['tt','ateliere',…],  // categoriile vizibile
       skipDays:['ma28','mi5'],   // zile scoase complet
       hideTrupa:false,           // ascunde rândurile marcate cu o trupă
       trupePicker:true,          // selectorul „urmărește o trupă”
       compact:'trupa',           // montări/repetiții: true / 'trupa' / false
       transport:true,            // benzile & liniile de transport
       showTech:false,            // rândurile @tehnic + comutatorul lor
       showNeeds:false,           // necesar tehnic / producție
       greetings:null,            // replici pentru header (null = ascuns)
       sw:'sw.js',                // calea către service worker
       info:{trupe:true, arteAlaturate:true, legend:false, …},
     };

   Filtrarea pe public se face la nivel de DATE (nu doar din chipuri):
   fiecare pagină vede doar evenimentele ei, iar grila / căutarea /
   chipurile reflectă exact acel subset. Fără stratul „live”.
   ============================================================ */
(function(){
'use strict';

const AUD = window.AUD || {key:'all', cats:Object.keys(CATS), hideTrupa:false, trupePicker:false, info:{}};
const INFO = AUD.info || {};

/* ── utilitare ──────────────────────────── */
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
/* telefoane voluntari (pentru ateliere): din CONTACTS + EXTRA_PHONES, potrivire pe set de tokeni */
const _nrm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/ș/g,'s').replace(/ț/g,'t').replace(/î/g,'i').replace(/â/g,'a');
const _TEL = (()=>{const a=[]; const add=(n,ph)=>{ if(ph&&/\d/.test(ph)) a.push({t:new Set(_nrm(n).split(/[^a-z0-9]+/).filter(Boolean)),ph}); };
  if(typeof CONTACTS!=='undefined') CONTACTS.forEach(([d,ppl])=>ppl.forEach(x=>add(x[0],x[2])));
  if(typeof EXTRA_PHONES!=='undefined') Object.entries(EXTRA_PHONES).forEach(([n,ph])=>add(n,ph));
  return a;})();
function phoneOf(name){ const t=new Set(_nrm(name).split(/[^a-z0-9]+/).filter(Boolean));
  let e=_TEL.find(x=>x.t.size===t.size&&[...t].every(y=>x.t.has(y))); if(e)return e.ph;
  for(const x of _TEL){ const sh=[...t].filter(y=>x.t.has(y)).length; if(sh>=2&&(sh===t.size||sh===x.t.size))return x.ph; } return null; }
/* people-picker: buton „voluntari" → sheet cu poză/inițiale + telefon, ca pe programul mare */
function _nmToks(s){s=String(s).normalize('NFKD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[șş]/g,'s').replace(/[țţ]/g,'t');return new Set(s.split(/[^a-z0-9]+/).filter(Boolean));}
const _PHIDX=(()=>{const a=[];if(typeof PHOTOS!=='undefined')for(const k in PHOTOS)a.push([_nmToks(k),PHOTOS[k]]);return a;})();
function photoFor(n){if(!n)return null;if(typeof PHOTOS!=='undefined'&&PHOTOS[n])return PHOTOS[n];const t=_nmToks(n);if(t.size<2)return null;for(const [kt,p] of _PHIDX){if(kt.size!==t.size)continue;let eq=true;for(const x of t)if(!kt.has(x)){eq=false;break;}if(eq)return p;}let hit=null,many=false;for(const [kt,p] of _PHIDX){const sm=t.size<=kt.size?t:kt,lg=t.size<=kt.size?kt:t;if(sm.size<2)continue;let sub=true;for(const x of sm)if(!lg.has(x)){sub=false;break;}if(sub){if(hit&&hit!==p){many=true;break;}hit=p;}}return many?null:hit;}
function peopleFromStr(str,roleDefault){return String(str).split(/\s*\+\s*|,\s*/).map(p=>{p=p.trim();if(!p)return null;const isGhid=/\(ghid\)/i.test(p);const name=p.replace(/\s*\(ghid\)/i,'').trim();return {name,role:isGhid?'ghid':(roleDefault||''),tel:phoneOf(name),photo:photoFor(name)};}).filter(Boolean);}
let _pgSeq=0; const PEOPLE_GROUPS={};
function peopleButton(people,btnLabel,sheetTitle){people=(people||[]).filter(Boolean);if(!people.length)return '';const id='pg'+(++_pgSeq);PEOPLE_GROUPS[id]={label:sheetTitle||btnLabel,people};const names=people.map(p=>p.name).join(', ');return `<button type="button" class="pbtn" data-people="${id}" aria-label="${esc(btnLabel+': '+names)}">${esc(btnLabel)}${people.length>1?`<span class="pbn">${people.length}</span>`:''}<span class="pbc">›</span></button>`;}
function _initials(n){return n.split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0]||'').join('').toUpperCase();}
function _hue(n){let h=0;for(let i=0;i<n.length;i++)h=(h*31+n.charCodeAt(i))%360;return h;}
/* ── prezență ateliere: buton „prezență" per atelier → formular bifat, salvat CENTRAL (Supabase) ── */
const PZ_SUPA_URL='https://waqyaewaldphstmiobjj.supabase.co';
const PZ_SUPA_KEY='sb_publishable_XtarsOK52eqlRUmv1ElS4Q_RwrDK78G'; /* cheia publică, ca pe programul mare */
const pzSb=(path,opt={})=>fetch(PZ_SUPA_URL+'/rest/v1'+path,Object.assign({},opt,{headers:Object.assign({apikey:PZ_SUPA_KEY,Authorization:'Bearer '+PZ_SUPA_KEY,'Content-Type':'application/json'},opt.headers||{})}));
const _slugOf={}; if(typeof TRUPE_IDS!=='undefined')Object.entries(TRUPE_IDS).forEach(([slug,nm])=>{_slugOf[nm]=slug;});
function ttRoster(trupaName){const slug=_slugOf[trupaName];if(slug&&typeof REPARTIZARE!=='undefined'&&REPARTIZARE[slug])return REPARTIZARE[slug][1].map(x=>({name:x[0],sub:''}));return [];}
function arteRoster(atelierName){const g=(typeof ARTE_PARTICIPANTI!=='undefined')&&ARTE_PARTICIPANTI[atelierName];if(!g)return [];return g.flatMap(r=>r.slice(1).map(n=>({name:n,sub:r[0]})));}
let _pzSeq=0; const PREZ_GROUPS={};
function prezButton(zi,atelierKey,label,people){people=(people||[]).filter(Boolean);if(!people.length||!zi)return '';const id='pz'+(++_pzSeq);PREZ_GROUPS[id]={zi,atelier:atelierKey,label,people};return `<button type="button" class="pzbtn" data-prez="${id}" aria-label="prezență ${esc(label)}">prezență<span class="pbc">›</span></button>`;}
const mins = hm => { const [h,m]=hm.split(':').map(Number); let v=h*60+m; if(h<5)v+=1440; return v; };
const smins = ev => mins(ev.ts || ev.t);
const maps = q => 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent((typeof MAPQ!=='undefined'&&MAPQ[q])||q+' Alexandria');

const lu=document.getElementById('lastupd'); if(lu)lu.textContent=LAST_UPDATED;

/* ── ce evenimente intră în programul acestui public ── */
function deDiac(s){return String(s).toLowerCase().replace(/[ăâáà]/g,'a').replace(/[îí]/g,'i').replace(/[éè]/g,'e').replace(/[óò]/g,'o').replace(/[úù]/g,'u').replace(/[șş]/g,'s').replace(/[țţ]/g,'t');}
function includeEvent(ev){
  if(ev.k==='e'){
    const t=ev.title||'';
    /* excepții punctuale, pe titlu: scoase sau băgate indiferent de categorie */
    if((AUD.exclude||[]).some(x=>t.includes(x))) return false;
    if((AUD.include||[]).some(x=>t.includes(x))) return true;
    if(!AUD.cats.includes(ev.cat||'alt')) return false;
    if(AUD.hideTrupa && ev.trupa) return false;
    if(ev.c){ /* montări / repetiții / probe */
      if(AUD.compact===false) return false;
      if(AUD.compact==='trupa' && !ev.trupa) return false;
    }
    return true;
  }
  if(ev.k==='t'){
    if(AUD.transport===false) return false;
    if(AUD.hideTrupa && ev.trupa) return false;
    return true;
  }
  if(ev.k==='m'){
    if(AUD.meals===false) return false;
    if(AUD.hideTrupa && ev.trupa) return false;
    return true; /* mesele generale rămân scheletul zilei */
  }
  if(ev.k==='x') return AUD.showTech!==false;
  return true;
}
const SKIP=new Set(AUD.skipDays||[]);
const DAYS_A = DAYS.filter(d=>!SKIP.has(d.id)).map(d=>({...d, events:d.events.filter(includeEvent)}));
const DAY_IDS=new Set(DAYS_A.map(d=>d.id));
/* categoriile prezente în acest public, în ordinea din CATS
   (cu etichete proprii paginii, unde e cazul) */
const CATS_A = Object.fromEntries(Object.entries(CATS).filter(([k])=>AUD.cats.includes(k))
  .map(([k,c])=>[k,{...c,label:(AUD.catLabels&&AUD.catLabels[k])||c.label}]));
/* pe paginile pentru formatori, notele interne despre săli nu apar */
const roomClean=s=>String(s).replace(/\s*\([^)]*\)/g,'');

/* ── ora curentă în Europe/Bucharest; până în 05:00 aparține zilei
      de program precedente. Test: ?test=v31-19:32 ── */
const TESTP=new URLSearchParams(location.search).get('test');
const parseSim=s=>{const i=s.indexOf('-');return {day:s.slice(0,i), mins:mins(s.slice(i+1)), hm:s.slice(i+1), demo:true};};
function roNow(){
  if(TESTP) return parseSim(TESTP);
  const fmt=o=>new Intl.DateTimeFormat('ro-RO',Object.assign({timeZone:'Europe/Bucharest'},o));
  const parts=fmt({year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date());
  const g=t=>parts.find(p=>p.type===t).value;
  const h=+g('hour'), m=+g('minute');
  let dateKey=`${g('day')}.${g('month')}.${g('year')}`;
  if(h<5){
    const pp=fmt({year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(Date.now()-5*3600*1000));
    const gg=t=>pp.find(p=>p.type===t).value;
    dateKey=`${gg('day')}.${gg('month')}.${gg('year')}`;
  }
  const day=DATEMAP[dateKey]||null;
  if(!day && typeof DEMO_NOW==='string' && DEMO_NOW) return parseSim(DEMO_NOW);
  return {day, mins:h*60+m+(h<5?1440:0), hm:`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`};
}
/* ora curentă, dar zilele scoase din acest program contează ca „în afara lui” */
function nowA(){
  const n=roNow();
  if(n.day&&!DAY_IDS.has(n.day)) return {...n, day:null};
  return n;
}

/* ziua de azi, sau cea mai apropiată zi DIN ACEST program */
function nearestDay(){
  const parts=new Intl.DateTimeFormat('ro-RO',{timeZone:'Europe/Bucharest',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const g=t=>parts.find(x=>x.type===t).value;
  const today=g('year')+g('month')+g('day');
  const list=Object.keys(DATEMAP).map(k=>({key:k.split('.').reverse().join(''),id:DATEMAP[k]}))
    .filter(x=>DAY_IDS.has(x.id)).sort((a,b)=>a.key<b.key?-1:1);
  const nxt=list.find(x=>x.key>=today);
  return (nxt||list[list.length-1]).id;
}

/* ── banda de zile ──────────────────────── */
const railEl=document.getElementById('rail');
const daysEl=document.getElementById('days');
(function(){const w=daysEl&&daysEl.closest('.wrap');if(w)w.insertAdjacentHTML('afterbegin','<div class="waterbanner" style="display:none"></div>');
  function _hotWater(){const el=document.querySelector('.waterbanner');if(!el)return;const mm=((roNow().mins%1440)+1440)%1440;if(mm>=720&&mm<960){el.style.display='flex';el.textContent='🔥 caniculă la Alexandria · bea apă!';}else{el.style.display='none';}}
  _hotWater(); setInterval(_hotWater,30000);
  function _clap(x,y){if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;for(let i=0;i<5;i++){const c=document.createElement('span');c.className='clap';c.textContent='👏';c.style.left=(x+(Math.random()*40-20))+'px';c.style.top=(y-8)+'px';c.style.animationDelay=(i*55)+'ms';document.body.appendChild(c);setTimeout(()=>c.remove(),1200+i*55);}}
  document.addEventListener('click',_e=>{if(_e.target.closest('button,a,input,summary,[data-x],.pbtn,.pzbtn,.xbtn'))return;const card=_e.target.closest('.ev');if(card&&/spectacol/i.test(card.textContent))_clap(_e.clientX,_e.clientY);});
})();
DAYS_A.forEach(d=>{
  const b=document.createElement('button');
  b.className='daychip'; b.dataset.day=d.id; b.setAttribute('aria-selected','false');
  b.innerHTML=`<span class="dw">${d.dw}</span><span class="dn">${d.dn}</span>`;
  b.addEventListener('click',()=>selectDay(d.id,true));
  railEl.appendChild(b);
});
const infoChip=document.createElement('button');
infoChip.className='daychip info'; infoChip.dataset.day='info'; infoChip.setAttribute('aria-selected','false');
infoChip.innerHTML='<span class="dw">+</span><span class="dn">info</span>';
infoChip.addEventListener('click',()=>selectDay('info',true));
document.getElementById('railpins').appendChild(infoChip);

/* ── Art&Play: atelierele comunității + participanții înscriși (din ARTPLAY_PART) ── */
function _apKey(ev){
  const t=ev.title||'';
  if(/Show Your Moves/i.test(t))return 'ap-show-moves';
  if(/Stand Up/i.test(t))return 'ap-stand-up';
  if(/Pauza de la dezinformare/i.test(t))return 'ap-pauza';
  if(/Mintea ta nu e a ta/i.test(t))return 'ap-mintea';
  if(/N-O-I/i.test(t)){return /14-18/.test((ev.sub||[]).join(' '))?'ap-noi-14-18':'ap-noi-10-13';}
  if(/Siguranța bebelușului/i.test(t))return 'ap-siguranta';
  if(/Prim ajutor pediatric/i.test(t))return 'ap-prim-ajutor';
  if(/Animalul care te locuiește/i.test(t))return 'ap-animalul';
  if(/Cetățenie activă/i.test(t))return 'ap-cetatenie';
  if(/Orașul e al tău/i.test(t))return 'ap-orasul';
  if(/Alexandria la 50 de grade/i.test(t))return 'ap-alexandria50';
  return null;
}
function apRoster(key){const a=(typeof ARTPLAY_PART!=='undefined')&&ARTPLAY_PART[key];return a?a.map(x=>({name:x[0],tel:x[1]})):[];}
/* ── vederea listă ──────────────────────── */
function detailRows(ev,dayId){
  if(ev.xlist) return {label:ev.xlabel, rows:ev.xlist.map(r=>[r[1],r[0]])};
  const needs=AUD.showNeeds!==false;
  let rows=[];
  if(ev.title==='ateliere teatru tânăr' && typeof ATELIERE_TT!=='undefined')
    rows=ATELIERE_TT.map(r=>{
      const vol=r[4]?peopleButton(peopleFromStr(r[4]),'voluntari',`${r[0]} · ${r[1]}`):'';
      const prez=prezButton(dayId,'tt:'+(_slugOf[r[0]]||r[0]),`${r[0]} · teatru tânăr`,ttRoster(r[0]));
      return ['@at', r[0], [r[1],r[3]].filter(Boolean).join(' · '), r[2]?roomClean(r[2]):'', vol+prez];
    }).concat(needs&&typeof TT_NEEDS!=='undefined'?[['necesar / atelier',TT_NEEDS]]:[]);
  else if(ev.title==='ateliere arte alăturate' && typeof ARTE_ALATURATE!=='undefined')
    rows=ARTE_ALATURATE.map(r=>{
      const vol=r[6]?peopleButton(peopleFromStr(r[6]),'voluntari',`${r[0]} · ${r[1]}`):'';
      const prez=prezButton(dayId,'arte:'+r[0],`${r[0]} · ${r[1]||''}`,arteRoster(r[0]));
      return ['@at', r[0], r[1]||'', r[2]?roomClean(r[2]):'', vol+prez];
    }).concat([['@at','Poziția Zero','Noreen Elamir & Andrei Dumitrescu · teatru tânăr','Șc. 5 · sala 4', prezButton(dayId,'tt:'+(_slugOf['Poziția Zero']||'Poziția Zero'),'Poziția Zero · teatru tânăr',ttRoster('Poziția Zero'))]]);
  else if(typeof ARTPLAY_PART!=='undefined' && _apKey(ev)){
    const key=_apKey(ev), roster=apRoster(key);
    if(roster.length) rows.push(['prezență', prezButton(dayId,'ap:'+key,ev.title,roster.map(p=>({name:p.name,sub:''})))]);
  }
  const lg=(typeof LOGISTICS!=='undefined')?LOGISTICS[ev.title]:null;
  if(lg){
    if(lg.n && !rows.some(r=>r[0]==='prezență'))rows.push(['participanți',lg.n]);
    if(needs&&lg.tehnic)rows.push(['necesar tehnic',lg.tehnic]);
    if(needs&&lg.prod)rows.push(['necesar producție',lg.prod]);
  }
  if(ev.title==='ateliere arte alăturate' && typeof ARTE_PARTICIPANTI!=='undefined') rows.push(['@html', `<button type="button" class="partlink" data-partall>vezi repartizarea participanților pe ateliere <span class="pbc">›</span></button>`]);
  return rows.length?{label:ev.xlabel||'detalii',rows}:null;
}
const slug=s=>s.toLowerCase().replace(/<[^>]*>/g,'').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,28);
/* localuri cu meniu online (Alex Tell, Conciato din MENIURI): link de meniu DOAR în +info, lângă hartă */
const _MENU=(()=>{const m={};if(typeof MENIURI!=='undefined')MENIURI.forEach(x=>m[x[0]]=x[2]);return m;})();
function evHtml(ev,dayId){
  const cat=CATS[ev.cat]||CATS.alt;
  const eid=`${dayId}-${ev.t.replace(':','')}-${slug(ev.title)}`;
  const lg=(typeof LOGISTICS!=='undefined')?LOGISTICS[ev.title]:null;
  const det=detailRows(ev,dayId);
  const search=[ev.title,ev.loc,ev.locd,(ev.sub||[]).join(' '),(det?det.rows.flat().join(' '):'')].join(' ').toLowerCase();
  let x='';
  if(det){
    const rows=det.rows.map(r=>
      r[0]==='@html'?r[1]:
      r[0]==='@at'?`<div class="xrow atrow"><div class="atinfo"><span class="atname">${r[1]}</span>${r[2]?`<span class="atsub">${r[2]}</span>`:''}</div><div class="atside">${r[3]?`<span class="atsala">${r[3]}</span>`:''}${r[4]}</div></div>`:
      `<div class="xrow"><span class="xa">${r[0]}</span><span class="xb">${r[1]}</span></div>`
    ).join('');
    x=`<button class="xbtn" data-x>▸ ${det.label}</button><div class="xlist">${rows}</div>`;
  }
  const subs=(ev.sub||[]).map(s=>`<div class="sub">${s}</div>`).join('');
  const room=lg&&lg.sala&&!ev.locd?` · ${esc(roomClean(lg.sala))}<span style="color:var(--muted)">*</span>`:'';
  const locline=ev.loc?`<div class="locline"><b>${esc(ev.loc)}</b>${ev.locd?' · '+esc(ev.locd):''}${room}</div>`:'';
  /* fișa spectacolului, direct pe cardul lui */
  let tinfo='';
  if(AUD.spectacoleInfo && ev.trupa && !ev.c && /spectacol/i.test(ev.title)
     && typeof TRUPE_INFO!=='undefined' && TRUPE_INFO[ev.trupa]){
    tinfo=`<button class="xbtn" data-x>▸ despre spectacol & trupă</button><div class="xlist">${trupaFisa(ev.trupa)}</div>`;
  }
  const _tt=(AUD.lockTrupa&&ev.trupaStart&&ev.trupaStart[AUD.lockTrupa])||ev.t;
  const _te=(AUD.lockTrupa&&ev.trupaEnd&&ev.trupaEnd[AUD.lockTrupa])||ev.e;
  return `<article class="ev${ev.c?' compact':''}" data-eid="${eid}" data-cat="${ev.cat||'alt'}"${ev.c?' data-tech="1"':''}${ev.trupa?` data-trupa="${ev.trupa}"`:''} data-s="${mins(_tt)}"${ev.e?` data-e="${mins(_te)}"`:''} data-search="${esc(search)}" style="--cat:${cat.color}">
    <div class="tcol"><div class="t1">${_tt}</div>${ev.e?`<div class="t2">${_te}</div>`:''}</div>
    <div>
      <div class="title">${ev.title}<span class="nowtag" hidden>acum</span></div>
      ${locline}${subs}${x}${tinfo}
    </div>
  </article>`;
}
/* fișa unei trupe: spectacol, echipă, distribuție, sinopsis, despre, video */
function trupaFisa(id){
  const i=TRUPE_INFO[id];
  return `<p class="ti-t">„${esc(i.spectacol)}”<small> · ${esc(i.autor)}</small></p>
    ${i.echipa?`<p class="ti-row"><b>echipa de creație</b>${esc(i.echipa)}</p>`:''}
    ${i.distributie?`<p class="ti-row"><b>distribuție</b>${esc(i.distributie)}</p>`:''}
    ${i.sinopsis?`<p class="ti-p">${esc(i.sinopsis)}</p>`:''}
    ${i.despre?`<p class="ti-p ti-despre"><b>despre trupă · </b>${esc(i.despre)}</p>`:''}
    ${i.video?`<a class="maplink" target="_blank" rel="noopener" href="${esc(i.video)}">vezi un fragment video ↗</a>`:''}`;
}
const trHtml=ev=>`<div class="tr"${ev.trupa?` data-trupa="${ev.trupa}"`:''} data-s="${smins(ev)}" data-search="transport ${esc(ev.route.toLowerCase())} ${esc((ev.note||'').toLowerCase())}"><span class="tag">transport</span><span class="tt">${ev.t}</span><span class="route">${esc(ev.route)}</span>${ev.note?`<span class="note">${esc(ev.note)}</span>`:''}</div>`;
const mealHtml=ev=>`<div class="meal"${ev.trupa?` data-trupa="${ev.trupa}"`:''} data-s="${smins(ev)}" data-search="masa ${ev.meal} ${esc((ev.loc||'').toLowerCase())} ${esc((ev.note||'').toLowerCase())}"><span class="tag">${AUD.mealLabel||'masă'}</span><span class="tt">${ev.t}–${ev.e}</span><span class="mt">${ev.meal} · ${esc(ev.loc)}</span>${ev.note?`<span class="note">${esc(ev.note)}</span>`:''}</div>`;
const techHtml=ev=>`<div class="tech" data-s="${smins(ev)}" data-search="tehnic ${esc(ev.text.toLowerCase())}"><span class="tt">${ev.t}</span><span>@tehnic · ${esc(ev.text)}</span></div>`;

/* ── vederea pe locații (grilă timp × loc) ── */
const MAINCOLS=[['cmt','CMT'],['mare','scena mare'],['mica','scena mică'],['kauf','Kaufland'],['sc5','Școala 5']];
function colOf(ev){
  if(ev.col)return ev.col;
  const l=ev.loc||'';
  if(l==='CMT')return 'cmt';
  if(l==='Kaufland')return 'kauf';
  if(l==='Școala 5')return 'sc5';
  if(l==='Piața Ideo Ideis'){const d=(ev.locd||'').toLowerCase();return d.includes('mare')?'mare':(d.includes('mic')?'mica':'mare');}
  return 'loc:'+(l||'de confirmat');
}
const PXM=48/60;
function gridHtml(d){
  const evs=d.events.filter(e=>e.k==='e');
  if(!evs.length)return '';
  const meals=d.events.filter(e=>e.k==='m');
  const trs=d.events.filter(e=>e.k==='t');
  const endOf=e=>e.e?mins(e.e):mins(e.t)+60;
  let t0=Math.min(...d.events.filter(e=>e.k!=='x').map(smins));
  let t1=Math.max(...evs.map(endOf),...meals.map(endOf),...trs.map(e=>smins(e)+15));
  t0=Math.floor(t0/60)*60; t1=Math.ceil(t1/60)*60;
  const H=(t1-t0)*PXM;
  const keys=[...MAINCOLS.map(c=>c[0])];
  evs.forEach(e=>{const k=colOf(e);if(!keys.includes(k))keys.push(k);});
  const cols=[];
  const vEnd=e=>Math.max(endOf(e),mins(e.t)+25);
  keys.forEach(c=>{
    const list=evs.filter(e=>colOf(e)===c).sort((a,b)=>mins(a.t)-mins(b.t));
    if(!list.length)return;
    const lanes=[];
    list.forEach(e=>{
      let li=lanes.findIndex(end=>end<=mins(e.t));
      if(li<0){li=lanes.length;lanes.push(0);}
      lanes[li]=vEnd(e); e._lane=li;
    });
    const main=MAINCOLS.find(m=>m[0]===c);
    cols.push({c,label:main?main[1]:c.slice(4),list,n:lanes.length});
  });
  let hourLabels='';
  for(let m=t0;m<=t1;m+=60) hourLabels+=`<div class="gtime" style="top:${(m-t0)*PXM}px">${String(Math.floor(m/60)%24).padStart(2,'0')}:00</div>`;
  const shortMeal=m=>m==='mic dejun'?'dejun':m;
  const mealsH=meals.map(e=>`<div class="gmeal" style="top:${(mins(e.t)-t0)*PXM}px;height:${(endOf(e)-mins(e.t))*PXM}px"></div>`).join('');
  const mealRail=meals.map(e=>`<div class="gmealt" style="top:${(mins(e.t)-t0)*PXM+2}px;height:${(endOf(e)-mins(e.t))*PXM-4}px">${shortMeal(e.meal)}</div>`).join('');
  const trsH=trs.map(e=>`<div class="gtr" style="top:${(smins(e)-t0)*PXM}px"></div>`).join('');
  const seenT=new Set();
  const trRail=trs.filter(e=>!e.t.endsWith(':00')&&!seenT.has(e.t)&&seenT.add(e.t))
    .map(e=>`<div class="gtrt" style="top:${(smins(e)-t0)*PXM}px">${e.t}</div>`).join('');
  const colw=c=>Math.max(150,c.n*104);
  const head=cols.map(c=>`<div class="gcolh" style="width:${colw(c)}px">${esc(c.label)}</div>`).join('');
  const body=cols.map(c=>`<div class="gcol" style="width:${colw(c)}px;height:${H}px">${
    c.list.map(e=>{
      const cat=CATS[e.cat]||CATS.alt;
      const top=(mins(e.t)-t0)*PXM, h=Math.max(20,(endOf(e)-mins(e.t))*PXM-2);
      const w=100/c.n, l=e._lane*w;
      const search=[e.title,e.loc,e.locd,(e.sub||[]).join(' ')].join(' ').toLowerCase();
      const short=h<34;
      const lines=Math.max(1,Math.floor((h-17)/13));
      const inner=short
        ?`<i>${e.t}</i>${e.title}`
        :`<i>${e.t}${e.e?'–'+e.e:''}</i><span class="gt" style="-webkit-line-clamp:${lines}">${e.title}</span>`;
      return `<div class="gblock${e.c?' ops':''}${short?' short':''}" data-cat="${e.cat||'alt'}"${e.c?' data-tech="1"':''}${e.trupa?` data-trupa="${e.trupa}"`:''} data-search="${esc(search)}" style="top:${top}px;height:${h}px;left:${l}%;width:${w}%;--cat:${cat.color}">${inner}</div>`;
    }).join('')
  }</div>`).join('');
  return `<div class="gridwrap">
    <div class="gheadwrap"><div class="gheadspace"></div><div class="gheadclip"><div class="ghead">${head}</div></div></div>
    <div class="gridrow">
      <div class="gtimes" style="height:${H}px">${hourLabels}${trRail}${mealRail}</div>
      <div class="gscroll"><div class="gbody" data-t0="${t0}" data-t1="${t1}" style="height:${H}px">${mealsH}${trsH}<div class="gridnow" data-gridnow hidden><span></span></div>${body}</div></div>
    </div>
  </div>`;
}

/* ── randăm zilele ──────────────────────── */
DAYS_A.forEach(d=>{
  const s=document.createElement('section');
  s.className='day'; s.id='day-'+d.id;
  let list='';
  const evs=[...d.events].sort((a,b)=>smins(a)-smins(b));
  evs.forEach(ev=>{
    if(ev.k==='t')list+=trHtml(ev);
    else if(ev.k==='m')list+=mealHtml(ev);
    else if(ev.k==='x')list+=techHtml(ev);
    else list+=evHtml(ev,d.id);
  });
  if(!list) list=`<p class="emptyday">nimic în programul tău în ziua asta.</p>`;
  s.innerHTML=`<div class="dayhero"><h2>${d.h2}</h2><div class="dd"><b>${d.full}</b></div></div>
    <div class="viewlist">${list}</div>
    <div class="viewgrid">${gridHtml(d)}</div>`;
  daysEl.appendChild(s);
});

/* sincronizăm antetul grilei cu scrollul orizontal */
document.querySelectorAll('.gridwrap').forEach(w=>{
  const sc=w.querySelector('.gscroll'), gh=w.querySelector('.ghead');
  sc.addEventListener('scroll',()=>{gh.style.transform=`translateX(${-sc.scrollLeft}px)`;},{passive:true});
});

/* comutatorul listă / pe locații */
document.querySelectorAll('.vbtn').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('.vbtn').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));
  document.body.dataset.view=b.dataset.view;
}));
document.body.dataset.view='lista';

/* listele de prezență în +info: pe zile → pe atelier, buton de prezență la fiecare */
function prezInfoHtml(){
  if(typeof prezButton!=='function' || typeof DAYS_A==='undefined')return '';
  let out='';
  DAYS_A.forEach(d=>{
    const items=[];
    d.events.forEach(ev=>{
      if(ev.title==='ateliere teatru tânăr' && typeof ATELIERE_TT!=='undefined')
        ATELIERE_TT.forEach(r=>{const b=prezButton(d.id,'tt:'+(_slugOf[r[0]]||r[0]),`${r[0]} · teatru tânăr`,ttRoster(r[0]));if(b)items.push([r[0]+' · teatru tânăr',b]);});
      else if(ev.title==='ateliere arte alăturate' && typeof ARTE_ALATURATE!=='undefined')
        ARTE_ALATURATE.forEach(r=>{const b=prezButton(d.id,'arte:'+r[0],`${r[0]} · ${r[1]||''}`,arteRoster(r[0]));if(b)items.push([r[0]+(r[1]?' · '+r[1]:''),b]);});
      else if(typeof _apKey==='function'){const k=_apKey(ev);if(k){const ro=apRoster(k);const b=ro.length?prezButton(d.id,'ap:'+k,ev.title,ro.map(p=>({name:p.name,sub:''}))):'';if(b)items.push([ev.title,b]);}}
    });
    if(items.length) out+=`<div class="przday"><div class="przd">${esc(d.h2+' '+d.dn)}</div>${items.map(([n,b])=>`<div class="przrow"><span class="przn">${esc(n)}</span>${b}</div>`).join('')}</div>`;
  });
  return out?`<div class="iblock wide acc"><h3>prezență ateliere</h3><div class="przwrap">${out}</div></div>`:'';
}
/* ── tabul +info ────────────────────────── */
const infoS=document.createElement('section');
infoS.className='day'; infoS.id='day-info';
const tel=(n,t)=>`${esc(n||'de confirmat')}${t?`<br><a class="tel" href="tel:${t.replace(/\s/g,'')}">${t}</a>`:''}`;
try{
infoS.innerHTML=`
  <div class="dayhero"><h2>info extra</h2><div class="dd"><b>hărți · echipă · legături</b></div></div>
  <div class="info-grid">
    ${prezInfoHtml()}
    ${(INFO.contacts && typeof CONTACTS!=='undefined')?`<div class="iblock wide acc" id="cblock">
      <h3>contacte</h3>
      <input class="search" id="cq" type="search" placeholder="caută om, rol sau departament…" aria-label="caută în contacte">
      ${CONTACTS.map(([dep,people])=>{
        const plain=people.every(x=>!x[1]);
        const rows=people.map(x=>`<div class="crow" data-s="${(dep+' '+x[0]+' '+(x[1]||'')).toLowerCase()}"><span class="cn">${x[0]}</span>${x[1]?`<span class="cr">${x[1]}</span>`:''}${x[2]?`<a class="tel" href="tel:${x[2].replace(/\s/g,'')}">${x[2]}</a>`:''}</div>`).join('');
        return `<div class="cdep"><p class="cdh">${dep}</p><div class="${plain?'cgrid':''}">${rows}</div></div>`;
      }).join('')}
      <p class="inote" style="margin-top:12px">în curând: telefoanele + voluntarii de permanență pe locații.</p>
    </div>`:''}
    <div class="iblock acc">
      <h3>locații & hărți</h3>
      ${(AUD.extraLocs||[]).map(l=>`<div class="irow"><span class="ra">${l[0]}${l[1]?`<small>${l[1]}</small>`:''}</span><a class="maplink" target="_blank" rel="noopener" href="${l[2]}">hartă ↗</a></div>`).join('')}
      ${LOCS.map(l=>`<div class="irow"><span class="ra">${l[0]}${l[1]?`<small>${l[1]}</small>`:''}</span><span class="ilinks">${_MENU[l[0]]?`<a class="maplink" target="_blank" rel="noopener" href="${_MENU[l[0]]}">meniu ↗</a>`:''}<a class="maplink" target="_blank" rel="noopener" href="${maps(l[0])}">hartă ↗</a></span></div>`).join('')}
    </div>
    ${INFO.legend===false?'':`<div class="iblock acc">
      <h3>legendă</h3>
      ${Object.values(CATS_A).map(c=>`<div class="irow"><span class="ra" style="display:flex;align-items:center;gap:8px"><span style="width:10px;height:10px;background:${c.color};flex:0 0 auto"></span>${c.label}</span></div>`).join('')}
      ${AUD.transport===false?'':`<div class="irow"><span class="ra" style="display:flex;align-items:center;gap:8px"><span style="width:18px;border-top:2px dashed rgba(255,196,46,.7);flex:0 0 auto"></span>transport</span></div>`}
      ${AUD.meals===false?'':`<div class="irow"><span class="ra" style="display:flex;align-items:center;gap:8px"><span style="width:18px;height:10px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);flex:0 0 auto"></span>mese</span></div>`}
      ${AUD.compact===false?'':`<div class="irow"><span class="ra" style="display:flex;align-items:center;gap:8px"><span style="width:18px;height:10px;border:1px dashed var(--muted);flex:0 0 auto"></span>montare / repetiție (contur punctat)</span></div>`}
      ${AUD.showTech===false?'':`<div class="irow"><span class="ra" style="font-family:var(--mono);font-size:12px;color:var(--amber-dim)">@tehnic · montări, repetiții, echipa tehnică</span></div>`}
    </div>`}
    ${(INFO.spectacole && typeof TRUPE_INFO!=='undefined' && typeof TRUPE_IDS!=='undefined')?`<div class="iblock wide acc">
      <h3>spectacolele trupelor</h3>
      ${Object.keys(TRUPE_IDS).filter(id=>TRUPE_INFO[id]).map(id=>`<div class="iblock acc tacc">
        <h3>${esc(TRUPE_IDS[id])} <small>· ${esc(TRUPE_INFO[id].oras)} · „${esc(TRUPE_INFO[id].spectacol)}”</small></h3>
        <div class="ti-body">${trupaFisa(id)}</div>
      </div>`).join('')}
    </div>`:''}
    ${(INFO.trupe && typeof TRUPE!=='undefined')?`<div class="iblock wide acc">
      <h3>teatru tânăr</h3>
      <div class="tscroll"><table class="ttable">
        <tr><th>trupă</th><th>trainer · sală (Șc. 5)</th><th>coordonator</th><th>ghid</th></tr>
        ${TRUPE.map(r=>{const np=(typeof REPARTIZARE!=='undefined'&&typeof TRUPE_IDS!=='undefined')?(()=>{const s=Object.keys(TRUPE_IDS).find(k=>TRUPE_IDS[k]===r[0]);return s&&REPARTIZARE[s]?REPARTIZARE[s][1].length:0;})():0;return `<tr><td><b>${r[0]}</b>${np?`<br><small>${np} participanți</small>`:''}</td><td><small>${r[1]}</small></td><td>${tel(r[2],r[3])}</td><td>${tel(r[4],r[5])}</td></tr>`;}).join('')}
        <tr><td><b>Train the Coordinators</b><br><small>7 participanți</small></td><td><small>mentori & coordonatori · Șc. 5 · sala 6</small></td><td>·</td><td>·</td></tr>
      </table></div>
    </div>`:''}
    ${(INFO.formatori && typeof FORMATORI!=='undefined')?`<div class="iblock wide acc">
      <h3>formatori & mentori</h3>
      <div class="tscroll"><table class="ttable" style="min-width:0">
        <tr><th>program</th><th>detalii</th></tr>
        ${FORMATORI.map(r=>`<tr><td><b>${esc(r[0])}</b></td><td><small>${esc(r[1])}</small></td></tr>`).join('')}
      </table></div>
      <p class="inote" style="margin-top:10px">întâlnirea mentori · participanți e în program (miercuri 29, 17:00) · alocările pe trupe se completează.</p>
    </div>`:''}
    ${(INFO.arteAlaturate && typeof ARTE_ALATURATE!=='undefined')?`<div class="iblock wide acc">
      <h3>arte alăturate</h3>
      <div class="tscroll"><table class="ttable" style="min-width:${AUD.showNeeds!==false?560:0}px">
        <tr><th>atelier</th><th>trainer</th><th>sală</th>${AUD.showNeeds!==false?'<th>necesar</th>':''}</tr>
        ${ARTE_ALATURATE.map(r=>`<tr><td><b>${r[0]}</b>${r[3]?`<br><small>${r[3]}</small>`:''}</td><td>${r[1]}</td><td><small>${roomClean(r[2])}</small></td>${AUD.showNeeds!==false?`<td><small>${[r[4]?'tehnic: '+r[4]:'',r[5]?'producție: '+r[5]:''].filter(Boolean).join('<br>')||'·'}</small></td>`:''}</tr>`).join('')}
      </table></div>
      ${typeof ARTE_PARTICIPANTI!=='undefined'?`<div style="margin-top:14px">${ARTE_ALATURATE.filter(r=>ARTE_PARTICIPANTI[r[0]]).map(r=>{const gs=ARTE_PARTICIPANTI[r[0]];const n=gs.reduce((s,g)=>s+g.length-1,0);return `<div class="iblock acc tacc">
        <h3>${esc(r[0])} <small>· ${esc(r[1])} · ${n} participanți</small></h3>
        <div class="ti-body">${gs.map(g=>`<p class="ti-row"><b>${esc(g[0])}</b>${g.slice(1).map(esc).join(', ')}</p>`).join('')}</div>
      </div>`;}).join('')}</div>`:''}
    </div>`:''}
    ${(INFO.artplay && typeof ARTPLAY_INFO!=='undefined')?`<div class="iblock wide acc">
      <h3>ateliere comunitate · Art&Play</h3>
      <div class="tscroll"><table class="ttable" style="min-width:${AUD.showNeeds!==false?560:0}px">
        <tr><th>atelier</th><th>sală</th><th>zile & ore</th>${AUD.showNeeds!==false?'<th>necesar</th>':''}</tr>
        ${ARTPLAY_INFO.map(r=>`<tr><td><b>${r[0]}</b>${r[1]?`<br><small>${r[1]} part.</small>`:''}</td><td><small>${roomClean(r[2])}</small></td><td><small>${r[3]}<br><b>${r[4]}</b></small></td>${AUD.showNeeds!==false?`<td><small>${[r[5]?'tehnic: '+r[5]:'',r[6]?'producție: '+r[6]:''].filter(Boolean).join('<br>')||'·'}</small></td>`:''}</tr>`).join('')}
      </table></div>
    </div>`:''}
  </div>`;
daysEl.appendChild(infoS);
}catch(e){
  infoS.innerHTML='<div class="dayhero"><h2>info extra</h2></div><p class="inote">secțiunea apare la următorul refresh.</p>';
  daysEl.appendChild(infoS);
}

/* căutarea în contacte */
infoS.addEventListener('input',e=>{
  if(e.target.id!=='cq')return;
  const term=deDiac(e.target.value.trim().toLowerCase());
  infoS.querySelectorAll('#cblock .crow').forEach(r=>{
    r.style.display=(!term||deDiac(r.dataset.s).includes(term))?'':'none';
  });
  infoS.querySelectorAll('#cblock .cdep').forEach(d=>{
    const any=[...d.querySelectorAll('.crow')].some(r=>r.style.display!=='none');
    d.style.display=any?'':'none';
  });
});
/* acordeonul din +info */
infoS.addEventListener('click',e=>{
  const h=e.target.closest('.iblock.acc>h3, h3');
  if(!h)return;
  const b=h.parentElement;
  if(b.classList.contains('acc')&&h===b.querySelector('h3')) b.classList.toggle('open');
});

/* ── selectorul de trupă (doar unde e cerut) ── */
let selTrupa=null;
/* ziua spectacolului fiecărei trupe (pentru saltul la selectare) */
const TRUPA_DAY={};
DAYS_A.forEach(d=>d.events.forEach(ev=>{
  if(ev.k==='e'&&ev.trupa&&/spectacol/i.test(ev.title)&&!TRUPA_DAY[ev.trupa]) TRUPA_DAY[ev.trupa]=d.id;
}));
/* trupele care chiar apar în programul acestui public */
const TRUPE_HERE=(()=>{
  const set=new Set();
  DAYS_A.forEach(d=>d.events.forEach(ev=>{if(ev.trupa)set.add(ev.trupa);}));
  return (typeof TRUPE_IDS!=='undefined')?Object.keys(TRUPE_IDS).filter(id=>set.has(id)):[...set];
})();
let trupeChipsEl=null;
if(AUD.trupePicker && TRUPE_HERE.length){
  const bar=document.getElementById('trupebar');
  if(bar){
    bar.innerHTML=`<p class="tbhd">urmărește o trupă <b>·</b> vezi doar drumul ei prin festival</p>
      <div class="trupechips" id="trupechips"></div>
      <p class="trupehint" id="trupehint"></p>`;
    trupeChipsEl=bar.querySelector('#trupechips');
    const allB=document.createElement('button');
    allB.className='trupechip all'; allB.dataset.trupa=''; allB.setAttribute('aria-pressed','true');
    allB.textContent='toate trupele';
    allB.addEventListener('click',()=>selectTrupa(null,true));
    trupeChipsEl.appendChild(allB);
    TRUPE_HERE.forEach(id=>{
      const b=document.createElement('button');
      b.className='trupechip'; b.dataset.trupa=id; b.setAttribute('aria-pressed','false');
      b.textContent=TRUPE_IDS[id]||id;
      b.addEventListener('click',()=>selectTrupa(id,true));
      trupeChipsEl.appendChild(b);
    });
  }
}
function selectTrupa(id,jump){
  selTrupa=id||null;
  if(trupeChipsEl){
    trupeChipsEl.querySelectorAll('.trupechip').forEach(c=>c.setAttribute('aria-pressed',String((c.dataset.trupa||'')=== (selTrupa||''))));
  }
  /* marcajul „mine” pe rândurile trupei */
  daysEl.querySelectorAll('.mine').forEach(el=>el.classList.remove('mine'));
  daysEl.querySelectorAll('.minetag').forEach(el=>el.remove());
  const hint=document.getElementById('trupehint');
  if(selTrupa){
    daysEl.querySelectorAll(`[data-trupa="${selTrupa}"]`).forEach(el=>{
      el.classList.add('mine');
      const t=el.querySelector('.title');
      if(t && !t.querySelector('.minetag')){const s=document.createElement('span');s.className='minetag';s.textContent=TRUPE_IDS[selTrupa]||selTrupa;t.appendChild(s);}
    });
    if(hint)hint.innerHTML=`programul general rămâne · drumul trupei alese e <b>evidențiat</b>, restul trupelor sunt ascunse.`;
  }else if(hint){
    hint.textContent='';
  }
  applyFilters();
  updateGreet(nowA());
  if(jump && selTrupa && TRUPA_DAY[selTrupa]) selectDay(TRUPA_DAY[selTrupa],true);
}

/* ── filtre ─────────────────────────────── */
const catchips=document.getElementById('catchips');
const filtersBox=document.getElementById('filters');
const selCats=new Set();
let mentoriOnly=false;
function chipToggle(b,id){
  const on=b.getAttribute('aria-pressed')==='true';
  b.setAttribute('aria-pressed',String(!on));
  on?selCats.delete(id):selCats.add(id);
  filtersBox.classList.toggle('filtering',selCats.size>0);
  applyFilters();
}
Object.entries(CATS_A).forEach(([id,c])=>{
  const b=document.createElement('button');
  b.className='fchip'; b.setAttribute('aria-pressed','false'); b.style.setProperty('--selc',c.color);
  b.innerHTML=`<span class="sw" style="background:${c.color}"></span>${c.label}`;
  b.addEventListener('click',()=>chipToggle(b,id));
  catchips.appendChild(b);
});
if(AUD.transport!==false){
  const trChip=document.createElement('button');
  trChip.className='fchip'; trChip.setAttribute('aria-pressed','false'); trChip.style.setProperty('--selc','#FFC42E');
  trChip.innerHTML='<span class="sw" style="background:#FFC42E"></span>transport';
  trChip.addEventListener('click',()=>chipToggle(trChip,'transport'));
  catchips.appendChild(trChip);
}
let techChip=null;
if(AUD.showTech!==false){
  techChip=document.createElement('button');
  techChip.className='fchip tech'; techChip.setAttribute('aria-pressed','true');
  techChip.textContent='@tehnic · montări & repetiții';
  techChip.addEventListener('click',()=>{
    const on=techChip.getAttribute('aria-pressed')==='true';
    techChip.setAttribute('aria-pressed',String(!on));
    applyFilters();
  });
  catchips.appendChild(techChip);
}
/* filtru „mentori": doar cardurile care menționează mentori */
const menChip=document.createElement('button');
menChip.className='fchip men'; menChip.setAttribute('aria-pressed','false'); menChip.style.setProperty('--selc','#E7004C');
menChip.innerHTML='<span class="sw" style="background:#E7004C"></span>mentori';
menChip.addEventListener('click',()=>{
  mentoriOnly=!mentoriOnly;
  menChip.setAttribute('aria-pressed',String(mentoriOnly));
  filtersBox.classList.toggle('filtering',selCats.size>0||mentoriOnly);
  applyFilters();
});
catchips.appendChild(menChip);

/* plierea zonei de filtre */
const fhead=document.getElementById('fhead');
fhead.addEventListener('click',()=>{
  const c=filtersBox.classList.toggle('collapsed');
  fhead.setAttribute('aria-expanded',String(!c));
  document.getElementById('farrow').textContent=c?'▸':'▾';
});

const q=document.getElementById('q');
q.addEventListener('input',applyFilters);

/* căutarea globală */
const sres=document.createElement('div');
sres.id='sres'; sres.hidden=true;
q.after(sres);
const DAYSHORT=Object.fromEntries(DAYS_A.map(d=>[d.id,`${d.dw} ${d.dn} ${d.full.split(' ')[1]||''}`.trim()]));
function globalSearch(){
  const term=deDiac(q.value.trim().toLowerCase());
  if(term.length<2){sres.hidden=true;sres.innerHTML='';return;}
  const hits=[];
  document.querySelectorAll('section.day .viewlist .ev').forEach(ev=>{
    if(deDiac(ev.dataset.search||'').includes(term)){
      const day=ev.closest('section.day').id.replace('day-','');
      const c=ev.querySelector('.title').cloneNode(true);
      c.querySelectorAll('.nowtag,.minetag').forEach(x=>x.remove());
      hits.push({day,eid:ev.dataset.eid,t:(ev.querySelector('.t1')||{}).textContent||'',title:c.textContent.trim()});
    }
  });
  if(!hits.length){
    sres.innerHTML='<p class="inote" style="padding:8px 10px">nimic găsit în program</p>';
    sres.hidden=false;return;
  }
  sres.innerHTML=hits.slice(0,12).map(h=>
    `<button class="srow" data-day="${h.day}" data-eid="${h.eid}"><small>${DAYSHORT[h.day]||h.day} · ${h.t}</small>${esc(h.title).slice(0,64)}</button>`
  ).join('')+(hits.length>12?`<p class="inote" style="padding:6px 10px">…și încă ${hits.length-12} rezultate</p>`:'');
  sres.hidden=false;
}
q.addEventListener('input',globalSearch);
sres.addEventListener('click',e=>{
  const b=e.target.closest('.srow'); if(!b)return;
  sres.hidden=true;
  document.body.dataset.view='lista';
  document.querySelectorAll('.vbtn').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.view==='lista')));
  selectDay(b.dataset.day,false);
  const ev=document.querySelector(`#day-${CSS.escape(b.dataset.day)} .viewlist .ev[data-eid="${CSS.escape(b.dataset.eid)}"]`);
  if(ev){
    ev.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});
    ev.classList.add('flash');
    setTimeout(()=>ev.classList.remove('flash'),2200);
  }
});
function applyFilters(){
  const term=deDiac(q.value.trim().toLowerCase());
  const filtering=selCats.size>0;
  const techOn=techChip?techChip.getAttribute('aria-pressed')==='true':true;
  const nActive=selCats.size+(techChip&&!techOn?1:0)+(term?1:0)+(mentoriOnly?1:0);
  document.getElementById('fcount').textContent=nActive?` · ${nActive} active`:'';
  daysEl.querySelectorAll('.ev,.tr,.meal,.tech,.gblock,.gtr,.gtrt').forEach(el=>{
    /* urmărirea unei trupe: ascunde rândurile marcate cu ALTE trupe */
    if(selTrupa && el.dataset.trupa && el.dataset.trupa!==selTrupa){el.style.display='none';return;}
    let show=true;
    if(el.classList.contains('tech')) show=techOn;
    else if(el.classList.contains('tr')||el.classList.contains('gtr')||el.classList.contains('gtrt')){
      if(filtering) show=selCats.has('transport');
    }
    else{
      if(filtering && el.dataset.cat) show=selCats.has(el.dataset.cat);
      if(show && el.dataset.tech && !techOn) show=false;
    }
    if(show && mentoriOnly){const s=el.dataset.search!==undefined?deDiac(el.dataset.search):'';if(!s.includes('mentori'))show=false;}
    if(show && term && el.dataset.search!==undefined && !deDiac(el.dataset.search).includes(term)) show=false;
    el.style.display=show?'':'none';
  });
}

/* liste expandabile */
daysEl.addEventListener('click',e=>{
  const b=e.target.closest('[data-x]'); if(!b)return;
  const l=b.nextElementSibling; const open=l.classList.toggle('open');
  b.textContent=(open?'▾ ':'▸ ')+b.textContent.slice(2);
});

/* bottom-sheet „cine e repartizat" pe atelierele de arte alăturate */
const _psheet=document.createElement('div'); _psheet.className='sheet-bd'; _psheet.hidden=true;
_psheet.innerHTML='<div class="sheet" role="dialog" aria-modal="true"><div class="sheet-grip"></div><div class="sheet-h"><span class="sheet-t" id="psheet-t"></span><button type="button" class="sheet-x" aria-label="închide">✕</button></div><div class="sheet-b" id="psheet-b"></div><div class="sheet-foot" id="psheet-foot" hidden></div></div>';
document.body.appendChild(_psheet);
const _psb=_psheet.querySelector('#psheet-b'), _pst=_psheet.querySelector('#psheet-t'), _pfoot=_psheet.querySelector('#psheet-foot');
function _clearFoot(){_pfoot.hidden=true;_pfoot.innerHTML='';}
function openPartSheet(atelier){
  const gs=(typeof ARTE_PARTICIPANTI!=='undefined')?ARTE_PARTICIPANTI[atelier]:null; if(!gs)return;
  _clearFoot(); _pst.textContent=atelier+' · cine e repartizat';
  _psb.innerHTML=gs.map(g=>`<p class="ti-row"><b>${esc(g[0])}</b>${g.slice(1).map(esc).join(', ')}</p>`).join('');
  _psheet.hidden=false; requestAnimationFrame(()=>_psheet.classList.add('open'));
  document.body.classList.add('sheet-open');
  _psheet.querySelector('.sheet-x').focus();
}
function openAllPartSheet(){
  if(typeof ARTE_PARTICIPANTI==='undefined')return;
  _clearFoot(); _pst.textContent='repartizarea participanților pe ateliere';
  _psb.innerHTML='<div class="partsheet">'+Object.keys(ARTE_PARTICIPANTI).map(a=>{const gs=ARTE_PARTICIPANTI[a];const n=gs.reduce((s,g)=>s+g.length-1,0);return `<div class="partgrp"><h4 class="parth">${esc(a)}<small> · ${n} participanți</small></h4>${gs.map(g=>`<p class="ti-row"><b>${esc(g[0])}</b>${g.slice(1).map(esc).join(', ')}</p>`).join('')}</div>`;}).join('')+'</div>';
  _psheet.hidden=false; requestAnimationFrame(()=>_psheet.classList.add('open'));
  document.body.classList.add('sheet-open');
  _psheet.querySelector('.sheet-x').focus();
}
function closePartSheet(){_psheet.classList.remove('open');document.body.classList.remove('sheet-open');setTimeout(()=>{_psheet.hidden=true;},220);}
_psheet.addEventListener('click',e=>{if(e.target===_psheet||e.target.closest('.sheet-x'))closePartSheet();});
document.addEventListener('click',e=>{const b=e.target.closest('[data-partall]');if(b){e.preventDefault();openAllPartSheet();}});
function openPeopleF(id){const g=PEOPLE_GROUPS[id];if(!g)return;_clearFoot();_pst.textContent=g.label;_psb.innerHTML='<div class="plist">'+g.people.map(p=>{const nm=p.name||'';const av=p.photo?`<img class="pav" src="${p.photo}" alt="${esc(nm)}">`:`<span class="pav ini" style="--h:${_hue(nm)}">${esc(_initials(nm))}</span>`;const role=p.role?`<span class="prole">${esc(p.role)}</span>`:'';const tel=(p.tel||'').replace(/\s/g,'');const call=tel?`<a class="pcall" href="tel:${tel}">sună</a>`:`<span class="pcall no">fără nr.</span>`;return `<div class="prow">${av}<div class="pinfo"><span class="pnm">${esc(nm)}</span>${role}</div>${call}</div>`;}).join('')+'</div>';_psheet.hidden=false;requestAnimationFrame(()=>_psheet.classList.add('open'));document.body.classList.add('sheet-open');const x=_psheet.querySelector('.sheet-x');if(x)x.focus();}
document.addEventListener('click',e=>{const b=e.target.closest('.pbtn[data-people]');if(b){e.preventDefault();openPeopleF(b.dataset.people);}});
/* ── prezență: formular per atelier (o singură sheet activă) ── */
let _pzCur=null;
function _pzTime(){try{return new Date().toLocaleTimeString('ro-RO',{hour:'2-digit',minute:'2-digit'});}catch(e){return '';}}
function _pzMsg(id,txt,cls){const m=document.getElementById('pzsavemsg');if(m&&_pzCur===id){m.textContent=txt;m.className='pzsavemsg'+(cls?' '+cls:'');}}
function _dayLabel(zi){const d=(typeof DAYS!=='undefined')&&DAYS.find(x=>x.id===zi);return d?(d.h2+' '+d.dn):zi;}
function openPrez(id){
  const g=PREZ_GROUPS[id]; if(!g)return; _pzCur=id; g._state=g._state||{};
  const today=(typeof nowA==='function')?nowA().day:null;
  const locked = g.zi!==today; g._locked=locked;
  _pst.textContent='prezență · '+g.label;
  _psb.innerHTML=`<div class="pzhead"><span class="pzcount" id="pzc">…</span>${locked?'':'<button type="button" class="pzall" data-pzall="1">toți prezenți</button>'}</div>${locked?`<div class="pzlock">doar vizualizare · se completează în ziua atelierului (${esc(_dayLabel(g.zi))})</div>`:''}<div class="pzlist${locked?' locked':''}" id="pzlist">${g.people.map((p,i)=>`<div class="pzrow" data-pzi="${i}"><span class="pzck" aria-hidden="true"></span><span class="pzinfo"><span class="pznm">${esc(p.name)}</span>${p.sub?`<span class="pzsub">${esc(p.sub)}</span>`:''}</span></div>`).join('')}</div>`;
  if(locked){ _clearFoot(); }
  else { _pfoot.hidden=false; _pfoot.innerHTML=`<button type="button" class="pzsavebtn" data-pzsave="1">salvează prezența</button><span class="pzsavemsg" id="pzsavemsg"></span>`; }
  _psheet.hidden=false;requestAnimationFrame(()=>_psheet.classList.add('open'));document.body.classList.add('sheet-open');
  const x=_psheet.querySelector('.sheet-x'); if(x)x.focus();
  _paintPz(id);
  pzSb(`/prezenta_ateliere?zi=eq.${encodeURIComponent(g.zi)}&atelier=eq.${encodeURIComponent(g.atelier)}&select=participant,prezent`)
    .then(r=>r.ok?r.json():Promise.reject(r.status))
    .then(rows=>{const st={};rows.forEach(x=>{st[x.participant]=x.prezent;});g._state=st;if(_pzCur===id){_paintPz(id);if(!locked&&rows.length)_pzMsg(id,'salvat ✓','ok');}})
    .catch(()=>{if(!locked)_pzMsg(id,'de rulat o dată SQL-ul în Supabase','err');});
}
function _paintPz(id){
  const g=PREZ_GROUPS[id]; if(!g||_pzCur!==id)return; const st=g._state||{};
  const list=document.getElementById('pzlist'); if(!list)return; let c=0;
  g.people.forEach((p,i)=>{const row=list.querySelector('.pzrow[data-pzi="'+i+'"]');if(!row)return;const on=!!st[p.name];if(on)c++;row.classList.toggle('on',on);const ck=row.querySelector('.pzck');if(ck)ck.textContent=on?'✓':'';});
  const cnt=document.getElementById('pzc'); if(cnt)cnt.textContent=c+' din '+g.people.length+' prezenți';
}
function _pzSave(g,body){return pzSb('/prezenta_ateliere?on_conflict=zi,atelier,participant',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(body)});}
function _pzToggle(id,i){
  const g=PREZ_GROUPS[id]; if(!g||g._locked)return; const p=g.people[i]; g._state=g._state||{};
  g._state[p.name]=!g._state[p.name]; _paintPz(id); _pzMsg(id,'se salvează…','');
  _pzSave(g,[{zi:g.zi,atelier:g.atelier,participant:p.name,prezent:g._state[p.name]}])
    .then(r=>_pzMsg(id, r.ok?('salvat ✓ '+_pzTime()):'nesalvat — apasă „salvează prezența"', r.ok?'ok':'err'))
    .catch(()=>_pzMsg(id,'nesalvat — apasă „salvează prezența"','err'));
}
function _pzSaveAll(id){
  const g=PREZ_GROUPS[id]; if(!g)return; g._state=g._state||{}; _pzMsg(id,'se salvează…','');
  _pzSave(g,g.people.map(p=>({zi:g.zi,atelier:g.atelier,participant:p.name,prezent:!!g._state[p.name]})))
    .then(r=>_pzMsg(id, r.ok?('salvat ✓ '+_pzTime()):'eroare la salvare — reîncearcă', r.ok?'ok':'err'))
    .catch(()=>_pzMsg(id,'eroare la salvare (offline?)','err'));
}
function _pzAll(id){
  const g=PREZ_GROUPS[id]; if(!g)return; g._state=g._state||{}; g.people.forEach(p=>{g._state[p.name]=true;}); _paintPz(id); _pzSaveAll(id);
}
document.addEventListener('click',e=>{
  const pb=e.target.closest('.pzbtn[data-prez]'); if(pb){e.preventDefault();openPrez(pb.dataset.prez);return;}
  if(_psheet.hidden||_pzCur==null)return;
  const ps=e.target.closest('[data-pzsave]'); if(ps){e.preventDefault();_pzSaveAll(_pzCur);return;}
  const pa=e.target.closest('[data-pzall]'); if(pa){e.preventDefault();_pzAll(_pzCur);return;}
  const pr=e.target.closest('.pzrow[data-pzi]'); if(pr){e.preventDefault();_pzToggle(_pzCur,+pr.dataset.pzi);return;}
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!_psheet.hidden)closePartSheet();});

/* schimbarea zilei */
function selectDay(id,scroll){
  document.querySelectorAll('.daychip').forEach(c=>c.setAttribute('aria-selected',String(c.dataset.day===id)));
  /* pe +info nu au ce căuta filtrele sau selectorul de trupă */
  const onInfo=(id==='info');
  filtersBox.style.display=onInfo?'none':'';
  const tb=document.getElementById('trupebar');
  if(tb)tb.style.display=onInfo?'none':'';
  const ac=document.querySelector(`.daychip[data-day="${id}"]`), rd=document.getElementById('rail');
  if(ac&&rd&&rd.contains(ac)){
    const l=ac.offsetLeft-rd.offsetLeft;
    if(l<rd.scrollLeft) rd.scrollLeft=Math.max(0,l-8);
    else if(l+ac.offsetWidth>rd.scrollLeft+rd.clientWidth) rd.scrollLeft=l+ac.offsetWidth-rd.clientWidth+8;
  }
  document.querySelectorAll('section.day').forEach(s=>s.classList.toggle('on',s.id==='day-'+id));
  if(scroll){
    const rail=document.querySelector('nav.rail');
    const y=rail.offsetTop;
    if(window.scrollY>y) window.scrollTo({top:y,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
  }
  applyFilters();
}

/* ── "acum": marcaje pe ora reală ───────── */
const fab=document.getElementById('fab');
const fabT=document.getElementById('fabt');
const nowlineEl=document.createElement('div');
nowlineEl.className='nowline'; nowlineEl.innerHTML='<span></span>';
function updateNow(){
  const n=nowA();
  document.querySelectorAll('.nowtag').forEach(x=>x.hidden=true);
  document.querySelectorAll('.ev.now-active').forEach(x=>x.classList.remove('now-active'));
  document.querySelectorAll('[data-gridnow]').forEach(x=>x.hidden=true);
  if(nowlineEl.parentNode) nowlineEl.remove();
  fab.hidden=!n.day;
  window.CURRENT_DAY=n.day||null;
  updateGreet(n);
  if(!n.day) return;
  fabT.textContent=(n.demo?'demo · ':'')+n.hm;
  const sec=document.getElementById('day-'+n.day);
  if(!sec) return;
  sec.querySelectorAll('.viewlist .ev').forEach(ev=>{
    const s=+ev.dataset.s, e=+ev.dataset.e;
    if(e && s<=n.mins && n.mins<e){
      ev.classList.add('now-active');
      const tag=ev.querySelector('.nowtag'); if(tag)tag.hidden=false;
    }
  });
  nowlineEl.querySelector('span').textContent='acum · '+n.hm;
  const listBox=sec.querySelector('.viewlist');
  const nxt=[...sec.querySelectorAll('.viewlist [data-s]')].find(el=>+el.dataset.s>n.mins && el.style.display!=='none');
  nxt?listBox.insertBefore(nowlineEl,nxt):listBox.appendChild(nowlineEl);
  const gb=sec.querySelector('.gbody');
  if(gb){
    const t0=+gb.dataset.t0, t1=+gb.dataset.t1;
    if(n.mins>=t0 && n.mins<=t1){
      const gl=gb.querySelector('[data-gridnow]');
      gl.hidden=false; gl.style.top=((n.mins-t0)*PXM)+'px';
      gl.querySelector('span').textContent=n.hm;
    }
  }
}
fab.addEventListener('click',()=>{
  const n=nowA(); if(!n.day)return;
  selectDay(n.day,false);
  const el=document.body.dataset.view==='loc'
    ? document.querySelector('#day-'+n.day+' [data-gridnow]:not([hidden])')
    : (document.querySelector('.ev.now-active')||nowlineEl);
  if(el) el.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});
});

/* antetul grilei stă lipit sub banda de zile */
const railH=document.querySelector('nav.rail').offsetHeight;
document.documentElement.style.setProperty('--railh',railH+'px');

/* ── salutul din header: replici PROPRII paginii (AUD.greetings).
      Formate: listă simplă (o alegere aleatoare) sau
      {pre:[...], zile:{mi29:[...],...}, post:[...]} — rotație pe zile,
      «pre» înainte de festival, «post» după. Fără replici → ascuns. ── */
let lastGreet='', greetKey='', greetPick='';
const FEST_LAST=Object.keys(DATEMAP).map(k=>k.split('.').reverse().join('')).sort().pop();
function isPostFestival(){
  const parts=new Intl.DateTimeFormat('ro-RO',{timeZone:'Europe/Bucharest',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const g=t=>parts.find(x=>x.type===t).value;
  return (g('year')+g('month')+g('day'))>FEST_LAST;
}
function updateGreet(n){
  const g=document.getElementById('greet'); if(!g)return;
  let txt=null;
  if(selTrupa) txt=`urmărești ${TRUPE_IDS[selTrupa]||selTrupa}`;
  else{
    const G=AUD.greetings;
    let pool=null,key='';
    if(Array.isArray(G)){pool=G;key='flat';}
    else if(G){
      if(n&&n.day&&G.zile&&(G.zile[n.day]||[]).length){pool=G.zile[n.day];key=n.day;}
      else if(!(n&&n.day)&&isPostFestival()){pool=G.post||null;key='post';}
      else if(!(n&&n.day)){pool=G.pre||null;key='pre';}
    }
    if(pool&&pool.length){
      /* aceeași replică pe toată ziua/perioada, aleasă aleator la încărcare */
      if(key!==greetKey){greetKey=key;greetPick=pool[Math.floor(Math.random()*pool.length)];}
      txt=greetPick;
    }
  }
  if(!txt){g.hidden=true;lastGreet='';return;}
  if(txt===lastGreet) return;
  lastGreet=txt;
  g.hidden=false;
  clearInterval(g._tw);
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){g.textContent=txt;return;}
  g.innerHTML='<span class="gtxt"></span><span class="gcursor">▌</span>';
  const t=g.querySelector('.gtxt');let i=0;
  g._tw=setInterval(()=>{t.textContent=txt.slice(0,++i);if(i>=txt.length)clearInterval(g._tw);},45);
}

/* ── pornire ────────────────────────────── */
/* deep-link pe trupă: ?t=<id> */
const DEEP=(()=>{const v=new URLSearchParams(location.search).get('t');return v&&TRUPE_HERE.includes(v)?v:null;})();
selectDay(nowA().day||nearestDay(),false);
if(AUD.trupePicker && DEEP) selectTrupa(DEEP,true);
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>setTimeout(()=>{
  const cur=document.querySelector('.daychip[aria-selected="true"]');
  if(cur)selectDay(cur.dataset.day,false);
},80));
updateNow();
setInterval(updateNow,30000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)updateNow();});

/* offline: service worker propriu al subpaginii */
if('serviceWorker' in navigator) navigator.serviceWorker.register(AUD.sw||'sw.js').catch(()=>{});
})();
