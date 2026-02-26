import { chromium } from 'playwright';

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const outDir = process.env.OUT_DIR || './screenshots';

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 1024, height: 768 },
  { name: 'mobile', width: 390, height: 844 }
];

const shots = [
  { name: 'home-top', fn: async (page) => {
      await page.goto(baseURL, { waitUntil: 'networkidle' });
      await page.waitForTimeout(250);
    }
  },
  { name: 'home-mid', fn: async (page) => {
      await page.goto(baseURL, { waitUntil: 'networkidle' });
      await page.waitForTimeout(250);
      const scroller = page.locator('.sheet-scroll');
      await scroller.evaluate((el) => {
        el.scrollLeft = 900;
        el.scrollTop = 550;
      });
      await page.waitForTimeout(250);
    }
  },
  { name: 'modal-new', fn: async (page) => {
      await page.goto(baseURL, { waitUntil: 'networkidle' });
      await page.waitForTimeout(250);
      const cell = page.locator('tbody tr:nth-child(2) td:nth-child(6)').first();
      await cell.dblclick();
      await page.waitForSelector('.modal-backdrop');
      await page.waitForTimeout(250);
    }
  },
  { name: 'modal-error-overlap', fn: async (page) => {
      await page.goto(baseURL, { waitUntil: 'networkidle' });
      await page.waitForTimeout(250);
      const cell1 = page.locator('tbody tr:nth-child(2) td:nth-child(6)').first();
      await cell1.dblclick();
      await page.waitForSelector('.modal-backdrop');
      await page.fill('input[placeholder="Guest name"]', 'Smith');
      await page.locator('.modal button.primary').click();
      await page.waitForTimeout(300);
      const cell2 = page.locator('tbody tr:nth-child(2) td:nth-child(7)').first();
      await cell2.dblclick();
      await page.waitForSelector('.modal-backdrop');
      await page.fill('input[placeholder="Guest name"]', 'Jones');
      await page.locator('.modal button.primary').click();
      await page.waitForTimeout(300);
    }
  }
];

const browser = await chromium.launch();
try {
  for (const vp of viewports) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await context.newPage();
    for (const shot of shots) {
      await shot.fn(page);
      await page.screenshot({ path: `${outDir}/${vp.name}__${shot.name}.png`, fullPage: true });
      console.log('WROTE', `${outDir}/${vp.name}__${shot.name}.png`);
    }
    await context.close();
  }
} finally {
  await browser.close();
}
