import { rmSync } from 'node:fs';
rmSync('dist/backend', { recursive: true, force: true });
