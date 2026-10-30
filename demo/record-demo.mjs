import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = 'http://127.0.0.1:4317';
const SCREENSHOT = path.resolve('acceptance/images/07-chat-conflict.png');
const FRAMES = path.resolve('demo/frames');
const META = path.resolve('demo/recording.json');
fs.rmSync(FRAMES, { recursive: true, force: true });
fs.mkdirSync(FRAMES, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1'],
  defaultViewport: { width: 1600, height: 900, deviceScaleFactor: 1 },
});
const page = await browser.newPage();
page.setDefaultTimeout(120000);
page.on('console', (msg) => {
  if (msg.type() === 'error') console.log('PAGE_ERR', msg.text().slice(0, 200));
});

await page.evaluateOnNewDocument(() => {
  const styleText = `
    #fb-cursor{position:fixed;left:1240px;top:640px;width:20px;height:20px;border-radius:50%;background:#C9F24E;border:2px solid #1B1C1E;box-shadow:0 0 0 7px rgba(201,242,78,.20);z-index:2147483647;pointer-events:none;transform:translate(-50%,-50%);transition:width .12s,height .12s,background .12s}
    #fb-cursor.click{width:36px;height:36px;background:rgba(201,242,78,.35)}
    #fb-caption{position:fixed;left:44px;bottom:36px;z-index:2147483646;pointer-events:none;max-width:900px;padding:19px 26px 19px 24px;border-left:4px solid #C9F24E;border-radius:12px;background:rgba(27,28,30,.94);color:#F8F6F1;font-family:"Hiragino Sans GB","PingFang SC",sans-serif;box-shadow:0 18px 50px rgba(0,0,0,.24)}
    #fb-caption .kick{font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#C9F24E;font-weight:600}
    #fb-caption .title{font-size:27px;line-height:1.28;font-weight:600;margin-top:6px}
    #fb-caption .body{font-size:15px;line-height:1.5;color:rgba(248,246,241,.65);margin-top:6px}
    #fb-progress{position:fixed;left:0;right:0;bottom:0;height:3px;background:rgba(27,28,30,.10);z-index:2147483645;pointer-events:none}
    #fb-progress i{display:block;height:100%;width:0;background:#C9F24E;transition:width .5s ease}
  `;
  const boot = () => {
    if (!document.getElementById('fb-style')) {
      const style = document.createElement('style');
      style.id = 'fb-style';
      style.textContent = styleText;
      document.head.appendChild(style);
    }
    if (!document.getElementById('fb-cursor')) {
      const cursor = document.createElement('div');
      cursor.id = 'fb-cursor';
      document.body.appendChild(cursor);
      window.addEventListener('mousemove', (e) => {
        cursor.style.left = e.clientX + 'px';
        cursor.style.top = e.clientY + 'px';
      });
      window.addEventListener('mousedown', () => cursor.classList.add('click'));
      window.addEventListener('mouseup', () => cursor.classList.remove('click'));
    }
    if (!document.getElementById('fb-caption')) {
      const cap = document.createElement('div');
      cap.id = 'fb-caption';
      cap.innerHTML = '<div class="kick"></div><div class="title"></div><div class="body"></div>';
      document.body.appendChild(cap);
    }
    if (!document.getElementById('fb-progress')) {
      const progress = document.createElement('div');
      progress.id = 'fb-progress';
      progress.innerHTML = '<i></i>';
      document.body.appendChild(progress);
    }
  };
  window.__fbBoot = boot;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  window.__fbCaption = (kick, title, body, progress) => {
    boot();
    const cap = document.getElementById('fb-caption');
    cap.querySelector('.kick').textContent = kick;
    cap.querySelector('.title').textContent = title;
    cap.querySelector('.body').textContent = body;
    document.querySelector('#fb-progress i').style.width = Math.max(0, Math.min(100, progress)) + '%';
  };
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const started = Date.now();
const scenes = [];

async function caption(kicker, title, body, progress) {
  const time = Date.now() - started;
  scenes.push({ time, kicker, title, body });
  await page.evaluate(
    (k, t, b, p) => window.__fbCaption(k, t, b, p),
    kicker,
    title,
    body,
    progress,
  );
  console.log('SCENE', Math.round(time / 1000) + 's', kicker, title);
}

async function findClickable(text, selector = 'button, a') {
  const handles = await page.$$(selector);
  for (const handle of handles) {
    const content = await handle.evaluate((el) => el.textContent.replace(/\s+/g, ''));
    if (content.includes(text.replace(/\s+/g, ''))) return handle;
  }
  return null;
}

async function moveAndClick(text, selector = 'button, a') {
  const handle = await findClickable(text, selector);
  if (!handle) {
    console.log('SKIP_CLICK', text);
    return false;
  }
  await handle.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'smooth' }));
  await sleep(450);
  const box = await handle.boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 18 });
    await sleep(250);
  }
  await handle.click();
  return true;
}

async function smoothScroll(y, wait = 900) {
  await page.evaluate((top) => window.scrollTo({ top, behavior: 'smooth' }), y);
  await sleep(wait);
}

await page.goto(BASE, { waitUntil: 'networkidle0' });
await page.evaluate(() => window.scrollTo(0, 0));
await sleep(500);

// Screencast frames are produced on visual changes; we hold the last one.
const client = await page.createCDPSession();
let frameCount = 0;
const frameTimes = [];
await client.send('Page.startScreencast', {
  format: 'jpeg',
  quality: 86,
  maxWidth: 1600,
  maxHeight: 900,
  everyNthFrame: 2,
});
client.on('Page.screencastFrame', async (frame) => {
  frameCount += 1;
  const name = `f_${String(frameCount).padStart(5, '0')}.jpg`;
  frameTimes.push({ file: name, time: Date.now() - started });
  try {
    fs.writeFileSync(path.join(FRAMES, name), Buffer.from(frame.data, 'base64'));
  } catch (error) {
    console.log('FRAME_WRITE_ERR', error.message);
  }
  try {
    await client.send('Page.screencastFrameAck', { sessionId: frame.sessionId });
  } catch {}
});

