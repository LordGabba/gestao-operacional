const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const context = {
  console,
  setTimeout,
  clearTimeout,
  Blob,
  URL,
  localStorage: { getItem: () => null, setItem: () => {} },
  document: {
    addEventListener: () => {},
    getElementById: () => null,
    querySelectorAll: () => []
  }
};
context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync('script.js', 'utf8'), context);

assert.strictEqual(context.normalizarTempoParaSegundos('01:02:03'), 3723);
assert.strictEqual(context.normalizarTempoParaSegundos('02:30'), 150);
assert.strictEqual(context.formatarSegundosParaHHMMSS(3723), '01:02:03');
assert.strictEqual(context.normalizarData('2026-05-30T14:45:00'), '2026-05-30');
assert.strictEqual(context.calcularMediaPonderada([
  { tickets_finalizados: 1, tme_segundos: 100, tme_total_segundos: 120 },
  { tickets_finalizados: 3, tme_segundos: 300, tme_total_segundos: 360 }
], 'tme_segundos'), 300);
assert.strictEqual(context.calcularCsat([{ nota: 5 }, { nota: 4 }, { nota: 3 }, { nota: 1 }]), 50);

const mop = [
  { colaborador_nome: 'Ana', usuario_blip: 'outro', lider: 'Lider A' },
  { colaborador_nome: 'Ana', usuario_blip: 'ana.blip', lider: 'Lider Correto' }
];
assert.strictEqual(context.relacionarComMop({ colaborador_nome: 'Ana', usuario_blip: 'ana.blip' }, mop).registro.lider, 'Lider Correto');
console.log('verify-performance: OK');
