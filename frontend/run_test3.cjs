const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto('http://localhost:5173/#/test', { waitUntil: 'networkidle0' });
  await page.waitForSelector('#btn-run-test');
  
  // Expose a function to take screenshot when JS wants to
  await page.exposeFunction('takeTestScreenshot', async () => {
     await page.screenshot({ path: '/Users/riteesh/.gemini/antigravity-cli/brain/b66db619-f4ea-4436-b1ad-16006611afe9/puppeteer_test_result3.png' });
     console.log('Took programmatic screenshot!');
  });
  
  await page.click('#btn-run-test');
  await new Promise(r => setTimeout(r, 10000));
  await browser.close();
})();