try {
  await caption('01 / IMPORT', '把聊天截图交给回响', 'AI 只产出候选；确认之后，才写入看板', 6);
  await page.mouse.move(1230, 560, { steps: 20 });
  await sleep(1000);

  await moveAndClick('上传截图');
  await sleep(900);

  const fileInput = await page.$('input[type=file]');
  if (!fileInput) throw new Error('file input not found');
  await fileInput.uploadFile(SCREENSHOT);
  await sleep(900);

  const nameInput = await page.$('input[placeholder^="可选"]');
  if (nameInput) {
    await nameInput.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'smooth' }));
    await sleep(500);
    const box = await nameInput.boundingBox();
    if (box) await page.mouse.move(box.x + 180, box.y + box.height / 2, { steps: 16 });
    await nameInput.click();
    await sleep(250);
    await page.keyboard.type('FlowBack 视频演示', { delay: 70 });
  }
  await sleep(600);
  await caption('02 / VISION', 'DeepSeek 正在读这张截图', '任务、负责人、截止时间与原文引用，一次抽取', 16);

  if (!(await moveAndClick('开始 AI 解析'))) throw new Error('analyze button not found');
  await page.waitForFunction(() => location.pathname.startsWith('/review/'), { timeout: 120000 });
  await sleep(900);

  await caption('03 / REVIEW', '原句和任务，一一对应', '每个任务都有逐字引用；风险被单独标出来', 34);
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(1400);
  await smoothScroll(720, 1200);
  await sleep(700);

  // Human edit: owner + due label on the unassigned venue task.
  await page.evaluate(() => {
    const titles = [...document.querySelectorAll('input[aria-label^="任务 "]')];
    const targetTitle =
      titles.find((el) => el.value.includes('场地')) ??
      titles.find((el) => {
        const card = el.closest('.rounded-2xl');
        const owner = card?.querySelector('input[placeholder="未指派"]');
        return Boolean(owner && !owner.value.trim());
      });
    const card = targetTitle?.closest('.rounded-2xl');
    const owner = card?.querySelector('input[placeholder="未指派"]');
    const due = card?.querySelector('input[placeholder="如 周四 / 周五前"]');
    if (owner) {
      owner.id = '__fb_owner';
      owner.scrollIntoView({ block: 'center', behavior: 'smooth' });
      window.__fbTargetTitle = targetTitle?.value ?? null;
    }
    if (due) due.id = '__fb_due';
  });
  await sleep(800);
  const ownerInput = await page.$('#__fb_owner');
  if (ownerInput) {
    const box = await ownerInput.boundingBox();
    if (box) await page.mouse.move(box.x + 120, box.y + box.height / 2, { steps: 16 });
    await ownerInput.click();
    await sleep(200);
    await page.keyboard.type('陈默', { delay: 110 });
    await sleep(600);
    await caption('04 / HUMAN CHECK', '补上负责人和日期', '草稿自动保存；确认之前，什么都不会写进看板', 50);
    const dueInput = await page.$('#__fb_due');
    if (dueInput) {
      await dueInput.click();
      await sleep(150);
      await page.keyboard.type('11月2日前', { delay: 80 });
    }
    const values = await page.evaluate(() => ({
      target: window.__fbTargetTitle,
      owner: document.getElementById('__fb_owner')?.value,
      due: document.getElementById('__fb_due')?.value,
    }));
    console.log('EDITED', values);
    await sleep(1400);
  }

  if (!(await moveAndClick('确认建立任务'))) throw new Error('confirm button not found');
  await page.waitForFunction(() => location.pathname.startsWith('/dashboard/'), { timeout: 60000 });
  await sleep(1000);

  await caption('05 / EXECUTE', '确认之后，才进入看板', '完成、进行中、待处理，一眼看清；状态变化留痕', 68);
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(1200);
  await smoothScroll(520, 900);
  await moveAndClick('开始', 'button');
  await sleep(1500);
  // Return to the top so the changed completion / in-progress stats are visible.
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await sleep(2400);

  await moveAndClick('风险中心', 'a, button');
  await page.waitForFunction(() => location.pathname.startsWith('/risks/'), { timeout: 60000 });
  await sleep(1000);
  await caption('06 / RISKS', '风险，必须能回到原文', '时间冲突、无人负责、待确认决策，都能被处理', 84);
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(900);
  await smoothScroll(260, 900);
  await moveAndClick('标记解决', 'button');
  await sleep(1300);

  await caption('07 / TRACE', '解决之后，仍然可追溯', '原文引用和处理记录都保留；刷新也不会丢', 94);
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(2200);
} catch (error) {
  console.error('RECORDING_FAILED', error.stack || error.message);
  await page.screenshot({ path: path.resolve('demo/recording-error.png') }).catch(() => {});
  process.exitCode = 1;
} finally {
  const end = Date.now() - started;
  try { await client.send('Page.stopScreencast'); } catch {}
  await sleep(500);
  fs.writeFileSync(
    META,
    JSON.stringify(
      {
        startedAt: new Date(Date.now() - end).toISOString(),
        durationMs: end,
        frames: frameTimes,
        scenes,
        finalFrameCount: frameCount,
      },
      null,
      2,
    ),
  );
  console.log('STOPPED', { durationMs: end, frames: frameCount });
  await browser.close();
}
