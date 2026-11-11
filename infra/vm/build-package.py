from pathlib import Path
import tarfile, base64, json, gzip, lzma
root=Path.cwd()
output=root/'data'/'deploy'; output.mkdir(parents=True,exist_ok=True)
files=['server.js','gallery-store.js','azure-store.js','user-accounts.js','index.html','usuarios.html','login.html','api.js','usuarios.js','login.js','theme.js','i18n.js','style.css','gallery.css','Dockerfile','package.json','package-lock.json','infra/vm/backup.cjs','infra/vm/manage-users.cjs']
with tarfile.open(output/'nogal-source.tar.gz','w:gz') as archive:
 for name in files:
  archive.add(root/name,arcname=name)
 for asset in sorted((root/'assets').iterdir()):
  if asset.is_file(): archive.add(asset,arcname=f'assets/{asset.name}')
payload=base64.b85encode(lzma.compress(gzip.decompress((output/'nogal-source.tar.gz').read_bytes()),preset=9)).decode('ascii')
script='''#!/bin/bash
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
cloud-init status --wait || true
apt-get update -qq
apt-get install -y -qq docker.io python3
if [ ! -f /swapfile ]; then
  fallocate -l 1G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  printf '/swapfile none swap sw 0 0\\n' >> /etc/fstab
fi
install -d -m 755 /opt/nogal /etc/nogal
python3 -c "import sys,base64,gzip,lzma;sys.stdout.buffer.write(gzip.compress(lzma.decompress(base64.b85decode(sys.stdin.buffer.read().strip()))))" > /opt/nogal-source.tar.gz <<'NOGAL_SOURCE'
'''+payload+'''
NOGAL_SOURCE
tar -xzf /opt/nogal-source.tar.gz -C /opt/nogal
rm /opt/nogal-source.tar.gz
cat > /etc/nogal/app.env <<'NOGAL_ENV'
NODE_ENV=production
HOST=0.0.0.0
PORT=8080
PUBLIC_ORIGIN=__PRIMARY_ORIGIN__
EXTRA_PUBLIC_ORIGINS=__SECONDARY_ORIGIN__
AZURE_CLIENT_ID=__IDENTITY_CLIENT_ID__
TABLE_ENDPOINT=__TABLE_ENDPOINT__
BLOB_ENDPOINT=__BLOB_ENDPOINT__
VISION_ENDPOINT=__VISION_ENDPOINT__
BOOTSTRAP_SECRET_URI=__BOOTSTRAP_SECRET_URI__
NOGAL_INSTANCE=__INSTANCE_NAME__
NOGAL_ENV
chmod 600 /etc/nogal/app.env
systemctl enable --now docker
docker build --pull -t nogal:project /opt/nogal
if [ '__NODE_ROLE__' = 'app' ]; then
cat > /etc/systemd/system/nogal.service <<'NOGAL_SERVICE'
[Unit]
Description=Nogal shared gallery
Requires=docker.service
After=docker.service network-online.target
[Service]
Restart=always
RestartSec=20
ExecStartPre=-/usr/bin/docker rm -f nogal
ExecStart=/usr/bin/docker run --rm --name nogal --read-only --tmpfs /tmp --cap-drop=ALL --security-opt=no-new-privileges --memory=650m --env-file /etc/nogal/app.env -p 8080:8080 nogal:project
ExecStop=/usr/bin/docker stop nogal
[Install]
WantedBy=multi-user.target
NOGAL_SERVICE
systemctl daemon-reload
systemctl enable --now nogal
else
install -d -o 1000 -g 1000 -m 700 /var/lib/nogal-backup
cat > /usr/local/bin/nogal-backup <<'NOGAL_BACKUP'
#!/bin/bash
set -euo pipefail
docker run --rm --cap-drop=ALL --security-opt=no-new-privileges --env-file /etc/nogal/app.env -v /var/lib/nogal-backup:/backup nogal:project node backup.cjs
NOGAL_BACKUP
chmod 700 /usr/local/bin/nogal-backup
cat > /etc/systemd/system/nogal-backup.service <<'BACKUP_SERVICE'
[Unit]
Description=Private backup of Nogal images and records
After=docker.service network-online.target
[Service]
Type=oneshot
ExecStart=/usr/local/bin/nogal-backup
BACKUP_SERVICE
cat > /etc/systemd/system/nogal-backup.timer <<'BACKUP_TIMER'
[Unit]
Description=Daily Nogal backup
[Timer]
OnCalendar=*-*-* 06:30:00 UTC
Persistent=true
[Install]
WantedBy=timers.target
BACKUP_TIMER
systemctl daemon-reload
systemctl enable --now nogal-backup.timer
fi
'''
(output/'app-init.sh').write_text(script,encoding='utf-8',newline='\n')
print('Paquete de aplicación: %s bytes; script: %s bytes; sin usuarios ni contraseñas.'%((output/'nogal-source.tar.gz').stat().st_size,len(script.encode())))
if len(script.encode())>130000: raise SystemExit('El script excede el margen del comando ARM; reducir el paquete antes de desplegar.')
