const fs=require('node:fs/promises');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const origins=['https://nogal-uietolmehuftu-1.northcentralus.cloudapp.azure.com','https://nogal-uietolmehuftu-2.belgiumcentral.cloudapp.azure.com'];
module.exports=async function check(credentials){
 const evidence={started:new Date().toISOString(),observations:[]};
 const photo='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
 const expectedHash=createHash('sha256').update(Buffer.from(photo,'base64')).digest('hex');
 const request=(route,method='GET',body,cookie,origin=origins[0])=>fetch(origin+route,{method,headers:{Origin:origin,...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)});
 const profiles=async()=>{const r=await request('/api/profiles');assert.equal(r.status,200);return(await r.json()).profiles;};
 const all=await profiles();const original=all.find(u=>!u.photoUrl&&credentials.some(c=>c[0]===u.username));
 assert.ok(original,'No hay un perfil sin foto disponible para una prueba temporal segura.');
 const credentialsForUser=credentials.find(c=>c[0]===original.username);
 const login=await request('/api/login','POST',{username:credentialsForUser[0],password:credentialsForUser[1]});assert.equal(login.status,200);
 const cookie=login.headers.get('set-cookie').split(';')[0];
 const fields=u=>Object.fromEntries(['name','bio','location','specialty'].map(k=>[k,u[k]||'']));
 const temporaryUrls=new Set();let currentUrl;
 async function verifyShared(url){
  const backends=new Set();
  const deadline=Date.now()+60000;let rounds=0;
  do{
   for(const origin of origins)for(let i=0;i<2;i++){
   const r=await request('/api/profiles','GET',null,null,origin);assert.equal((await r.json()).profiles.find(p=>p.id===original.id).photoUrl,url);
   const image=await request(url,'GET',null,null,origin);assert.equal(image.status,200);assert.match(image.headers.get('content-type'),/image\/png/);
   assert.equal(createHash('sha256').update(Buffer.from(await image.arrayBuffer())).digest('hex'),expectedHash);
   backends.add(image.headers.get('x-nogal-backend'));evidence.observations.push({origin,backend:image.headers.get('x-nogal-backend'),status:200});
   const secondImage=await request(url,'GET',null,null,origin);assert.equal(secondImage.status,200);
   assert.equal(createHash('sha256').update(Buffer.from(await secondImage.arrayBuffer())).digest('hex'),expectedHash);
   backends.add(secondImage.headers.get('x-nogal-backend'));evidence.observations.push({origin,backend:secondImage.headers.get('x-nogal-backend'),status:200});
   }
   rounds++;
   if(backends.size<2)await new Promise(r=>setTimeout(r,1500));
  }while((backends.size<2||rounds<2)&&Date.now()<deadline);
  assert.ok(backends.has('app1')&&backends.has('app2'));
 }
 try{
  const invalid=await request('/api/profile','PUT',{...fields(original),photoData:'data:image/png;base64,YmFk'},cookie);assert.equal(invalid.status,400);evidence.invalidStatus=400;
  const denied=await request('/api/profile','PUT',{...fields(original),photoData:'data:image/png;base64,'+photo});assert.equal(denied.status,401);evidence.unauthenticatedStatus=401;
  const uploaded=await request('/api/profile','PUT',{...fields(original),photoData:'data:image/png;base64,'+photo},cookie);assert.equal(uploaded.status,200);
  currentUrl=(await uploaded.json()).user.photoUrl;temporaryUrls.add(currentUrl);assert.match(currentUrl,/^\/media\/[a-f0-9-]{36}\.png$/);
  evidence.uploadBackend=uploaded.headers.get('x-nogal-backend');await verifyShared(currentUrl);
  await fs.writeFile('data/deploy/profile-photo-test-stage.json',JSON.stringify({phase:'uploaded',username:original.username,url:currentUrl,backend:evidence.uploadBackend}));
  console.log('PHOTO_SHARED_READY',evidence.uploadBackend);
  const deadline=Date.now()+600000;
  while(true){try{await fs.access('data/deploy/profile-photo-test-continue');break;}catch{}if(Date.now()>deadline)throw new Error('Se agotó la espera de reinicio y respaldo.');await new Promise(r=>setTimeout(r,1500));}
  await verifyShared(currentUrl);evidence.persistedAfterRestart=true;
  const current=(await profiles()).find(u=>u.id===original.id);assert.equal(current.photoUrl,currentUrl,'El perfil cambió durante la prueba.');
  const replaced=await request('/api/profile','PUT',{...fields(current),photoData:'data:image/png;base64,'+photo},cookie);assert.equal(replaced.status,200);
  const oldUrl=currentUrl;currentUrl=(await replaced.json()).user.photoUrl;temporaryUrls.add(currentUrl);assert.notEqual(currentUrl,oldUrl);assert.equal((await request(oldUrl)).status,404);evidence.replaced=true;
  await verifyShared(currentUrl);
 }finally{
  const current=(await profiles()).find(u=>u.id===original.id);
  if(temporaryUrls.has(current?.photoUrl)){
   const removed=await request('/api/profile','PUT',{...fields(current),photoData:null},cookie);assert.equal(removed.status,200);assert.equal((await removed.json()).user.photoUrl,'');evidence.removed=true;
  }
 }
 assert.equal((await request(currentUrl)).status,404);evidence.finished=new Date().toISOString();
 await fs.writeFile('data/deploy/profile-photo-verification.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify({persistedAfterRestart:evidence.persistedAfterRestart,replaced:evidence.replaced,removed:evidence.removed,observations:evidence.observations.length}));
};
