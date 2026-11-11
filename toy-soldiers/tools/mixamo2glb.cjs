// Convert a Mixamo character and its animations into one .glb for the game.
//   1. npm run dev            (in another terminal; this script uses the dev server)
//   2. node tools/mixamo2glb.cjs [port]
// Reads assets-src/mixamo/character.(dae|fbx) and every other .fbx in that
// folder as an animation named after its file, and writes
// public/models/soldier/swat.glb (no textures: the game paints it as plastic).
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const dir = path.join(__dirname, '..', 'assets-src', 'mixamo');
const port = process.argv[2] || 5173;
(async () => {
  const files = fs.readdirSync(dir);
  const character = files.find((f) => /^character\.(dae|fbx)$/i.test(f));
  if (!character) throw new Error('Put the character at assets-src/mixamo/character.dae or character.fbx');
  const animations = files.filter((f) => /\.fbx$/i.test(f) && f !== character)
    .map((f) => [f.replace(/\.fbx$/i, '').toLowerCase().replace(/[^a-z0-9]+/g, '-'), `/assets-src/mixamo/${encodeURIComponent(f)}`]);
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('page error:', e.message));
  await page.goto(`http://localhost:${port}/tools/mixamo.html`);
  await page.waitForFunction(() => window.ready, null, { timeout: 60000 });
  const out = await page.evaluate((a) => window.convert(a), { character: `/assets-src/mixamo/${character}`, animations });
  const dest = path.join(__dirname, '..', 'public', 'models', 'soldier', 'swat.glb');
  fs.writeFileSync(dest, Buffer.from(out.base64, 'base64'));
  if (process.env.PREVIEW) await page.locator('#c').screenshot({ path: process.env.PREVIEW });
  console.log(`swat.glb: ${Math.round(fs.statSync(dest).size / 1024)} KB, ${out.tris} triangles, ${out.bones} bones, size ${out.size.map((v) => v.toFixed(2)).join(' x ')}`);
  console.log('clips:', out.clips.join(', ') || '(none yet)');
  await browser.close();
})();
