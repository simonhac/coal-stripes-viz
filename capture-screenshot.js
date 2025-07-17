const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function captureScreenshot() {
  console.log('🚀 Starting screenshot capture...');
  
  let browser;
  try {
    browser = await puppeteer.launch({ 
      headless: true,
      defaultViewport: { width: 1200, height: 800 }
    });
    
    const page = await browser.newPage();
    
    console.log('📱 Navigating to http://localhost:3000...');
    await page.goto('http://localhost:3000', { 
      waitUntil: 'networkidle0',
      timeout: 60000 
    });
    
    console.log('⏳ Waiting for data to load...');
    // Wait for the stripes to load (look for region headers)
    try {
      await page.waitForSelector('.opennem-region-header', { timeout: 30000 });
      console.log('✅ Coal stripes data loaded!');
    } catch (e) {
      console.log('⚠️  Stripes not loaded yet, taking screenshot anyway...');
    }
    
    // Wait a bit more for any animations
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('📸 Taking screenshot...');
    const outputDir = path.join(__dirname, 'output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }
    
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
    const screenshotPath = path.join(outputDir, `coal-stripes-screenshot-${timestamp}.png`);
    
    await page.screenshot({ 
      path: screenshotPath,
      fullPage: true
    });
    
    console.log(`✅ Screenshot saved to: ${screenshotPath}`);
    
    // Also get page title and some basic info
    const title = await page.title();
    const url = page.url();
    
    console.log(`📄 Page title: ${title}`);
    console.log(`🔗 URL: ${url}`);
    
    // Check if we can see the main elements
    const hasHeader = await page.$('.opennem-header') !== null;
    const hasStripes = await page.$('.opennem-stripes-viz') !== null;
    const hasRegions = await page.$$('.opennem-region');
    
    console.log(`🔍 Analysis:`);
    console.log(`   - Header present: ${hasHeader}`);
    console.log(`   - Stripes container present: ${hasStripes}`);
    console.log(`   - Number of regions: ${hasRegions.length}`);
    
    return screenshotPath;
    
  } catch (error) {
    console.error('❌ Error capturing screenshot:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run the screenshot capture
captureScreenshot()
  .then(path => {
    console.log(`🎉 Screenshot capture completed: ${path}`);
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Screenshot capture failed:', error);
    process.exit(1);
  });