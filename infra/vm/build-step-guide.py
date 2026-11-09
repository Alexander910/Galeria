from pathlib import Path
import json
from docx import Document
from docx.shared import Inches,Pt,RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT,WD_CELL_VERTICAL_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

root=Path.cwd();out=root/'output'/'word';out.mkdir(parents=True,exist_ok=True)
evidence=json.loads((root/'data/deploy/reactivation-check.json').read_text())
continuity=json.loads((root/'data/deploy/continuity.json').read_text())
doc=Document();sec=doc.sections[0]
sec.page_width=Inches(8.5);sec.page_height=Inches(11)
sec.top_margin=sec.bottom_margin=Inches(.75);sec.left_margin=sec.right_margin=Inches(.8)
for name in ['Normal','Title','Subtitle','Heading 1','Heading 2','Heading 3','Caption','Header','Footer']:
 st=doc.styles[name];st.font.name='Calibri';st.font.color.rgb=RGBColor(0,0,0)
 st.paragraph_format.space_after=Pt(7)
doc.styles['Normal'].font.size=Pt(11)
doc.styles['Normal'].paragraph_format.line_spacing=1.12
doc.styles['Title'].font.size=Pt(28);doc.styles['Title'].font.bold=True
doc.styles['Heading 1'].font.size=Pt(18);doc.styles['Heading 1'].paragraph_format.space_after=Pt(12)
doc.styles['Heading 2'].font.size=Pt(12);doc.styles['Heading 2'].paragraph_format.space_before=Pt(10)
doc.styles['Caption'].font.size=Pt(9);doc.styles['Caption'].font.italic=True
header=sec.header.paragraphs[0];header.text='NOGAL  DOCUMENTACIÓN TÉCNICA';header.runs[0].font.size=Pt(9)
footer=sec.footer.paragraphs[0];footer.alignment=WD_ALIGN_PARAGRAPH.RIGHT
footer.add_run('Página ').font.size=Pt(9)
field=OxmlElement('w:fldSimple');field.set(qn('w:instr'),'PAGE');footer._p.append(field)
def p(text,bold=False):
 x=doc.add_paragraph();r=x.add_run(text);r.bold=bold;return x
def h(text):doc.add_heading(text,2)
def page(title):doc.add_page_break();doc.add_heading(title,1)
def code(text):
 x=doc.add_paragraph();x.paragraph_format.line_spacing=1;x.paragraph_format.space_after=Pt(8)
 for i,line in enumerate(text.strip().splitlines()):
  if i:x.add_run().add_break()
  r=x.add_run(line);r.font.name='Consolas';r.font.size=Pt(9)
 return x
def step(n,text):p(str(n)+'. '+text)
def caption(text):doc.add_paragraph(text,'Caption')
def picture(name,width=6.85):doc.add_picture(str(root/'data/deploy/reactivation-evidence'/name),width=Inches(width))
def table(rows,widths):
 t=doc.add_table(rows=0, cols=len(widths));t.alignment=WD_TABLE_ALIGNMENT.CENTER;t.autofit=False
 for c,w in zip(t.columns,widths):c.width=Inches(w)
 for i,row in enumerate(rows):
  cells=t.add_row().cells
  for j,(c,text) in enumerate(zip(cells,row)):
   c.width=Inches(widths[j]);c.vertical_alignment=WD_CELL_VERTICAL_ALIGNMENT.CENTER
   c.text=str(text);tcPr=c._tc.get_or_add_tcPr()
   borders=OxmlElement('w:tcBorders')
   for edge in ['top','left','bottom','right']:
    el=OxmlElement('w:'+edge);el.set(qn('w:val'),'single');el.set(qn('w:sz'),'4');el.set(qn('w:color'),'D9D9D9');borders.append(el)
   tcPr.append(borders)
   shade=OxmlElement('w:shd');shade.set(qn('w:fill'),'303030' if i==0 else ('F4F4F4' if i%2==0 else 'FFFFFF'));tcPr.append(shade)
   margins=OxmlElement('w:tcMar')
   for edge in ['top','left','bottom','right']:
    el=OxmlElement('w:'+edge);el.set(qn('w:w'),'85');el.set(qn('w:type'),'dxa');margins.append(el)
   tcPr.append(margins)
   for para in c.paragraphs:
    para.paragraph_format.space_after=Pt(2);para.paragraph_format.line_spacing=1
    for r in para.runs:r.font.size=Pt(10);r.bold=i==0;r.font.color.rgb=RGBColor(255,255,255) if i==0 else RGBColor(0,0,0)
  if i==0:
   repeat=OxmlElement('w:tblHeader');t.rows[0]._tr.get_or_add_trPr().append(repeat)
 return t

