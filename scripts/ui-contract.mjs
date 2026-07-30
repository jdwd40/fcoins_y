import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const chart = readFileSync(new URL('../src/components/PriceChart.tsx', import.meta.url), 'utf8');

assert.match(app, /CoinX/);
assert.match(app, /Virtual GBP/);
assert.match(app, /Market Overview/);
assert.match(app, /Markets/);
assert.match(styles, /--accent:\s*#7132f5/);
assert.match(styles, /font-family:\s*'Inter'/);
assert.doesNotMatch(styles, /fractalNoise/);
assert.match(html, /<title>CoinX Virtual Exchange<\/title>/);
assert.match(html, /family=Inter/);

assert.match(chart, /24H/);
assert.match(chart, /7D/);
assert.match(chart, /30D/);
assert.match(chart, /ALL/);
assert.match(chart, /aria-pressed/);
assert.match(chart, /role="group"/);
console.log('Crypto exchange UI contract passed');
