// Creates an empty Flyway migration in db/migration/<module>/.
// Usage: node scripts/create-migration.mjs
// Asks for the module and a short description; the timestamp (V<AAAAMMDDHHmm>) is generated.
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

const MIGRATION_ROOT = fileURLToPath(new URL('../src/main/resources/db/migration/', import.meta.url));

const rl = createInterface({ input: process.stdin, output: process.stdout });
const moduleName = (await rl.question('Módulo (ex.: identity, portfolio): ')).trim();
const description = (await rl.question('Descrição (ex.: create access tables): ')).trim();
rl.close();

// Pasta do módulo é criada se não existir; nome só minúsculas, sem espaço nem acento.
if (!/^[a-z][a-z0-9]*$/.test(moduleName)) {
  console.error(`Módulo inválido: "${moduleName}" (use só letras minúsculas e números, ex.: identity)`);
  process.exit(1);
}

// "Criar tabelas de acesso" -> "criar_tabelas_de_acesso"; remove acentos e símbolos.
const slug = description
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
if (!slug) {
  console.error('Descrição vazia ou sem letras/números.');
  process.exit(1);
}

const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}`;

// Flyway exige versão única entre TODOS os módulos: mesmo carimbo em outra pasta quebra a subida.
const existing = readdirSync(MIGRATION_ROOT, { recursive: true });
if (existing.some((name) => name.toString().split(/[\\/]/).pop().startsWith(`V${stamp}__`))) {
  console.error(`Já existe migração com o carimbo ${stamp}. Espere 1 minuto e rode de novo.`);
  process.exit(1);
}

const dir = join(MIGRATION_ROOT, moduleName);
const file = join(dir, `V${stamp}__${moduleName}_${slug}.sql`);
if (existsSync(file)) {
  console.error(`Arquivo já existe: ${file}`);
  process.exit(1);
}

mkdirSync(dir, { recursive: true });
writeFileSync(file, `-- ${description}\n`, { flag: 'wx' });
console.log(`Criado: ${file}`);
