import { mkdir, copyFile, cp } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const hostingPath = '.openai/hosting.json';

if (!existsSync(hostingPath)) {
  throw new Error('Missing .openai/hosting.json');
}

await mkdir('dist/.openai', { recursive: true });
await mkdir('dist/server', { recursive: true });
await copyFile(hostingPath, 'dist/.openai/hosting.json');
await cp('server', 'dist/server', { recursive: true, force: true });
