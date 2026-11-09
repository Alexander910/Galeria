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
let favoritesActive = false;
let notifications = [];
let notificationsLoading = false;
let editingWork = null;
let draftImage = null;
let fileGeneration = 0;
let preparingImage = false;
let savingArtwork = false;
let savingProfile = false;
let profilePhotoUrl = null;
let profilePhotoRemoved = false;
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
  if (profile.photoUrl) {
    const image = node('img'); image.src = profile.photoUrl; image.alt = ''; image.loading = 'lazy';
    element.replaceChildren(image);
  }
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
const pendingLikes = new Set();
function updateLikeControls(work) {
  for (const control of document.querySelectorAll('[data-like-work]')) {
    if (control.dataset.likeWork !== work.id) continue;
    const liked = Boolean(currentUser && work.liked);
    const count = work.likeCount || 0;
    control.querySelector('.heart-symbol').textContent = liked ? '♥' : '♡';
    control.querySelector('.heart-count').textContent = String(count);
    if (control.tagName === 'BUTTON') {
      control.setAttribute('aria-pressed', String(liked));
      control.setAttribute('aria-label', (liked ? 'Quitar corazón de ' : 'Dar corazón a ') + work.title + '. ' + count + ' corazones');
      control.disabled = pendingLikes.has(work.id);
    }
  }
}
function likeControl(work) {
  const group = node('div', 'artwork-likes');
  const control = node(currentUser ? 'button' : 'a', 'heart-button');
  control.dataset.likeWork = work.id;
  const symbol = node('span', 'heart-symbol', currentUser && work.liked ? '♥' : '♡');
  symbol.setAttribute('aria-hidden', 'true');
  control.append(symbol, node('span', 'heart-count', String(work.likeCount || 0)));
  const errorMessage = node('span', 'heart-message'); errorMessage.setAttribute('role', 'status');
  if (!currentUser) {
    control.href = 'login.html';
    control.setAttribute('aria-label', 'Inicia sesión para dar un corazón a ' + work.title + '. ' + (work.likeCount || 0) + ' corazones');
    control.title = 'Inicia sesión para dar un corazón';
  } else {
    control.type = 'button';
    control.setAttribute('aria-pressed', String(Boolean(work.liked)));
    control.setAttribute('aria-label', (work.liked ? 'Quitar corazón de ' : 'Dar corazón a ') + work.title + '. ' + (work.likeCount || 0) + ' corazones');
    control.disabled = pendingLikes.has(work.id);
    control.addEventListener('click', async () => {
      if (pendingLikes.has(work.id)) return;
      const liked = !work.liked;
      pendingLikes.add(work.id); errorMessage.textContent = ''; updateLikeControls(work);
      try {
        const result = isDemo ? { liked, likeCount: Math.max(0, (work.likeCount || 0) + (liked ? 1 : -1)) }
          : await nogalApi.request('/api/artworks/' + work.id + '/like', { method: liked ? 'PUT' : 'DELETE' });
        Object.assign(work, result);
      } catch (error) { errorMessage.textContent = error.message; }
      finally { pendingLikes.delete(work.id); updateLikeControls(work); if (favoritesActive) renderGallery(); }
    });
  }
  group.append(control, errorMessage);
  return group;
}
function updateCommentCounts(work) {
  for (const control of document.querySelectorAll('[data-comment-work]')) {
    if (control.dataset.commentWork === work.id) control.textContent = 'Comentarios (' + (work.comments || []).length + ')';
  }
}
function commentsSection(work) {
  const section = node('section', 'comments-section');
  section.setAttribute('aria-label', 'Comentarios de ' + work.title);
  section.append(node('h3', '', 'Comentarios (' + (work.comments || []).length + ')'));
  const errorMessage = node('p', 'artwork-error'); errorMessage.setAttribute('role', 'status');
  let busy = false;
  const refresh = () => {
    updateCommentCounts(work);
    if (!section.isConnected) return;
    const next = commentsSection(work); section.replaceWith(next);
    (next.querySelector('textarea') || next.querySelector('a, button'))?.focus();
  };
  const list = node('div', 'comment-list');
  if (!(work.comments || []).length) list.append(node('p', 'comment-empty', 'Sé la primera persona en comentar esta obra.'));
  for (const comment of work.comments || []) {
    const entry = node('article', 'comment');
    const author = profiles.find(profile => profile.id === comment.userId) || { id: comment.userId, name: comment.authorName || 'Artista' };
    const heading = node('div', 'comment-heading'); heading.append(profileLink(author));
    const time = node('time', '', new Date(comment.createdAt).toLocaleDateString('es-GT', { day: 'numeric', month: 'short', year: 'numeric' })); time.dateTime = comment.createdAt; heading.append(time);
    entry.append(heading, node('p', 'comment-text', comment.text));
    if (currentUser && (currentUser.id === comment.userId || canManage(work))) {
      const remove = node('button', 'text-button delete-comment', 'Borrar comentario'); remove.type = 'button';
      remove.addEventListener('click', async () => {
        if (busy) return; busy = true; remove.disabled = true; errorMessage.textContent = '';
        try {
          if (isDemo) work.comments = work.comments.filter(item => item.id !== comment.id);
          else work.comments = (await nogalApi.request('/api/artworks/' + work.id + '/comments/' + comment.id, { method: 'DELETE' })).comments;
          refresh();
        } catch (error) { errorMessage.textContent = error.message; }
        finally { busy = false; remove.disabled = false; }
      });
      entry.append(remove);
    }
    list.append(entry);
  }
  section.append(list);
  if (currentUser) {
    const form = node('form', 'comment-form');
    const label = node('label', 'field', 'Tu comentario');
    const textarea = node('textarea'); textarea.name = 'comment'; textarea.required = true; textarea.maxLength = 500; textarea.rows = 3; textarea.placeholder = 'Comparte lo que te inspira esta obra…'; label.append(textarea);
    const help = node('span', 'storage-note', 'Máximo 500 caracteres. Tu comentario será público.');
    const submit = node('button', 'add-button primary-button', 'Publicar comentario'); submit.type = 'submit';
    form.append(label, help, submit);
    form.addEventListener('submit', async event => {
      event.preventDefault(); if (busy) return;
      const text = textarea.value.trim();
      if (!text) { errorMessage.textContent = 'Escribe un comentario.'; textarea.focus(); return; }
      busy = true; form.inert = true; submit.disabled = true; errorMessage.textContent = '';
      try {
        if (isDemo) {
          if ((work.comments || []).length >= 30) throw new Error('Esta obra alcanzó el límite de 30 comentarios.');
          work.comments = [...(work.comments || []), { id: crypto.randomUUID(), userId: currentUser.id, authorName: currentUser.name, text, createdAt: new Date().toISOString() }];
        } else work.comments = (await nogalApi.request('/api/artworks/' + work.id + '/comments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) })).comments;
        refresh();
      } catch (error) { errorMessage.textContent = error.message; }
      finally { busy = false; form.inert = false; submit.disabled = false; }
    });
    section.append(form);
  } else {
    const link = node('a', 'demo-entry', 'Inicia sesión para comentar →'); link.href = 'login.html'; section.append(link);
  }
  section.append(errorMessage);
  return section;
}
function renderGallery() {
  const needle = normalize(searchInput.value.trim());
  const availability = $('availabilityFilter').value;
  const visible = works.filter(work => {
    const seller = profileFor(work);
    return (!favoritesActive || (currentUser && work.liked)) && (!activeProfile || work.userId === activeProfile) && (activeCategory === 'Todas' || work.category === activeCategory) &&
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
    const social = node('div', 'post-social');
    const comments = node('button', 'text-button comment-count', 'Comentarios (' + (work.comments || []).length + ')');
    comments.type = 'button'; comments.dataset.commentWork = work.id;
    comments.addEventListener('click', () => { openArtwork(work, comments); artDialog.querySelector('.comments-section').scrollIntoView({ block: 'nearest' }); });
    social.append(likeControl(work), comments);
    body.append(social, footer);
    card.append(header, woodFrame(work), body);
    if (canManage(work)) card.append(managementActions(work));
    else card.append(node('div', 'artwork-actions artwork-actions-placeholder'));
    return card;
  }));
  $('resultsCount').textContent = `${visible.length} ${visible.length === 1 ? 'obra' : 'obras'}`;
  $('emptyCollection').hidden = visible.length !== 0 || loading;
  const hasFilters = needle || activeCategory !== 'Todas' || availability !== 'all';
  $('emptyTitle').textContent = hasFilters ? 'No encontramos esa obra.' : favoritesActive ? 'Tus obras favoritas, en un lugar.' : 'Un espacio para nuevas historias.';
  $('emptyMessage').textContent = hasFilters ? 'Prueba otra búsqueda o cambia los filtros.' : favoritesActive ? 'Dale corazón a una obra para guardarla aquí.' : activeProfile ? 'Este artista todavía no ha publicado pinturas.' : 'Las pinturas que se publiquen aparecerán aquí.';
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
  details.append(likeControl(work), facts);
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
  details.append(commentsSection(work));
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
  const contacts = node('div', 'profile-contacts');
  for (const [text, href] of [[profile.contactEmail, profile.contactEmail ? 'mailto:' + profile.contactEmail : ''], [profile.contactPhone, profile.contactPhone ? 'tel:' + profile.contactPhone.replace(/[^+0-9]/g, '') : ''], [profile.website, profile.website]]) {
    if (!text) continue;
    const link = node('a', '', text); link.href = href;
    if (href.startsWith('http')) { link.target = '_blank'; link.rel = 'noopener noreferrer'; }
    contacts.append(link);
  }
  if (contacts.childElementCount) info.append(contacts);
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
  favoritesActive = route === 'favorites';
  const activity = route === 'notifications';
  const locked = (favoritesActive || activity) && !currentUser;
  activeProfile = profile?.id || null;
  $('privateAccess').hidden = !locked;
  $('marketHero').hidden = Boolean(profile) || directory || Boolean(requestedId) || favoritesActive || activity;
  $('profileHeader').hidden = !profile;
  $('artistDirectory').hidden = !directory;
  $('notificationsSection').hidden = !activity || locked;
  $('feedSection').hidden = directory || activity || locked;
  $('exploreLink').setAttribute('aria-current', !profile && !directory && !favoritesActive && !activity ? 'page' : 'false');
  $('artistsLink').setAttribute('aria-current', directory ? 'page' : 'false');
  $('favoritesLink').setAttribute('aria-current', favoritesActive ? 'page' : 'false');
  $('notificationsLink').setAttribute('aria-current', activity ? 'page' : 'false');
  if (profile) renderProfile(profile);
  if (directory) renderArtists();
  if (activity && currentUser) renderNotifications();
  $('feedTitle').textContent = favoritesActive ? 'Tus favoritos' : profile ? 'Sus pinturas' : 'Descubre tu próxima obra';
  $('feedEyebrow').textContent = favoritesActive ? 'LAS OBRAS QUE TE INSPIRAN' : profile ? 'UNA MIRADA, MUCHAS HISTORIAS' : 'LA GALERÍA, SIEMPRE ABIERTA';
  document.title = favoritesActive ? 'Favoritos — Nogal' : activity ? 'Notificaciones — Nogal' : profile ? profile.name + ' — Nogal' : directory ? 'Artistas — Nogal' : 'Nogal — Arte con un lugar';
  $('collectionError').textContent = requestedId && !profile ? 'Este perfil no está disponible. Explora las obras de la comunidad.' : '';
  $('collectionError').hidden = !requestedId || Boolean(profile);
  renderGallery();
}
function demoNotifications() {
  return works.filter(work => work.userId === currentUser.id).flatMap(work => (work.comments || []).filter(comment => comment.userId !== currentUser.id).map(comment => ({
    id: comment.id, workId: work.id, title: work.title, actorName: comment.authorName, text: comment.text.slice(0, 140), createdAt: comment.createdAt, read: Boolean(comment.notificationRead),
  }))).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
function updateNotificationBadge() {
  const count = notifications.filter(note => !note.read).length;
  $('notificationBadge').textContent = String(count); $('notificationBadge').hidden = !count;
  $('notificationsLink').setAttribute('aria-label', 'Notificaciones: ' + count + ' sin leer');
}
function renderNotifications() {
  updateNotificationBadge();
  const list = $('notificationsList');
  if (!notifications.length) {
    list.replaceChildren(node('div', 'notification-empty', 'Aquí verás los comentarios que otras personas hagan en tus cuadros.'));
    return;
  }
  list.replaceChildren(...notifications.map(note => {
    const button = node('button', 'notification-card' + (note.read ? '' : ' unread'));
    button.type = 'button';
    button.append(node('span', 'notification-state', note.read ? 'Leída' : 'Nueva'), node('strong', '', note.actorName + ' comentó en «' + note.title + '»'), node('span', 'notification-excerpt', note.text));
    const date = node('time', '', new Date(note.createdAt).toLocaleString('es-GT')); date.dateTime = note.createdAt; button.append(date);
    button.addEventListener('click', async () => {
      button.disabled = true; $('notificationsStatus').textContent = '';
      try {
        if (!isDemo) {
          await nogalApi.request('/api/notifications/' + note.workId + '/' + note.id + '/read', { method: 'PUT' });
          const collection = await nogalApi.request('/api/artworks');
          for (const work of collection.works) {
            const previous = works.find(entry => entry.id === work.id);
            if (previous) Object.assign(previous, work); else works.push(work);
          }
        } else {
          const comment = works.find(work => work.id === note.workId)?.comments?.find(comment => comment.id === note.id);
          if (comment) comment.notificationRead = true;
        }
        note.read = true; updateNotificationBadge();
        button.classList.remove('unread'); button.querySelector('.notification-state').textContent = 'Leída';
        const work = works.find(work => work.id === note.workId);
        if (!work) throw new Error('Esta obra ya no está disponible.');
        openArtwork(work, button); artDialog.querySelector('.comments-section').scrollIntoView({ block: 'nearest' });
      } catch (error) { $('notificationsStatus').textContent = error.message; }
      finally { button.disabled = false; }
    });
    return button;
  }));
}
async function refreshNotifications() {
  if (!currentUser || notificationsLoading) return;
  notificationsLoading = true; $('refreshNotifications').disabled = true;
  try {
    notifications = isDemo ? demoNotifications() : (await nogalApi.request('/api/notifications')).notifications;
    $('notificationsStatus').textContent = '';
    updateNotificationBadge();
    if (location.hash === '#notifications') renderNotifications();
  } catch (error) { $('notificationsStatus').textContent = error.message; }
  finally { notificationsLoading = false; $('refreshNotifications').disabled = false; }
}
async function refreshFavorites() {
  if (!currentUser || isDemo) return;
  try {
    const collection = await nogalApi.request('/api/favorites');
    const ids = new Set(collection.works.map(work => work.id));
    for (const work of works) if (!pendingLikes.has(work.id)) work.liked = ids.has(work.id);
    for (const work of collection.works) {
      const previous = works.find(entry => entry.id === work.id);
      if (previous && !pendingLikes.has(work.id)) Object.assign(previous, work); else if (!previous) works.push(work);
    }
    if (favoritesActive) renderGallery();
  } catch (error) { $('collectionError').textContent = error.message; $('collectionError').hidden = false; }
}
$('refreshNotifications').addEventListener('click', () => { void refreshNotifications(); });
window.addEventListener('focus', () => { void refreshNotifications(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) void refreshNotifications(); });
setInterval(() => { if (!document.hidden) void refreshNotifications(); }, 30000);
window.addEventListener('hashchange', () => {
  for (const dialog of [artDialog, addDialog, profileDialog]) if (dialog.open && !dialogBusy(dialog)) dialog.close();
  searchInput.value = ''; activeCategory = 'Todas'; $('availabilityFilter').value = 'all';
  renderCategories(); renderRoute(); window.scrollTo(0, 0);
  if (favoritesActive) void refreshFavorites();
  if (location.hash === '#notifications') void refreshNotifications();
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
function clearProfilePhotoDraft() {
  if (profilePhotoUrl) URL.revokeObjectURL(profilePhotoUrl);
  profilePhotoUrl = null;
}
function renderProfilePhotoPreview() {
  const photoUrl = profilePhotoUrl || (profilePhotoRemoved ? '' : currentUser?.photoUrl);
  $('profilePhotoPreview').replaceChildren(avatar({ ...currentUser, photoUrl }, 'profile-avatar'));
  $('removeProfilePhoto').hidden = !photoUrl;
}
$('profilePhoto').addEventListener('change', () => {
  clearProfilePhotoDraft(); $('profileError').hidden = true;
  const file = $('profilePhoto').files[0];
  if (file && (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || !file.size || file.size > 2 * 1024 * 1024)) {
    $('profilePhoto').value = ''; $('profileError').textContent = 'Selecciona una foto JPG, PNG o WebP de hasta 2 MB.'; $('profileError').hidden = false;
  } else if (file) { profilePhotoUrl = URL.createObjectURL(file); profilePhotoRemoved = false; }
  renderProfilePhotoPreview();
});
$('removeProfilePhoto').addEventListener('click', () => {
  clearProfilePhotoDraft(); $('profilePhoto').value = ''; profilePhotoRemoved = true; renderProfilePhotoPreview();
});
profileDialog.addEventListener('close', clearProfilePhotoDraft);
function openProfileEditor(opener) {
  if (!currentUser) return;
  const form = $('profileForm');
  for (const name of ['name', 'bio', 'location', 'specialty', 'contactEmail', 'contactPhone', 'website']) form.elements[name].value = currentUser[name] || '';
  clearProfilePhotoDraft();
  profilePhotoRemoved = false; $('profilePhoto').value = '';
  renderProfilePhotoPreview();
  $('profileError').hidden = true; openModal(profileDialog, opener);
}
$('profileForm').addEventListener('submit', async event => {
  event.preventDefault(); if (savingProfile) return;
  const form = event.currentTarget;
  const values = Object.fromEntries(['name', 'bio', 'location', 'specialty', 'contactEmail', 'contactPhone', 'website'].map(name => [name, form.elements[name].value.trim()]));
  savingProfile = true; form.inert = true; form.querySelector('button[type="submit"]').disabled = true;
  try {
    const file = $('profilePhoto').files[0];
    if (file) values.photoData = await new Promise((resolve, reject) => {
      const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('No se pudo leer la foto.')); reader.readAsDataURL(file);
    });
    else if (profilePhotoRemoved) values.photoData = null;
    if (isDemo) currentUser = { ...currentUser, ...values, photoUrl: values.photoData === null ? '' : values.photoData || currentUser.photoUrl };
    else currentUser = (await nogalApi.request('/api/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) })).user;
    profiles = profiles.map(profile => profile.id === currentUser.id ? currentUser : profile);
    updateSessionControls(); renderRoute(); profileDialog.close();
  } catch (error) { $('profileError').textContent = error.message; $('profileError').hidden = false; }
  finally { savingProfile = false; form.inert = false; form.querySelector('button[type="submit"]').disabled = false; }
});
function updateSessionControls() {
  $('loginLink').hidden = Boolean(currentUser);
  $('logoutButton').hidden = !currentUser;
  $('favoritesLink').hidden = !currentUser; $('notificationsLink').hidden = !currentUser;
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
    renderRoute(); void refreshNotifications();
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
