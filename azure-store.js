const { createHash } = require('node:crypto');

const enabled = Boolean(process.env.TABLE_ENDPOINT || process.env.COSMOS_ENDPOINT);
let database;
let images;
let credential;

function tokenId(token) { return createHash('sha256').update(token).digest('hex'); }
function container(name) { return database.container(name); }

function tableDatabase(credential) {
  const { TableClient } = require('@azure/data-tables');
  const tables = new Map();
  async function normalize(operation) {
    try { return await operation(); }
    catch (error) { if (error.statusCode === 404) error.code = 404; throw error; }
  }
  return { container(name) {
    if (!tables.has(name)) tables.set(name, new TableClient(process.env.TABLE_ENDPOINT, name, credential));
    const client = tables.get(name);
    const entity = document => ({ partitionKey: document.kind, rowKey: document.id, payload: JSON.stringify(document) });
    return {
      item(id, kind) { return {
        read: () => normalize(async () => ({ resource: JSON.parse((await client.getEntity(kind, id)).payload) })),
        delete: () => normalize(() => client.deleteEntity(kind, id)),
      }; },
      items: {
        create: document => client.createEntity(entity(document)),
        upsert: document => client.upsertEntity(entity(document), 'Replace'),
        query(sql) { return { async fetchAll() {
          const resources = [];
          for await (const row of client.listEntities()) resources.push(JSON.parse(row.payload));
          if (sql.includes('ORDER BY')) resources.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
          return { resources };
        } }; },
      },
    };
  } };
}

