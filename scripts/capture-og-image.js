const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Set viewport to OpenGraph recommended dimensions
  // We'll capture a taller area and crop it
  await page.setViewport({
    width: 1200,
    height: 1200, // Taller to capture content, will clip to 630
    deviceScaleFactor: 2 // Higher quality
  });
  
  console.log('Navigating to stripes.energy...');
  await page.goto('https://stripes.energy', {
    waitUntil: 'networkidle2',
    timeout: 30000
  });
  
  // Wait for the stripes to render
  await page.waitForSelector('.opennem-region-header', { timeout: 10000 });
  
  // Wait a bit more for animations to settle
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Find the NSW section and get its bottom position
  const nswSectionBottom = await page.evaluate(() => {
    const regions = document.querySelectorAll('.opennem-region');
    if (regions.length > 0) {
      const firstRegion = regions[0];
      const rect = firstRegion.getBoundingClientRect();
      // Add a bit of padding below the NSW section
      return rect.bottom + 20;
    }
    return 630; // Fallback to standard OG height
  });
  
  // Capture screenshot with proper OpenGraph dimensions
  await page.screenshot({
    path: 'public/og-image.png',
    clip: {
      x: 0,
      y: 0,
      width: 1200,
      height: Math.min(nswSectionBottom, 630) // Cap at standard OG height
    }
  });
  
  console.log(`✅ OpenGraph image saved to public/og-image.png (1200x${Math.min(nswSectionBottom, 630)})`);
  
  await browser.close();
})().catch(error => {
  console.error('Error capturing screenshot:', error);
  process.exit(1);
});