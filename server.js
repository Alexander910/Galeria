const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomBytes, scryptSync, timingSafeEqual } = require('node:crypto');

const root = __dirname;
const port = Number(process.env.PORT || 4173);
const usersFile = path.join(root, 'data', 'users.json');
const sessions = new Map();
const attempts = new Map();
const sessionSeconds = 60 * 60 * 8;
let users;

async function initializeUsers() {
  await fs.mkdir(path.dirname(usersFile), { recursive: true });
  try {
    users = JSON.parse(await fs.readFile(usersFile, 'utf8')).users;
    if (!Array.isArray(users)) throw new Error('Formato de usuarios inválido.');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const salt = randomBytes(16).toString('hex');
    users = [{ id: 'user-aldo-test', name: 'Aldo', email: 'aldo@nogal.local', passwordSalt: salt, passwordHash: scryptSync('Nogal2026!', salt, 64).toString('hex'), createdAt: new Date().toISOString() }];
    await fs.writeFile(usersFile, JSON.stringify({ users }, null, 2), { flag: 'wx' });
  }
}

function json(response, status, body, headers = {}) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  response.end(JSON.stringify(body));
}
function publicUser(user) { return { id: user.id, name: user.name, email: user.email }; }
function sessionUser(request) {
  const token = (request.headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith('nogal_session='))?.slice('nogal_session='.length);
  const session = sessions.get(token);
  if (!session || session.expiresAt <= Date.now()) { if (token) sessions.delete(token); return null; }
  return users.find(user => user.id === session.userId) || null;
}
async function readJson(request) {
  let length = 0;
  const chunks = [];
  for await (const chunk of request) {
    length += chunk.length;
    if (length > 4096) throw new Error('Solicitud demasiado grande.');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function handle(request, response) {
  const host = request.headers.host;
  const localHosts = ['127.0.0.1', 'localhost'].flatMap(name => [port, 5500, 5501].map(value => `${name}:${value}`));
  if (!localHosts.includes(host)) return json(response, 403, { error: 'Host no permitido.' });
  const url = new URL(request.url, `http://${host}`);
  if (['/', '/index.html'].includes(url.pathname) && ['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(302, { Location: '/login.html', 'Cache-Control': 'no-store' });
    return response.end();
  }
  if (url.pathname === '/usuarios.html' && url.searchParams.get('demo') !== '1' && !sessionUser(request)) {
    response.writeHead(302, { Location: '/login.html', 'Cache-Control': 'no-store' });
    return response.end();
  }
  const hostname = host.split(':')[0];
  const allowedOrigins = [4173, 5500, 5501, 49976, port].map(value => `http://${hostname}:${value}`);
  const trustedOrigin = request.headers.origin && allowedOrigins.includes(request.headers.origin);
  if (url.pathname.startsWith('/api/') && trustedOrigin) {
    response.setHeader('Access-Control-Allow-Origin', request.headers.origin);
    response.setHeader('Access-Control-Allow-Credentials', 'true');
    response.setHeader('Vary', 'Origin');
  }
  if (url.pathname.startsWith('/api/') && request.method === 'OPTIONS') {
    if (!trustedOrigin) return json(response, 403, { error: 'Origen no permitido.' });
    response.writeHead(204, { 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Cache-Control': 'no-store' });
    return response.end();
  }
  if (url.pathname === '/api/session' && request.method === 'GET') {
    const user = sessionUser(request);
    return json(response, 200, { user: user ? publicUser(user) : null });
  }
  if (url.pathname === '/api/health' && request.method === 'GET') {
    return json(response, 200, { service: 'nogal-api' });
  }
  if (url.pathname === '/api/logout' && request.method === 'POST') {
    if (!trustedOrigin) return json(response, 403, { error: 'Origen no permitido.' });
    const token = (request.headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith('nogal_session='))?.slice('nogal_session='.length);
    if (token) sessions.delete(token);
    return json(response, 200, { ok: true }, { 'Set-Cookie': 'nogal_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' });
  }
  if (url.pathname === '/api/login' && request.method === 'POST') {
    if (!trustedOrigin) return json(response, 403, { error: 'Origen no permitido.' });
    if (!request.headers['content-type']?.startsWith('application/json')) return json(response, 415, { error: 'Formato no admitido.' });
    const address = request.socket.remoteAddress;
    const previous = attempts.get(address);
    const rate = previous && previous.expiresAt > Date.now() ? previous : { count: 0, expiresAt: Date.now() + 60000 };
    attempts.set(address, rate);
    if (++rate.count > 12) return json(response, 429, { error: 'Demasiados intentos. Espera un minuto.' });
    let input;
    try { input = await readJson(request); } catch { return json(response, 400, { error: 'Solicitud inválida.' }); }
    if (!input || typeof input.email !== 'string' || typeof input.password !== 'string' || input.password.length > 256) return json(response, 400, { error: 'Revisa el correo y la contraseña.' });
    const user = users.find(entry => entry.email === input.email.trim().toLowerCase());
    const derived = scryptSync(input.password, user?.passwordSalt || 'unknown-user-salt', 64);
    const expected = user ? Buffer.from(user.passwordHash, 'hex') : Buffer.alloc(64);
    if (!user || expected.length !== derived.length || !timingSafeEqual(derived, expected)) return json(response, 401, { error: 'El correo o la contraseña no son correctos.' });
    const previousToken = (request.headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith('nogal_session='))?.slice('nogal_session='.length);
    if (previousToken) sessions.delete(previousToken);
    const token = randomBytes(32).toString('hex');
    sessions.set(token, { userId: user.id, expiresAt: Date.now() + sessionSeconds * 1000 });
    attempts.delete(address);
    return json(response, 200, { user: publicUser(user) }, { 'Set-Cookie': `nogal_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${sessionSeconds}` });
  }
  if (url.pathname.startsWith('/api/')) return json(response, 404, { error: 'Ruta no disponible.' });
  if (!['GET', 'HEAD'].includes(request.method)) return json(response, 405, { error: 'Método no permitido.' });
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { return json(response, 400, { error: 'Ruta inválida.' }); }
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  const relative = path.relative(root, file).replaceAll('\\', '/');
  if (relative.startsWith('../') || path.isAbsolute(relative) || !(['index.html', 'login.html', 'usuarios.html', 'style.css', 'gallery.css', 'api.js', 'login.js', 'usuarios.js'].includes(relative) || relative.startsWith('assets/'))) return json(response, 404, { error: 'Archivo no disponible.' });
  try {
    const data = await fs.readFile(file);
    const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
    response.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-cache' });
    response.end(request.method === 'HEAD' ? undefined : data);
  } catch { json(response, 404, { error: 'Archivo no disponible.' }); }
}

const ready = initializeUsers();
module.exports = { handle, ready };

if (require.main === module) ready.then(() => {
  const cleanup = setInterval(() => {
    for (const [token, session] of sessions) if (session.expiresAt <= Date.now()) sessions.delete(token);
    for (const [address, rate] of attempts) if (rate.expiresAt <= Date.now()) attempts.delete(address);
  }, 60000);
  cleanup.unref();
  http.createServer((request, response) => handle(request, response).catch(() => json(response, 500, { error: 'No se pudo completar la solicitud.' })))
    .listen(port, '127.0.0.1', () => console.log(`Nogal: http://127.0.0.1:${port}`));
}).catch(error => { console.error('No se pudo iniciar Nogal:', error.message); process.exitCode = 1; });