async function initialize() {
  if (!enabled) return null;
  const { DefaultAzureCredential } = require('@azure/identity');
  const { BlobServiceClient } = require('@azure/storage-blob');
  credential = new DefaultAzureCredential();
  if (process.env.TABLE_ENDPOINT) database = tableDatabase(credential);
  else {
    const { CosmosClient } = require('@azure/cosmos');
    database = new CosmosClient({ endpoint: process.env.COSMOS_ENDPOINT, aadCredentials: credential }).database(process.env.COSMOS_DATABASE || 'nogal');
  }
  images = new BlobServiceClient(process.env.BLOB_ENDPOINT, credential).getContainerClient('images');
  let bootstrap = process.env.BOOTSTRAP_USERS_JSON;
  if (!bootstrap && process.env.BOOTSTRAP_SECRET_URI) {
    const token = await credential.getToken('https://vault.azure.net/.default');
    const secretUrl = new URL(process.env.BOOTSTRAP_SECRET_URI);
    secretUrl.searchParams.set('api-version', '7.4');
    const response = await fetch(secretUrl, { headers: { Authorization: `Bearer ${token.token}` }, signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('No se pudo obtener la configuración de usuarios desde Key Vault.');
    bootstrap = (await response.json()).value;
  }
  const configured = JSON.parse(bootstrap || '[]');
  if (configured.length !== 3 || configured.map(user => user.username).sort().join(',') !== 'Astid,Elvia,Zulema') {
    throw new Error('Configura únicamente los tres usuarios autorizados en BOOTSTRAP_USERS_JSON.');
  }
  for (const user of configured) {
    if (!/^[a-f0-9]{128}$/.test(user.passwordHash) || !/^[a-f0-9]{32}$/.test(user.passwordSalt)) throw new Error('Configuración de usuarios inválida.');
    const document = { ...user, id: user.username.toLowerCase(), kind: 'user' };
    let existing;
    try { existing = (await container('users').item(document.id, 'user').read()).resource; }
    catch (error) { if (error.code !== 404) throw error; }
    if (!existing) {
      try { await container('users').items.create(document); }
      catch (error) { if (Number(error.code || error.statusCode) !== 409) throw error; }
    }
  }
  const { resources } = await container('users').items.query('SELECT * FROM c').fetchAll();
  if (resources.length !== 3 || resources.some(user => !configured.some(expected => expected.username === user.username))) throw new Error('La base de datos debe contener solo los tres usuarios autorizados.');
  return resources;
}

async function list() {
  const { resources } = await container('artworks').items.query('SELECT * FROM c ORDER BY c.createdAt DESC').fetchAll();
  return resources.map(({ _rid, _self, _etag, _attachments, _ts, kind, ...work }) => work);
}

async function analyze(bytes) {
  const endpoint = process.env.VISION_ENDPOINT;
  const key = process.env.VISION_KEY;
  if (!endpoint) throw new Error('El análisis de imágenes no está configurado.');
  const authentication = key ? { 'Ocp-Apim-Subscription-Key': key }
    : { Authorization: `Bearer ${(await credential.getToken('https://cognitiveservices.azure.com/.default')).token}` };
  const url = new URL('/computervision/imageanalysis:analyze', endpoint);
  url.search = new URLSearchParams({ 'api-version': '2024-02-01', features: 'tags', language: 'es' });
  const response = await fetch(url, { method: 'POST', headers: { ...authentication, 'Content-Type': 'application/octet-stream' }, body: bytes, signal: AbortSignal.timeout(45000) });
  if (!response.ok) throw new Error('No se pudo analizar la imagen. Comprueba el formato o inténtalo más tarde.');
  const result = await response.json();
  if (!Array.isArray(result.tagsResult?.values)) throw new Error('El análisis no devolvió un resultado válido.');
  return result.tagsResult.values.map(tag => ({ name: tag.name, confidence: Math.round(tag.confidence * 10000) / 100 }));
}

async function saveWork(work, bytes, type, previous) {
  if (previous && !bytes) {
    await container('artworks').items.upsert({ ...work, kind: 'artwork' });
    return work;
  }
  const existing = await list();
  const remaining = existing.filter(entry => entry.id !== previous?.id);
  if (remaining.length >= 500 || remaining.reduce((total, entry) => total + (entry.byteSize || 0), 0) + bytes.length > 500 * 1024 * 1024) {
    throw new Error('La galería alcanzó su límite de almacenamiento. Contacta a la persona responsable.');
  }
  const labels = await analyze(bytes);
  const filename = work.imageUrl.split('/').pop();
  const blob = images.getBlockBlobClient(filename);
  await blob.uploadData(bytes, { blobHTTPHeaders: { blobContentType: `image/${type}` } });
  const document = { ...work, byteSize: bytes.length, labels, processedAt: new Date().toISOString(), analysisProvider: 'Azure AI Vision', kind: 'artwork' };
  try { await container('artworks').items[previous ? 'upsert' : 'create'](document); }
  catch (error) { await blob.deleteIfExists().catch(() => {}); throw error; }
  if (previous) await images.getBlockBlobClient(previous.imageUrl.split('/').pop()).deleteIfExists().catch(() => {});
  return document;
}

async function deleteWork(work) {
  await container('artworks').item(work.id, 'artwork').delete();
  await images.getBlockBlobClient(work.imageUrl.split('/').pop()).deleteIfExists().catch(() => {});
}

async function saveUser(user) {
  await container('users').items.upsert({ ...user, kind: 'user' });
}

async function listUsers() {
  const { resources } = await container('users').items.query('SELECT * FROM c').fetchAll();
  return resources;
}

async function getUser(id) {
  try { return (await container('users').item(id, 'user').read()).resource; }
  catch (error) { if (error.code === 404) return null; throw error; }
}

async function image(filename) {
  try { return await images.getBlockBlobClient(filename).downloadToBuffer(); }
  catch (error) { if (error.statusCode === 404) return null; throw error; }
}

async function getSession(token) {
  if (!token) return null;
  try { const { resource } = await container('sessions').item(tokenId(token), 'session').read(); return resource; }
  catch (error) { if (error.code === 404) return null; throw error; }
}
async function setSession(token, session) {
  await container('sessions').items.upsert({ ...session, id: tokenId(token), kind: 'session', ttl: 8 * 60 * 60 });
}
async function deleteSession(token) {
  if (!token) return;
  try { await container('sessions').item(tokenId(token), 'session').delete(); }
  catch (error) { if (error.code !== 404) throw error; }
}

async function saveImage(filename, bytes, type) {
  await images.getBlockBlobClient(filename).uploadData(bytes, { blobHTTPHeaders: { blobContentType: `image/${type}` } });
}
async function deleteImage(filename) {
  await images.getBlockBlobClient(filename).deleteIfExists();
}
module.exports = { enabled, initialize, list, saveWork, deleteWork, saveUser, listUsers, getUser, image, saveImage, deleteImage, getSession, setSession, deleteSession };
