FROM node:24-alpine
ENV NODE_ENV=production PORT=8080 HOST=0.0.0.0
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server.js gallery-store.js azure-store.js user-accounts.js ./
COPY infra/vm/manage-users.cjs ./infra/vm/manage-users.cjs
COPY index.html login.html usuarios.html api.js login.js usuarios.js theme.js style.css gallery.css ./
COPY assets ./assets
COPY infra/vm/backup.cjs ./backup.cjs
USER node
EXPOSE 8080
CMD ["node", "server.js"]
