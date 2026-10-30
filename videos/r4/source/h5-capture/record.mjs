import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const BASE = 'http://127.0.0.1:4318';
const OUT = path.resolve('videos/r4/source/h5-capture');
const FRAMES = path.join(OUT, 'frames');
fs.rmSync(FRAMES, { recursive: true, force: true });
fs.mkdirSync(FRAMES, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'],
});
const page = await browser.newPage();
await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
page.setDefaultTimeout(90000);
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await page.goto(`${BASE}/#/pages/import/index`, { waitUntil: 'networkidle0' });
await sleep(900);
const client = await page.createCDPSession();
const frames = [];
const scenes = [];
const started = Date.now();
let n = 0;
const mark = (name) => {
  const t = Date.now() - started;
  scenes.push({ name, t });
  console.log('MARK', name, (t / 1000).toFixed(2));
};
await client.send('Page.startScreencast', {
  format: 'jpeg', quality: 90, maxWidth: 750, maxHeight: 1624, everyNthFrame: 2,
});
client.on('Page.screencastFrame', async (frame) => {
  n += 1;
  const file = `f_${String(n).padStart(5, '0')}.jpg`;
  frames.push({ file, t: Date.now() - started });
  try { fs.writeFileSync(path.join(FRAMES, file), Buffer.from(frame.data, 'base64')); } catch {}
  try { await client.send('Page.screencastFrameAck', { sessionId: frame.sessionId }); } catch {}
});

try {
  mark('import');
  await sleep(1200);
  // choose a real screenshot
  const [fc] = await Promise.all([
    page.waitForFileChooser({ timeout: 8000 }),
    page.evaluate(() => document.querySelector('.upload')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))),
  ]);
  await fc.accept([path.resolve('acceptance/images/07-chat-conflict.png')]);
  await sleep(1800);
  mark('screenshot');
  await sleep(1000);
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('taro-button-core,button,.btn')].find((n) => (n.textContent || '').includes('开始整理'));
    el?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  mark('analyze');
  await page.waitForFunction(() => location.hash.includes('/pages/review/index'), { timeout: 120000 });
  await sleep(1400);
  mark('review');
  await sleep(1200);

  // expand the due-conflict task's source and risk
  await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.review-task')];
    rows[1]?.querySelector('.expand-link')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await sleep(1800);
  mark('risk');
  await sleep(1000);

  // open the unassigned venue task and make a real review edit
  await page.evaluate(() => {
    const heads = [...document.querySelectorAll('.review-task-head')];
    heads[2]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await sleep(700);
  await page.evaluate(() => {
    const inputs = [...document.querySelectorAll('.sheet-panel .field-input')];
    const owner = inputs.find((i) => i.placeholder === '未指派');
    const due = inputs.find((i) => i.placeholder === '例如：周五');
    if (owner) owner.id = '__owner';
    if (due) due.id = '__due';
  });
  if (await page.$('#__owner')) {
    await page.click('#__owner');
    await page.keyboard.down('Meta'); await page.keyboard.press('a'); await page.keyboard.up('Meta');
    await page.keyboard.type('陈默');
  }
  if (await page.$('#__due')) {
    await page.click('#__due');
    await page.keyboard.down('Meta'); await page.keyboard.press('a'); await page.keyboard.up('Meta');
    await page.keyboard.type('11月2日前');
  }
  await sleep(700);
  await page.evaluate(() => document.querySelector('.sheet-save')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await sleep(1300);
  mark('edited');
  await sleep(600);
  await page.evaluate(() => document.querySelector('.bottom-btn')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await page.waitForFunction(() => location.hash.includes('/pages/tasks/index'), { timeout: 30000 });
  await sleep(1300);
  mark('tasks');
  await sleep(1200);
  await page.evaluate(() => document.querySelector('.task-row:not(.is-done) .check')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await sleep(1500);
  mark('done');
  await sleep(900);
  // show the risk hint briefly without changing data
  await page.evaluate(() => document.querySelector('.task-risks .risk-hint')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await sleep(1200);
  mark('risk_detail');
  await page.screenshot({ path: path.join(OUT, 'final-tasks.png'), fullPage: false });
  await sleep(1000);
} catch (error) {
  console.error('CAPTURE_FAILED', error.stack || error.message);
  await page.screenshot({ path: path.join(OUT, 'error.png') }).catch(() => {});
  process.exitCode = 1;
} finally {
  const end = Date.now() - started;
  try { await client.send('Page.stopScreencast'); } catch {}
  await sleep(400);
  fs.writeFileSync(path.join(OUT, 'recording.json'), JSON.stringify({ durationMs: end, frames, scenes, errors }, null, 2));
  console.log('STOP', end, n, 'frames');
  await browser.close();
}
