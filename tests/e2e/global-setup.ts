import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const SESSION_DIR = path.resolve(PROJECT_ROOT, 'playwright', '.auth');

async function globalSetup(): Promise<void> {
  fs.mkdirSync(SESSION_DIR, { recursive: true });
}

export default globalSetup;
