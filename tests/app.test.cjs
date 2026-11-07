const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const { scryptSync } = require('node:crypto');

test('perfiles y catálogo: publicación, venta, edición, permisos y persistencia', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'nogal-test-'));
  const password = 'temporary-test-password';
  const names = ['Astid', 'Zulema', 'Elvia'];
  const users = names.map(name => ({ id: name.toLowerCase(), name, username: name, passwordSalt: 'fixture', passwordHash: scryptSync(password, 'fixture', 64).toString('hex') }));
  for (const file of ['server.js', 'gallery-store.js', 'azure-store.js', 'index.html', 'login.html', 'theme.js']) await fs.copyFile(path.join(__dirname, '..', file), path.join(directory, file));
  await fs.mkdir(path.join(directory, 'data'));
  await fs.writeFile(path.join(directory, 'data', 'users.json'), JSON.stringify({ users }));
  let child;
  const origin = 'http://127.0.0.1:4189';
  async function start() {
    child = spawn(process.execPath, ['server.js'], { cwd: directory, env: { ...process.env, COSMOS_ENDPOINT: '', TABLE_ENDPOINT: '', NODE_ENV: 'test', PORT: '4189' }, stdio: ['ignore', 'pipe', 'pipe'] });
    await new Promise((resolve, reject) => { child.stdout.once('data', resolve); child.once('error', reject); child.once('exit', code => reject(new Error(`Server exited ${code}`))); });
  }
  async function stop() {
    if (child && child.exitCode === null) { const ended = new Promise(resolve => child.once('exit', resolve)); child.kill(); await ended; }
  }
  function post(route, body, cookie, requestOrigin = origin) {
    return fetch(origin + route, { method: 'POST', headers: { Origin: requestOrigin, 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(body) });
  }
  const imageData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
  const input = { title: 'Obra', artist: 'Artista', year: 2026, medium: 'Fotografía', description: 'Descripción de prueba', category: 'Otra', frameSize: '30x40', orientation: 'portrait', imageFit: 'contain', imageData };
  try {
    await start();
    assert.equal((await fetch(origin + '/')).status, 200);
    assert.match(await (await fetch(origin + '/login.html')).text(), /id="username"/);
    assert.equal((await post('/api/login', { username: 'Aldo', password })).status, 401);
    assert.equal((await post('/api/artworks', input)).status, 401);
    for (const name of names) {
      const login = await post('/api/login', { username: name.toLowerCase(), password });
      assert.equal(login.status, 200);
      assert.equal((await login.json()).user.username, name);
      const cookie = login.headers.get('set-cookie').split(';')[0];
      assert.equal((await post('/api/artworks', input, cookie, 'https://untrusted.example')).status, 403);
      assert.equal((await post('/api/artworks', { ...input, imageData: 'data:image/png;base64,YmFk' }, cookie)).status, 400);
      const saved = await post('/api/artworks', { ...input, title: name }, cookie);
      assert.equal(saved.status, 201);
      const { work } = await saved.json();
      assert.equal(work.uploadedBy, name);
      assert.equal((await fetch(origin + work.imageUrl)).headers.get('content-type'), 'image/png');
      assert.equal((await post('/api/logout', {}, cookie)).status, 200);
      const session = await (await fetch(origin + '/api/session', { headers: { Cookie: cookie } })).json();
      assert.equal(session.user, null);
    }
    assert.equal((await (await fetch(origin + '/api/artworks')).json()).works.length, 3);
    await stop(); await start();
    assert.equal((await (await fetch(origin + '/api/artworks')).json()).works.length, 3);
    const login = await post('/api/login', { username: 'Astid', password });
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const profileInput = { name: 'Astid Artista', bio: 'Pinto paisajes y naturaleza.', location: 'Guatemala', specialty: 'Pintura al óleo' };
    const putProfile = (body, auth = cookie, requestOrigin = origin) => fetch(origin + '/api/profile', { method: 'PUT', headers: { Origin: requestOrigin, 'Content-Type': 'application/json', ...(auth ? { Cookie: auth } : {}) }, body: JSON.stringify(body) });
    const profilesBefore = (await (await fetch(origin + '/api/profiles')).json()).profiles;
    assert.equal(profilesBefore.length, 3);
    assert.equal(JSON.stringify(profilesBefore).includes('password'), false);
    assert.equal((await putProfile(profileInput, '')).status, 401);
    assert.equal((await putProfile(profileInput, cookie, 'https://untrusted.example')).status, 403);
    assert.equal((await putProfile({ ...profileInput, name: '' })).status, 400);
    assert.equal((await putProfile({ ...profileInput, bio: 'x'.repeat(501) })).status, 400);
    assert.equal((await putProfile(null)).status, 400);
    const profileResponse = await putProfile({ ...profileInput, id: 'elvia', passwordHash: 'bad', username: 'changed' });
    assert.equal(profileResponse.status, 200);
    const profile = (await profileResponse.json()).user;
    assert.equal(profile.id, 'astid');
    assert.equal(profile.username, 'Astid');
    assert.equal(profile.name, profileInput.name);
    assert.equal(profile.bio, profileInput.bio);
    assert.equal(profile.passwordHash, undefined);
    for (const invalid of [{ contactEmail: 'incorrecto' }, { contactPhone: 'abc' }, { website: 'javascript:alert(1)' }, { website: 'https://user:password@example.com' }, { photoData: 'data:image/png;base64,YmFk' }, { photoData: 'data:image/svg+xml;base64,PHN2Zy8+' }, { photoData: 'data:image/png;base64,' + Buffer.alloc(2 * 1024 * 1024 + 1, 1).toString('base64') }]) {
      assert.equal((await putProfile({ ...profileInput, ...invalid })).status, 400);
    }
    const contact = { contactEmail: 'arte@example.com', contactPhone: '+502 5555 5555', website: 'https://example.com/arte' };
    const withPhotoResponse = await putProfile({ ...profileInput, ...contact, photoData: imageData, id: 'elvia', photoUrl: 'https://untrusted.example/photo' });
    assert.equal(withPhotoResponse.status, 200);
    const withPhoto = (await withPhotoResponse.json()).user;
    assert.match(withPhoto.photoUrl, /^\/media\/[a-f0-9-]{36}\.png$/);
    assert.equal(withPhoto.contactEmail, contact.contactEmail);
    assert.equal(withPhoto.contactPhone, contact.contactPhone);
    assert.equal(withPhoto.website, contact.website);
    assert.equal((await fetch(origin + withPhoto.photoUrl)).headers.get('content-type'), 'image/png');
    const preserved = (await (await putProfile(profileInput)).json()).user;
    assert.equal(preserved.photoUrl, withPhoto.photoUrl);
    assert.equal(preserved.contactEmail, contact.contactEmail);
    const publicProfiles = (await (await fetch(origin + '/api/profiles')).json()).profiles;
    assert.equal(publicProfiles.find(entry => entry.id === 'astid').photoUrl, withPhoto.photoUrl);
    assert.equal(publicProfiles.find(entry => entry.id === 'elvia').photoUrl, '');
    assert.equal(JSON.stringify(publicProfiles).includes('photoData'), false);
    assert.equal((await (await fetch(origin + '/api/session', { headers: { Cookie: cookie } })).json()).user.name, profileInput.name);
    const profilesAfter = (await (await fetch(origin + '/api/profiles')).json()).profiles;
    assert.equal(profilesAfter.find(entry => entry.id === 'elvia').name, 'Elvia');
    assert.equal((await fetch(origin + '/theme.js')).status, 200);
    const all = (await (await fetch(origin + '/api/artworks')).json()).works;
    const own = all.find(work => work.userId === 'astid');
    const other = all.find(work => work.userId === 'elvia');
    const update = { ...input, title: 'Título editado', frameSize: '50x50', description: 'Nueva descripción', imageDescription: 'Montañas verdes bajo un cielo naranja.', price: '875.50', currency: 'GTQ', saleStatus: 'reserved', frameStyle: 'gold', matStyle: 'black' };
    delete update.imageData;
    const mutate = (id, method, body, auth = cookie, requestOrigin = origin) => fetch(origin + '/api/artworks/' + id, {
      method, headers: { Origin: requestOrigin, 'Content-Type': 'application/json', ...(auth ? { Cookie: auth } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    for (const method of ['PUT', 'DELETE']) {
      assert.equal((await mutate(own.id, method, method === 'PUT' ? update : undefined, '')).status, 401);
      assert.equal((await mutate(other.id, method, method === 'PUT' ? update : undefined)).status, 403);
      assert.equal((await mutate(own.id, method, method === 'PUT' ? update : undefined, cookie, 'https://untrusted.example')).status, 403);
      assert.equal((await mutate('00000000-0000-0000-0000-000000000000', method, method === 'PUT' ? update : undefined)).status, 404);
    }
    assert.equal((await mutate(own.id, 'PUT', { ...update, title: '' })).status, 400);
    assert.equal((await mutate(own.id, 'PUT', null)).status, 400);
    const editedResponse = await mutate(own.id, 'PUT', { ...update, userId: 'elvia' });
    assert.equal(editedResponse.status, 200);
    const edited = (await editedResponse.json()).work;
    assert.equal(edited.title, update.title);
    assert.equal(edited.imageDescription, update.imageDescription);
    assert.equal(edited.price, 875.5);
    assert.equal(edited.currency, 'GTQ');
    assert.equal(edited.saleStatus, 'reserved');
    for (const invalid of [{ price: -1 }, { price: 'abc' }, { price: 1.001 }, { price: true }, { currency: 'bad' }, { saleStatus: 'invalid' }, { imageDescription: 'x'.repeat(301) }]) {
      assert.equal((await mutate(own.id, 'PUT', { ...update, ...invalid })).status, 400);
    }
    assert.equal(edited.imageUrl, own.imageUrl);
    assert.equal(edited.createdAt, own.createdAt);
    assert.equal(edited.userId, 'astid');
    assert.equal(edited.orientation, 'square');
    assert.equal(edited.frameSize, '50x50');
    assert.equal(edited.frameStyle, 'gold');
    assert.equal(edited.matStyle, 'black');
    for (const frameStyle of ['maya-greca', 'maya-rombos', 'maya-piedra', 'maya-espiral', 'maya-celosia', 'maya-sol']) {
      const response = await mutate(own.id, 'PUT', { ...update, frameStyle });
      assert.equal(response.status, 200);
      assert.equal((await response.json()).work.frameStyle, frameStyle);
      const catalog = (await (await fetch(origin + '/api/artworks')).json()).works;
      assert.equal(catalog.find(work => work.id === own.id).frameStyle, frameStyle);
    }
    assert.equal((await mutate(own.id, 'PUT', { ...update, frameStyle: 'unknown' })).status, 400);
    assert.equal((await mutate(own.id, 'PUT', { ...update, matStyle: 'unknown' })).status, 400);
    const panoramicResponse = await mutate(own.id, 'PUT', { ...update, frameSize: '20x60', orientation: 'landscape', frameStyle: 'floating' });
    assert.equal(panoramicResponse.status, 200);
    const panoramic = (await panoramicResponse.json()).work;
    assert.equal(panoramic.dimensions, '60 × 20 cm');
    assert.equal(panoramic.ratio, 3);
    assert.equal(panoramic.frameStyle, 'floating');
    assert.equal((await mutate(own.id, 'PUT', { ...update, imageData: 'data:image/png;base64,YmFk' })).status, 400);
    assert.equal((await fetch(origin + own.imageUrl)).status, 200);
    const replacement = await mutate(own.id, 'PUT', { ...update, imageData });
    assert.equal(replacement.status, 200);
    const replaced = (await replacement.json()).work;
    assert.equal(replaced.id, own.id);
    assert.notEqual(replaced.imageUrl, own.imageUrl);
    assert.equal((await fetch(origin + own.imageUrl)).status, 404);
    assert.equal((await fetch(origin + replaced.imageUrl)).status, 200);
    await stop(); await start();
    const persisted = (await (await fetch(origin + '/api/artworks')).json()).works.find(work => work.id === own.id);
    assert.equal(persisted.title, update.title);
    assert.equal(persisted.imageUrl, replaced.imageUrl);
    assert.equal(persisted.price, 875.5);
    assert.equal(persisted.frameStyle, 'gold');
    assert.equal(persisted.matStyle, 'black');
    assert.equal(persisted.imageDescription, update.imageDescription);
    const persistedProfiles = (await (await fetch(origin + '/api/profiles')).json()).profiles;
    assert.equal(persistedProfiles.find(entry => entry.id === 'astid').name, profileInput.name);
    assert.equal(persistedProfiles.find(entry => entry.id === 'astid').specialty, profileInput.specialty);
    assert.equal(persistedProfiles.find(entry => entry.id === 'astid').photoUrl, withPhoto.photoUrl);
    assert.equal(persistedProfiles.find(entry => entry.id === 'astid').contactEmail, contact.contactEmail);
    const newLogin = await post('/api/login', { username: 'Astid', password });
    const newCookie = newLogin.headers.get('set-cookie').split(';')[0];
    const replacementPhoto = (await (await putProfile({ ...profileInput, photoData: imageData }, newCookie)).json()).user;
    assert.notEqual(replacementPhoto.photoUrl, withPhoto.photoUrl);
    assert.equal((await fetch(origin + withPhoto.photoUrl)).status, 404);
    const removedPhoto = (await (await putProfile({ ...profileInput, contactEmail: '', contactPhone: '', website: '', photoData: null }, newCookie)).json()).user;
    assert.equal(removedPhoto.photoUrl, '');
    assert.equal(removedPhoto.contactEmail, '');
    assert.equal((await fetch(origin + replacementPhoto.photoUrl)).status, 404);
    assert.equal((await mutate(own.id, 'DELETE', undefined, newCookie)).status, 200);
    assert.equal((await fetch(origin + replaced.imageUrl)).status, 404);
    assert.equal((await mutate(own.id, 'DELETE', undefined, newCookie)).status, 404);
    await stop(); await start();
    assert.equal((await (await fetch(origin + '/api/artworks')).json()).works.length, 2);
    assert.equal((await fetch(origin + '/data/users.json')).status, 404);
    assert.equal((await fetch(origin + '/azure-store.js')).status, 404);
  } finally { await stop(); await fs.rm(directory, { recursive: true, force: true }); }
});
