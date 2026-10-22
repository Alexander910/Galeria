const apiBase = '';
// Colección de demostración: vive únicamente en la memoria de esta página.
const works = [
  { id: 'tarde', title: 'Luz de tarde', artist: 'Elena Ríos', year: 2024, medium: 'Gouache sobre lienzo', dimensions: '60 × 45 cm', category: 'Paisaje', orientation: 'landscape', imageUrl: 'assets/tarde.svg', description: 'El horizonte guarda la última luz del día. Colinas de terracota y verdes suaves, como una pausa antes de volver a casa.' },
  { id: 'botanica', title: 'Hojas en calma', artist: 'Inés Valera', year: 2023, medium: 'Óleo y pigmento mineral', dimensions: '30 × 40 cm', category: 'Botánica', orientation: 'portrait', imageUrl: 'assets/botanica.svg', description: 'Un pequeño jardín que crece sin prisa. La luz y las hojas se encuentran en ese rincón donde todo parece estar en su sitio.' },
  { id: 'cordillera', title: 'Cordillera verde', artist: 'Tomás Alarcón', year: 2022, medium: 'Acrílico sobre lino', dimensions: '60 × 45 cm', category: 'Paisaje', orientation: 'landscape', imageUrl: 'assets/cordillera.svg', description: 'Montañas en capas de verde y piedra. Un paisaje imaginado que se parece a la memoria de un lugar querido.' },
  { id: 'arco', title: 'El arco quieto', artist: 'Lía Moreno', year: 2025, medium: 'Témpera sobre papel', dimensions: '35 × 50 cm', category: 'Abstracto', orientation: 'portrait', imageUrl: 'assets/arco.svg', description: 'Un umbral de terracota abierto hacia una luz tibia. Al otro lado, un paisaje que invita a quedarse un momento más.' },
  { id: 'ondas', title: 'Donde el agua descansa', artist: 'Inés Valera', year: 2024, medium: 'Serigrafía sobre algodón', dimensions: '50 × 38 cm', category: 'Abstracto', orientation: 'landscape', imageUrl: 'assets/ondas.svg', description: 'Un ritmo lento de curvas y verdes. El movimiento del agua reducido a lo esencial, como una respiración sobre el papel.' },
  { id: 'sol', title: 'Un sol para quedarse', artist: 'Elena Ríos', year: 2025, medium: 'Gouache sobre papel', dimensions: '30 × 30 cm', category: 'Paisaje', orientation: 'square', imageUrl: 'assets/sol.svg', description: 'Un sol de miel y un horizonte tranquilo. Una pequeña celebración de la luz que acompaña los días sencillos.' },
];
const galleryScene = document.getElementById('galleryScene');
const wall = document.getElementById('galleryWall');

const searchInput = document.getElementById('gallerySearch');
const artDialog = document.getElementById('artDialog');
const addDialog = document.getElementById('addDialog');

let returnFocus = null;

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function woodFrame(work, interactive = true) {
  const frame = node(interactive ? 'button' : 'div', `art-frame frame orientation-${work.orientation}`);
  if (interactive) {
    frame.type = 'button';
    frame.setAttribute('aria-label', `Ampliar ${work.title}`);
    frame.addEventListener('click', () => openArtwork(work, frame));
  }
  for (const side of ['top', 'right', 'bottom', 'left']) {
    const rail = node('i', `rail ${side}`);
    rail.setAttribute('aria-hidden', 'true');
    frame.appendChild(rail);
  }
  const mat = node('span', 'art-mat');
  const image = node('img');
  image.style.aspectRatio = String(work.ratio || (work.orientation === 'portrait' ? 3 / 4 : work.orientation === 'square' ? 1 : 4 / 3));
  image.style.objectFit = work.imageFit || 'cover';
  if (!work.imageUrl) {
    const placeholder = node('span', 'preview-placeholder', 'Tu imagen, aquí');
    placeholder.style.aspectRatio = image.style.aspectRatio;
    mat.appendChild(placeholder);
    frame.appendChild(mat);
    return frame;
  }
  image.src = work.imageUrl;
  image.alt = work.title;
  image.loading = interactive ? 'lazy' : 'eager';
  image.referrerPolicy = 'no-referrer';
  image.addEventListener('error', () => {
    image.hidden = true;
    mat.appendChild(node('span', 'image-unavailable', 'Imagen no disponible'));
  }, { once: true });
  mat.appendChild(image);
  frame.appendChild(mat);
  return frame;
}

