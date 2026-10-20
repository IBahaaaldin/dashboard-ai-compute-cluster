const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

(async () => {
  const dir = __dirname;
  const fileUrl = 'file://' + path.join(dir, 'index.html');
  const tempDir = path.join(dir, '.temp_record');
  if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
  fs.mkdirSync(tempDir, { recursive: true });

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--enable-webgl', '--use-gl=angle', '--use-angle=metal']
  });

  const injectCursor = async (page) => {
    await page.addStyleTag({
      content: `
        .custom-cursor {
          position: fixed;
          top: 0; left: 0;
          width: 20px; height: 20px;
          border-radius: 50%;
          background: rgba(16, 185, 129, 0.45);
          border: 2px solid rgba(255, 255, 255, 0.95);
          box-shadow: 0 0 16px rgba(16, 185, 129, 0.8), 0 0 24px rgba(6, 78, 59, 0.5);
          pointer-events: none;
          z-index: 999999;
          transform: translate(-50%, -50%);
          transition: transform 0.08s ease;
        }
        .custom-cursor.clicking {
          transform: translate(-50%, -50%) scale(0.75);
          background: rgba(6, 78, 59, 0.9);
        }
      `
    });
    await page.evaluate(() => {
      const cursor = document.createElement('div');
      cursor.className = 'custom-cursor';
      document.body.appendChild(cursor);
      window.addEventListener('mousemove', e => {
        cursor.style.left = e.clientX + 'px';
        cursor.style.top = e.clientY + 'px';
      });
      window.addEventListener('mousedown', () => cursor.classList.add('clicking'));
      window.addEventListener('mouseup', () => cursor.classList.remove('clicking'));
    });
  };

  // ==========================================
  // 1. DESKTOP RECORDING (1200x900)
  // ==========================================
  console.log('--- [Dashboard 01] Recording Desktop Version ---');
  const desktopVideoDir = path.join(tempDir, 'desktop');
  fs.mkdirSync(desktopVideoDir);

  const desktopContext = await browser.newContext({
    viewport: { width: 1200, height: 900 },
    deviceScaleFactor: 2,
    recordVideo: { dir: desktopVideoDir, size: { width: 1200, height: 900 } }
  });

  const dPage = await desktopContext.newPage();
  await dPage.goto(fileUrl, { waitUntil: 'commit' });
  await dPage.waitForSelector('#timeTrackerDisplay', { timeout: 10000 });
  await dPage.waitForTimeout(800);

  // Take Desktop Screenshot (2400x1800 @ 2x)
  await dPage.screenshot({ path: path.join(dir, 'screenshot-desktop.png') });
  console.log('Saved screenshot-desktop.png (2400x1800)');

  await injectCursor(dPage);
  await dPage.mouse.move(600, 450);
  await dPage.waitForTimeout(300);

  // Hover over Top 4 Metric Cards
  const cards = await dPage.$$('.bento-card');
  for (let i = 0; i < Math.min(4, cards.length); i++) {
    const box = await cards[i].boundingBox();
    if (box) {
      await dPage.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 10 });
      await dPage.waitForTimeout(220);
    }
  }

  // Hover across Analytics Bar Chart days (S, M, T, W, T, F, S)
  const barElements = await dPage.$$('[data-val]');
  for (const bar of barElements) {
    const bBox = await bar.boundingBox();
    if (bBox) {
      await dPage.mouse.move(bBox.x + bBox.width / 2, bBox.y + bBox.height / 2, { steps: 8 });
      await dPage.waitForTimeout(200);
    }
  }

  // Click "Start Meeting"
  const meetingBtn = await dPage.$('#startMeetingBtn');
  if (meetingBtn) {
    const mBox = await meetingBtn.boundingBox();
    if (mBox) {
      await dPage.mouse.move(mBox.x + mBox.width / 2, mBox.y + mBox.height / 2, { steps: 12 });
      await dPage.waitForTimeout(150);
      await dPage.mouse.down();
      await dPage.waitForTimeout(100);
      await dPage.mouse.up();
      await dPage.waitForTimeout(600);
    }
  }

  // Interact with Time Tracker: Click Pause, then Play
  const timerToggleBtn = await dPage.$('#timerToggleBtn');
  if (timerToggleBtn) {
    const tBox = await timerToggleBtn.boundingBox();
    if (tBox) {
      await dPage.mouse.move(tBox.x + tBox.width / 2, tBox.y + tBox.height / 2, { steps: 12 });
      await dPage.waitForTimeout(150);
      await dPage.mouse.down();
      await dPage.waitForTimeout(100);
      await dPage.mouse.up();
      await dPage.waitForTimeout(400);

      // Click Resume
      await dPage.mouse.down();
      await dPage.waitForTimeout(100);
      await dPage.mouse.up();
      await dPage.waitForTimeout(500);
    }
  }

  // Toggle Theme (Switch to Dark Obsidian Mode)
  const themeBtn = await dPage.$('#themeToggleBtn');
  if (themeBtn) {
    const thBox = await themeBtn.boundingBox();
    if (thBox) {
      await dPage.mouse.move(thBox.x + thBox.width / 2, thBox.y + thBox.height / 2, { steps: 12 });
      await dPage.waitForTimeout(150);
      await dPage.mouse.down();
      await dPage.waitForTimeout(100);
      await dPage.mouse.up();
      await dPage.waitForTimeout(800); // Admire dark mode
    }
  }

  // Switch back to Light Mode
  if (themeBtn) {
    const thBox = await themeBtn.boundingBox();
    if (thBox) {
      await dPage.mouse.move(thBox.x + thBox.width / 2, thBox.y + thBox.height / 2, { steps: 10 });
      await dPage.mouse.down();
      await dPage.waitForTimeout(100);
      await dPage.mouse.up();
      await dPage.waitForTimeout(600);
    }
  }

  await dPage.close();
  await desktopContext.close();

  // Convert desktop video
  const dVideos = fs.readdirSync(desktopVideoDir).filter(f => f.endsWith('.webm'));
  if (dVideos.length > 0) {
    execSync(`ffmpeg -y -i "${path.join(desktopVideoDir, dVideos[0])}" -c:v libx264 -pix_fmt yuv420p -r 30 -b:v 3M "${path.join(dir, 'video-desktop.mp4')}"`);
    console.log('Saved video-desktop.mp4 (1200x900 @ 30fps)');
  }

  // ==========================================
  // 2. MOBILE RECORDING (390x844)
  // ==========================================
  console.log('--- [Dashboard 01] Recording Mobile Version ---');
  const mobileVideoDir = path.join(tempDir, 'mobile');
  fs.mkdirSync(mobileVideoDir);

  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    recordVideo: { dir: mobileVideoDir, size: { width: 390, height: 844 } }
  });

  const mPage = await mobileContext.newPage();
  await mPage.goto(fileUrl, { waitUntil: 'commit' });
  await mPage.waitForSelector('#mobileMenuOpenBtn', { timeout: 10000 });
  await mPage.waitForTimeout(800);

  // Take Mobile Screenshot (780x1688 @ 2x)
  await mPage.screenshot({ path: path.join(dir, 'screenshot-mobile.png') });
  console.log('Saved screenshot-mobile.png (780x1688)');

  await injectCursor(mPage);
  await mPage.mouse.move(195, 200);
  await mPage.waitForTimeout(300);

  // Scroll down slightly to view metric cards and widgets
  await mPage.evaluate(() => window.scrollBy({ top: 220, behavior: 'smooth' }));
  await mPage.waitForTimeout(600);

  // Open Mobile Slide-in Sidebar Sheet
  const mMenuBtn = await mPage.$('#mobileMenuOpenBtn');
  if (mMenuBtn) {
    const box = await mMenuBtn.boundingBox();
    if (box) {
      await mPage.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 12 });
      await mPage.waitForTimeout(150);
      await mPage.mouse.down();
      await mPage.waitForTimeout(100);
      await mPage.mouse.up();
      await mPage.waitForTimeout(800); // Sidebar opened
    }
  }

  // Close Mobile Sidebar Sheet
  const mCloseBtn = await mPage.$('#mobileMenuCloseBtn');
  if (mCloseBtn) {
    const cBox = await mCloseBtn.boundingBox();
    if (cBox) {
      await mPage.mouse.move(cBox.x + cBox.width / 2, cBox.y + cBox.height / 2, { steps: 12 });
      await mPage.waitForTimeout(150);
      await mPage.mouse.down();
      await mPage.waitForTimeout(100);
      await mPage.mouse.up();
      await mPage.waitForTimeout(600);
    }
  }

  await mPage.close();
  await mobileContext.close();
  await browser.close();

  // Convert mobile video
  const mVideos = fs.readdirSync(mobileVideoDir).filter(f => f.endsWith('.webm'));
  if (mVideos.length > 0) {
    execSync(`ffmpeg -y -i "${path.join(mobileVideoDir, mVideos[0])}" -c:v libx264 -pix_fmt yuv420p -r 30 -b:v 2M "${path.join(dir, 'video-mobile.mp4')}"`);
    console.log('Saved video-mobile.mp4 (390x844 @ 30fps)');
  }

  fs.rmSync(tempDir, { recursive: true, force: true });
  console.log('✅ Dashboard 01 Desktop & Mobile assets recorded successfully!');
})();
