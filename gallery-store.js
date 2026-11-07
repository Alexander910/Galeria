const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const directory = path.join(__dirname, 'data', 'gallery');
const azure = require('./azure-store');
const catalog = path.join(directory, 'catalog.json');
let queue = Promise.resolve();

async function list() {
  if (azure.enabled) return azure.list();
  try { return JSON.parse(await fs.readFile(catalog, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
}

async function save(input, user, existingId) {
  const operation = queue.then(async () => {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Revisa los datos de la obra.');
    const works = await list();
    const previous = existingId ? ownedWork(works, existingId, user) : null;
    const saleStatus = input.saleStatus ?? previous?.saleStatus ?? 'available';
    if (!['available', 'reserved', 'sold'].includes(saleStatus)) throw new Error('La disponibilidad no es válida.');
    const currency = input.currency ?? previous?.currency ?? 'GTQ';
    if (!['GTQ', 'USD', 'EUR'].includes(currency)) throw new Error('La moneda no es válida.');
    const rawPrice = input.price === undefined ? previous?.price : input.price;
    const price = rawPrice === undefined || rawPrice === null || rawPrice === '' ? null : Number(rawPrice);
    if (price !== null && ((typeof rawPrice !== 'string' && typeof rawPrice !== 'number') || !Number.isFinite(price) || price <= 0 || price > 100000000 || Math.abs(price * 100 - Math.round(price * 100)) > 0.00001)) throw new Error('Introduce un precio válido con hasta dos decimales.');
    const imageDescription = input.imageDescription ?? previous?.imageDescription ?? '';
    if (typeof imageDescription !== 'string' || imageDescription.trim().length > 300) throw new Error('La descripción visual debe tener como máximo 300 caracteres.');
    const frameStyle = input.frameStyle ?? previous?.frameStyle ?? (previous ? 'none' : 'walnut');
    if (!["maya-espiral","maya-celosia","maya-sol","maya-greca","maya-rombos","maya-piedra","walnut","oak","mahogany","rustic","black","white","gold","silver","bronze","floating","canvas","none"].includes(frameStyle)) throw new Error('El estilo de marco no es válido.');
    const matStyle = input.matStyle ?? previous?.matStyle ?? (previous ? 'none' : 'cream');
    if (!['cream', 'white', 'black', 'none'].includes(matStyle)) throw new Error('El paspartú no es válido.');
    const fields = {};
    for (const [name, limit] of Object.entries({ title: 90, artist: 80, medium: 80, description: 500 })) {
      if (typeof input[name] !== 'string' || !input[name].trim() || input[name].trim().length > limit) throw new Error('Revisa los datos de la obra.');
      fields[name] = input[name].trim();
    }
    const year = Number(input.year);
    if (!Number.isInteger(year) || year < 1000 || year > new Date().getFullYear() + 1) throw new Error('El año no es válido.');
    if (!['Paisaje', 'Botánica', 'Abstracto', 'Otra'].includes(input.category)) throw new Error('La categoría no es válida.');
    if (!["15x20","20x25","20x30","30x40","40x50","40x60","50x70","60x80","60x90","70x100","80x120","100x150","20x20","30x30","40x40","50x50","60x60","80x80","20x60","30x90"].includes(input.frameSize)) throw new Error('El tamaño no es válido.');
    if (!['portrait', 'landscape'].includes(input.orientation) || !['contain', 'cover'].includes(input.imageFit)) throw new Error('El formato no es válido.');
    const replacingImage = !previous || input.imageData !== undefined;
    let bytes, type;
    if (replacingImage) {
      const match = typeof input.imageData === 'string' && input.imageData.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
      if (!match) throw new Error('Usa una imagen JPG, PNG o WebP.');
      bytes = Buffer.from(match[2], 'base64');
      if (!bytes.length || bytes.length > 19 * 1024 * 1024) throw new Error('La imagen debe pesar como máximo 19 MB.');
      type = match[1];
      const valid = type === 'png' ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : type === 'jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
        : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
      if (!valid) throw new Error('El contenido del archivo no coincide con su formato.');
    }
    const id = previous?.id || randomUUID();
    const filename = `${randomUUID()}.${type}`;
    const [short, long] = input.frameSize.split('x').map(Number);
    const width = input.orientation === 'landscape' ? long : short;
    const height = input.orientation === 'landscape' ? short : long;
    const work = { ...previous, ...fields, id, year, category: input.category, imageFit: input.imageFit,
      frameStyle, matStyle, price, currency, saleStatus, imageDescription: imageDescription.trim(),
      frameSize: input.frameSize, orientation: width === height ? 'square' : input.orientation, ratio: width / height,
      dimensions: `${width} × ${height} cm`, imageUrl: replacingImage ? `/media/${filename}` : previous.imageUrl,
      uploadedBy: user.name, userId: user.id, createdAt: previous?.createdAt || new Date().toISOString(), ...(previous ? { updatedAt: new Date().toISOString() } : {}) };
    if (azure.enabled) return azure.saveWork(work, bytes, type, previous);
    await fs.mkdir(directory, { recursive: true });
    if (replacingImage) await fs.writeFile(path.join(directory, filename), bytes, { flag: 'wx' });
    try {
      await fs.writeFile(`${catalog}.tmp`, JSON.stringify(previous ? works.map(entry => entry.id === id ? work : entry) : [work, ...works], null, 2));
      await fs.rename(`${catalog}.tmp`, catalog);
    } catch (error) { if (replacingImage) await fs.unlink(path.join(directory, filename)).catch(() => {}); throw error; }
    if (previous && replacingImage) await fs.unlink(path.join(directory, path.basename(previous.imageUrl))).catch(() => {});
    return work;
  });
  queue = operation.catch(() => {});
  return operation;
}

async function image(filename) {
  if (!/^[a-f0-9-]{36}\.(png|jpeg|webp)$/.test(filename)) return null;
  if (azure.enabled) return azure.image(filename);
  try { return await fs.readFile(path.join(directory, filename)); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

function ownedWork(works, id, user) {
  const work = works.find(entry => entry.id === id);
  if (!work) throw Object.assign(new Error('La imagen ya no está disponible.'), { status: 404 });
  if (work.userId !== user.id) throw Object.assign(new Error('Solo puedes modificar tus propias imágenes.'), { status: 403 });
  return work;
}
async function remove(id, user) {
  const operation = queue.then(async () => {
    const works = await list();
    const work = ownedWork(works, id, user);
    if (azure.enabled) return azure.deleteWork(work);
    await fs.writeFile(`${catalog}.tmp`, JSON.stringify(works.filter(entry => entry.id !== id), null, 2));
    await fs.rename(`${catalog}.tmp`, catalog);
    await fs.unlink(path.join(directory, path.basename(work.imageUrl))).catch(() => {});
  });
  queue = operation.catch(() => {});
  return operation;
}
module.exports = { list, create: (input, user) => save(input, user), update: (id, input, user) => save(input, user, id), remove, image };
