const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {spawn}=require('node:child_process');
const {createUser}=require('../user-accounts');
test('una cuarta cuenta inicia sesión, aparece en perfiles y conserva el acceso después de reiniciar',async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'nogal-users-'));
 const password='clave-temporal-nuevos-usuarios';
 let child;
 async function start(){
  child=spawn(process.execPath,['server.js'],{cwd:directory,env:{...process.env,TABLE_ENDPOINT:'',COSMOS_ENDPOINT:'',NODE_ENV:'test',PORT:'4191'},stdio:['ignore','pipe','pipe']});
  await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject);child.once('exit',code=>reject(new Error('Servidor: '+code)));});
 }
 async function stop(){const current=child;child=null;if(current&&current.exitCode===null&&current.signalCode===null){const done=new Promise(r=>current.once('exit',r));current.kill();await done;}}
 try{
  for(const name of ['server.js','gallery-store.js','azure-store.js','user-accounts.js','index.html','login.html','theme.js'])await fs.copyFile(path.join(__dirname,'..',name),path.join(directory,name));
  await fs.mkdir(path.join(directory,'data'));
  const users=['Astid','Zulema','Elvia','Carlos'].map(username=>createUser({username,name:username,password}));
  users[0].id='652f51da-9b44-4370-bebe-1f34bc0f40d2';
  await fs.writeFile(path.join(directory,'data/users.json'),JSON.stringify({users}));
  for(let attempt=0;attempt<2;attempt++){
   await start();
   const r=await fetch('http://127.0.0.1:4191/api/login',{method:'POST',headers:{Origin:'http://127.0.0.1:4191','Content-Type':'application/json'},body:JSON.stringify({username:'carlos',password})});
   assert.equal(r.status,200);assert.equal((await r.json()).user.username,'Carlos');
   const profiles=(await(await fetch('http://127.0.0.1:4191/api/profiles')).json()).profiles;
   assert.equal(profiles.length,4);assert.ok(profiles.some(p=>p.username==='Astid'));assert.ok(profiles.some(p=>p.username==='Carlos'));
   assert.equal(JSON.stringify(profiles).includes('passwordHash'),false);
   const previous=await fetch('http://127.0.0.1:4191/api/login',{method:'POST',headers:{Origin:'http://127.0.0.1:4191','Content-Type':'application/json'},body:JSON.stringify({username:'Astid',password})});
   assert.equal(previous.status,200);
   assert.equal((await previous.json()).user.id,users[0].id);
   await stop();
  }
 }finally{await stop();await fs.rm(directory,{recursive:true,force:true});}
});