const normalize = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
function renderGallery() {
  const needle = normalize(searchInput.value.trim());
  const visible = works.filter(work => normalize(`${work.title} ${work.artist} ${work.medium} ${work.category}`).includes(needle));
  wall.replaceChildren();
  visible.forEach((work, index) => {
    const card = node('article', `artwork-card artwork-card--${index + 1}`);
    card.style.setProperty('--order', Math.min(index, 8));
    card.appendChild(woodFrame(work));
    const caption = node('div', 'artwork-caption');
    const text = node('div');
    text.append(node('h2', '', work.title), node('p', '', `${work.artist} · ${work.year}`));
    const open = node('button', 'artwork-open', '↗');
    open.type = 'button';
    open.setAttribute('aria-label', `Ver detalles de ${work.title}`);
    open.addEventListener('click', () => openArtwork(work, open));
    caption.append(text, open);
    card.appendChild(caption);
    wall.appendChild(card);
  });
  document.getElementById('resultsCount').textContent = `${visible.length} ${visible.length === 1 ? 'obra' : 'obras'}`;
  document.getElementById('emptyCollection').hidden = visible.length !== 0;

}


function openModal(dialog, opener) {
  returnFocus = opener;
  dialog.showModal();
  document.body.style.overflow = 'hidden';
}

function openArtwork(work, opener) {
  const content = document.getElementById('artDialogContent');
  const details = node('div', 'art-details');
  const title = node('h2', '', work.title);
  title.id = 'artDialogTitle';
  details.append(node('p', 'eyebrow', `${work.category.toUpperCase()} · ${work.year}`), title, node('p', 'art-artist', work.artist), node('p', 'art-description', work.description));
  const facts = node('dl', 'art-facts');
  for (const [label, value] of [['Técnica', work.medium], ['Formato', work.dimensions]]) {
    const item = node('div');
    item.append(node('dt', '', label), node('dd', '', value));
    facts.appendChild(item);
  }
  details.append(facts, node('p', 'art-endnote', 'EN TU PARED, A TU MANERA'));
  content.replaceChildren(woodFrame(work, false), details);
  openModal(artDialog, opener);
}

for (const dialog of [artDialog, addDialog]) {
  dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => {
    document.body.style.overflow = '';
    if (returnFocus?.isConnected) returnFocus.focus();
  });
}

function showGallery(user) {

  galleryScene.hidden = false;
  document.getElementById('galleryTitle').textContent = user?.name || 'Nogal';
  document.title = user ? `${user.name} — Galería Nogal` : 'Nogal — Mi colección';
  renderGallery();
  window.scrollTo(0, 0);
  document.getElementById('galleryTitle').focus({ preventScroll: true });
}

searchInput.addEventListener('input', renderGallery);
document.getElementById('resetSearch').addEventListener('click', () => {
  searchInput.value = ''; renderGallery(); searchInput.focus();
});
document.getElementById('backToTop').addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  document.getElementById('galleryTitle').focus({ preventScroll: true });
});
const artworkForm = document.getElementById('artworkForm');
const artworkError = document.getElementById('artworkError');
const artworkFile = document.getElementById('artworkFile');
const saveArtwork = document.getElementById('saveArtwork');
let draftImage = null;
let fileGeneration = 0;

