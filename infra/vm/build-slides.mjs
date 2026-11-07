import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const root=process.cwd();
const runtime='C:/Users/usuario/.cache/codex-runtimes/codex-primary-runtime/dependencies';
process.env.RUNTIME_NODE_MODULES=runtime+'/node/node_modules';
const {Presentation,PresentationFile}=await import(pathToFileURL(runtime+'/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs'));
const skill='C:/Users/usuario/.codex/plugins/cache/openai-primary-runtime/presentations/26.1105.12137/skills/presentations';
const build=path.join(root,'tmp/slides');await fs.mkdir(build,{recursive:true});await fs.mkdir(path.join(root,'output/presentacion'),{recursive:true});
const deck=Presentation.create({slideSize:{width:1280,height:720}});
function text(s,value,x,y,w,h,size=28,bold=false,color='#342c23'){
 const t=s.shapes.add({geometry:'textbox',position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:'none',width:0}});
 t.text=value;t.text.style={fontFamily:'Arial',fontSize:size,bold,color};return t;
}
function slide(title,notes=''){
 const s=deck.slides.add();s.background.fill='#eee7db';text(s,title,68,46,1144,80,48,true);s.speakerNotes.text=notes;return s;
}
function lines(s,items,start=175,size=30,gap=100){items.forEach((v,i)=>text(s,v,72,start+i*gap,1120,gap-12,size));}
let s=slide('Nogal','Proyecto final de Cloud Computing, UVG Campus Altiplano. Evidencias verificadas el 6 de noviembre de 2026. Guía del curso: Dennys Tezón, 2026. Presentación del 11 de noviembre a las 19:00 Guatemala.');
text(s,'Análisis de imágenes en Azure',72,165,1100,145,64,true);
text(s,'Cinco servidores y dos réplicas de aplicación',72,325,1100,75,32);
text(s,'Aldo Alexander\nCarmen Zulema\nAstrid Cuxilic\nElvia Veronica',72,435,900,190,26);
s=slide('La galería publicada','Captura propia del acceso HTTPS principal, 6 de noviembre de 2026. El historial contiene 7 obras. Abrir una obra y desplegar Etiquetas de la imagen. La cuenta Astid conserva su identificador original.');
s.images.add({blob:new Uint8Array(await fs.readFile(path.join(root,'data/deploy/evidence/gallery.png'))),contentType:'image/png',alt:'Galería Nogal desplegada con siete publicaciones',fit:'contain',position:{left:68,top:145,width:1144,height:510}});
s=slide('Arquitectura de cinco servidores','Fuente: infra/vm/main.bicep. Dos aplicaciones en el mismo conjunto de disponibilidad, con dos dominios de falla y dos de actualización. Las redes se emparejan entre regiones. El proxy alternativo requiere cambio manual de URL. Key Vault entrega bootstrap-users a las aplicaciones. Referencia: https://learn.microsoft.com/en-us/azure/virtual-machines/availability-set-overview');
function box(x,y,w,h,label){const b=s.shapes.add({geometry:'rect',position:{left:x,top:y,width:w,height:h},fill:'#f8f4ec',line:{fill:'#8c7252',width:1.3}});text(s,label,x+15,y+15,w-30,h-20,25,true);return b;}
function line(x1,y1,x2,y2){s.shapes.add({geometry:'line',position:{left:Math.min(x1,x2),top:Math.min(y1,y2),width:Math.abs(x2-x1)||1,height:Math.abs(y2-y1)||1},line:{fill:'#8c7252',width:2},fill:'none'});}
box(395,145,490,64,'Navegador por HTTPS');
box(72,255,500,85,'VM1  Caddy + HAProxy\nNorth Central US');box(708,255,500,85,'VM2  Caddy + HAProxy\nBelgium Central');
box(72,395,500,80,'VM3  app1        VM4  app2\nAplicaciones privadas · Docker');box(708,395,500,80,'VM5  nogal-ops\nRespaldos diarios');
line(640,209,640,232);line(322,232,958,232);line(322,232,322,255);line(958,232,958,255);line(322,340,322,395);line(958,340,958,365);line(322,365,958,365);line(322,365,322,395);
box(72,545,340,90,'Tables privado\nObras y sesiones');box(470,545,340,90,'Blob Storage\nimages · backups');box(868,545,340,90,'Azure AI Vision\nEtiquetas y confianza');
line(322,475,322,510);line(242,510,1038,510);line(242,510,242,545);line(640,510,640,545);line(1038,510,1038,545);
line(958,475,958,490);line(640,490,958,490);line(640,490,640,510);
text(s,'Las sesiones y las obras se comparten entre las dos réplicas',72,650,1120,40,24);
s=slide('Cinco servidores en ejecución','Captura propia de Azure Portal, 6 de noviembre de 2026. VMs Standard_B2ats_v2. Grupo nogal-final. Despliegue nogal-final-v3: Succeeded.');
s.images.add({blob:new Uint8Array(await fs.readFile(path.join(root,'data/deploy/evidence/azure-five-servers.png'))),contentType:'image/png',alt:'Portal de Azure con cinco máquinas virtuales en ejecución',fit:'contain',position:{left:68,top:145,width:1144,height:510}});
s=slide('Carga y análisis de una imagen','La aplicación valida el tipo y el máximo de 19 MB. Azure devuelve etiquetas con confianza, que se convierten a porcentajes y se guardan junto a ID y fechas. Una imagen sintética obtuvo cero detecciones, resultado conservado. Referencias: https://learn.microsoft.com/en-us/azure/ai-services/computer-vision/concept-tagging-images y https://learn.microsoft.com/en-us/azure/storage/tables/table-storage-overview');
lines(s,['1. El usuario publica una imagen y su descripción','2. Azure AI Vision devuelve etiquetas y confianza','3. Blob conserva el archivo y Tables guarda el registro','4. El historial muestra la obra y sus resultados'],165,30,110);
s=slide('Seguridad y datos compartidos','La cuenta de Tables tiene publicNetworkAccess Disabled, claves compartidas deshabilitadas y TLS mínimo 1.2. El contenedor Blob es privado aunque su endpoint requiere autenticación sobre red pública. Los proxies no acceden a los datos. Los respaldos no se incluyen en la entrega. Referencia: https://learn.microsoft.com/en-us/azure/storage/common/storage-private-endpoints');
lines(s,['Base de datos privada con Private Link y DNS privado','Identidades administradas y configuración en Key Vault','Contraseñas con scrypt y cookies seguras','Permisos de edición y eliminación según el propietario'],170,30,110);
s=slide('Continuidad comprobada','Fuente: continuity.json. Intervalo 2026-11-06 22:50:05.738Z a 22:52:06.882Z. app1 detenida de 22:50:37Z a 22:51:02Z. 164 solicitudes autenticadas a ambos accesos, sin fallos de respuesta ni sesión. Esta muestra no prueba un SLA ni caída regional. Tras recuperar el nodo se observaron ambos backends. HAProxy: check inter 3s fall 2 rise 2. https://www.haproxy.com/documentation/haproxy-configuration-tutorials/reliability/health-checks/');
text(s,'164',72,170,400,115,92,true);text(s,'solicitudes autenticadas',72,295,500,55,30);
text(s,'0',735,170,400,115,92,true);text(s,'fallos en la muestra',735,295,460,55,30);
text(s,'Una réplica detenida durante 25 segundos',72,440,1120,70,38,true);
text(s,'La otra réplica conservó el servicio y la sesión',72,540,1120,70,30);
s=slide('Respaldo y recuperación','Respaldo real: 2026-11-06T22-50-46-796Z.tar.gz. Generado en nogal-ops y subido al contenedor privado backups. Descarga y validación dry-run: 3 usuarios, 7 obras, 7 imágenes. No se aplicó restauración sobre producción. Ejecutar restore.cjs con --apply requiere una identidad autorizada en la red privada; invalida sesiones. Consultar RECUPERACION.txt.');
lines(s,['Respaldo diario a las 00:30 de Guatemala','3 usuarios, 7 publicaciones y 7 imágenes','Archivo descargado y validado sin sobrescribir datos','Recuperación de aplicación, datos y proxy documentada'],170,30,110);
s=slide('Demostración en vivo','Guion: abrir URL principal y Azure Portal con las cinco VMs. Entrar con credenciales entregadas por separado. Publicar una imagen propia, mostrar sus etiquetas, cambiar marco y descripción. Usar Azure Run Command para detener app1 mientras se consulta la sesión desde el acceso público. Reiniciar app1 y verificar ambos backends. Ejecutar el respaldo en ops y mostrar únicamente los conteos. Evitar mostrar cookies, contraseñas, claves o tokens. No detener simultáneamente las dos aplicaciones.');
lines(s,['1. Acceso, perfiles e historial','2. Publicación, etiquetas y edición del marco','3. Detención de app1 y continuidad de la sesión','4. Recuperación de app1 y verificación del respaldo'],170,30,110);
s=slide('Alcance y costos de operación','Límite autorizado USD 50 incluyendo crédito. El presupuesto Azure no detiene recursos. Cómputo estimado 0.0498 USD/h entre cinco VMs. Estimación total orientativa 25–35 USD por seis días y uso pequeño; no es factura. Se requiere revisar Cost Management y autorizar retiro tras la exposición. NAT, IPs, discos y endpoint continúan cobrando aunque se detengan VMs. Referencia: https://azure.microsoft.com/en-us/pricing/details/azure-nat-gateway/');
lines(s,['Cambio al proxy alternativo mediante su URL','Aplicaciones y base permanecen en la región primaria','Estimación: USD 25–35 para unos seis días de uso pequeño','Presupuesto autorizado: USD 50; revisión al cerrar el proyecto'],170,30,110);
s=slide('Preparación del equipo','Propuesta de distribución pendiente de confirmar, no evidencia de contribuciones realizadas. Cada integrante debe administrar su componente y poder explicar la solución completa, conforme a la guía del curso de Dennys Tezón, 2026. No crear cuentas de la aplicación para reflejar estos nombres.');
text(s,'Propuesta pendiente de confirmar',72,145,1100,60,30,true);
lines(s,['Aldo Alexander   Redes y HAProxy','Carmen Zulema   Interfaz y perfiles','Astrid Cuxilic   Blob y Azure AI Vision','Elvia Veronica   Tables y recuperación'],240,30,90);
for(const [i,slide]of deck.slides.items.entries()){
 const png=await deck.export({slide,format:'png',scale:1});await fs.writeFile(path.join(build,`slide-${String(i+1).padStart(2,'0')}.png`),new Uint8Array(await png.arrayBuffer()));
}
const candidate=path.join(build,'candidate.pptx');await(await PresentationFile.exportPptx(deck)).save(candidate);
const {finalizePresentation}=await import(pathToFileURL(skill+'/container_tools/artifact_tool_utils.mjs'));
const result=await finalizePresentation({workspaceDir:root,candidatePath:candidate,finalPath:path.join(root,'output/presentacion/Nogal-Presentacion.pptx'),pythonExecutable:runtime+'/python/python.exe',integrityValidatorPath:skill+'/container_tools/inspect_presentation_package_integrity.py',layoutValidatorPath:skill+'/container_tools/inspect_presentation_layout_geometry.py',layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-heading-fit'],fontPolicy:{basis:'design',families:['Arial']},verifyArtifactToolImport:true,receiptPath:path.join(build,'validation-delivery.json')});
console.log(JSON.stringify(result));
