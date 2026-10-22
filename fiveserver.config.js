const { handle, ready } = require('./server');

// Five Server carga este archivo al iniciarse desde la carpeta Proyecto.
module.exports = {
  host: '127.0.0.1',
  port: 5500,
  root: __dirname,
  open: '/login.html',
  injectBody: false,
  remoteLogs: true,
  ignore: ['data/**', '**/*-preview.png'],
  middleware: [
    (request, response, next) => {
      const pathname = request.url.split('?')[0];
      // Los datos y el código del servidor no se sirven como archivos estáticos.
      if (/^\/(?:data(?:\/|$)|server\.js$|fiveserver\.config\.js$|PRUEBAS\.txt$|\.git)/i.test(pathname)) {
        response.writeHead(404);
        return response.end();
      }
      if (!pathname.startsWith('/api/') && !['/', '/index.html', '/login.html', '/usuarios.html'].includes(pathname)) return next();
      ready.then(() => handle(request, response)).catch(error => {
        console.error('Nogal: fallo de la API integrada:', error.message);
        if (!response.headersSent) response.writeHead(500, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        response.end(JSON.stringify({ error: 'No se pudo iniciar el servidor de acceso.' }));
      });
    },
  ],
};
