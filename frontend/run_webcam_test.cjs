const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  console.log("Launching Puppeteer with fake webcam...");
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--use-file-for-fake-video-capture=/Users/riteesh/documents/Windsurf/Aura-ring-AR/frontend/public/test-ring-hand.jpg'
    ]
  });

  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));

  console.log("Navigating to http://localhost:5173/#/shop ...");
  
  await page.goto('http://localhost:5173/#/shop');

  await new Promise(r => setTimeout(r, 2000));

  await page.evaluate(() => {
     // Find the Target Finger Try-on button. It might be AR Try-on.
     const btn = document.getElementById('btn-camera-trigger') || document.querySelector('.btn-primary');
     if (btn) {
         console.log("Clicking button: " + btn.innerText);
         btn.click();
     } else {
         console.log("Could not find start button.");
     }
  });

  await new Promise(r => setTimeout(r, 5000));

  const videoInfo = await page.evaluate(() => {
    const video = document.getElementById('webcam-source');
    if (!video) return 'No video element found';
    return {
      clientWidth: video.clientWidth,
      clientHeight: video.clientHeight,
      videoWidth: video.videoWidth,
      videoHeight: video.videoHeight,
      readyState: video.readyState,
      paused: video.paused,
      style: video.getAttribute('style'),
      srcObject: !!video.srcObject,
      bounds: video.getBoundingClientRect(),
      containerHtml: video.parentElement ? video.parentElement.innerHTML : ''
    };
  });
  console.log("Video Info:", videoInfo);

  await page.screenshot({ path: 'puppeteer_webcam_test2.png', fullPage: true });
  console.log("Took screenshot puppeteer_webcam_test2.png!");
  
  await browser.close();
  console.log("Done.");
})();
