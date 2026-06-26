const fs = require('fs');
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setContent(`
    <img id="img" src="data:image/png;base64,${fs.readFileSync('public/test_hand.png', 'base64')}" />
  `);
  const dimensions = await page.evaluate(() => {
    const img = document.getElementById('img');
    return { width: img.width, height: img.height };
  });
  console.log(dimensions);
  await browser.close();
})();
