"""Convierte el respaldo local a formato de recuperación sin cambiar IDs ni fechas."""
from pathlib import Path
import argparse,base64,hashlib,io,json,re,tarfile,zipfile,unicodedata
p=argparse.ArgumentParser();p.add_argument('backup');p.add_argument('--output',default='data/deploy/local-restore.tar.gz');a=p.parse_args()
with zipfile.ZipFile(a.backup) as z:
 works=json.loads(z.read('gallery.json').decode('utf-8-sig'))
 users=json.loads(z.read('users.json').decode('utf-8-sig'))['users']
 manifest=json.loads(z.read('manifest.json').decode('utf-8-sig'))
 hashes={i['name']:i['sha256'].lower() for i in manifest['images']}
 if not isinstance(users,list) or not users:raise ValueError('El respaldo debe contener usuarios')
 ids=set();usernames=set()
 for u in users:
  username=unicodedata.normalize('NFKC',u['username'].strip())
  if not (3<=len(username)<=64 and username[0].isalnum() and all(c.isalnum() or c in '_.-' for c in username)):raise ValueError('Nombre de usuario no válido')
  account_id=username.lower()
  stored_id=u.get('id',account_id)
  legacy_id=isinstance(stored_id,str) and re.fullmatch(r'[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}',stored_id)
  if account_id in usernames or stored_id in ids or (stored_id!=account_id and not legacy_id):raise ValueError('Identificador duplicado o no válido')
  if not re.fullmatch(r'[a-f0-9]{128}',u.get('passwordHash','')) or not re.fullmatch(r'[a-f0-9]{32}',u.get('passwordSalt','')):raise ValueError('Hash de acceso no válido')
  ids.add(stored_id);usernames.add(account_id)
 if any(w.get('userId') not in ids for w in works):raise ValueError('Una obra no tiene propietario válido')
 data={ 'users':[{**u,'id':u.get('id',unicodedata.normalize('NFKC',u['username'].strip()).lower()),'kind':'user'} for u in users], 'artworks':[{**w,'kind':'artwork'} for w in works] }
 target=Path(a.output);target.parent.mkdir(parents=True,exist_ok=True)
 with tarfile.open(target,'w:gz') as tar:
  def add(name,content):
   info=tarfile.TarInfo(name);info.size=len(content);info.mode=0o600;info.uid=info.gid=1000;tar.addfile(info,io.BytesIO(content))
  add('tables.json',json.dumps(data,ensure_ascii=False).encode())
  references={w['imageUrl']:w.get('byteSize') for w in works}
  references.update({u['photoUrl']:None for u in users if u.get('photoUrl') and u['photoUrl'] not in references})
  for url,size in references.items():
   if not url.startswith('/media/'):raise ValueError('Referencia de imagen inválida')
   name=url.split('/')[-1]
   if not re.fullmatch(r'[a-f0-9-]{36}\.(png|jpeg|webp)',name):raise ValueError('Nombre de imagen inválido')
   content=z.read('images/'+name)
   if (size is not None and len(content)!=size) or hashlib.sha256(content).hexdigest()!=hashes[name]:raise ValueError('Integridad incorrecta')
   add('images/'+name,content)
 print(json.dumps({'archive':str(target),'users':len(users),'artworks':len(works),'images':len(references),'sha256':hashlib.sha256(target.read_bytes()).hexdigest()}))
 Path('data/deploy/restore-public.json').write_text(json.dumps({'artworks':works,'profiles':[{k:u.get(k,'') for k in ['id','username','name','bio','location','specialty']} for u in users],'hashes':hashes},ensure_ascii=False),encoding='utf-8')
