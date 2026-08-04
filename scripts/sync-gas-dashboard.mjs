import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const webDir = path.join(root, 'web');
const gasDir = path.join(root, 'gas');

const [indexHtml, styles, client] = await Promise.all([
  fs.readFile(path.join(webDir, 'index.html'), 'utf8'),
  fs.readFile(path.join(webDir, 'styles.css'), 'utf8'),
  fs.readFile(path.join(webDir, 'app.js'), 'utf8')
]);

const dashboard = indexHtml
  .replace('<meta charset="utf-8">', '<meta charset="utf-8">\n  <base target="_top">')
  .replace('<link rel="icon" href="favicon.svg" type="image/svg+xml">', '')
  .replace('<link rel="stylesheet" href="styles.css">', '<?!= include_(\'Styles\'); ?>')
  .replace('  <script src="app-config.js"></script>\n  <script src="app.js"></script>', [
    '  <script>window.APP_CONFIG = { dataMode: \'gas\', deadlineDays: 7, limitedSeatsThreshold: 20 };</script>',
    '  <?!= include_(\'Client\'); ?>'
  ].join('\n'));

await Promise.all([
  fs.writeFile(path.join(gasDir, 'Dashboard.html'), dashboard),
  fs.writeFile(path.join(gasDir, 'Styles.html'), `<style>\n${styles}</style>\n`),
  fs.writeFile(path.join(gasDir, 'Client.html'), `<script>\n${client}</script>\n`)
]);

console.log('gas dashboard synced from web/');
