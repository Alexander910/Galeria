from pathlib import Path
import json,re,html
from reportlab.pdfgen import canvas
from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer,PageBreak,Table,TableStyle,Image,Flowable
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER,TA_LEFT
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.pagesizes import letter
import pypdfium2 as pdfium
root=Path.cwd(); out=root/'output'; (out/'pdf').mkdir(parents=True,exist_ok=True)
tmp=root/'tmp'/'pdfs';tmp.mkdir(parents=True,exist_ok=True)
for name,file in [('Times','times.ttf'),('Times-Bold','timesbd.ttf'),('Times-Italic','timesi.ttf'),('Arial','arial.ttf')]:pdfmetrics.registerFont(TTFont(name,'C:/Windows/Fonts/'+file))
body=ParagraphStyle('Body',fontName='Times',fontSize=12,leading=24,firstLineIndent=36,alignment=TA_LEFT,spaceAfter=8)
heading=ParagraphStyle('Heading',fontName='Times-Bold',fontSize=12,leading=20,alignment=TA_CENTER,spaceAfter=16)
small=ParagraphStyle('Small',fontName='Times',fontSize=10,leading=14,spaceAfter=6)
caption=ParagraphStyle('Caption',fontName='Times-Italic',fontSize=12,leading=18,spaceAfter=9)
cell=ParagraphStyle('Cell',fontName='Times',fontSize=10,leading=14)
center=ParagraphStyle('Center',fontName='Times',fontSize=12,leading=24,alignment=TA_CENTER,spaceAfter=12)
story=[]
def p(s,style=body):return Paragraph(s,style)
def section(title,*paras):
 if story:story.append(PageBreak())
 story.append(p(title,heading));story.extend(p(t) for t in paras)
def table(rows,widths):
 t=Table([[p(str(c),cell) for c in row] for row in rows],colWidths=widths,repeatRows=1,hAlign='LEFT')
 t.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'MIDDLE'),('BACKGROUND',(0,0),(-1,0),colors.HexColor('#eeeae2')),('LINEABOVE',(0,0),(-1,0),.7,colors.black),('LINEBELOW',(0,0),(-1,0),.7,colors.black),('LINEBELOW',(0,-1),(-1,-1),.7,colors.black),('TOPPADDING',(0,0),(-1,-1),8),('BOTTOMPADDING',(0,0),(-1,-1),8)]));return t
class Architecture(Flowable):
 def __init__(self):
  super().__init__();self.width=468;self.height=300
 def draw(self):
  c=self.canv;c.saveState();c.scale(1,.78)
  boxes=[(140,320,188,42,'Navegador · HTTPS'),(0,235,214,58,'VM1 · Caddy + HAProxy','North Central US'),(254,235,214,58,'VM2 · Caddy + HAProxy','Belgium Central'),(0,140,214,58,'VM3 · nogal-app-1','10.44.2.10 · Docker'),(254,140,214,58,'VM4 · nogal-app-2','10.44.2.11 · Docker'),(0,35,140,60,'Tables privado','users · sessions','artworks'),(164,35,140,60,'Blob + Vision','images · etiquetas'),(328,35,140,60,'VM5 · nogal-ops','Respaldo privado')]
  c.setStrokeColor(colors.HexColor('#6c5942'));c.setLineWidth(.9)
  for x,y,w,h,*lines in boxes:
   c.setFillColor(colors.HexColor('#f3efe7'));c.rect(x,y,w,h,fill=1,stroke=1);c.setFillColor(colors.black);c.setFont('Times',10)
   for i,line in enumerate(lines):c.drawCentredString(x+w/2,y+h-17-i*13,line)
  for x1,y1,x2,y2 in [(234,320,107,293),(234,320,361,293),(107,235,107,198),(361,235,361,198),(107,235,361,198),(361,235,107,198),(107,140,70,95),(361,140,70,95),(107,140,234,95),(361,140,234,95),(398,95,234,95)]:c.line(x1,y1,x2,y2)
  c.setFont('Times-Italic',10);c.drawString(0,8,'Aplicaciones: mismo conjunto de disponibilidad; acceso alternativo manual.')
  c.restoreState()