doc.add_paragraph('Guía paso a paso de despliegue y operación de Nogal','Title')
doc.add_paragraph('Reactivación de cinco servidores en Azure',style='Subtitle')
p('Universidad del Valle de Guatemala · Campus Altiplano\nCloud Computing\n7 de noviembre de 2026')
p('Aldo Alexander\nCarmen Zulema\nAstrid Cuxilic\nElvia Veronica')
h('Propósito')
p('Esta guía permite recrear la infraestructura, recuperar las obras y comprobar el funcionamiento de Nogal. Documenta la reactivación realizada el 7 de noviembre de 2026 y ofrece procedimientos para repetir las comprobaciones y administrar el sistema.')
p('Los cinco servidores quedaron en ejecución. Se restauraron las cinco obras y los tres usuarios desde el respaldo local, conservando archivos, identificadores, fechas y perfiles. Las contraseñas y llaves no se incluyen en el documento.')
h('Accesos del sistema')
code('Principal\nhttps://nogal-uietolmehuftu-1.northcentralus.cloudapp.azure.com\nAlternativo\nhttps://nogal-uietolmehuftu-2.belgiumcentral.cloudapp.azure.com')
h('Recorrido de la guía')
p('1 Preparación · 2 Respaldo · 3 Recuperación de servicios · 4 Despliegue\n5 Servidores · 6 Restauración · 7 Uso de la galería\n8 Continuidad · 9 Respaldos · 10 Costos y cierre')

page('1 Preparar el equipo y la suscripción')
step(1,'Abrir PowerShell en la carpeta C:\\Users\\usuario\\Documents\\Galeria. Utilizar Node.js, Python 3 y Azure CLI, con una cuenta que pueda administrar el grupo nogal-final y asignar roles de datos.')
code("Set-Location -LiteralPath 'C:\\Users\\usuario\\Documents\\Galeria'\nnode --version\naz --version\npython --version")
p('En este equipo se utiliza infra/az.ps1 como acceso a la instalación local de Azure CLI. Por eso los siguientes ejemplos empiezan con & ./infra/az.ps1. En otro equipo con Azure CLI instalado se puede sustituir ese prefijo por az. El wrapper local no distribuye credenciales y requiere una sesión autenticada.')
step(2,'Comprobar la cuenta y seleccionar la suscripción del proyecto. Si la sesión expiró, iniciar sesión con Azure CLI y completar la autenticación de Microsoft.')
code('& ./infra/az.ps1 account show `\n  --query "{name:name,state:state}" -o json\n& ./infra/az.ps1 account set `\n  --subscription 135ef5e9-e2af-4093-90ea-8112892dff30')
step(3,'Consultar Cost Management antes de crear recursos. El límite autorizado es USD 50 en total, incluyendo el crédito de estudiante. La consulta previa a esta reactivación mostró USD 0.760953640609048, aproximadamente USD 0.76. El importe es provisional y no es el saldo de crédito restante.')
step(4,'Comprobar si el grupo existe. Si se conservaron VMs desasignadas, basta con iniciarlas. En esta reactivación el grupo había sido eliminado y fue necesario reconstruirlo mediante Bicep.')
code('& ./infra/az.ps1 group exists --name nogal-final\n& ./infra/az.ps1 vm list -g nogal-final -d -o table')
p('No ejecutar un inicio de VM si el recurso no existe. Continuar con los pasos siguientes para el caso de reconstrucción completa.')

