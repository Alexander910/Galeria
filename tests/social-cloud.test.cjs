const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');

test('Azure Tables conserva corazones y comentarios concurrentes al editar una obra', async () => {
  let document = { id: 'work', kind: 'artwork', title: 'Original', likedBy: [], comments: [] };
  let version = 1;
  let conflicts = 0;
  class TableClient {
    async getEntity() {
      if (!document) throw { statusCode: 404 };
      return { payload: JSON.stringify(document), etag: String(version) };
    }
    async updateEntity(entity, mode, options) {
      assert.equal(mode, 'Replace');
      if (!document) throw { statusCode: 404 };
      if (options.etag !== String(version)) { conflicts++; throw { statusCode: 412 }; }
      document = JSON.parse(entity.payload); version++;
    }
  }
  const file = path.join(__dirname, '..', 'azure-store.js');
  const nativeRequire = createRequire(file);
  const context = { module: { exports: {} }, process: { env: { TABLE_ENDPOINT: 'https://example.invalid' } }, require: name => name === '@azure/data-tables' ? { TableClient } : nativeRequire(name) };
  vm.runInNewContext(fs.readFileSync(file, 'utf8') + '\ndatabase = tableDatabase({});', context);
  const azure = context.module.exports;
  await Promise.all([
    azure.updateArtwork('work', current => ({ ...current, likedBy: [...current.likedBy, 'alice'] })),
    azure.updateArtwork('work', current => ({ ...current, likedBy: [...current.likedBy, 'bob'] })),
    azure.updateArtwork('work', current => ({ ...current, comments: [...current.comments, { id: 'comment', text: 'Hermoso' }] })),
    azure.saveWork({ id: 'work', title: 'Editado', likedBy: [], comments: [] }, null, null, { id: 'work' }),
  ]);
  assert.equal(document.title, 'Editado');
  assert.deepEqual(document.likedBy.sort(), ['alice', 'bob']);
  assert.equal(document.comments[0].text, 'Hermoso');
  assert.ok(conflicts > 0);
  assert.equal('_etag' in document, false);
  document = null;
  await assert.rejects(azure.updateArtwork('work', current => current), error => error.status === 404);
});
