const room = document.getElementById('room');
const lampSwitch = document.getElementById('lampSwitch');
const cord = document.getElementById('cordPath');
const panel = document.getElementById('loginPanel');
const closedCard = document.getElementById('closedCard');
const status = document.getElementById('lampStatus');
// Node y Five Server (con fiveserver.config.js) atienden la API en el mismo origen.
const apiBase = '';
let isOn = false;
let drag = null;
let suppressClick = false;

function setLamp(on) {
  isOn = on;
  if (!on && panel.contains(document.activeElement)) lampSwitch.focus();
  room.classList.toggle('on', on);
  panel.inert = !on;
  panel.setAttribute('aria-hidden', String(!on));
  closedCard.setAttribute('aria-hidden', String(on));
  lampSwitch.setAttribute('aria-pressed', String(on));
  lampSwitch.setAttribute('aria-label', on ? 'Apagar lámpara y ocultar el acceso' : 'Encender lámpara y mostrar el acceso');
  status.textContent = on ? 'Lámpara encendida. El formulario de acceso está disponible.' : 'Lámpara apagada.';
}

function resetCord() {
  lampSwitch.classList.remove('dragging');
  lampSwitch.style.transform = '';
  cord.setAttribute('d', 'M 45 0 Q 45 40 45 80');
}

lampSwitch.addEventListener('pointerdown', (event) => {
  if (!event.isPrimary || event.button !== 0) return;
  suppressClick = false;
  drag = { id: event.pointerId, x: event.clientX, y: event.clientY, distance: 0, moved: false };
  lampSwitch.setPointerCapture(event.pointerId);
  lampSwitch.classList.add('dragging');
});
lampSwitch.addEventListener('pointermove', (event) => {
  if (!drag || drag.id !== event.pointerId) return;
  const x = Math.max(-28, Math.min(28, (event.clientX - drag.x) * .3));
  const y = Math.max(0, Math.min(100, (event.clientY - drag.y) * .6));
  drag.distance = y;
  drag.moved ||= Math.abs(event.clientX - drag.x) > 6 || Math.abs(event.clientY - drag.y) > 6;
  lampSwitch.style.transform = `translate(${x}px, ${y}px)`;
  cord.setAttribute('d', `M 45 0 Q ${45 + x * .35} ${40 + y * .5} ${45 + x} ${80 + y}`);
});
lampSwitch.addEventListener('pointerup', (event) => {
  if (!drag || drag.id !== event.pointerId) return;
  const pulled = drag.distance > 25;
  suppressClick = drag.moved;
  drag = null;
  resetCord();
  if (pulled) setLamp(!isOn);
});
function cancelDrag() {
  if (!drag) return;
  suppressClick = true;
  drag = null;
  resetCord();
}
lampSwitch.addEventListener('pointercancel', cancelDrag);
lampSwitch.addEventListener('lostpointercapture', cancelDrag);
lampSwitch.addEventListener('click', (event) => {
  if (suppressClick && event.detail !== 0) { suppressClick = false; return; }
  suppressClick = false;
  setLamp(!isOn);
});

const motes = document.getElementById('motes');
for (let i = 0; i < 14; i++) {
  const mote = document.createElement('span');
  mote.className = 'mote';
  mote.style.setProperty('--x', `${15 + Math.random() * 70}%`);
  mote.style.setProperty('--y', `${25 + Math.random() * 65}%`);
  mote.style.setProperty('--duration', `${5 + Math.random() * 7}s`);
  mote.style.setProperty('--delay', `${-Math.random() * 10}s`);
  motes.appendChild(mote);
}

const password = document.getElementById('password');
const togglePassword = document.getElementById('togglePassword');
togglePassword.addEventListener('click', () => {
  const show = password.type === 'password';
  password.type = show ? 'text' : 'password';
  togglePassword.setAttribute('aria-pressed', String(show));
  togglePassword.setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña');
});

document.getElementById('loginForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const message = document.getElementById('formMessage');
  const button = event.currentTarget.querySelector('button[type="submit"]');
  message.hidden = true;
  button.disabled = true;
  try {
    const result = await nogalApi.request('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: document.getElementById('email').value, password: password.value }) });
    if (!result.user?.name) throw new Error('La respuesta del servidor no es válida.');
    password.value = '';
    await nogalApi.goToGallery();
  } catch (error) {
    console.error('Error de acceso a Nogal:', { message: error.message, origin: location.origin });
    message.textContent = `No se pudo iniciar sesión: ${error.message}`;
    message.hidden = false;
  } finally { button.disabled = false; }
});
setLamp(false);


document.getElementById('exploreGallery').addEventListener('click', () => {
  location.assign('usuarios.html?demo=1');
});
nogalApi.request('/api/session')
  .then(result => { if (result?.user?.name) return nogalApi.goToGallery(); })
  .catch(() => {});
