const isCommunity = document.body.dataset.gallery === 'community';
const isDemo = !isCommunity && new URLSearchParams(location.search).get('demo') === '1';
let currentUser = null;
// Colección de demostración: vive únicamente en la memoria de esta página.
const works = [
  { id: 'tarde', title: 'Luz de tarde', artist: 'Elena Ríos', year: 2024, medium: 'Gouache sobre lienzo', dimensions: '60 × 45 cm', category: 'Paisaje', orientation: 'landscape', imageUrl: 'assets/tarde.svg', description: 'El horizonte guarda la última luz del día. Colinas de terracota y verdes suaves, como una pausa antes de volver a casa.' },
  { id: 'botanica', title: 'Hojas en calma', artist: 'Inés Valera', year: 2023, medium: 'Óleo y pigmento mineral', dimensions: '30 × 40 cm', category: 'Botánica', orientation: 'portrait', imageUrl: 'assets/botanica.svg', description: 'Un pequeño jardín que crece sin prisa. La luz y las hojas se encuentran en ese rincón donde todo parece estar en su sitio.' },
  { id: 'cordillera', title: 'Cordillera verde', artist: 'Tomás Alarcón', year: 2022, medium: 'Acrílico sobre lino', dimensions: '60 × 45 cm', category: 'Paisaje', orientation: 'landscape', imageUrl: 'assets/cordillera.svg', description: 'Montañas en capas de verde y piedra. Un paisaje imaginado que se parece a la memoria de un lugar querido.' },
  { id: 'arco', title: 'El arco quieto', artist: 'Lía Moreno', year: 2025, medium: 'Témpera sobre papel', dimensions: '35 × 50 cm', category: 'Abstracto', orientation: 'portrait', imageUrl: 'assets/arco.svg', description: 'Un umbral de terracota abierto hacia una luz tibia. Al otro lado, un paisaje que invita a quedarse un momento más.' },
  { id: 'ondas', title: 'Donde el agua descansa', artist: 'Inés Valera', year: 2024, medium: 'Serigrafía sobre algodón', dimensions: '50 × 38 cm', category: 'Abstracto', orientation: 'landscape', imageUrl: 'assets/ondas.svg', description: 'Un ritmo lento de curvas y verdes. El movimiento del agua reducido a lo esencial, como una respiración sobre el papel.' },
  { id: 'sol', title: 'Un sol para quedarse', artist: 'Elena Ríos', year: 2025, medium: 'Gouache sobre papel', dimensions: '30 × 30 cm', category: 'Paisaje', orientation: 'square', imageUrl: 'assets/sol.svg', description: 'Un sol de miel y un horizonte tranquilo. Una pequeña celebración de la luz que acompaña los días sencillos.' },
];
const $ = id => document.getElementById(id);
const galleryScene = $('galleryScene');
const wall = $('galleryWall');
const searchInput = $('gallerySearch');
const artDialog = $('artDialog');
const addDialog = $('addDialog');
const profileDialog = $('profileDialog');
const artworkForm = $('artworkForm');
const artworkFile = $('artworkFile');
const artworkError = $('artworkError');
const saveArtwork = $('saveArtwork');
let profiles = [];
let activeCategory = 'Todas';
let activeProfile = null;
let editingWork = null;
let draftImage = null;
let fileGeneration = 0;
let preparingImage = false;
let savingArtwork = false;
let savingProfile = false;
let loading = true;
const modalOpeners = new WeakMap();
const statusNames = { available: 'Disponible', reserved: 'Reservada', sold: 'Vendida' };
const frameNames = {"maya-espiral":"Maya · Espiral cuadrada","maya-celosia":"Maya · Celosía diagonal","maya-sol":"Maya · Sol geométrico","maya-greca":"Maya · Greca escalonada","maya-rombos":"Maya · Tejido de rombos","maya-piedra":"Maya · Relieve de piedra","walnut":"Nogal clásico","oak":"Roble natural","mahogany":"Caoba","rustic":"Madera rústica","black":"Negro mate","white":"Blanco mate","gold":"Dorado clásico","silver":"Plateado","bronze":"Bronce","floating":"Caja flotante","canvas":"Lienzo sobre bastidor","none":"Sin marco"};
const categories = ['Todas', 'Paisaje', 'Botánica', 'Abstracto', 'Otra'];

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}
function profileFor(work) {
  return profiles.find(profile => profile.id === work.userId) || { id: work.userId, name: work.uploadedBy || work.artist, username: '', bio: '', location: '', specialty: '' };
}
function avatar(profile, className = '') {
  const element = node('span', `avatar ${className}`, profile.name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase());
  const hue = [...(profile.id || profile.name)].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 360;
  element.style.setProperty('--avatar-hue', hue);
  element.setAttribute('aria-hidden', 'true');
  return element;
}
function profileLink(profile) {
  const link = node('a', 'artist-link');
  link.href = `#artist/${encodeURIComponent(profile.id)}`;
  link.append(avatar(profile), node('span', '', profile.name));
  return link;
}
function money(work) {
  if (work.price === null || work.price === undefined) return 'Precio no publicado';
  return new Intl.NumberFormat('es-GT', { style: 'currency', currency: work.currency || 'GTQ', maximumFractionDigits: 2 }).format(work.price);
}
function canManage(work) { return Boolean(currentUser && work.userId === currentUser.id); }
function frameSettings() {
  const [short, long] = artworkForm.elements.frameSize.value.split('x').map(Number);
  const horizontal = artworkForm.elements.orientation.value === 'landscape';
  const width = horizontal ? long : short;
  const height = horizontal ? short : long;
  artworkForm.elements.orientation.disabled = short === long;
  return { ratio: width / height, dimensions: `${width} × ${height} cm`, orientation: width === height ? 'square' : horizontal ? 'landscape' : 'portrait', imageFit: artworkForm.elements.imageFit.value, frameStyle: artworkForm.elements.frameStyle.value, matStyle: artworkForm.elements.matStyle.value };
}
function woodFrame(work, interactive = true) {
  const frame = node(interactive ? 'button' : 'div', `art-frame orientation-${work.orientation}`);
  if (interactive) {
    frame.type = 'button';
    frame.setAttribute('aria-label', `Ver ${work.title}`);
    frame.addEventListener('click', () => openArtwork(work, frame));
  }
  const mat = node('span', 'art-mat');
  const presentation = node('span', 'art-presentation');
  const ratio = work.ratio || (work.orientation === 'portrait' ? 3 / 4 : work.orientation === 'square' ? 1 : 4 / 3);
  frame.style.setProperty('--work-ratio', ratio);
  frame.style.setProperty('--art-width', (Math.min(1, ratio / 1.15) * 90) + '%');
  presentation.dataset.frameStyle = work.frameStyle || 'none';
  presentation.dataset.matStyle = work.matStyle || 'none';
  mat.append(presentation);
  if (work.imageUrl) {
    const image = node('img');
    image.src = work.imageUrl;
    image.alt = work.imageDescription || work.description || work.title;
    image.loading = interactive ? 'lazy' : 'eager';
    image.style.objectFit = work.imageFit || 'contain';
    image.referrerPolicy = 'no-referrer';
    image.addEventListener('error', () => { image.hidden = true; mat.append(node('span', 'image-unavailable', 'Imagen no disponible')); }, { once: true });
    presentation.append(image);
  } else presentation.append(node('span', 'preview-placeholder', 'Tu próxima pintura, aquí'));
  frame.append(mat);
  return frame;
}
const normalize = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
function renderCategories() {
  $('categoryTabs').replaceChildren(...categories.map(category => {
    const button = node('button', 'category-tab', category);
    button.type = 'button';
    button.setAttribute('aria-pressed', String(activeCategory === category));
    button.addEventListener('click', () => { activeCategory = category; renderCategories(); renderGallery(); });
    return button;
  }));
}
function statusBadge(work) { return node('span', `status-badge status-${work.saleStatus || 'available'}`, statusNames[work.saleStatus] || 'Disponible'); }
function renderGallery() {
  const needle = normalize(searchInput.value.trim());
  const availability = $('availabilityFilter').value;
  const visible = works.filter(work => {
    const seller = profileFor(work);
    return (!activeProfile || work.userId === activeProfile) && (activeCategory === 'Todas' || work.category === activeCategory) &&
      (availability === 'all' || (work.saleStatus || 'available') === availability) &&
      normalize(`${work.title} ${work.artist} ${work.medium} ${work.category} ${work.description} ${work.imageDescription || ''} ${seller.name}`).includes(needle);
  });
  const sort = $('sortOrder').value;
  visible.sort((a, b) => {
    if (sort !== 'recent') {
      if (a.price == null) return b.price == null ? 0 : 1;
      if (b.price == null) return -1;
      return sort === 'price-asc' ? a.price - b.price : b.price - a.price;
    }
    return (b.createdAt || '').localeCompare(a.createdAt || '');
  });
  wall.replaceChildren(...visible.map(work => {
    const card = node('article', 'artwork-card');
    const header = node('div', 'post-header');
    header.append(profileLink(profileFor(work)), statusBadge(work));
    const body = node('div', 'post-body');
    const caption = node('div', 'artwork-caption');
    const titleButton = node('button', 'artwork-title', work.title);
    titleButton.type = 'button';
    titleButton.addEventListener('click', () => openArtwork(work, titleButton));
    caption.append(titleButton, node('span', 'artwork-price', money(work)));
    body.append(caption, node('p', 'post-medium', `${work.medium} · ${work.dimensions}`), node('p', 'post-description', work.description));
    const footer = node('div', 'post-footer');
    const details = node('button', 'text-button', 'Ver obra ↗');
    details.type = 'button';
    details.setAttribute('aria-label', `Ver detalles de ${work.title}`);
    details.addEventListener('click', () => openArtwork(work, details));
    footer.append(node('span', 'post-category', work.category), details);
    body.append(footer);
    card.append(header, woodFrame(work), body);
    if (canManage(work)) card.append(managementActions(work));
    else card.append(node('div', 'artwork-actions artwork-actions-placeholder'));
    return card;
  }));
  $('resultsCount').textContent = `${visible.length} ${visible.length === 1 ? 'obra' : 'obras'}`;
  $('emptyCollection').hidden = visible.length !== 0 || loading;
  const hasFilters = needle || activeCategory !== 'Todas' || availability !== 'all';
  $('emptyTitle').textContent = hasFilters ? 'No encontramos esa obra.' : 'Un espacio para nuevas historias.';
  $('emptyMessage').textContent = hasFilters ? 'Prueba otra búsqueda o cambia los filtros.' : activeProfile ? 'Este artista todavía no ha publicado pinturas.' : 'Las pinturas que se publiquen aparecerán aquí.';
  $('resetSearch').hidden = !hasFilters;
}
function openModal(dialog, opener) {
  modalOpeners.set(dialog, opener || document.activeElement);
  dialog.showModal();
  document.body.style.overflow = 'hidden';
}
function dialogBusy(dialog) { return dialog === addDialog ? savingArtwork : dialog === profileDialog && savingProfile; }
for (const dialog of [artDialog, addDialog, profileDialog]) {
  dialog.querySelector('.dialog-close').addEventListener('click', () => { if (!dialogBusy(dialog)) dialog.close(); });
  dialog.addEventListener('cancel', event => { if (dialogBusy(dialog)) event.preventDefault(); });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog || dialogBusy(dialog)) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => {
    if (![artDialog, addDialog, profileDialog].some(item => item.open)) {
      document.body.style.overflow = '';
      const opener = modalOpeners.get(dialog);
      if (opener?.isConnected) opener.focus();
      else $('addArtwork').focus({ preventScroll: true });
    }
  });
}
function managementActions(work) {
  const actions = node('div', 'artwork-actions');
  const edit = node('button', 'text-button', 'Editar');
  const remove = node('button', 'text-button delete-artwork', 'Eliminar');
  const errorMessage = node('p', 'artwork-error');
  errorMessage.setAttribute('role', 'alert');
  for (const button of [edit, remove]) { button.type = 'button'; button.setAttribute('aria-label', `${button.textContent} ${work.title}`); }
  edit.addEventListener('click', () => openEditor(work, edit));
  remove.addEventListener('click', async () => {
    if (!confirm(`¿Eliminar «${work.title}»? Esta acción no se puede deshacer.`)) return;
    edit.disabled = remove.disabled = true;
    errorMessage.textContent = '';
    try {
      if (!isDemo) await nogalApi.request(`/api/artworks/${work.id}`, { method: 'DELETE' });
      const index = works.findIndex(entry => entry.id === work.id);
      if (index !== -1) works.splice(index, 1);
      if (isDemo && work.imageUrl.startsWith('blob:')) URL.revokeObjectURL(work.imageUrl);
      if (artDialog.open) artDialog.close();
      renderRoute();
    } catch (error) { errorMessage.textContent = error.message; edit.disabled = remove.disabled = false; }
  });
  actions.append(edit, remove, errorMessage);
  return actions;
}
function openArtwork(work, opener) {
  const details = node('div', 'art-details');
  const title = node('h2', '', work.title);
  title.id = 'artDialogTitle';
  const artist = profileLink(profileFor(work));
  artist.addEventListener('click', () => artDialog.close());
  details.append(statusBadge(work), title, artist, node('p', 'detail-price', money(work)), node('p', 'art-description', work.description));
  const facts = node('dl', 'art-facts');
  for (const [label, value] of [['Artista de la obra', work.artist], ['Técnica', work.medium], ['Formato', work.dimensions], ['Marco', frameNames[work.frameStyle] || 'Sin marco'], ['Año', work.year]]) {
    const item = node('div'); item.append(node('dt', '', label), node('dd', '', value)); facts.append(item);
  }
  details.append(facts);
  if (work.imageDescription) {
    const visual = node('section', 'visual-description');
    visual.append(node('h3', '', 'Descripción de la imagen'), node('p', '', work.imageDescription));
    details.append(visual);
  }
  if (Array.isArray(work.labels) && work.labels.length) {
    const analysis = node('details', 'image-analysis');
    analysis.append(node('summary', '', 'Etiquetas de la imagen'));
    const list = node('ul');
    for (const label of work.labels) list.append(node('li', '', `${label.name} · ${Number(label.confidence).toFixed(1)} %`));
    analysis.append(list); details.append(analysis);
  }
  if (canManage(work)) details.append(managementActions(work));
  $('artDialogContent').replaceChildren(woodFrame(work, false), details);
  openModal(artDialog, opener);
}
function renderProfile(profile) {
  const header = $('profileHeader');
  const info = node('div', 'profile-info');
  info.append(node('p', 'eyebrow', profile.specialty || 'ARTISTA EN NOGAL'), node('h1', '', profile.name), node('p', 'profile-handle', `@${profile.username}`));
  if (profile.bio) info.append(node('p', 'profile-bio', profile.bio));
  else info.append(node('p', 'profile-bio muted', 'Un espacio para compartir su mirada a través del arte.'));
  if (profile.location) info.append(node('p', 'profile-location', profile.location));
  const ownWorks = works.filter(work => work.userId === profile.id);
  const stats = node('div', 'profile-stats');
  const availableCount = ownWorks.filter(work => (work.saleStatus || 'available') === 'available').length;
  stats.append(node('span', '', `${ownWorks.length} ${ownWorks.length === 1 ? 'pintura' : 'pinturas'}`), node('span', '', `${availableCount} ${availableCount === 1 ? 'disponible' : 'disponibles'}`));
  info.append(stats);
  header.replaceChildren(avatar(profile, 'profile-avatar'), info);
  if (currentUser?.id === profile.id) {
    const button = node('button', 'add-button', 'Editar perfil');
    button.type = 'button'; button.addEventListener('click', () => openProfileEditor(button));
    header.append(button);
  }
}
function renderArtists() {
  $('artistCards').replaceChildren(...profiles.map(profile => {
    const link = node('a', 'artist-card');
    link.href = `#artist/${encodeURIComponent(profile.id)}`;
    link.append(avatar(profile, 'directory-avatar'), node('h2', '', profile.name), node('p', 'artist-specialty', profile.specialty || 'Artista en Nogal'), node('p', 'artist-bio', profile.bio || 'Descubre sus pinturas y su forma de ver el mundo.'));
    const count = works.filter(work => work.userId === profile.id).length;
    link.append(node('span', 'artist-count', `${count} ${count === 1 ? 'pintura' : 'pinturas'} · Ver perfil ↗`));
    return link;
  }));
}
function renderRoute() {
  const route = location.hash.slice(1);
  const requestedId = route.startsWith('artist/') ? route.slice(7) : null;
  const profile = profiles.find(entry => encodeURIComponent(entry.id) === requestedId);
  const directory = route === 'artists';
  activeProfile = profile?.id || null;
  $('marketHero').hidden = Boolean(profile) || directory || Boolean(requestedId);
  $('profileHeader').hidden = !profile;
  $('artistDirectory').hidden = !directory;
  $('feedSection').hidden = directory;
  $('exploreLink').setAttribute('aria-current', !profile && !directory ? 'page' : 'false');
  $('artistsLink').setAttribute('aria-current', directory ? 'page' : 'false');
  if (profile) renderProfile(profile);
  if (directory) renderArtists();
  $('feedTitle').textContent = profile ? 'Sus pinturas' : 'Descubre tu próxima obra';
  $('feedEyebrow').textContent = profile ? 'UNA MIRADA, MUCHAS HISTORIAS' : 'LA GALERÍA, SIEMPRE ABIERTA';
  document.title = profile ? `${profile.name} — Nogal` : directory ? 'Artistas — Nogal' : 'Nogal — Arte con un lugar';
  $('collectionError').textContent = requestedId && !profile ? 'Este perfil no está disponible. Explora las obras de la comunidad.' : '';
  $('collectionError').hidden = !requestedId || Boolean(profile);
  renderGallery();
}
window.addEventListener('hashchange', () => {
  for (const dialog of [artDialog, addDialog, profileDialog]) if (dialog.open && !dialogBusy(dialog)) dialog.close();
  searchInput.value = ''; activeCategory = 'Todas'; $('availabilityFilter').value = 'all';
  renderCategories(); renderRoute(); window.scrollTo(0, 0);
});
function updateFramePreview() {
  const settings = frameSettings();
  const preview = woodFrame({ ...settings, title: artworkForm.elements.title.value || 'Vista previa', imageUrl: draftImage?.url || editingWork?.imageUrl, imageDescription: artworkForm.elements.imageDescription.value }, false);
  const [width, height] = settings.dimensions.match(/\d+/g).map(Number);
  preview.style.width = `${Math.min(320, 320 * width / height)}px`;
  preview.style.setProperty('--preview-ratio', settings.ratio);
  $('framePreview').replaceChildren(preview);
  $('previewMeasurement').textContent = `${settings.dimensions} · ${frameNames[settings.frameStyle]}`;
}
function discardDraft() {
  fileGeneration++; preparingImage = false;
  if (draftImage) URL.revokeObjectURL(draftImage.url);
  draftImage = null;
}
addDialog.addEventListener('close', () => { discardDraft(); editingWork = null; });
for (const name of ['frameSize', 'orientation', 'imageFit', 'matStyle', 'title', 'imageDescription']) artworkForm.elements[name].addEventListener('input', updateFramePreview);
for (const radio of artworkForm.querySelectorAll('[name="frameStyle"]')) radio.addEventListener('change', updateFramePreview);
artworkFile.addEventListener('change', async () => {
  discardDraft();
  const generation = fileGeneration;
  artworkError.hidden = true;
  const file = artworkFile.files[0];
  saveArtwork.disabled = Boolean(file) || !editingWork;
  $('previewFile').textContent = file ? 'Preparando imagen…' : editingWork ? 'Se conservará la imagen actual.' : 'Adjunta una imagen para previsualizarla.';
  updateFramePreview();
  if (!file) return;
  preparingImage = true;
  let url;
  try {
    if (!file.size || file.size > 19 * 1024 * 1024) throw new Error('Selecciona una imagen de hasta 19 MB.');
    if (!isDemo && !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Usa JPG, PNG o WebP.');
    url = URL.createObjectURL(file);
    const image = new Image(); image.src = url; await image.decode();
    if (generation !== fileGeneration) { URL.revokeObjectURL(url); return; }
    draftImage = { url, file };
    $('previewFile').textContent = `${file.name} · ${image.naturalWidth} × ${image.naturalHeight} px`;
    saveArtwork.disabled = false; updateFramePreview();
  } catch (error) {
    if (url) URL.revokeObjectURL(url);
    if (generation !== fileGeneration) return;
    artworkError.textContent = error instanceof DOMException ? 'No se pudo abrir la imagen. Usa JPG, PNG o WebP.' : error.message;
    artworkError.hidden = false; artworkFile.value = ''; saveArtwork.disabled = !editingWork;
    $('previewFile').textContent = editingWork ? 'Se conservará la imagen actual.' : 'No se pudo previsualizar el archivo.';
  } finally { if (generation === fileGeneration) preparingImage = false; }
});
function openEditor(work, opener) {
  if (!currentUser) { location.assign('login.html'); return; }
  if (artDialog.open) artDialog.close();
  discardDraft(); editingWork = work; artworkForm.reset(); artworkFile.required = !work;
  $('addDialogTitle').textContent = work ? 'Editar pintura' : 'Comparte tu próxima obra.';
  addDialog.querySelector('.add-description').textContent = work ? 'Actualiza la descripción, el precio o la imagen de tu pintura.' : 'Dale un lugar a tu pintura en la comunidad.';
  saveArtwork.querySelector('span').textContent = work ? 'Guardar cambios' : 'Publicar pintura';
  artworkForm.elements.artist.value = currentUser.name;
  artworkForm.elements.year.value = new Date().getFullYear();
  artworkForm.elements.year.max = new Date().getFullYear() + 1;
  if (work) {
    for (const name of ['title', 'artist', 'year', 'medium', 'category', 'description', 'imageDescription', 'price']) artworkForm.elements[name].value = work[name] ?? '';
    const size = work.dimensions.match(/\d+/g).map(Number).sort((a, b) => a - b).join('x');
    const selectedSize = work.frameSize || size;
    if (![...artworkForm.elements.frameSize.options].some(option => option.value === selectedSize)) artworkForm.elements.frameSize.value = '30x40';
    else artworkForm.elements.frameSize.value = selectedSize;
    artworkForm.elements.orientation.value = work.orientation === 'landscape' ? 'landscape' : 'portrait';
    artworkForm.elements.imageFit.value = work.imageFit || 'contain';
    artworkForm.elements.frameStyle.value = work.frameStyle || 'none';
    artworkForm.elements.matStyle.value = work.matStyle || 'none';
    artworkForm.elements.currency.value = work.currency || 'GTQ';
    artworkForm.elements.saleStatus.value = work.saleStatus || 'available';
  }
  saveArtwork.disabled = !work; artworkError.hidden = true;
  $('previewFile').textContent = work ? 'Imagen actual. Adjunta otra si quieres reemplazarla.' : 'Adjunta una imagen para previsualizarla.';
  updateFramePreview(); openModal(addDialog, opener);
}
$('addArtwork').addEventListener('click', event => openEditor(null, event.currentTarget));
artworkForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (savingArtwork || preparingImage) return;
  const edited = editingWork;
  try {
    if (!draftImage && !edited) throw new Error('Adjunta una imagen válida.');
    const names = ['title', 'artist', 'year', 'medium', 'category', 'description', 'imageDescription', 'price', 'currency', 'saleStatus', 'frameSize', 'orientation', 'imageFit', 'frameStyle', 'matStyle'];
    const values = Object.fromEntries(names.map(name => [name, artworkForm.elements[name].value.trim()]));
    savingArtwork = true; saveArtwork.disabled = true; artworkForm.inert = true; artworkError.hidden = true;
    let work;
    if (isDemo) {
      work = { ...edited, ...values, ...frameSettings(), price: values.price ? Number(values.price) : null, year: Number(values.year), imageUrl: draftImage?.url || edited.imageUrl, id: edited?.id || `custom-${Date.now()}`, userId: currentUser.id, uploadedBy: currentUser.name, createdAt: edited?.createdAt || new Date().toISOString() };
      if (edited && draftImage && edited.imageUrl.startsWith('blob:')) URL.revokeObjectURL(edited.imageUrl);
      draftImage = null;
    } else {
      const imageData = draftImage ? await new Promise((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('No se pudo leer la imagen.')); reader.readAsDataURL(draftImage.file);
      }) : undefined;
      ({ work } = await nogalApi.request(edited ? `/api/artworks/${edited.id}` : '/api/artworks', { method: edited ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...values, imageData }) }));
    }
    if (edited) works[works.findIndex(entry => entry.id === edited.id)] = work;
    else works.unshift(work);
    searchInput.value = ''; activeCategory = 'Todas'; $('availabilityFilter').value = 'all'; renderCategories();
    addDialog.close();
    if (activeProfile && activeProfile !== currentUser.id) location.hash = `artist/${encodeURIComponent(currentUser.id)}`;
    else if (location.hash === '#artists') location.hash = 'explore';
    renderRoute();
  } catch (error) { artworkError.textContent = error.message; artworkError.hidden = false; saveArtwork.disabled = !draftImage && !editingWork; }
  finally { savingArtwork = false; artworkForm.inert = false; }
});
function openProfileEditor(opener) {
  if (!currentUser) return;
  const form = $('profileForm');
  for (const name of ['name', 'bio', 'location', 'specialty']) form.elements[name].value = currentUser[name] || '';
  $('profileError').hidden = true; openModal(profileDialog, opener);
}
$('profileForm').addEventListener('submit', async event => {
  event.preventDefault(); if (savingProfile) return;
  const form = event.currentTarget;
  const values = Object.fromEntries(['name', 'bio', 'location', 'specialty'].map(name => [name, form.elements[name].value.trim()]));
  savingProfile = true; form.inert = true; form.querySelector('button[type="submit"]').disabled = true;
  try {
    if (isDemo) currentUser = { ...currentUser, ...values };
    else currentUser = (await nogalApi.request('/api/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) })).user;
    profiles = profiles.map(profile => profile.id === currentUser.id ? currentUser : profile);
    updateSessionControls(); renderRoute(); profileDialog.close();
  } catch (error) { $('profileError').textContent = error.message; $('profileError').hidden = false; }
  finally { savingProfile = false; form.inert = false; form.querySelector('button[type="submit"]').disabled = false; }
});
function updateSessionControls() {
  $('loginLink').hidden = Boolean(currentUser);
  $('logoutButton').hidden = !currentUser;
  const link = $('myProfileLink'); link.hidden = !currentUser;
  if (currentUser) { link.href = `#artist/${encodeURIComponent(currentUser.id)}`; link.replaceChildren(avatar(currentUser)); }
}
function resetFilters() {
  searchInput.value = ''; activeCategory = 'Todas'; $('availabilityFilter').value = 'all'; $('sortOrder').value = 'recent'; renderCategories(); renderGallery();
}
searchInput.addEventListener('input', renderGallery);
$('availabilityFilter').addEventListener('change', renderGallery);
$('sortOrder').addEventListener('change', renderGallery);
$('resetSearch').addEventListener('click', resetFilters);
$('backToTop').addEventListener('click', () => window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }));
async function initializeGalleryPage() {
  loading = true; $('retryCollection').hidden = true; $('collectionError').hidden = true;
  try {
    if (isDemo) {
      if (!profiles.length) {
        const names = [...new Set(works.map(work => work.artist))];
        profiles = names.map((name, index) => ({ id: `demo-${index}`, name, username: normalize(name).replace(/\s+/g, '.'), specialty: 'Pintura y exploración visual', bio: 'Un perfil de muestra para explorar la nueva galería.', location: '' }));
        works.forEach((work, index) => Object.assign(work, { userId: profiles.find(profile => profile.name === work.artist).id, frameStyle: ['maya-greca', 'maya-rombos', 'maya-piedra', 'maya-espiral', 'maya-celosia', 'maya-sol'][index % 6], matStyle: 'cream', price: [850, 1200, 950, 650, 1400, 480][index], currency: 'GTQ', saleStatus: index === 4 ? 'sold' : 'available', createdAt: `2026-10-${String(20 - index).padStart(2, '0')}` }));
        currentUser = profiles[0];
      }
      $('logoutError').textContent = 'Vista de demostración. Los perfiles, pinturas y precios son de muestra; los cambios se perderán al recargar.';
      $('logoutError').hidden = false;
    } else {
      currentUser = (await nogalApi.request('/api/session')).user;
      if (!isCommunity && !currentUser) { location.replace('login.html'); return; }
      const [collection, people] = await Promise.all([nogalApi.request('/api/artworks'), nogalApi.request('/api/profiles')]);
      works.splice(0, works.length, ...collection.works); profiles = people.profiles;
    }
    loading = false; galleryScene.hidden = false; updateSessionControls(); renderCategories();
    if (!isCommunity && !isDemo && !location.hash) location.hash = `artist/${encodeURIComponent(currentUser.id)}`;
    renderRoute();
  } catch (error) {
    loading = false; works.length = 0; galleryScene.hidden = false; renderCategories(); renderGallery(); updateSessionControls();
    $('collectionError').textContent = `No se pudo cargar la galería. ${error.message}`;
    $('collectionError').hidden = false; $('retryCollection').hidden = false; $('emptyCollection').hidden = true;
  }
}
$('retryCollection').addEventListener('click', () => { void initializeGalleryPage(); });
$('logoutButton').addEventListener('click', async () => {
  const button = $('logoutButton'); button.disabled = true; $('logoutError').hidden = true;
  try {
    if (!isDemo) await nogalApi.request('/api/logout', { method: 'POST' });
    location.replace('index.html');
  } catch (error) { $('logoutError').textContent = error.message; $('logoutError').hidden = false; button.disabled = false; }
});
window.addEventListener('pageshow', event => { if (event.persisted) { galleryScene.hidden = true; void initializeGalleryPage(); } });
void initializeGalleryPage();
