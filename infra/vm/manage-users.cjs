'use strict';
const {createUser,validateUsers}=require('../../user-accounts');
async function insertUser(client,user){
  const document=validateUsers([user])[0];
  try{await client.createEntity({partitionKey:'user',rowKey:document.id,payload:JSON.stringify(document)});}
  catch(error){if(Number(error.statusCode||error.code)===409)throw new Error('Ese usuario ya existe. No se modificaron su perfil ni su contraseña.');throw new Error('No se pudo crear el usuario en Tables. Revisa conectividad privada e identidad.');}
  return {id:document.id,username:document.username};
}
async function main(){
  const command=process.argv[2];
  if(!['prepare','create'].includes(command))throw new Error('Uso: manage-users.cjs prepare|create. Los datos se leen por stdin.');
  const input=JSON.parse(require('node:fs').readFileSync(0,'utf8').replace(/^\uFEFF/,''));
  if(command==='prepare'){
    const document=createUser(input);
    const payload=JSON.stringify(document);
    const script="#!/bin/bash\nset -euo pipefail\ndocker run --rm -i --env-file /etc/nogal/app.env nogal:project node infra/vm/manage-users.cjs create <<'NOGAL_NEW_USER'\n"+payload+"\nNOGAL_NEW_USER\n";
    process.stdout.write(script);return;
  }
  if(!process.env.TABLE_ENDPOINT)throw new Error('Configura TABLE_ENDPOINT dentro de la VM de aplicación.');
  const {TableClient}=require('@azure/data-tables');
  const {DefaultAzureCredential}=require('@azure/identity');
  const created=await insertUser(new TableClient(process.env.TABLE_ENDPOINT,'users',new DefaultAzureCredential()),input);
  console.log('NOGAL_USER_CREATED '+JSON.stringify(created));
}
if(require.main===module)main().catch(error=>{console.error(error instanceof SyntaxError?'Entrada JSON no válida.':error.message);process.exitCode=1;});
module.exports={insertUser};
