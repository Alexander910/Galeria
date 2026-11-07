from pathlib import Path
import base64
code=base64.b64encode(Path('infra/vm/restore.cjs').read_bytes()).decode()
script='''#!/bin/bash
set -euo pipefail
install -d -o 1000 -g 1000 -m 700 /var/lib/nogal-backup/recovery-check
printf %s __CODE__ | base64 -d > /opt/nogal/restore.cjs
chmod 644 /opt/nogal/restore.cjs
docker run --rm --env-file /etc/nogal/app.env -v /var/lib/nogal-backup:/backup nogal:project node -e "const {BlobServiceClient}=require('@azure/storage-blob');const {DefaultAzureCredential}=require('@azure/identity');new BlobServiceClient(process.env.BLOB_ENDPOINT,new DefaultAzureCredential()).getContainerClient('backups').getBlockBlobClient('2026-11-06T22-50-46-796Z.tar.gz').downloadToFile('/backup/recovery-check/archive.tar.gz').then(()=>console.log('Respaldo privado descargado')).catch(e=>{console.error(e.message);process.exitCode=1})"
docker run --rm -v /var/lib/nogal-backup:/backup nogal:project tar -xzf /backup/recovery-check/archive.tar.gz -C /backup/recovery-check
docker run --rm -v /var/lib/nogal-backup/recovery-check:/restore:ro -v /opt/nogal/restore.cjs:/app/restore.cjs:ro nogal:project node restore.cjs /restore
'''.replace('__CODE__',code)
Path('data/deploy/check-restore.sh').write_text(script,encoding='utf-8',newline='\n')