function frameSettings() {
  const [short, long] = artworkForm.elements.frameSize.value.split('x').map(Number);
  const horizontal = artworkForm.elements.orientation.value === 'landscape';
  const width = horizontal ? long : short;
  const height = horizontal ? short : long;
  artworkForm.elements.orientation.disabled = short === long;
  return { ratio: width / height, dimensions: `${width} × ${height} cm`, orientation: width === height ? 'square' : horizontal ? 'landscape' : 'portrait', imageFit: artworkForm.elements.imageFit.value };
}
function updateFramePreview() {
  const settings = frameSettings();
  const preview = woodFrame({ ...settings, title: artworkForm.elements.title.value.trim() || 'Vista previa de tu imagen', imageUrl: draftImage?.url }, false);
  const [width, height] = settings.dimensions.match(/\d+/g).map(Number);
  preview.style.width = `${Math.min(280, width * 4, 300 * width / height)}px`;
  document.getElementById('framePreview').replaceChildren(preview);
  document.getElementById('previewMeasurement').textContent = `${settings.dimensions} · ${settings.orientation === 'square' ? 'Cuadrado' : settings.orientation === 'landscape' ? 'Horizontal' : 'Vertical'}`;
}
function discardDraft() {
  fileGeneration++;
  if (draftImage) URL.revokeObjectURL(draftImage.url);
  draftImage = null;
  saveArtwork.disabled = true;
}
addDialog.addEventListener('close', discardDraft);
for (const name of ['frameSize', 'orientation', 'imageFit', 'title']) artworkForm.elements[name].addEventListener('input', updateFramePreview);
artworkFile.addEventListener('change', async () => {
  discardDraft();
  const generation = fileGeneration;
  artworkError.hidden = true;
  const file = artworkFile.files[0];
  const fileStatus = document.getElementById('previewFile');
  fileStatus.textContent = file ? 'Preparando tu imagen…' : 'Adjunta una imagen para probarla.';
  updateFramePreview();
  if (!file) return;
  let url;
  try {
    if (file.size > 25 * 1024 * 1024) throw new Error('La imagen supera los 25 MB. Selecciona una versión más pequeña.');
    if (!file.size) throw new Error('El archivo está vacío. Selecciona otra imagen.');
    url = URL.createObjectURL(file);
    const decoded = new Image();
    decoded.src = url;
    await decoded.decode();
    if (generation !== fileGeneration) { URL.revokeObjectURL(url); return; }
    draftImage = { url, name: file.name };
    fileStatus.textContent = `${file.name} · ${decoded.naturalWidth} × ${decoded.naturalHeight} px`;
    saveArtwork.disabled = false;
    updateFramePreview();
  } catch (error) {
    if (url) URL.revokeObjectURL(url);
    if (generation !== fileGeneration) return;
    artworkError.textContent = error instanceof DOMException ? 'El navegador no puede abrir esta imagen. Usa JPG, PNG o WebP; para HEIC, TIFF o RAW, conviértela primero.' : error.message;
    artworkError.hidden = false;
    fileStatus.textContent = 'No se pudo previsualizar el archivo.';
    artworkFile.value = '';
  }
});
document.getElementById('addArtwork').addEventListener('click', (event) => {
  discardDraft();
  artworkForm.reset();
  artworkForm.elements.year.value = new Date().getFullYear();
  artworkForm.elements.year.max = new Date().getFullYear() + 1;
  artworkError.hidden = true;
  document.getElementById('previewFile').textContent = 'Adjunta una imagen para probarla.';
  updateFramePreview();
  openModal(addDialog, event.currentTarget);
});
artworkForm.addEventListener('submit', (event) => {
  event.preventDefault();
  try {
    if (!draftImage) throw new Error('Adjunta una imagen que se pueda previsualizar.');
    const values = Object.fromEntries(['title', 'artist', 'year', 'medium', 'category', 'description'].map(name => [name, artworkForm.elements[name].value.trim()]));
    if (Object.values(values).some(value => !value)) throw new Error('Completa todos los campos de la obra.');
    works.unshift({ ...values, ...frameSettings(), imageUrl: draftImage.url, year: Number(values.year), id: `custom-${Date.now()}` });
    draftImage = null;
    searchInput.value = '';
    renderGallery();
    addDialog.close();
  } catch (error) {
    artworkError.textContent = error.message;
    artworkError.hidden = false;
  }
});

async function initializeGalleryPage() {
  if (new URLSearchParams(location.search).get('demo') === '1') {
    showGallery(null);
    return;
  }
  try {
    const result = await nogalApi.request('/api/session');
    if (!result.user?.name) { location.replace('login.html'); return; }
    showGallery(result.user);
  } catch {
    const notice = node('main', 'session-notice');
    notice.appendChild(node('h1', '', 'Volvamos a encender la luz.'));
    notice.appendChild(node('p', '', 'No pudimos comprobar tu sesión. Abre el proyecto con Node o reinicia Five Server para cargar su configuración.'));
    const link = node('a', 'demo-entry', 'Volver al login →');
    link.href = 'login.html';
    notice.appendChild(link);
    document.body.appendChild(notice);
  }
}
void initializeGalleryPage();

const logoutButton = document.getElementById('logoutButton');
logoutButton.addEventListener('click', async () => {
  const message = document.getElementById('logoutError');
  logoutButton.disabled = true;
  message.hidden = true;
  try {
    if (new URLSearchParams(location.search).get('demo') === '1') {
      location.replace('login.html');
      return;
    }
    await nogalApi.request('/api/logout', { method: 'POST' });
    const origin = await nogalApi.origin();
    location.replace(new URL('/login.html', origin).href);
  } catch (error) {
    message.textContent = `No se pudo cerrar la sesión: ${error.message}`;
    message.hidden = false;
    logoutButton.disabled = false;
  }
});
// Comprobar de nuevo la sesión si el navegador restaura esta página al volver atrás.
window.addEventListener('pageshow', event => {
  if (event.persisted) {
    galleryScene.hidden = true;
    void initializeGalleryPage();
  }
});
