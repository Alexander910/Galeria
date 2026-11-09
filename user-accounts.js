'use strict';
const {randomBytes,scryptSync}=require('node:crypto');
function accountId(username){
  if(typeof username!=='string')throw new Error('El nombre de usuario no es válido.');
  const value=username.trim().normalize('NFKC');
  if(!/^[\p{L}\p{N}][\p{L}\p{N}_.-]{2,63}$/u.test(value))throw new Error('Usa un usuario de 3 a 64 letras, números, puntos, guiones o guiones bajos.');
  return value.toLowerCase();
}
function validateUsers(users){
  if(!Array.isArray(users))throw new Error('La configuración de usuarios debe ser una lista.');
  const seen=new Set();
  const seenIds=new Set();
  for(const user of users){
    if(!user||typeof user!=='object')throw new Error('Registro de usuario no válido.');
    const id=accountId(user.username);
    const storedId=user.id??id;
    const legacyId=typeof storedId==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(storedId);
    if(storedId!==id&&!legacyId)throw new Error('El identificador debe coincidir con el usuario normalizado o ser un UUID anterior.');
    if(seen.has(id))throw new Error('Hay nombres de usuario duplicados.');
    if(seenIds.has(storedId))throw new Error('Hay identificadores de usuario duplicados.');
    seen.add(id);
    seenIds.add(storedId);
    if(typeof user.name!=='string'||!user.name.trim()||user.name.length>80||/[\u0000-\u001f\u007f]/.test(user.name))throw new Error('El nombre visible no es válido.');
    if(!/^[a-f0-9]{128}$/.test(user.passwordHash)||!/^[a-f0-9]{32}$/.test(user.passwordSalt))throw new Error('El usuario necesita salt y hash scrypt válidos.');
    if(user.kind!==undefined&&user.kind!=='user')throw new Error('Tipo de registro de usuario no válido.');
  }
  // Conservar los UUID anteriores mantiene las referencias de obras y perfiles.
  return users.map(user=>({...user,id:user.id??accountId(user.username),kind:'user'}));
}
function createUser({username,name,password}){
  const id=accountId(username);
  if(typeof password!=='string'||password.length<12||password.length>256)throw new Error('La contraseña nueva debe tener entre 12 y 256 caracteres.');
  const passwordSalt=randomBytes(16).toString('hex');
  return validateUsers([{id,kind:'user',username:username.trim().normalize('NFKC'),name,
    bio:'',location:'',specialty:'',photoUrl:'',contactEmail:'',contactPhone:'',website:'',
    passwordSalt,passwordHash:scryptSync(password,passwordSalt,64).toString('hex'),createdAt:new Date().toISOString()}])[0];
}
async function seedUsers(store,configured){
  const seeds=validateUsers(configured);
  for(const user of seeds){
    let existing;
    try{existing=(await store.item(user.id,'user').read()).resource;}
    catch(error){if(Number(error.statusCode||error.code)!==404)throw error;}
    if(!existing){
      try{await store.items.create(user);}
      catch(error){if(Number(error.statusCode||error.code)!==409)throw error;}
    }
  }
  const {resources}=await store.items.query('SELECT * FROM c').fetchAll();
  const accounts=validateUsers(resources);
  if(!accounts.length)throw new Error('No hay usuarios. Crea una cuenta en Azure o configura los usuarios iniciales.');
  return accounts;
}
module.exports={accountId,validateUsers,createUser,seedUsers};
