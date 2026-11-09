const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomBytes, scryptSync, timingSafeEqual } = require('node:crypto');

const gallery = require('./gallery-store');
const azure = require('./azure-store');
const {validateUsers}=require('./user-accounts');
const production = process.env.NODE_ENV === 'production';
const publicOrigin = process.env.PUBLIC_ORIGIN;
const publicOrigins = [publicOrigin, ...(process.env.EXTRA_PUBLIC_ORIGINS || '').split(',')].filter(Boolean);
if (production && !publicOrigin) throw new Error('Configura PUBLIC_ORIGIN con la URL HTTPS de la aplicación.');
const cookieSecurity = production ? '; Secure' : '';
const root = __dirname;
const port = Number(process.env.PORT || 4173);
const usersFile = path.join(root, 'data', 'users.json');
const sessions = new Map();
const attempts = new Map();
const sessionSeconds = 60 * 60 * 8;
let users;
let profileQueue = Promise.resolve();

async function initializeUsers() {
  if (azure.enabled) { users = await azure.initialize(); return; }
  await fs.mkdir(path.dirname(usersFile), { recursive: true });
  try {
    users = JSON.parse(await fs.readFile(usersFile, 'utf8')).users;
    users=validateUsers(users);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    throw new Error('No hay usuarios configurados. Proporciona data/users.json con las cuentas autorizadas.');
  }
}

