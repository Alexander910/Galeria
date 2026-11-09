#!/bin/bash
set -euo pipefail
install -d -o 1000 -g 1000 -m 700 /var/lib/nogal-continuity-final
trap 'systemctl start nogal' EXIT
docker run --rm -i --read-only --tmpfs /tmp --cap-drop=ALL --security-opt=no-new-privileges --memory=128m --network host -v /var/lib/nogal-continuity-final:/evidence nogal:project node <<'NOGAL_MONITOR' &
const fs=require('node:fs');
const origins=['https://nogal-uietolmehuftu-1.northcentralus.cloudapp.azure.com','https://nogal-uietolmehuftu-2.belgiumcentral.cloudapp.azure.com'];
(async()=>{
 const evidence={started:new Date().toISOString(),samples:[]};const until=Date.now()+90000;
 while(Date.now()<until){
  await Promise.all(origins.map(async origin=>{
   const s={at:new Date().toISOString(),origin};
   try{const r=await fetch(origin+'/api/artworks',{signal:AbortSignal.timeout(12000)});s.status=r.status;s.backend=r.headers.get('x-nogal-backend');s.works=(await r.json()).works?.length;}
   catch(error){s.error=error.message;}
   evidence.samples.push(s);
  }));await new Promise(resolve=>setTimeout(resolve,1000));
 }
 evidence.ended=new Date().toISOString();
 const stop=fs.readFileSync('/evidence/stopped.txt','utf8').trim(),restart=fs.readFileSync('/evidence/restarted.txt','utf8').trim();
 const during=evidence.samples.filter(s=>s.at>=stop&&s.at<restart);
 const failures=evidence.samples.filter(s=>s.status!==200||!(s.works>=5));
 const summary={started:evidence.started,ended:evidence.ended,requests:evidence.samples.length,failures:failures.length,app1StoppedAt:stop,app1RestartedAt:restart,stopSeconds:(Date.parse(restart)-Date.parse(stop))/1000,requestsDuringStop:during.length,duringStopBackends:[...new Set(during.map(s=>s.backend))],afterRecoveryBackends:[...new Set(evidence.samples.filter(s=>s.at>restart).map(s=>s.backend))]};
 fs.writeFileSync('/evidence/samples.json',JSON.stringify(evidence));fs.writeFileSync('/evidence/summary.json',JSON.stringify(summary));
 console.log('NOGAL_CONTINUITY_RESULT '+JSON.stringify(summary));
 if(failures.length||during.length<8||summary.afterRecoveryBackends.length!==2)process.exitCode=1;
})().catch(e=>{console.error(e.message);process.exitCode=1});
NOGAL_MONITOR
monitor_pid=$!
sleep 10
systemctl stop nogal
date -u +%Y-%m-%dT%H:%M:%SZ > /var/lib/nogal-continuity-final/stopped.txt
sleep 20
systemctl start nogal
date -u +%Y-%m-%dT%H:%M:%SZ > /var/lib/nogal-continuity-final/restarted.txt
systemctl is-active nogal
wait "$monitor_pid"
echo NOGAL_CONTINUITY_COMPLETE