page('2 Comprobar el respaldo y preparar los archivos')
step(1,'Localizar data/backups/20261107-034140.zip. Este respaldo es el estado final guardado antes del cierre anterior; contiene cinco imágenes y tres usuarios. Mantenerlo privado porque incluye hashes de acceso.')
step(2,'Ejecutar la conversión del respaldo. El programa verifica los nombres de archivo, los tamaños y los hashes SHA-256 registrados en el manifiesto. Después genera un tar.gz compatible con restore.cjs.')
code('python infra/vm/prepare-local-restore.py `\n  data/backups/20261107-034140.zip')
p('Si Python no está en PATH, usar el ejecutable de Python instalado en el equipo. El script de restauración permite indicar su ruta mediante -PythonExecutable.')
h('Resultado esperado y comprobado')
code('{"users":3,"artworks":5,"images":5}')
p('El archivo privado generado es data/deploy/local-restore.tar.gz. El archivo restore-public.json contiene la información necesaria para comparar las obras y sus archivos después de la recuperación; no contiene contraseñas.')
step(3,'Verificar que estén presentes main.bicep, server.bicep, proxy-init.sh, build-package.py, backup.cjs, restore.cjs y restore-local-backup.ps1 dentro de infra/vm. Mantener package-lock.json para reproducir las dependencias de la aplicación.')
step(4,'Conservar el archivo privado de parámetros en data/deploy/nogal-five-servers.parameters.json. Contiene la clave pública SSH y la configuración de usuarios con hashes. No adjuntarlo a la documentación ni subir data/ o .tools/ a un repositorio público.')
p('Las cuentas de acceso siguen siendo Astid, Zulema y Elvia. Los nombres completos de la portada corresponden al equipo y no crean cuentas adicionales.')

page('3 Recuperar el grupo y los servicios protegidos')
step(1,'Crear el grupo de recursos en North Central US. Los recursos de recuperación se aprovisionan después en Belgium Central.')
code('& ./infra/az.ps1 group create --name nogal-final `\n  --location northcentralus `\n  --tags project=nogal-cloud-final budgetLimitUSD=50')
step(2,'Si Key Vault aparece en la lista de recursos eliminados, recuperarlo. El borrado lógico reserva su nombre; volver a crearlo directamente con el mismo nombre puede fallar. No purgarlo para resolver este caso.')
code('& ./infra/az.ps1 keyvault list-deleted `\n  --query "[].name" -o json\n& ./infra/az.ps1 keyvault recover `\n  --name nogal-kv-uietolmehuftu `\n  --resource-group nogal-final --location northcentralus')
step(3,'Recuperar Vision si está eliminado lógicamente. Si los servicios nunca existieron, la plantilla los crea; omitir estos comandos de recuperación en ese caso.')
code('& ./infra/az.ps1 cognitiveservices account recover `\n  --name nogal-vision-uietolmehuftu `\n  --resource-group nogal-final --location canadacentral')
step(4,'Esperar el estado Succeeded en ambas recuperaciones antes de desplegar. La plantilla configura otra vez redes, identidades y roles. La recuperación de un recurso no debe interpretarse como una confirmación de todos sus permisos anteriores.')
p('La reactivación recuperó ambos servicios satisfactoriamente. Se reutilizaron los nombres de los servicios y los FQDN públicos. Las direcciones IP numéricas de las nuevas máquinas pueden cambiar.')

page('4 Empaquetar y desplegar la infraestructura')
step(1,'Preparar el paquete a partir del código local vigente. El generador incluye una lista explícita de fuentes y assets, y excluye los usuarios locales, los respaldos, las llaves y las sesiones.')
code('python infra/vm/build-package.py\nnode --test tests/app.test.cjs')
p('En esta ejecución se incluyeron los nuevos marcos mayas. El instalador se codifica en Base85 para conservar margen frente al límite de tamaño de comandos ARM. El generador cancela la operación si el script supera su margen configurado.')
step(2,'Compilar main.bicep. En este equipo Bicep está disponible en .tools/azure-config/bin/bicep.exe. El comando bicep siguiente representa ese mismo ejecutable cuando está en PATH.')
code('bicep build infra/vm/main.bicep `\n  --outfile data/deploy/nogal-five-servers.json')
step(3,'Desplegar con el archivo privado de parámetros. Esperar la terminación antes de iniciar otro despliegue que utilice los mismos módulos.')
code('& ./infra/az.ps1 deployment group create `\n  -g nogal-final -n nogal-reactivacion-final-20261107 `\n  --template-file data/deploy/nogal-five-servers.json `\n  --parameters "@data/deploy/nogal-five-servers.parameters.json" `\n  --query properties.provisioningState -o tsv')
h('Resultado comprobado')
code('Succeeded')
p('La plantilla crea dos proxies, dos aplicaciones y un nodo de respaldos; además configura Blob, Tables, Vision, Key Vault, red privada e identidades. Una VM encendida todavía puede estar instalando su software: el estado final del despliegue y las pruebas HTTP deben comprobarse por separado.')

