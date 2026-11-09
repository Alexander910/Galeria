from pathlib import Path
from datetime import datetime,timezone
import base64,json,hashlib,gzip,lzma
root=Path.cwd();archive=root/'data/deploy/nogal-source.tar.gz'
tag='profile-'+datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')
payload=base64.b85encode(lzma.compress(gzip.decompress(archive.read_bytes()),preset=9)).decode()
script='''set -euo pipefail
release=__TAG__
directory=/opt/nogal/releases/$release
install -d -m 755 "$directory"
python3 -c "import sys,base64,gzip,lzma;sys.stdout.buffer.write(gzip.compress(lzma.decompress(base64.b85decode(sys.stdin.buffer.read().strip()))))" > "$directory/source.tar.gz" <<'NOGAL_ARCHIVE'
__PAYLOAD__
NOGAL_ARCHIVE
tar -xzf "$directory/source.tar.gz" -C "$directory"
docker build -t "nogal:$release" "$directory"
docker tag nogal:project "nogal:rollback-$release"
changed=0
rollback() {
  code=$?
  if [ "$code" -ne 0 ] && [ "$changed" -eq 1 ]; then
    docker tag "nogal:rollback-$release" nogal:project
    systemctl restart nogal
    echo NOGAL_RELEASE_ROLLED_BACK
  fi
  exit "$code"
}
trap rollback EXIT
docker tag "nogal:$release" nogal:project
changed=1
systemctl restart nogal
healthy=0
for attempt in $(seq 1 40); do
  if python3 -c "import urllib.request,json; r=urllib.request.urlopen('http://127.0.0.1:8080/api/health',timeout=3);assert r.status==200;assert json.load(r).get('service')=='nogal-api'" 2>/dev/null; then
    healthy=1
    break
  fi
  sleep 2
done
[ "$healthy" -eq 1 ]
tar -xzf "$directory/source.tar.gz" -C /opt/nogal
printf '%s\n' "$release" > /opt/nogal/release.txt
sha256sum /opt/nogal/server.js /opt/nogal/gallery-store.js /opt/nogal/azure-store.js /opt/nogal/usuarios.js
echo NOGAL_RELEASE_OK
'''.replace('__TAG__',tag).replace('__PAYLOAD__',payload)
command="bash <<'NOGAL_RELEASE'\n"+script+"\nNOGAL_RELEASE"
if len(command)>131000:raise ValueError('El paquete supera el límite del comando protegido')
(root/'data/deploy/rolling-release.settings.json').write_text(json.dumps({'commandToExecute':command}),encoding='utf-8')
(root/'data/deploy/rolling-release-manifest.json').write_text(json.dumps({'tag':tag,'archiveSha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'files':{n:hashlib.sha256((root/n).read_bytes()).hexdigest() for n in ['server.js','gallery-store.js','azure-store.js','usuarios.js','index.html','usuarios.html','gallery.css']}},indent=2))
print(json.dumps({'release':tag,'commandBytes':len(command.encode())}))
