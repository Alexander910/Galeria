const test=require('node:test');
const assert=require('node:assert/strict');
const {scryptSync}=require('node:crypto');
const {createUser,validateUsers,seedUsers}=require('../user-accounts');
const {insertUser}=require('../infra/vm/manage-users.cjs');
const password='contraseña-de-prueba-2026';
function storeFor(initial=[]){
 const rows=new Map(initial.map(u=>[u.id,{...u}]));
 const store={item(id){return{async read(){if(!rows.has(id))throw{statusCode:404};return{resource:rows.get(id)};}};},items:{
  async create(user){if(rows.has(user.id))throw{statusCode:409};rows.set(user.id,user);},
  query(){return{async fetchAll(){return{resources:[...rows.values()]};}};}
 }};
 return{rows,store};
}
test('cuentas adicionales sobreviven al arranque y las cuentas iniciales conservan sus datos',async()=>{
 const seeds=['Astid','Zulema','Elvia'].map(username=>createUser({username,name:username,password}));
 const fourth=createUser({username:'Carlos',name:'Carlos Artista',password});
 const current={...seeds[0],bio:'Perfil existente',photoUrl:'/media/00000000-0000-0000-0000-000000000001.png'};
 const {rows,store}=storeFor([current,...seeds.slice(1),fourth]);
 assert.equal((await seedUsers(store,seeds)).length,4);
 assert.deepEqual(rows.get('astid'),current);
 assert.deepEqual(rows.get('carlos'),fourth);
 const fifth=createUser({username:'María',name:'María',password});
 await insertUser({createEntity:async entity=>store.items.create(JSON.parse(entity.payload))},fifth);
 assert.equal((await seedUsers(store,seeds)).length,5);
 assert.equal((await seedUsers(store,[])).length,5);
});
test('el alta usa hash scrypt y no reemplaza usuarios duplicados',async()=>{
 const user=createUser({username:' Nuevo_Artista ',name:'Nuevo Artista',password});
 assert.equal(user.id,'nuevo_artista');
 assert.equal(user.passwordHash,scryptSync(password,user.passwordSalt,64).toString('hex'));
 assert.equal(user.password,undefined);
 let saved;
 await insertUser({async createEntity(entity){saved=entity;}},user);
 assert.equal(saved.partitionKey,'user');assert.equal(saved.rowKey,user.id);
 assert.equal(JSON.parse(saved.payload).username,'Nuevo_Artista');
 await assert.rejects(insertUser({async createEntity(){throw{statusCode:409};}},user),/ya existe/);
 assert.throws(()=>validateUsers([user,{...user,username:'NUEVO_ARTISTA'}]),/duplicados/);
 assert.throws(()=>createUser({username:'../otra',name:'Otra',password}),/usuario/);
 assert.throws(()=>createUser({username:'nuevo',name:'Nuevo',password:'corta'}),/12/);
});

test('las cuentas anteriores conservan sus UUID y rechazan identificadores inválidos o repetidos',async()=>{
 const first={...createUser({username:'Astid',name:'Astid',password}),id:'652f51da-9b44-4370-bebe-1f34bc0f40d2'};
 const second=createUser({username:'Nuevo',name:'Nuevo',password});
 const validated=validateUsers([first,second]);
 assert.equal(validated[0].id,first.id);
 assert.equal(validated[0].passwordHash,first.passwordHash);
 assert.equal(validated[1].id,'nuevo');
 assert.throws(()=>validateUsers([first,{...second,id:first.id}]),/identificadores.*duplicados/);
 assert.throws(()=>validateUsers([{...second,id:'otra-persona'}]),/identificador/);
 const {rows,store}=storeFor([first,second]);
 assert.equal((await seedUsers(store,[first])).length,2);
 assert.deepEqual(rows.get(first.id),first);
});
