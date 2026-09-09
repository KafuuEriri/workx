// The macOS app menu title comes from the running bundle's CFBundleName. In dev
// that bundle is node_modules/electron/dist/Electron.app, so the menu bar says
// "Electron". Patch the dev bundle so local runs show "Workx". Packaged builds
// already use productName from package.json and do not need this.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

if (process.platform !== 'darwin') {
  process.exit(0);
}

const plist = path.join(
  process.cwd(),
  'node_modules/electron/dist/Electron.app/Contents/Info.plist',
);

if (!existsSync(plist)) {
  process.exit(0);
}

for (const key of ['CFBundleName', 'CFBundleDisplayName']) {
  try {
    execFileSync('plutil', ['-replace', key, '-string', 'Workx', plist]);
  } catch (error) {
    console.warn(`Could not set ${key} in the dev Electron bundle: ${error.message}`);
  }
}
