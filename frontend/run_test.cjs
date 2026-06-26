const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  // Set viewport
  await page.setViewport({ width: 1280, height: 800 });
  
  console.log('Navigating to test harness...');
  await page.goto('http://localhost:5173/#/test', { waitUntil: 'networkidle0' });
  
  console.log('Waiting for button...');
  await page.waitForSelector('#btn-run-test');
  
  console.log('Clicking run test...');
  await page.click('#btn-run-test');
  
  console.log('Waiting 5 seconds for ML model and rendering...');
  await new Promise(r => setTimeout(r, 5000));
  
  console.log('Taking screenshot...');
  await page.screenshot({ path: '/Users/riteesh/.gemini/antigravity-cli/brain/b66db619-f4ea-4436-b1ad-16006611afe9/puppeteer_test_result.png' });
  
  console.log('Done!');
  await browser.close();
})();
