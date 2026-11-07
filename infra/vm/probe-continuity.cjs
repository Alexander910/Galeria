const fs = require('node:fs/promises');
const origins=['https://nogal-uietolmehuftu-1.northcentralus.cloudapp.azure.com','https://nogal-uietolmehuftu-2.belgiumcentral.cloudapp.azure.com'];
module.exports=async function probe(username,password,duration=120000) {
  const login=await fetch(origins[0]+'/api/login',{method:'POST',headers:{Origin:origins[0],'Content-Type':'application/json'},body:JSON.stringify({username,password})});
  if(login.status!==200) throw new Error('No se pudo iniciar la prueba autenticada.');
  const cookie=login.headers.get('set-cookie').split(';')[0];
  const started=Date.now(), samples=[];
  while(Date.now()-started<duration) {
    for(const origin of origins) {
      const sample={at:new Date().toISOString(),origin};
      try {
        const response=await fetch(origin+'/api/session',{headers:{Cookie:cookie},signal:AbortSignal.timeout(10000)});
        sample.status=response.status;sample.backend=response.headers.get('x-nogal-backend');
        sample.sessionValid=(await response.json()).user?.username===username;
      }catch(error){sample.error=error.message;}
      samples.push(sample);
    }
    await new Promise(r=>setTimeout(r,1000));
  }
  const result={started:new Date(started).toISOString(),ended:new Date().toISOString(),requests:samples.length,failures:samples.filter(s=>s.status!==200||!s.sessionValid),samples};
  await fs.writeFile('data/deploy/continuity.json',JSON.stringify(result,null,2));
  console.log(JSON.stringify({requests:result.requests,failures:result.failures.length,backends:[...new Set(samples.map(s=>s.backend))]}));
  if(result.failures.length)process.exitCode=1;
};