page('5 Verificar los cinco servidores')
step(1,'En Azure Portal abrir Máquinas virtuales, filtrar el grupo nogal-final y comprobar cinco filas en ejecución. Por CLI se puede usar el siguiente comando.')
code('& ./infra/az.ps1 vm list -g nogal-final -d `\n  --query "[].{name:name,state:powerState}" -o table')
table([['Servidor','Región','Función'],['nogal-proxy-1','North Central US','Caddy HTTPS y HAProxy'],['nogal-proxy-2','Belgium Central','Acceso alternativo con HAProxy'],['nogal-app-1','North Central US','Primera aplicación Docker'],['nogal-app-2','North Central US','Segunda aplicación Docker'],['nogal-ops','Belgium Central','Respaldo diario privado']],[1.6,1.55,3.7])
p('Todas las VMs usan Standard_B2ats_v2. Las aplicaciones pertenecen al mismo conjunto de disponibilidad, con dos dominios de falla y dos de actualización. No se presenta esta configuración como un despliegue en dos zonas.')
picture('servers.png')
caption('Figura 1. Cinco servidores en ejecución el 7 de noviembre de 2026. Captura propia del portal de Azure.')

page('6 Restaurar las obras y los perfiles')
step(1,'Confirmar que terminó la instalación de las aplicaciones y que existe el contenedor privado backups. Ejecutar el helper de recuperación desde la raíz del proyecto.')
code('& ./infra/vm/restore-local-backup.ps1 `\n  -BackupPath data/backups/20261107-034140.zip -Apply')
step(2,'El helper convierte el respaldo, concede temporalmente al operador permiso de transferencia solo en backups y concede a la identidad de aplicación lectura de ese contenedor. No publica el archivo ni habilita claves compartidas.')
step(3,'El archivo se sube con autenticación de Azure. En nogal-app-1, Azure Run Command descarga el respaldo mediante identidad administrada y lo extrae dentro de un directorio local privado.')
step(4,'restore.cjs valida primero el contenido sin escribir y después repone imágenes y entidades en Blob y Tables. La aplicación ya dispone de los roles de escritura sobre sus datos. Las sesiones anteriores se invalidan para volver a iniciar sesión.')
code('{"mode":"dry-run","users":3,"artworks":5,"images":5}\n{"mode":"apply","users":3,"artworks":5,"images":5}\nNOGAL_RESTORE_OK')
step(5,'El helper retira los permisos temporales al finalizar, incluso cuando una operación genera un error. Verificar la confirmación y data/deploy/reactivation-restore.json antes de dar por terminada la recuperación.')
p('La verificación posterior comparó los cinco archivos mediante SHA-256 y comprobó identificadores, fechas, etiquetas, descripciones y perfiles. Todos coincidieron con el respaldo. No se importaron las obras que habían sido eliminadas antes del último respaldo.')
p('Si se restaura una base que ya contiene datos, el programa actualiza por ID y conserva los registros ajenos al respaldo. Para una recuperación total, resolver esos registros explícitamente y evitar escrituras concurrentes durante el procedimiento.')

page('7 Comprobar la galería desde el navegador')
step(1,'Abrir el acceso principal por HTTPS. El feed debe mostrar cinco obras. Abrir Entrar, encender la lámpara e iniciar sesión con una de las tres cuentas y la contraseña entregada por separado.')
step(2,'Abrir el perfil y comprobar sus publicaciones. Publicar una imagen propia JPG, PNG o WebP, de hasta 19 MB, y escribir título, técnica y descripción. Elegir tamaño, orientación, marco y paspartú.')
step(3,'Comprobar la vista previa y guardar. La versión desplegada incluye dieciocho estilos de marco, entre ellos seis diseños mayas. Abrir el detalle de la obra y expandir Etiquetas de la imagen para ver nombres y confianza.')
step(4,'Editar una publicación propia y cambiar el marco. Al entrar con otra cuenta, esa publicación no debe poder modificarse. Para probar eliminación, utilizar únicamente una publicación temporal identificada para ese fin.')
picture('analysis.png')
caption('Figura 2. Imagen de ejemplo y etiquetas visibles en la aplicación restaurada. Captura propia del 7 de noviembre de 2026.')
p('En el ejemplo, la interfaz muestra mobiliario (98.7 %), tejido (97.9 %) y persona (94.3 %), entre otras etiquetas.')
p('Las pruebas en Azure comprobaron acceso con Astid, Zulema y Elvia; publicación temporal con Vision; cambio de marco maya; HTTP 403 para edición ajena; y eliminación de la publicación temporal. El historial final conserva las cinco obras originales.')