story += [Spacer(1,88),p('Sistema web para análisis inteligente de imágenes',ParagraphStyle('Title',parent=center,fontName='Times-Bold',fontSize=14,leading=28)),p('Nogal en Azure',center),Spacer(1,32)]
for line in ['Aldo Alexander','Carmen Zulema','Astrid Cuxilic','Elvia Veronica']:story.append(p(line,center))
story += [Spacer(1,20),p('Universidad del Valle de Guatemala<br/>Campus Altiplano<br/>Licenciatura en Tecnología de Sistemas Informáticos',center),p('Cloud Computing<br/>M. A. Ing. Dennys Tezón',center),p('6 de noviembre de 2026',center)]
section('Introducción',
'Una galería necesita conservar las imágenes y sus descripciones aunque una instancia de la aplicación falle. El proyecto Nogal combina publicación de obras, perfiles y análisis automático de imágenes en una aplicación accesible por HTTPS. El propósito es demostrar persistencia, autenticación y continuidad de la capa de aplicación mediante dos réplicas detrás de HAProxy.',
'El alcance académico comprende cinco servidores en Azure, almacenamiento de objetos, etiquetas con porcentajes de confianza, base de datos administrada privada y procedimientos de respaldo. La guía del curso exige una demostración real en la nube y aportes comprobables de cada integrante (Tezón, 2026). El registro técnico del proyecto señala la autorización docente para utilizar servicios equivalentes de Azure.',
'El despliegue final se verificó el 6 de noviembre de 2026. Las pruebas comprobaron acceso con las tres cuentas autorizadas, siete imágenes recuperadas y continuidad durante la detención de una réplica. Este informe distingue esas comprobaciones de las mejoras propuestas y de los escenarios de recuperación que todavía no se han ejecutado en producción.')
section('Requerimientos y alcance funcional',
'La interfaz permite publicar fotografías JPG, PNG y WebP, consultar un feed de obras y abrir sus detalles. Cada usuario tiene perfil y puede editar o eliminar sus publicaciones. El catálogo conserva descripción, tamaño, marco y paspartú; ofrece doce estilos de marco y veinte tamaños. Las preferencias visuales mantienen la paleta cálida original y ofrecen modo oscuro.',
'El servidor valida autenticación, propiedad de la publicación, origen de las solicitudes y firma del archivo. El máximo por imagen es 19 MB; la galería limita el conjunto a 500 imágenes y 500 MB. Las credenciales no forman parte de las respuestas públicas. Se mantienen las cuentas Astid, Zulema y Elvia; los nombres del equipo del informe no modifican esos identificadores.',
'El análisis utiliza Azure AI Vision; las imágenes se guardan en un contenedor privado de Azure Blob Storage y los registros en Azure Table Storage. El historial conserva identificador, referencia al archivo, propietario, fecha de publicación, fecha de análisis, etiquetas y confianza. La integración de contacto comercial se dejó fuera del alcance por indicación del responsable.')
story.append(p('Tabla 1',heading));story.append(p('Correspondencia de servicios',caption))
story.append(table([['Requisito','Implementación'],['Cinco servidores','Dos proxies, dos aplicaciones y un nodo de respaldo'],['Objetos y análisis','Blob Storage y Azure AI Vision'],['Datos administrados','Table Storage con endpoint privado'],['Distribución y seguridad','HAProxy, Caddy HTTPS, NSG e identidades administradas']],[160,308]))
section('Arquitectura implementada',
'Dos aplicaciones en North Central US comparten un conjunto con dos dominios de falla y dos de actualización. Este mecanismo ofrece menos aislamiento que zonas independientes (Microsoft, s.f.-a). No se demuestra redundancia entre zonas.',
'Los proxies están en North Central US y Belgium Central, con redes emparejadas. Caddy termina HTTPS y HAProxy distribuye a las aplicaciones privadas. El quinto servidor respalda los datos desde Belgium Central. Las regiones elegidas permitieron respetar las cuotas disponibles.')
story.append(p('Figura 1',heading));story.append(p('Arquitectura de cinco servidores y servicios administrados',caption));story.append(Architecture());story.append(p('Nota. Elaboración propia a partir de infra/vm/main.bicep. Las líneas indican dependencias lógicas; el acceso a Tables utiliza Private Link y DNS privado. Key Vault proporciona la configuración inicial de usuarios a las aplicaciones.',small))
section('Infraestructura disponible',
'Azure informó el despliegue nogal-final-v3 como Succeeded. Los cinco servidores se observaron en ejecución y utilizan Standard_B2ats_v2. El grupo nogal-final contiene también redes, identidades, servicios de almacenamiento, Vision, Key Vault y el presupuesto de seguimiento.',
'La captura muestra el estado de los servidores al verificar el entorno. Las evidencias de la aplicación y la continuidad se conservan además en archivos JSON legibles, sin cookies ni contraseñas.')
story.append(p('Figura 2',heading));story.append(p('Cinco máquinas virtuales en ejecución en Azure',caption));story.append(Image(str(root/'data/deploy/evidence/azure-five-servers.png'),width=468,height=263.25,kind='proportional'));story.append(p('Nota. Captura del portal de Azure del 6 de noviembre de 2026. El grupo de recursos es nogal-final. Las VMs de aplicación y respaldo carecen de dirección IP pública.',small))
section('Implementación y persistencia',
'La aplicación usa Node.js y el servidor HTTP del proyecto. Un contenedor Docker se ejecuta bajo systemd en cada réplica. El sistema comparte las tablas users, sessions y artworks. Las sesiones se consultan desde la base y no dependen de la memoria de un nodo, por lo que una solicitud posterior puede atenderla otra réplica.',
'Table Storage almacena entidades NoSQL sin imponer un esquema relacional fijo (Microsoft, s.f.-b). El adaptador usa PartitionKey para el tipo de registro, RowKey para el identificador y payload para el documento JSON. Los perfiles se consultan de forma compartida para evitar datos desactualizados entre nodos.',
'Al recibir una imagen válida, la aplicación solicita etiquetas a Vision, guarda el archivo y persiste sus metadatos. Los valores de confianza se convierten a porcentajes. El reconocimiento ofrece indicios del contenido y no una validación de autoría o exactitud artística; la documentación describe etiquetas de objetos, escenas y acciones detectables (Microsoft, s.f.-c).',
'El aprovisionamiento usa Bicep y un paquete de código con lista explícita de archivos. El paquete excluye cuentas locales, contraseñas, llaves y cachés de autenticación. El parámetro bootstrapUsers es seguro y se almacena en Key Vault. Las aplicaciones utilizan identidades administradas para Blob, Tables, Vision y la lectura de la configuración inicial.')
section('Controles de seguridad',
'La cuenta de tablas tiene acceso público deshabilitado, autenticación con claves compartidas deshabilitada y TLS mínimo 1.2. El endpoint privado se vincula a ambas redes mediante DNS privado. Crear un endpoint privado no basta para cerrar el acceso público; por ello se configuró también publicNetworkAccess=Disabled (Microsoft, s.f.-d).',
'Las reglas de red publican únicamente HTTP y HTTPS en los proxies. Las aplicaciones reciben el puerto 8080 desde las subredes de proxies y el nodo de operaciones. La administración se realiza por Azure Run Command. Las contraseñas de la aplicación se almacenan mediante scrypt con salt; las cookies de producción son Secure, HttpOnly y SameSite.',
'La identidad de aplicación tiene permisos de datos sobre imágenes y tablas, acceso de análisis en Vision y lectura de secretos en Key Vault. La identidad de respaldos lee imágenes y tablas, y escribe únicamente en el contenedor de respaldos. Los proxies no tienen una identidad de acceso a los datos. Los contenedores de imágenes y respaldos no permiten lectura anónima.',
'Estos controles cubren el alcance académico, pero no constituyen una auditoría de seguridad completa. La aplicación no incorpora un sistema de pagos ni una validación de propiedad intelectual. Los respaldos contienen hashes de usuarios y deben permanecer privados. La entrega técnica excluye esos respaldos y todos los parámetros privados.')
section('Procedimiento de pruebas',
'La prueba local node --test tests/app.test.cjs comprobó autenticación, publicaciones, edición, sustitución y eliminación de imágenes, perfiles, permisos y persistencia después de reiniciar. El resultado fue una prueba de integración aprobada, sin fallos. Esta ejecución local complementa las verificaciones reales del entorno de Azure.',
'En Azure se iniciaron sesiones con Astid, Zulema y Elvia. Se consultaron sesiones repetidamente y se observaron app1 y app2 en la cabecera X-Nogal-Backend. Se recuperaron las siete imágenes del respaldo anterior, conservando propietarios y contenido. La recuperación por API generó nuevos identificadores y nuevas fechas de publicación y procesamiento; no se afirma que los identificadores anteriores permanecieran iguales.',
'Una publicación temporal permitió comprobar edición del marco, prohibición de editar desde otra cuenta, eliminación del registro temporal y rechazo de un archivo inválido. No se utilizaron las obras existentes para la prueba de eliminación.',
'La prueba de continuidad mantuvo una sesión iniciada y consultó ambos accesos públicos durante 121 segundos aproximadamente. Se detuvo nogal en app1 a las 22:50:37 UTC y se inició a las 22:51:02 UTC, un intervalo de 25 segundos. HAProxy comprueba HTTP 200 cada tres segundos y requiere dos fallas o dos éxitos para retirar o reincorporar un nodo. Las comprobaciones activas permiten detectar servidores no saludables (HAProxy Technologies, s.f.).')
v=json.loads((root/'data/deploy/cloud-verification.json').read_text());cont=json.loads((root/'data/deploy/continuity.json').read_text())
section('Resultados y evidencia',
f'La muestra de continuidad registró {cont["requests"]} solicitudes y {len(cont["failures"])} fallos de respuesta o de sesión. Ambos nombres de backend aparecen en la muestra; después del reinicio se confirmó nuevamente la atención desde ambas réplicas. El resultado demuestra continuidad en esa prueba controlada y no equivale a una medición de disponibilidad durante períodos prolongados.',
'El historial contiene siete publicaciones. Seis imágenes recibieron etiquetas y una imagen sintética de prueba produjo una lista vacía. La ausencia de detecciones se conserva como resultado del servicio. En la fotografía de ejemplo de Microsoft Learn se obtuvieron catorce etiquetas, entre ellas mobiliario, tejido y persona, con porcentajes visibles en la interfaz.')
story.append(p('Tabla 2',heading));story.append(p('Resultados comprobados el 6 de noviembre de 2026',caption));story.append(table([['Comprobación','Resultado'],['Despliegue final y servidores','Succeeded; cinco VMs en ejecución'],['Inicio de sesión','Astid, Zulema y Elvia: HTTP 200'],['Edición / permiso ajeno / eliminación','200 / 403 / 200'],['Archivo inválido','HTTP 400'],['Continuidad autenticada','164 solicitudes; 0 fallos'],['Respaldo y validación sin escritura','3 usuarios, 7 obras, 7 archivos']],[190,278]));story.append(Spacer(1,12));story.append(p('Nota. Fuentes: cloud-verification.json, continuity.json, Azure Run Command y portal. La muestra no incluyó una caída regional, corrupción completa de tablas ni pérdida simultánea de ambos proxies.',small))
section('Respaldo y recuperación',
'El servidor nogal-ops ejecuta un timer diario a las 06:30 UTC, equivalente a las 00:30 de Guatemala. El respaldo reúne usuarios, publicaciones e imágenes en un archivo tar.gz privado. Excluye sesiones para que se vuelvan a crear al iniciar sesión. El primer respaldo verificado fue 2026-11-06T22-50-46-796Z.tar.gz, con tres usuarios, siete publicaciones y siete archivos.',
'Ese respaldo se descargó en el servidor de operaciones y se validó con restore.cjs en modo dry-run. La validación comprobó estructura, nombres y tamaños de archivos. No se aplicó una restauración sobre los datos de producción; el tiempo de recuperación total no se midió.',
'La guía adjunta describe recuperación de una aplicación, reinicio de HAProxy y Caddy, comprobación de DNS privado y restauración con una identidad autorizada. El programa de restauración repone imágenes y entidades por identificador y elimina sesiones cuando se aplica; conserva registros que no estén en el respaldo. El administrador debe resolver esos registros si busca una recuperación total.',
'La periodicidad diaria permite proponer un objetivo de pérdida de hasta 24 horas, siempre que la ejecución y conservación de respaldos funcionen. El cambio al proxy alternativo requiere abrir su URL manualmente. Ambas aplicaciones y la base están en la región primaria, por lo que esta arquitectura no garantiza continuidad frente a una caída regional completa.')
section('Costos y dificultades resueltas',
'El límite autorizado es USD 50, incluyendo crédito de estudiante. Se creó el presupuesto nogal-50-usd para seguimiento. El presupuesto no detiene servicios ni constituye un límite técnico de gasto. Con las tarifas consultadas para B2ats_v2, el cómputo de las cinco VMs suma aproximadamente USD 0.0498 por hora; la red, los discos y los servicios administrados se cobran por separado.',
'Para unos seis días de uso pequeño se utiliza una estimación operativa de USD 25 a 35, pendiente de contrastar con Cost Management y la factura. NAT comienza a cobrar desde su creación y el tráfico procesado se factura por uso (Microsoft, s.f.-e). Detener las VMs no elimina los cargos de red, IP, discos o almacenamiento. Después de la exposición debe revisarse y autorizarse el retiro de recursos, conservando primero un respaldo privado.',
'La cuenta de estudiante restringió regiones, tamaños y núcleos. Se eligieron dos regiones permitidas para disponer de cinco VMs sin exceder las cuotas de cada región. El nivel gratuito de Vision no pudo crearse por una restricción de cuentas gratuitas, por lo que se utilizó S1 con consumo por análisis.',
'La instalación inicial encontró el límite de tamaño de una expresión ARM y la ausencia de Caddy en los repositorios configurados. Se corrigió el envío del script y se incorporó el repositorio oficial de Caddy. También se normalizaron saltos de línea de scripts. El despliegue final y las verificaciones posteriores corresponden a la versión corregida, no a esos intentos fallidos.')
section('Conclusiones y recomendaciones',
'Nogal quedó desplegado en Azure con cinco servidores, dos aplicaciones detrás de HAProxy y persistencia compartida. La prueba de retiro de una réplica cumplió el objetivo de mantener las solicitudes autenticadas durante el intervalo observado. El historial y el análisis mostraron resultados reales de siete imágenes, incluyendo una sin detecciones.',
'La separación entre aplicación, objetos y datos permite recuperar un nodo sin reconstruir el historial. La base privada, las identidades administradas y la exclusión de credenciales de la entrega reducen exposición. El respaldo descargado y validado aporta evidencia de recuperabilidad del archivo, aunque queda pendiente un ensayo completo de restauración en un entorno aislado.',
'Se recomienda practicar la exposición con todos los integrantes, comprobar respaldos antes del evento y revisar costos al finalizar. Para una siguiente etapa conviene distribuir las aplicaciones entre zonas, implementar recuperación regional de datos y un mecanismo de cambio automático de acceso, además de ampliar la observabilidad y medir recuperación completa.',
'La distribución de responsabilidades aún requiere confirmación del equipo. Como propuesta de preparación, Aldo Alexander puede demostrar redes y HAProxy; Carmen Zulema, interfaz y perfiles; Astrid Cuxilic, Blob y Vision; y Elvia Veronica, Tables y respaldos. Esta propuesta no certifica contribuciones ya realizadas. Todos deben poder explicar la solución completa y demostrar su administración conforme a las condiciones del curso.')
section('Referencias')
refs=[
('HAProxy Technologies. (s.f.). <i>Health checks</i>.','https://www.haproxy.com/documentation/haproxy-configuration-tutorials/reliability/health-checks/'),
('Microsoft. (s.f.-a). <i>Availability sets overview</i>. Microsoft Learn.','https://learn.microsoft.com/en-us/azure/virtual-machines/availability-set-overview'),
('Microsoft. (s.f.-b). <i>Introduction to Azure Table storage</i>. Microsoft Learn.','https://learn.microsoft.com/en-us/azure/storage/tables/table-storage-overview'),
('Microsoft. (s.f.-c). <i>Image tagging</i>. Microsoft Learn.','https://learn.microsoft.com/en-us/azure/ai-services/computer-vision/concept-tagging-images'),
('Microsoft. (s.f.-d). <i>Use private endpoints for Azure Storage</i>. Microsoft Learn.','https://learn.microsoft.com/en-us/azure/storage/common/storage-private-endpoints'),
('Microsoft. (s.f.-e). <i>Azure NAT Gateway pricing</i>. Recuperado el 6 de noviembre de 2026, de','https://azure.microsoft.com/en-us/pricing/details/azure-nat-gateway/'),
('Tezón, D. (2026). <i>Proyecto final Sistema web para análisis inteligente de imágenes</i> [Guía del curso Cloud Computing]. Universidad del Valle de Guatemala, Campus Altiplano.','')]
refstyle=ParagraphStyle('Reference',parent=body,firstLineIndent=-36,leftIndent=36,spaceAfter=12,wordWrap='CJK')
for text,url in refs:story.append(p(text+(' <link href="'+url+'" color="black">'+url+'</link>' if url else ''),refstyle))
def footer(c,doc):c.setFont('Times',12);c.drawRightString(540,756,str(doc.page))
report=out/'pdf/Informe-academico-Nogal.pdf'
SimpleDocTemplate(str(report),pagesize=letter,leftMargin=72,rightMargin=72,topMargin=72,bottomMargin=72,title='Sistema web para análisis inteligente de imágenes',author='Aldo Alexander; Carmen Zulema; Astrid Cuxilic; Elvia Veronica').build(story,onFirstPage=footer,onLaterPages=footer)
# Guía operativa separada, con comandos legibles y texto seleccionable.
guide=[];gs=ParagraphStyle('Guide',fontName='Arial',fontSize=10.5,leading=16,spaceAfter=8)
for block in (root/'infra/vm/RECUPERACION.txt').read_text(encoding='utf-8').split('\n\n'):
 lines=block.splitlines();first=lines[0]
 if first.isupper() and len(first)<85:
  guide.append(p(html.escape(first),ParagraphStyle('GuideHead',parent=gs,fontName='Times-Bold',fontSize=13,leading=20,spaceBefore=15,keepWithNext=True)))
  lines=lines[1:]
 if lines:guide.append(p('<br/>'.join(html.escape(l) for l in lines),gs))
guidefile=out/'pdf/Guia-recuperacion-Nogal.pdf'
SimpleDocTemplate(str(guidefile),pagesize=letter,leftMargin=54,rightMargin=54,topMargin=54,bottomMargin=54,title='Guía de recuperación Nogal').build(guide,onFirstPage=footer,onLaterPages=footer)
for file in [report,guidefile]:
 document=pdfium.PdfDocument(str(file));dest=tmp/file.stem;dest.mkdir(exist_ok=True)
 for i,page in enumerate(document):page.render(scale=1.25).to_pil().save(dest/f'page-{i+1:02}.png')
 print(file,len(document),'páginas')
