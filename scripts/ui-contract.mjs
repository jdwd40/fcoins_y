import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

assert.match(app, /CoinX/);
assert.match(app, /Virtual GBP/);
assert.match(app, /Market Overview/);
assert.match(app, /Markets/);
assert.match(styles, /--accent:\s*#7132f5/);
assert.match(styles, /font-family:\s*'Inter'/);
assert.doesNotMatch(styles, /fractalNoise/);
assert.match(html, /<title>CoinX Virtual Exchange<\/title>/);
assert.match(html, /family=Inter/);

console.log('Crypto exchange UI contract passed');