page('8 Probar disponibilidad y controles privados')
step(1,'Consultar /api/health varias veces desde ambos accesos. El JSON devuelve nogal-app-1 o nogal-app-2. Este sondeo comprueba el proceso HTTP; no sustituye una prueba de acceso a todos los servicios de datos.')
code("$base='https://nogal-uietolmehuftu-1.northcentralus.cloudapp.azure.com'\n1..6 | ForEach-Object {\n  Invoke-RestMethod ($base+'/api/health')\n}")
step(2,'Mantener una sesión iniciada y consultar la página mientras se retira una réplica. En Azure Portal abrir nogal-app-1, seleccionar Ejecutar comando y RunShellScript. Pegar el siguiente script; no detener ambas aplicaciones.')
code('set -e\ntrap "systemctl start nogal" EXIT\nsystemctl stop nogal\ndate -u +STOPPED:%FT%TZ\nsleep 25\nsystemctl start nogal\ndate -u +STARTED:%FT%TZ\nsystemctl is-active nogal')
step(3,'Comprobar que la sesión y la navegación siguen funcionando. HAProxy consulta HTTP 200 cada tres segundos y usa fall 2 y rise 2. Después de recuperar el nodo, comprobar de nuevo ambos nombres de backend.')
p(f'Resultado de esta reactivación: {continuity["requests"]} solicitudes autenticadas, {len(continuity["failures"])} fallos, con app1 detenida durante 25 segundos. La muestra se guardó en data/deploy/continuity.json. Es una prueba controlada, no una medición de SLA.')
step(4,'Comprobar la cuenta de datos desde Azure Portal o CLI. Debe indicar acceso público deshabilitado y claves compartidas deshabilitadas. No abrir el endpoint público para resolver un error de acceso.')
code('& ./infra/az.ps1 storage account show `\n  -g nogal-final -n nogaldbuietolmehuftu `\n  --query "{public:publicNetworkAccess,keys:allowSharedKeyAccess}"')

page('9 Crear respaldos y recuperar componentes')
step(1,'Abrir nogal-ops, Ejecutar comando y RunShellScript. Ejecutar el respaldo y comprobar el timer diario.')
code('/usr/local/bin/nogal-backup\nsystemctl is-active nogal-backup.timer\nsystemctl list-timers nogal-backup.timer --no-pager')
p('Resultado de esta reactivación: 2026-11-07T22-25-07-534Z.tar.gz, con tres usuarios, cinco obras y cinco imágenes. El timer quedó activo. Se ejecuta a las 06:30 UTC, equivalentes a las 00:30 de Guatemala. El archivo está en el contenedor privado backups; excluye las sesiones.')
h('Recuperar una aplicación')
p('Consultar primero el log de la VM afectada. Reiniciar solo ese servicio y comprobar ambos accesos HTTPS. Si se perdió la VM, reconstruirla mediante la plantilla, conservando almacenamiento y base existentes.')
code('journalctl -u nogal -n 60 --no-pager\nsystemctl restart nogal\nsystemctl is-active nogal')
h('Recuperar un proxy')
p('Abrir manualmente la URL alternativa y revisar el proxy afectado. Validar la configuración antes de reiniciar. El cambio de URL es manual; no hay un servicio de DNS con conmutación automática.')
code('haproxy -c -f /etc/haproxy/haproxy.cfg\ncaddy validate --config /etc/caddy/Caddyfile\nsystemctl restart haproxy caddy')
h('Recuperar datos')
p('Elegir un respaldo privado, validar su integridad y seguir el paso 6. Ante timeout o HTTP 403, revisar primero DNS privado, emparejamiento de redes e identidad. Las dos aplicaciones y la base están en la región primaria; un proxy en otra región no garantiza recuperación regional de datos.')

