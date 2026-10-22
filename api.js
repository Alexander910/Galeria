// Localiza la API antes de enviar credenciales. Las vistas estáticas pueden usar otro puerto.
(() => {
  let connection;
  async function locate() {
    const origins = [location.origin];
    if (['127.0.0.1', 'localhost'].includes(location.hostname)) {
      origins.push(`http://${location.hostname}:4173`);
    }
    for (const origin of new Set(origins)) {
      try {
        const response = await fetch(`${origin}/api/health`, { credentials: 'include', cache: 'no-store', signal: AbortSignal.timeout(4000) });
        if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
          const result = await response.json();
          if (result.service === 'nogal-api') return origin;
        }
      } catch { /* probar el servidor Node local */ }
    }
    throw new Error('No se encontró la API de Nogal. Inicia node server.js en Proyecto y abre http://127.0.0.1:4173/login.html.');
  }
  window.nogalApi = {
    async origin() {
      if (!connection) connection = locate().catch(error => { connection = null; throw error; });
      return connection;
    },
    async request(route, options = {}) {
      const origin = await this.origin();
      const response = await fetch(`${origin}${route}`, { ...options, credentials: 'include', cache: 'no-store' });
      if (!response.headers.get('content-type')?.includes('application/json')) throw new Error(`Respuesta inválida de la API (HTTP ${response.status}).`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `La solicitud falló (HTTP ${response.status}).`);
      return result;
    },
    async goToGallery() {
      location.assign(new URL('/usuarios.html', await this.origin()).href);
    },
  };
})();
