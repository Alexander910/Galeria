'use strict';
// Ejecutar en una red con acceso privado a Tables y con una identidad autorizada.
const fs=require('node:fs/promises');
const path=require('node:path');
const {DefaultAzureCredential}=require('@azure/identity');
const {TableClient}=require('@azure/data-tables');
const {BlobServiceClient}=require('@azure/storage-blob');
const {validateUsers}=require(require('node:fs').existsSync(path.join(__dirname,'user-accounts.js'))?'./user-accounts':'../../user-accounts');
async function main(){
  const directory=path.resolve(process.argv[2]||'/restore');
  const apply=process.argv.includes('--apply');
  const data=JSON.parse(await fs.readFile(path.join(directory,'tables.json'),'utf8'));
  if(!Array.isArray(data.artworks))throw new Error('Respaldo de obras no válido.');
  data.users=validateUsers(data.users);
  if(!data.users.length)throw new Error('El respaldo no contiene usuarios.');
  const files=[];
  for(const work of data.artworks){
    if(work.kind!=='artwork'||!/^[a-f0-9-]{36}$/.test(work.id)||!Array.isArray(work.labels))throw new Error('Metadatos no válidos.');
    const name=work.imageUrl.split('/').pop();
    if(!/^[a-f0-9-]{36}\.(png|jpeg|webp)$/.test(name))throw new Error('Archivo no válido.');
    const file=path.join(directory,'images',name),stat=await fs.stat(file);
    if(stat.size!==work.byteSize)throw new Error('Tamaño de imagen inconsistente.');
    files.push({file,name});
  }
  for(const user of data.users){
    if(!user.photoUrl)continue;
    if(!/^\/media\/[a-f0-9-]{36}\.(png|jpeg|webp)$/.test(user.photoUrl))throw new Error('Foto de perfil no válida.');
    const name=user.photoUrl.split('/').pop();
    if(files.some(f=>f.name===name))continue;
    const file=path.join(directory,'images',name),stat=await fs.stat(file);
    if(!stat.isFile()||stat.size===0||stat.size>2*1024*1024)throw new Error('Tamaño de foto de perfil no válido.');
    files.push({file,name});
  }
  console.log(JSON.stringify({mode:apply?'apply':'dry-run',users:data.users.length,artworks:data.artworks.length,images:files.length}));
  if(!apply)return;
  const credential=new DefaultAzureCredential();
  const images=new BlobServiceClient(process.env.BLOB_ENDPOINT,credential).getContainerClient('images');
  for(const {file,name}of files)await images.getBlockBlobClient(name).uploadFile(file,{blobHTTPHeaders:{blobContentType:'image/'+name.split('.').pop()}});
  for(const name of ['users','artworks']){
    const client=new TableClient(process.env.TABLE_ENDPOINT,name,credential);
    for(const document of data[name])await client.upsertEntity({partitionKey:document.kind,rowKey:document.id,payload:JSON.stringify(document)},'Replace');
  }
  const sessions=new TableClient(process.env.TABLE_ENDPOINT,'sessions',credential);
  for await(const row of sessions.listEntities())await sessions.deleteEntity(row.partitionKey,row.rowKey);
  console.log('Restauración completada; sesiones invalidadas. Los registros ajenos al respaldo no se eliminan.');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
