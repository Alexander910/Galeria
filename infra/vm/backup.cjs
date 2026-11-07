'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const { promisify } = require('node:util');
const { execFile } = require('node:child_process');
const { DefaultAzureCredential } = require('@azure/identity');
const { TableClient } = require('@azure/data-tables');
const { BlobServiceClient } = require('@azure/storage-blob');
async function main() {
  const credential = new DefaultAzureCredential();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const directory = path.join('/backup', timestamp);
  await fs.mkdir(path.join(directory, 'images'), { recursive: true });
  const data = {};
  for (const name of ['users', 'artworks']) {
    const client = new TableClient(process.env.TABLE_ENDPOINT, name, credential);
    data[name] = [];
    for await (const row of client.listEntities()) data[name].push(JSON.parse(row.payload));
  }
  await fs.writeFile(path.join(directory, 'tables.json'), JSON.stringify(data), { mode: 0o600 });
  const service = new BlobServiceClient(process.env.BLOB_ENDPOINT, credential);
  const images = service.getContainerClient('images');
  let count = 0;
  for await (const blob of images.listBlobsFlat()) {
    if (!/^[a-f0-9-]{36}\.(png|jpeg|webp)$/.test(blob.name)) throw new Error('Nombre de imagen no válido en el respaldo.');
    await images.getBlockBlobClient(blob.name).downloadToFile(path.join(directory, 'images', blob.name));
    count++;
  }
  const archive = `${directory}.tar.gz`;
  await promisify(execFile)('tar', ['-czf', archive, '-C', directory, '.']);
  await service.getContainerClient('backups').getBlockBlobClient(`${timestamp}.tar.gz`).uploadFile(archive);
  console.log(JSON.stringify({ backup: `${timestamp}.tar.gz`, images: count, artworks: data.artworks.length, users: data.users.length }));
  await fs.rm(directory, { recursive: true, force: true });
  await fs.unlink(archive);
}
main().catch(error => { console.error('No se pudo completar el respaldo:', error.message); process.exitCode = 1; });
