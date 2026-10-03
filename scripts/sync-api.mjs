import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const backend = resolve(process.env.BACKEND_REPO ?? '../3-course-sd-lifecycle-be');
const source = resolve(backend, 'docs/api/openapi.yaml');
const target = resolve('docs/api/openapi.yaml');

if (!existsSync(source)) {
  console.error(`Backend spec not found: ${source}. Set BACKEND_REPO to the backend checkout.`);
  process.exit(1);
}

mkdirSync(dirname(target), { recursive: true });
copyFileSync(source, target);
console.log(`Copied ${source} -> ${target}`);
