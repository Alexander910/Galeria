const fs=require('node:fs/promises');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const origins=['https://nogal-uietolmehuftu-1.northcentralus.cloudapp.azure.com','https://nogal-uietolmehuftu-2.belgiumcentral.cloudapp.azure.com'];
module.exports=async function check(credentials){
 const expected=JSON.parse(await fs.readFile('data/deploy/restore-public.json','utf8'));
 const evidence={at:new Date().toISOString(),accounts:[],health:[],images:[],sessions:[],restoredIdsPreserved:true};
 const cookies=new Map();
 const request=(route,method='GET',data,cookie,origin=origins[0])=>fetch(origin+route,{method,headers:{Origin:origin,...(data?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},...(data?{body:JSON.stringify(data)}:{}),signal:AbortSignal.timeout(90000)});
 for(const origin of origins)for(let i=0;i<4;i++){
  const r=await request('/api/health','GET',null,null,origin);assert.equal(r.status,200);evidence.health.push({origin,backend:r.headers.get('x-nogal-backend'),...(await r.json())});
 }
 for(const [username,password]of credentials){
  const login=await request('/api/login','POST',{username,password});assert.equal(login.status,200,`Login ${username}`);
  cookies.set(username,login.headers.get('set-cookie').split(';')[0]);evidence.accounts.push({username,status:200});
  for(let i=0;i<6;i++){
   const r=await request('/api/session','GET',null,cookies.get(username));assert.equal((await r.json()).user.username,username);evidence.sessions.push({username,backend:r.headers.get('x-nogal-backend'),status:r.status});
  }
 }
 const profiles=(await(await request('/api/profiles')).json()).profiles;
 for(const user of expected.profiles){const saved=profiles.find(u=>u.id===user.id);assert.ok(saved);for(const key of ['name','bio','location','specialty'])assert.equal(saved[key]||'',user[key]||'');}
 const works=(await(await request('/api/artworks')).json()).works;assert.equal(works.length,expected.artworks.length);
 let testImage;
 for(const work of expected.artworks){
  const saved=works.find(w=>w.id===work.id);assert.ok(saved,work.id);for(const key of ['title','createdAt','processedAt','frameStyle','description'])assert.equal(saved[key],work[key]);assert.deepEqual(saved.labels,work.labels);
  const r=await request(saved.imageUrl);assert.equal(r.status,200);const bytes=Buffer.from(await r.arrayBuffer());const sha=createHash('sha256').update(bytes).digest('hex');assert.equal(sha,expected.hashes[work.imageUrl.split('/').pop()]);evidence.images.push({id:work.id,bytes:bytes.length,sha256:sha});if(!testImage)testImage={bytes,work};
 }
 const input={...testImage.work,title:'Prueba temporal de reactivación',frameStyle:'maya-espiral',imageData:'data:image/'+testImage.work.imageUrl.split('.').pop()+';base64,'+testImage.bytes.toString('base64')};
 const cookie=cookies.get(input.uploadedBy);const posted=await request('/api/artworks','POST',input,cookie);assert.equal(posted.status,201);const temporary=(await posted.json()).work;
 try{
  assert.equal(temporary.frameStyle,'maya-espiral');assert.ok(temporary.labels.length>0);evidence.vision={provider:temporary.analysisProvider,labels:temporary.labels.length};
  delete input.imageData;input.title='Prueba temporal editada';input.frameStyle='maya-celosia';
  const edited=await request('/api/artworks/'+temporary.id,'PUT',input,cookie);assert.equal(edited.status,200);assert.equal((await edited.json()).work.frameStyle,'maya-celosia');
  const other=[...cookies.keys()].find(n=>n!==input.uploadedBy);const denied=await request('/api/artworks/'+temporary.id,'PUT',input,cookies.get(other));assert.equal(denied.status,403);
  evidence.edit={status:200,otherUser:403,frameStyle:'maya-celosia'};
 }finally{const deleted=await request('/api/artworks/'+temporary.id,'DELETE',null,cookie);assert.equal(deleted.status,200);evidence.deleteStatus=200;}
 evidence.historyCount=(await(await request('/api/artworks')).json()).works.length;assert.equal(evidence.historyCount,5);
 await fs.writeFile('data/deploy/reactivation-check.json',JSON.stringify(evidence,null,2));
 console.log(JSON.stringify({accounts:evidence.accounts,historyCount:evidence.historyCount,imagesVerified:evidence.images.length,backends:[...new Set(evidence.health.map(h=>h.backend))],vision:evidence.vision,edit:evidence.edit,deleteStatus:evidence.deleteStatus}));
};