page('10 Consultar costos y cerrar el entorno')
step(1,'Abrir Azure for Students y consultar Costo actual o Cost Management. Al comenzar esta reactivación se registraban USD 0.76. Los cargos recientes pueden aparecer con retraso; no calcular el saldo restante como si ese importe fuera definitivo.')
step(2,'Revisar el presupuesto nogal-50-usd y el límite total autorizado. El presupuesto de Azure sirve para seguimiento y no detiene los servicios. Cinco VMs, NAT, IP, discos, almacenamiento y endpoint privado pueden generar consumo.')
step(3,'Si solo se necesita una pausa de cómputo, desasignar las VMs. El comando siguiente es de cierre y no debe ejecutarse mientras se pretende mantener la galería disponible.')
code("$vms='nogal-proxy-1','nogal-proxy-2',`\n     'nogal-app-1','nogal-app-2','nogal-ops'\nforeach($vm in $vms){\n  & ./infra/az.ps1 vm deallocate -g nogal-final -n $vm\n}")
p('Desasignar no elimina cargos de NAT, IP, discos y otros servicios. Para retirar todos los recursos facturables del proyecto, obtener primero un respaldo local actualizado y verificado; después el responsable debe autorizar expresamente la eliminación del grupo.')
code('& ./infra/backup-gallery.ps1 -BaseUrl $base\n# SOLO para un cierre total autorizado y con respaldo verificado\n& ./infra/az.ps1 group delete --name nogal-final --yes')
step(4,'Verificar al terminar el cierre que el grupo ya no exista y que no queden recursos facturables del proyecto. En esta entrega el grupo está activo por solicitud del responsable; no se programó su eliminación ni un cierre automático.')
p('Las dos instancias automáticas de Network Watcher son independientes del grupo del proyecto. Su mera habilitación no tiene costo; comprobar que no queden funciones de pago activas antes de atribuirles consumo.')

page('Evidencias y referencias técnicas')
p('Los resultados descritos corresponden a comprobaciones realizadas el 7 de noviembre de 2026. Los comandos de cierre y las instrucciones para incidentes son procedimientos de operación; no significan que el entorno activo haya sido apagado al entregar esta guía.')
table([['Archivo local','Contenido'],['reactivation-check.json','Accesos, integridad, Vision y edición'],['reactivation-restore.json','Respaldo aplicado y confirmación'],['continuity.json','Muestras de continuidad autenticada'],['reactivation-evidence/servers.json','Inventario final de cinco VMs'],['reactivation-evidence/database.json','Controles de acceso de Tables']],[3.25,3.6])
p('Los archivos anteriores se encuentran dentro de data/deploy. Las capturas están en reactivation-evidence. Mantener los respaldos y los parámetros privados fuera de entregas públicas. La documentación no incluye contraseñas, cookies, tokens ni llaves privadas.')
h('Fuentes consultadas')
for title,url in [
 ('Microsoft Learn. Recuperación de Key Vault y borrado lógico.','https://learn.microsoft.com/en-us/azure/key-vault/general/key-vault-recovery'),
 ('Microsoft Learn. Consulta de consumo de Cost Management.','https://learn.microsoft.com/en-us/rest/api/cost-management/query/usage'),
 ('Microsoft Learn. Estados de máquinas y facturación.','https://learn.microsoft.com/en-us/azure/virtual-machines/states-billing'),
 ('Microsoft Learn. Endpoints privados de Azure Storage.','https://learn.microsoft.com/en-us/azure/storage/common/storage-private-endpoints'),
 ('HAProxy Technologies. Comprobaciones de salud.','https://www.haproxy.com/documentation/haproxy-configuration-tutorials/reliability/health-checks/'),
 ('Microsoft Learn. Habilitar y deshabilitar Network Watcher.','https://learn.microsoft.com/en-us/azure/network-watcher/network-watcher-create')]:
  para=p(title+'\n'+url)
  for r in para.runs:r.font.size=Pt(9.5)
doc.core_properties.title='Guía paso a paso de despliegue y operación de Nogal'
doc.core_properties.author='Aldo Alexander; Carmen Zulema; Astrid Cuxilic; Elvia Veronica'
doc.core_properties.subject='Reactivación y operación de cinco servidores en Azure'
for element in [doc._element,doc.styles.element]:
 for border in list(element.iter(qn('w:pBdr'))):border.getparent().remove(border)
target=out/'Documentacion-paso-a-paso-Nogal.docx';doc.save(target);print(target)