function json(response, status, body, headers = {}) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  response.end(JSON.stringify(body));
}
function publicUser(user) {
  return { id: user.id, name: user.name, username: user.username,
    bio: user.bio || '', location: user.location || '', specialty: user.specialty || '',
    photoUrl: user.photoUrl || '', contactEmail: user.contactEmail || '', contactPhone: user.contactPhone || '', website: user.website || '' };
}
function publicComments(comments = []) {
  return comments.map(({ notificationRead, ...comment }) => comment);
}
function publicArtwork(work, user) {
  const { likedBy = [], ...fields } = work;
  return { ...fields, comments: publicComments(work.comments), likeCount: new Set(likedBy).size, liked: Boolean(user && likedBy.includes(user.id)) };
}
async function updateProfile(userId, input) {
  const operation = profileQueue.then(async () => {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Revisa los datos del perfil.');
    const fields = {};
    for (const [name, limit] of Object.entries({ name: 80, bio: 500, location: 80, specialty: 80 })) {
      if (typeof input[name] !== 'string' || input[name].trim().length > limit || (name === 'name' && !input[name].trim())) throw new Error('Revisa los datos del perfil.');
      fields[name] = input[name].trim();
    }
    const current = azure.enabled ? await azure.getUser(userId) : users.find(entry => entry.id === userId);
    for (const [name, limit] of Object.entries({ contactEmail: 160, contactPhone: 40, website: 300 })) {
      const value = input[name] ?? current[name] ?? '';
      if (typeof value !== 'string' || value.trim().length > limit) throw new Error('Revisa los datos de contacto.');
      fields[name] = value.trim();
    }
    if (fields.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.contactEmail)) throw new Error('Introduce un correo electrónico válido.');
    if (fields.contactPhone && (!/^\+?[0-9 ()\-\.]{5,40}$/.test(fields.contactPhone) || fields.contactPhone.replace(/\D/g, '').length < 5)) throw new Error('Introduce un teléfono válido.');
    if (fields.website) {
      let website;
      try { website = new URL(fields.website); } catch { throw new Error('Introduce una dirección web completa, con https://.'); }
      if (!['https:', 'http:'].includes(website.protocol) || website.username || website.password) throw new Error('Usa una dirección web http o https sin credenciales.');
      fields.website = website.href;
    }
    if (input.photoData !== undefined) fields.photoUrl = input.photoData === null ? '' : await gallery.saveProfilePhoto(input.photoData);
    const updated = { ...current, ...fields };
    try {
      if (azure.enabled) await azure.saveUser(updated);
      else {
        const document = JSON.parse(await fs.readFile(usersFile, 'utf8'));
        document.users = document.users.map(entry => entry.id === userId ? updated : entry);
        await fs.writeFile(`${usersFile}.tmp`, JSON.stringify(document, null, 2));
        await fs.rename(`${usersFile}.tmp`, usersFile);
      }
    } catch (error) {
      if (fields.photoUrl) await gallery.deleteProfilePhoto(fields.photoUrl).catch(() => {});
      throw error;
    }
    users = users.map(entry => entry.id === userId ? updated : entry);
    if (input.photoData !== undefined && current.photoUrl) await gallery.deleteProfilePhoto(current.photoUrl).catch(() => {});
    return publicUser(updated);
  });
  profileQueue = operation.catch(() => {});
  return operation;
}
async function sessionUser(request) {
  const token = (request.headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith('nogal_session='))?.slice('nogal_session='.length);
  const session = azure.enabled ? await azure.getSession(token) : sessions.get(token);
  if (!session || session.expiresAt <= Date.now()) { if (token) { if (azure.enabled) await azure.deleteSession(token); else sessions.delete(token); } return null; }
  return azure.enabled ? azure.getUser(session.userId) : users.find(user => user.id === session.userId) || null;
}
async function readJson(request, limit = 4096) {
  let length = 0;
  const chunks = [];
  for await (const chunk of request) {
    length += chunk.length;
    if (length > limit) throw new Error('Solicitud demasiado grande.');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function handle(request, response) {
  const host = request.headers.host;
  const localHosts = ['127.0.0.1', 'localhost'].flatMap(name => [port, 5500, 5501].map(value => `${name}:${value}`));
  if (!localHosts.includes(host) && !publicOrigins.some(origin => host === new URL(origin).host)) return json(response, 403, { error: 'Host no permitido.' });
  const url = new URL(request.url, `http://${host}`);
  if (url.pathname === '/') url.pathname = '/index.html';
  if (url.pathname === '/usuarios.html' && url.searchParams.get('demo') !== '1' && !(await sessionUser(request))) {
    response.writeHead(302, { Location: '/login.html', 'Cache-Control': 'no-store' });
    return response.end();
  }
  const hostname = host.split(':')[0];
  const allowedOrigins = [4173, 5500, 5501, 49976, port].map(value => `http://${hostname}:${value}`);
  allowedOrigins.push(...publicOrigins);
  const trustedOrigin = request.headers.origin && allowedOrigins.includes(request.headers.origin);
  if (url.pathname.startsWith('/api/') && trustedOrigin) {
    response.setHeader('Access-Control-Allow-Origin', request.headers.origin);
    response.setHeader('Access-Control-Allow-Credentials', 'true');
    response.setHeader('Vary', 'Origin');
  }
  if (url.pathname.startsWith('/api/') && request.method === 'OPTIONS') {
    if (!trustedOrigin) return json(response, 403, { error: 'Origen no permitido.' });
    response.writeHead(204, { 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Cache-Control': 'no-store' });
    return response.end();
  }
  if (url.pathname === '/api/artworks' && request.method === 'GET') {
    const user = await sessionUser(request);
    return json(response, 200, { works: (await gallery.list()).map(work => publicArtwork(work, user)) });
  }
  if (url.pathname === '/api/favorites' && request.method === 'GET') {
    const user = await sessionUser(request);
    if (!user) return json(response, 401, { error: 'Inicia sesión para ver tus favoritos.' });
    return json(response, 200, { works: (await gallery.list()).filter(work => (work.likedBy || []).includes(user.id)).map(work => publicArtwork(work, user)) });
  }
  if (url.pathname === '/api/notifications' && request.method === 'GET') {
    const user = await sessionUser(request);
    if (!user) return json(response, 401, { error: 'Inicia sesión para ver tus notificaciones.' });
    const notifications = (await gallery.list()).filter(work => work.userId === user.id).flatMap(work =>
      (work.comments || []).filter(comment => comment.userId !== user.id).map(comment => ({
        id: comment.id, workId: work.id, title: work.title, actorName: comment.authorName,
        text: comment.text.slice(0, 140), createdAt: comment.createdAt, read: Boolean(comment.notificationRead),
      })));
    notifications.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return json(response, 200, { notifications, unreadCount: notifications.filter(note => !note.read).length });
  }
  const notificationRoute = url.pathname.match(/^\/api\/notifications\/([a-f0-9-]{36})\/([a-f0-9-]{36})\/read$/);
  if (notificationRoute && request.method === 'PUT') {
    if (!trustedOrigin) return json(response, 403, { error: 'Origen no permitido.' });
    const user = await sessionUser(request);
    if (!user) return json(response, 401, { error: 'Inicia sesión para ver tus notificaciones.' });
    try {
      await gallery.readNotification(notificationRoute[1], notificationRoute[2], user);
      return json(response, 200, { ok: true });
    } catch (error) {
      return json(response, error.status || 500, { error: error.status ? error.message : 'No se pudo marcar la notificación como leída.' });
    }
  }
  if (url.pathname === '/api/profiles' && request.method === 'GET') {
    return json(response, 200, { profiles: (azure.enabled ? await azure.listUsers() : users).map(publicUser) });
  }
  if (url.pathname === '/api/profile' && request.method === 'PUT') {
    if (!trustedOrigin) return json(response, 403, { error: 'Origen no permitido.' });
    const user = await sessionUser(request);
    if (!user) return json(response, 401, { error: 'Inicia sesión para editar tu perfil.' });
    if (!request.headers['content-type']?.startsWith('application/json')) return json(response, 415, { error: 'Formato no admitido.' });
    let input;
    try { input = await readJson(request, 3 * 1024 * 1024); }
    catch { return json(response, 400, { error: 'Solicitud inválida.' }); }
    try { return json(response, 200, { user: await updateProfile(user.id, input) }); }
    catch (error) { return json(response, error.code ? 500 : 400, { error: error.code ? 'No se pudo guardar el perfil.' : error.message }); }
  }
  if (url.pathname === '/api/artworks' && request.method === 'POST') {
    if (!trustedOrigin) return json(response, 403, { error: 'Origen no permitido.' });
    const user = await sessionUser(request);
    if (!user) return json(response, 401, { error: 'Inicia sesión para publicar una imagen.' });
    if (!request.headers['content-type']?.startsWith('application/json')) return json(response, 415, { error: 'Formato no admitido.' });
    let input;
    try { input = await readJson(request, 35 * 1024 * 1024); }
    catch { return json(response, 400, { error: 'Solicitud inválida o imagen demasiado grande.' }); }
    try { return json(response, 201, { work: publicArtwork(await gallery.create(input || {}, user), user) }); }
    catch (error) { return json(response, 400, { error: error.code ? 'No se pudo guardar la imagen. Inténtalo de nuevo.' : error.message }); }
  }
  const commentRoute = url.pathname.match(/^\/api\/artworks\/([a-f0-9-]{36})\/comments(?:\/([a-f0-9-]{36}))?$/);
  if (commentRoute && ((request.method === 'POST' && !commentRoute[2]) || (request.method === 'DELETE' && commentRoute[2]))) {
    if (!trustedOrigin) return json(response, 403, { error: 'Origen no permitido.' });
    const user = await sessionUser(request);
    if (!user) return json(response, 401, { error: 'Inicia sesión para comentar.' });
    let input;
    if (request.method === 'POST') {
      if (!request.headers['content-type']?.startsWith('application/json')) return json(response, 415, { error: 'Formato no admitido.' });
      try { input = await readJson(request); } catch { return json(response, 400, { error: 'Comentario inválido.' }); }
    }
    try {
      const work = request.method === 'POST' ? await gallery.addComment(commentRoute[1], user, input?.text)
        : await gallery.deleteComment(commentRoute[1], commentRoute[2], user);
      return json(response, request.method === 'POST' ? 201 : 200, { comments: publicComments(work.comments) });
    } catch (error) {
      return json(response, error.status || 500, { error: error.status ? error.message : 'No se pudo guardar el comentario. Inténtalo de nuevo.' });
    }
  }
  const likeRoute = url.pathname.match(/^\/api\/artworks\/([a-f0-9-]{36})\/like$/);
  if (likeRoute && ['PUT', 'DELETE'].includes(request.method)) {
    if (!trustedOrigin) return json(response, 403, { error: 'Origen no permitido.' });
    const user = await sessionUser(request);
    if (!user) return json(response, 401, { error: 'Inicia sesión para dar corazones.' });
    try {
      const work = await gallery.setLike(likeRoute[1], user.id, request.method === 'PUT');
      const { likeCount, liked } = publicArtwork(work, user);
      return json(response, 200, { likeCount, liked });
    } catch (error) {
      return json(response, error.status || 500, { error: error.status ? error.message : 'No se pudo guardar tu corazón. Inténtalo de nuevo.' });
    }
  }
  const artworkRoute = url.pathname.match(/^\/api\/artworks\/([a-f0-9-]{36})$/);
  if (artworkRoute && ['PUT', 'DELETE'].includes(request.method)) {
    if (!trustedOrigin) return json(response, 403, { error: 'Origen no permitido.' });
    const user = await sessionUser(request);
    if (!user) return json(response, 401, { error: 'Inicia sesión para modificar una imagen.' });
    let input;
    if (request.method === 'PUT') {
      if (!request.headers['content-type']?.startsWith('application/json')) return json(response, 415, { error: 'Formato no admitido.' });
      try { input = await readJson(request, 35 * 1024 * 1024); }
      catch { return json(response, 400, { error: 'Solicitud inválida o imagen demasiado grande.' }); }
    }
    try {
      if (request.method === 'DELETE') {
        await gallery.remove(artworkRoute[1], user);
        return json(response, 200, { ok: true });
      }
      return json(response, 200, { work: publicArtwork(await gallery.update(artworkRoute[1], input, user), user) });
    } catch (error) {
      return json(response, error.status || (error.code ? 500 : 400), { error: error.code ? 'No se pudo guardar el cambio. Inténtalo de nuevo.' : error.message });
    }
  }
  if (url.pathname.startsWith('/media/') && ['GET', 'HEAD'].includes(request.method)) {
    const filename = url.pathname.slice('/media/'.length);
    const data = await gallery.image(filename);
    if (!data) return json(response, 404, { error: 'Imagen no disponible.' });
    const types = { '.png': 'image/png', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
    response.writeHead(200, { 'Content-Type': types[path.extname(filename)], 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'public, max-age=86400' });
    return response.end(request.method === 'HEAD' ? undefined : data);
  }
  if (url.pathname === '/api/session' && request.method === 'GET') {
    const user = await sessionUser(request);
    return json(response, 200, { user: user ? publicUser(user) : null });
  }
  if (url.pathname === '/api/health' && request.method === 'GET') {
    return json(response, 200, { service: 'nogal-api', instance: process.env.NOGAL_INSTANCE || 'local' });
  }
  if (url.pathname === '/api/logout' && request.method === 'POST') {
    if (!trustedOrigin) return json(response, 403, { error: 'Origen no permitido.' });
    const token = (request.headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith('nogal_session='))?.slice('nogal_session='.length);
    if (token) { if (azure.enabled) await azure.deleteSession(token); else sessions.delete(token); }
    return json(response, 200, { ok: true }, { 'Set-Cookie': `nogal_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${cookieSecurity}` });
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
    if (!input || typeof input.username !== 'string' || typeof input.password !== 'string' || input.password.length > 256) return json(response, 400, { error: 'Revisa el usuario y la contraseña.' });
    const accounts = azure.enabled ? await azure.listUsers() : users;
    const user = accounts.find(entry => entry.username.normalize('NFKC').toLowerCase() === input.username.trim().normalize('NFKC').toLowerCase());
    const derived = scryptSync(input.password, user?.passwordSalt || 'unknown-user-salt', 64);
    const expected = user ? Buffer.from(user.passwordHash, 'hex') : Buffer.alloc(64);
    if (!user || expected.length !== derived.length || !timingSafeEqual(derived, expected)) return json(response, 401, { error: 'El usuario o la contraseña no son correctos.' });
    const previousToken = (request.headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith('nogal_session='))?.slice('nogal_session='.length);
    if (previousToken) { if (azure.enabled) await azure.deleteSession(previousToken); else sessions.delete(previousToken); }
    const token = randomBytes(32).toString('hex');
    const session = { userId: user.id, expiresAt: Date.now() + sessionSeconds * 1000 };
    if (azure.enabled) await azure.setSession(token, session); else sessions.set(token, session);
    attempts.delete(address);
    return json(response, 200, { user: publicUser(user) }, { 'Set-Cookie': `nogal_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${sessionSeconds}${cookieSecurity}` });
  }
  if (url.pathname.startsWith('/api/')) return json(response, 404, { error: 'Ruta no disponible.' });
  if (!['GET', 'HEAD'].includes(request.method)) return json(response, 405, { error: 'Método no permitido.' });
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { return json(response, 400, { error: 'Ruta inválida.' }); }
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  const relative = path.relative(root, file).replaceAll('\\', '/');
  if (relative.startsWith('../') || path.isAbsolute(relative) || !(['index.html', 'login.html', 'usuarios.html', 'style.css', 'gallery.css', 'api.js', 'login.js', 'usuarios.js', 'theme.js'].includes(relative) || relative.startsWith('assets/'))) return json(response, 404, { error: 'Archivo no disponible.' });
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
    .listen(port, process.env.HOST || '127.0.0.1', () => console.log(`Nogal: http://127.0.0.1:${port}`));
}).catch(error => { console.error('No se pudo iniciar Nogal:', error.message); process.exitCode = 1; });
