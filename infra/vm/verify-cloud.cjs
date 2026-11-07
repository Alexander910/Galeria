const fs = require('node:fs/promises');
const assert = require('node:assert/strict');
const origin = 'https://nogal-uietolmehuftu-1.northcentralus.cloudapp.azure.com';
const secondary = 'https://nogal-uietolmehuftu-2.belgiumcentral.cloudapp.azure.com';
module.exports = async function verify(credentials) {
  const evidence = { at: new Date().toISOString(), origin, secondary, accounts: [], restored: [], sessions: [] };
  const cookies = new Map();
  async function request(route, method = 'GET', body, cookie, host = origin) {
    return fetch(host + route, { method, headers: { Origin: host, ...(body ? {'Content-Type':'application/json'} : {}), ...(cookie ? {Cookie:cookie} : {}) }, ...(body ? {body:JSON.stringify(body)} : {}), signal:AbortSignal.timeout(120000) });
  }
  for (const [username,password] of credentials) {
    const r = await request('/api/login','POST',{username,password});
    assert.equal(r.status,200,`Login ${username}: ${r.status}`);
    const result = await r.json();
    assert.equal(result.user.username,username);
    const cookie=r.headers.get('set-cookie').split(';')[0];
    cookies.set(username,cookie);
    evidence.accounts.push({username,status:r.status});
    for (let i=0;i<4;i++) {
      const session=await request('/api/session','GET',null,cookie);
      assert.equal((await session.json()).user.username,username);
      evidence.sessions.push({username,backend:session.headers.get('x-nogal-backend'),status:session.status});
    }
  }
  const works=(await (await request('/api/artworks')).json()).works;
  const input=JSON.parse(await fs.readFile('data/deploy/restore-input.json','utf8'));
  for (const work of input) {
    if(works.some(w=>w.title===work.title && w.uploadedBy===work.uploadedBy)) continue;
    const response=await request('/api/artworks','POST',work,cookies.get(work.uploadedBy));
    const saved=await response.json();
    assert.equal(response.status,201,`Restaurar ${work.title}: ${JSON.stringify(saved)}`);
    assert.ok(Array.isArray(saved.work.labels));
    evidence.restored.push({id:saved.work.id,title:saved.work.title,owner:saved.work.uploadedBy,labels:saved.work.labels.length,provider:saved.work.analysisProvider});
    console.log('Restaurada:',work.title,'etiquetas:',saved.work.labels.length);
  }
  const history=(await (await request('/api/artworks')).json()).works;
  evidence.historyCount=history.length;
  evidence.sample=history.map(w=>({id:w.id,title:w.title,labels:w.labels,createdAt:w.createdAt,processedAt:w.processedAt,provider:w.analysisProvider}));
  for(const work of history) {
    const image=await request(work.imageUrl);
    assert.equal(image.status,200);
    await image.arrayBuffer();
  }
  for(const host of [origin,secondary]) {
    const health=await request('/api/health','GET',null,null,host);
    assert.equal(health.status,200);
  }
  const fixture={...input.find(w=>w.title.includes('Microsoft Learn')),title:'Prueba temporal de edición y permisos'};
  const created=await request('/api/artworks','POST',fixture,cookies.get('Astid'));
  assert.equal(created.status,201);
  const temporary=(await created.json()).work;
  try {
    const update={...fixture,title:'Prueba temporal editada',frameStyle:'silver',matStyle:'white',description:'Verificación técnica temporal'};
    delete update.imageData;
    const forbidden=await request('/api/artworks/'+temporary.id,'PUT',update,cookies.get('Elvia'));
    assert.equal(forbidden.status,403);
    const edited=await request('/api/artworks/'+temporary.id,'PUT',update,cookies.get('Astid'));
    assert.equal(edited.status,200);
    assert.equal((await edited.json()).work.frameStyle,'silver');
    evidence.edit={status:edited.status,otherUserStatus:forbidden.status};
  } finally {
    const removed=await request('/api/artworks/'+temporary.id,'DELETE',null,cookies.get('Astid'));
    assert.equal(removed.status,200);
    evidence.delete={status:removed.status};
  }
  const invalid=await request('/api/artworks','POST',{...fixture,imageData:'data:image/png;base64,YmFk'},cookies.get('Astid'));
  assert.equal(invalid.status,400);
  evidence.invalidFileStatus=invalid.status;
  await fs.writeFile('data/deploy/cloud-verification.json',JSON.stringify(evidence,null,2));
  console.log(JSON.stringify({accounts:evidence.accounts,historyCount:evidence.historyCount,backends:[...new Set(evidence.sessions.map(s=>s.backend))]}));
};
