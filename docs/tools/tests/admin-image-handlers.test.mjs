import fs from 'fs';
import * as imgs from './images.mjs';
import * as vars from './image-variants.mjs';
import { publishReadiness } from '/Users/hatim_czar/Desktop/photoczaro-site/models-site/functions/_lib/publish-check.js';
const store=new Map();const kv=new Map();
const env={MEDIA:{put:async(k,v)=>{store.set(k,Buffer.from(v instanceof ArrayBuffer?v:await new Response(v).arrayBuffer()))},get:async k=>store.has(k)?{arrayBuffer:async()=>store.get(k).buffer.slice(store.get(k).byteOffset,store.get(k).byteOffset+store.get(k).length),body:store.get(k)}:null,delete:async k=>{store.delete(k)}},
 ROSTER_KV:{get:async(k,o)=>kv.has(k)?JSON.parse(kv.get(k)):null,put:async(k,v)=>kv.set(k,v)}};
kv.set('model:t1',JSON.stringify({slug:'t1',name:'T',images:{},imageSets:{}}));
const file=(p,type='image/webp')=>new File([fs.readFileSync(p)],p,{type});
const post=async(mod,fields)=>{const fd=new FormData();for(const [k,v] of Object.entries(fields))fd.append(k,v);return mod.onRequestPost({request:new Request('https://x.test/api/admin/models/t1/x',{method:'POST',body:fd}),env,params:{slug:'t1'}})};
const ok=(c,m)=>{console.log((c?'PASS':'FAIL')+' - '+m); if(!c) process.exitCode=1};
// 1. upload A, again A, then B
let r=await (await post(imgs,{image:file('A.webp'),slot:'headshot'})).json(); const k1=r.key;
ok(/^models\/t1\/headshot\.[0-9a-f]{8}\.webp$/.test(k1),'new upload gets a content-hashed key: '+k1);
r=await (await post(imgs,{image:file('A.webp'),slot:'headshot'})).json(); ok(r.key===k1,'same bytes -> same URL (stays cacheable)');
// 2. variants for A
r=await (await post(vars,{key:k1,sourceWidth:'200',sourceHeight:'260',w80:file('A-80.webp'),w120:file('A-120.webp')})).json();
const base=k1.replace(/\.webp$/,""); const h=k1.match(/\.([0-9a-f]{8})\.webp$/)[1];
ok(r.ok && r.set && r.set.v===h && JSON.stringify(r.set.widths)==='[80,120]','variants stored; set.v matches hash of the stored source');
ok(store.has(`${base}-80.webp`)&&store.has(`${base}-120.webp`),'variant objects exist at <key>-<w>.webp');
let rec=JSON.parse(kv.get('model:t1')); ok(rec.imageSets[k1],'imageSets recorded on the model');
// 3. replace the photo with B -> URL changes, old set dropped
r=await (await post(imgs,{image:file('B.webp'),slot:'headshot'})).json(); const k2=r.key;
ok(k2!==k1,'replacing the photograph changes its URL: '+k1.split('/').pop()+' -> '+k2.split('/').pop());
rec=JSON.parse(kv.get('model:t1')); ok(!rec.imageSets[k1],'old photo\'s responsive set removed from the record');
ok(rec.images.headshot===k2,'record points at the new key');
// 4. publish gate: new photo has no responsive set yet
const rd=publishReadiness({...rec,name:'T',location:'Dubai',height:'170 cm',seoTitle:'t',seoDescription:'d',categories:['women'],bust:'1',images:{headshot:k2,fullFront:'a',fullSide:'b'}});
ok(rd.missing.some(m=>/Responsive image versions/.test(m)),'publish is blocked until responsive versions exist');
// 5. validation
let bad=await post(vars,{key:k2,sourceWidth:'200',sourceHeight:'260',w80:file('bad.png','image/png')}); ok(bad.status===400,'non-WebP version rejected (400)');
bad=await post(vars,{key:'models/t1/other.webp',sourceWidth:'200',sourceHeight:'260',w80:file('B-80.webp')}); ok(bad.status===400,'key not owned by the model rejected (400)');
bad=await post(vars,{key:k2,sourceWidth:'200',sourceHeight:'260',w9999:file('B-80.webp')}); ok(bad.status===400,'absurd width rejected (400)');
// 6. delete removes the derived files too
await post(vars,{key:k2,sourceWidth:'200',sourceHeight:'260',w80:file('B-80.webp'),w120:file('B-120.webp')});
const k2base=k2.replace(/\.webp$/,''); ok(store.has(`${k2base}-80.webp`),'B variants stored');
const del=await imgs.onRequestDelete({request:new Request('https://x.test/api/admin/models/t1/images?key='+encodeURIComponent(k2),{method:'DELETE'}),env,params:{slug:'t1'}});
ok(del.status===200&&![...store.keys()].some(k=>k.startsWith(k2base)),'removing a photo also removes its derived versions');
