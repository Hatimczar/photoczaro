import { ID_RE } from '../_lib/delivery.js';

// Serves the private delivery viewer shell for /delivery/<id>. The page itself contains nothing
// private: it asks /api/delivery/<id>/manifest, which only answers with a valid session.
const PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow, noarchive">
<meta name="referrer" content="no-referrer">
<meta name="color-scheme" content="dark">
<title>Your Photoczaro delivery</title>
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400&family=Inter:wght@300;400;500&display=swap">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--gold:#c9a96e;--gold-light:#e8d5a3;--white:#f5f0eb;--grey:#8a8680;--dark:#0a0a0a;--dark-2:#111;--dark-3:#1a1a1a;--danger:#d4756a;--ok:#7ec686}
body{background:var(--dark);color:var(--white);font-family:'Inter',system-ui,sans-serif;font-weight:300;min-height:100vh;-webkit-font-smoothing:antialiased}
a{color:inherit}
:focus-visible{outline:2px solid var(--gold);outline-offset:3px}
header{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:22px 5vw;border-bottom:1px solid rgba(255,255,255,.08)}
.logo{font-family:'Cormorant Garamond',serif;font-size:22px;letter-spacing:.04em;text-decoration:none}
.tag{font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:var(--grey)}
main{max-width:1200px;margin:0 auto;padding:48px 5vw 80px}
h1{font-family:'Cormorant Garamond',serif;font-weight:300;font-size:clamp(2rem,6vw,3.4rem);line-height:1.1;margin:8px 0 14px}
h1 em{color:var(--gold-light)}
.eyebrow{font-size:10px;letter-spacing:.24em;text-transform:uppercase;color:var(--gold)}
.lead{color:rgba(245,240,235,.75);line-height:1.75;max-width:620px;margin-bottom:28px}
button,.btn{display:inline-block;background:var(--gold);color:#0a0a0a;border:0;font:inherit;font-size:12px;letter-spacing:.18em;text-transform:uppercase;padding:14px 26px;cursor:pointer;text-decoration:none}
button.ghost,.btn.ghost{background:transparent;color:var(--gold-light);border:1px solid rgba(201,169,110,.5)}
button:disabled{opacity:.5;cursor:default}
.banner{border:.5px solid rgba(201,169,110,.35);background:var(--dark-2);padding:16px 20px;margin:0 0 28px;font-size:14px;line-height:1.65;color:rgba(245,240,235,.85)}
.toolbar{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin-bottom:24px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:14px}
.tile{background:var(--dark-2);border:.5px solid rgba(255,255,255,.08);position:relative}
.tile button.open{all:unset;display:block;cursor:pointer;width:100%}
.tile img{display:block;width:100%;aspect-ratio:4/5;object-fit:cover;background:#151515}
.tile .play{position:absolute;left:50%;top:38%;transform:translate(-50%,-50%);width:56px;height:56px;border-radius:50%;background:rgba(10,10,10,.65);border:1px solid var(--gold);display:flex;align-items:center;justify-content:center;pointer-events:none}
.tile .play::after{content:"";border-left:14px solid var(--gold-light);border-top:9px solid transparent;border-bottom:9px solid transparent;margin-left:4px}
.tile .meta{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px;font-size:12px;color:var(--grey)}
.tile .meta span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tile .meta a{color:var(--gold-light);font-size:11px;letter-spacing:.14em;text-transform:uppercase;text-decoration:none;border-bottom:.5px solid rgba(232,213,163,.4);white-space:nowrap}
.lb{position:fixed;inset:0;background:rgba(0,0,0,.94);display:none;align-items:center;justify-content:center;z-index:50;padding:3vw}
.lb.on{display:flex}
.lb img,.lb video{max-width:94vw;max-height:88vh;display:block}
.lb .x{position:absolute;top:16px;right:16px}
.empty{color:var(--grey)}
.sr{position:absolute;left:-9999px}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
</style>
</head>
<body>
<header><a class="logo" href="/">Photoczaro</a><span class="tag">Private delivery</span></header>
<main id="main">
  <section id="gallery" hidden>
    <p class="eyebrow" id="g-model"></p>
    <h1 id="g-title"></h1>
    <p class="lead" id="g-note"></p>
    <div class="banner" id="g-banner" role="status"></div>
    <div class="toolbar" id="g-tools"></div>
    <div class="grid" id="g-grid"></div>
    <p class="empty" id="g-empty" hidden>No files have been added yet. Please check back soon.</p>
  </section>
  <section id="gone" hidden>
    <p class="eyebrow">Private delivery</p>
    <h1>This delivery is <em>not available</em></h1>
    <p class="lead" id="gone-msg">The link may be wrong or the delivery may have expired. Please message Hatim and we will sort it out.</p>
  </section>
</main>
<div class="lb" id="lb" role="dialog" aria-modal="true" aria-label="Preview"><button class="x ghost" id="lb-x" type="button">Close</button><div id="lb-body"></div></div>
<script>
(function(){
var id=location.pathname.split('/').filter(Boolean).pop();
var api='/api/delivery/'+id;
var $=function(s){return document.getElementById(s)};
function show(n){['gallery','gone'].forEach(function(k){$(k).hidden=(k!==n)})}
function fmtSize(b){return b>=1048576?(b/1048576).toFixed(b>=10485760?0:1)+' MB':Math.max(1,Math.round(b/1024))+' KB'}

function load(){
  fetch(api+'/manifest').then(function(r){
    if(!r.ok){show('gone');return null}
    return r.json();
  }).then(function(m){if(m)render(m)}).catch(function(){show('gone')});
}

function fileUrl(f,v,dl){return api+'/file/'+f.id+'?v='+v+(dl?'&dl=1':'')}

function render(m){
  show('gallery');
  document.title=m.title+' | Photoczaro delivery';
  $('g-model').textContent=m.modelName;
  $('g-title').textContent=m.title;
  $('g-note').textContent=m.note||'';
  $('g-note').hidden=!m.note;
  var exp=m.expiresAt?' This delivery stays available until '+new Date(m.expiresAt).toLocaleDateString(undefined,{day:'numeric',month:'long',year:'numeric'})+'.':'';
  $('g-banner').textContent=m.released
    ?'Your files are ready. Open any file to view it, or download the full-resolution originals, one by one or all together in a ZIP.'+exp
    :'These are watermarked previews. Your full-resolution files unlock here as soon as your delivery is released.'+exp;
  var tools=$('g-tools');tools.textContent='';
  if(m.released&&m.files.length){
    if(m.zip){
      var z=document.createElement('a');z.className='btn';z.href=api+'/zip';z.setAttribute('download','');
      z.textContent='Download all as ZIP ('+m.files.length+' files, '+fmtSize(m.zip.size)+')';tools.appendChild(z);
    }else{
      var all=document.createElement('button');all.type='button';all.textContent='Download all ('+m.files.length+')';
      all.addEventListener('click',function(){m.files.forEach(function(f,i){setTimeout(function(){var a=document.createElement('a');a.href=fileUrl(f,'original',true);a.download='';document.body.appendChild(a);a.click();a.remove()},i*900)})});
      tools.appendChild(all);
    }
  }
  var g=$('g-grid');g.textContent='';
  $('g-empty').hidden=m.files.length>0;
  m.files.forEach(function(f){
    var t=document.createElement('div');t.className='tile';
    var o=document.createElement('button');o.type='button';o.className='open';o.setAttribute('aria-label','Open '+f.name);
    var img=document.createElement('img');img.loading='lazy';img.alt=f.name;
    img.src=fileUrl(f,f.type==='video'?'poster':'preview');
    if(f.width&&f.height){img.width=f.width;img.height=f.height}
    o.appendChild(img);
    if(f.type==='video'){var p=document.createElement('span');p.className='play';p.setAttribute('aria-hidden','true');o.appendChild(p)}
    o.addEventListener('click',function(){open(f,m.released)});
    t.appendChild(o);
    var meta=document.createElement('div');meta.className='meta';
    var n=document.createElement('span');n.textContent=(f.raw?'RAW · ':'')+f.name+' · '+fmtSize(f.size);meta.appendChild(n);
    if(m.released){var d=document.createElement('a');d.href=fileUrl(f,'original',true);d.setAttribute('download','');d.textContent='Download';meta.appendChild(d)}
    t.appendChild(meta);g.appendChild(t);
  });
}

var lastFocus=null;
function open(f,released){
  var b=$('lb-body');b.textContent='';
  if(f.type==='video'){
    if(!released){var im=document.createElement('img');im.alt=f.name;im.src=fileUrl(f,'poster');b.appendChild(im)}
    else{var v=document.createElement('video');v.controls=true;v.autoplay=true;v.playsInline=true;v.src=fileUrl(f,'original');b.appendChild(v)}
  }else{var i=document.createElement('img');i.alt=f.name;i.src=fileUrl(f,'preview');b.appendChild(i)}
  lastFocus=document.activeElement;$('lb').classList.add('on');$('lb-x').focus();
}
function close(){$('lb').classList.remove('on');$('lb-body').textContent='';if(lastFocus)lastFocus.focus()}
$('lb-x').addEventListener('click',close);
$('lb').addEventListener('click',function(e){if(e.target===$('lb'))close()});
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&$('lb').classList.contains('on'))close()});

load();
})();
</script>
</body>
</html>`;

export async function onRequestGet({ params }) {
  if (!ID_RE.test(params.id)) return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  return new Response(PAGE, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; media-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
    },
  });
}
