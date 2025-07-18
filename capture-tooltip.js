const puppeteer = require('puppeteer');

(async () => {
  console.log('🚀 Starting tooltip capture...');
  
  const browser = await puppeteer.launch({
    headless: false, // Show browser for debugging
    defaultViewport: { width: 1200, height: 800 }
  });

  const page = await browser.newPage();
  
  console.log('📱 Navigating to http://localhost:3001...');
  await page.goto('http://localhost:3001', { waitUntil: 'networkidle2' });

  // Wait for stripes to load
  console.log('⏳ Waiting for data to load...');
  await page.waitForSelector('.opennem-stripe-segment', { timeout: 30000 });
  
  // Find the last segment in the first row
  const lastSegment = await page.$('.opennem-stripe-row:first-child .opennem-stripe-segment:last-child');
  
  if (lastSegment) {
    console.log('🎯 Found last segment, hovering...');
    
    // Get the bounding box
    const box = await lastSegment.boundingBox();
    
    // Move mouse to the center of the last segment
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    
    // Wait for tooltip to appear
    await page.waitForSelector('.opennem-tooltip', { timeout: 5000 });
    
    console.log('📸 Taking screenshot with tooltip...');
    await page.screenshot({ 
      path: `output/tooltip-test-${new Date().toISOString().replace(/[:.]/g, '-')}.png`,
      fullPage: false 
    });
    
    // Get tooltip position info
    const tooltipInfo = await page.evaluate(() => {
      const tooltip = document.querySelector('.opennem-tooltip');
      const rect = tooltip.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      
      return {
        left: rect.left,
        right: rect.right,
        width: rect.width,
        viewportWidth: viewportWidth,
        distanceFromRightEdge: viewportWidth - rect.right,
        styles: window.getComputedStyle(tooltip)
      };
    });
    
    console.log('📏 Tooltip measurements:');
    console.log(`   - Width: ${tooltipInfo.width}px`);
    console.log(`   - Right edge: ${tooltipInfo.right}px`);
    console.log(`   - Viewport width: ${tooltipInfo.viewportWidth}px`);
    console.log(`   - Distance from right edge: ${tooltipInfo.distanceFromRightEdge}px`);
    
  } else {
    console.log('❌ Could not find last segment');
  }

  // Keep browser open for manual inspection
  console.log('🔍 Browser will stay open for 10 seconds for inspection...');
  await new Promise(resolve => setTimeout(resolve, 10000));
  
  await browser.close();
  console.log('✅ Done!');
})();