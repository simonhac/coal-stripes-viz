const puppeteer = require('puppeteer');

async function extractHeader() {
  console.log('🕷️  Extracting header from OpenElectricity...');
  
  let browser;
  try {
    browser = await puppeteer.launch({ 
      headless: true,
      defaultViewport: { width: 1200, height: 800 }
    });
    
    const page = await browser.newPage();
    
    console.log('📱 Loading OpenElectricity stripes page...');
    await page.goto('https://explore.openelectricity.org.au/stripes/nem/?metric=coalProportion', { 
      waitUntil: 'networkidle0',
      timeout: 60000 
    });
    
    console.log('⏳ Waiting for page to fully load...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Extract header HTML
    const headerHTML = await page.evaluate(() => {
      const header = document.querySelector('header') || document.querySelector('nav') || document.querySelector('[role="banner"]');
      if (header) {
        return header.outerHTML;
      }
      
      // Try to find anything that looks like a header
      const possibleHeaders = document.querySelectorAll('div[class*="header"], div[class*="nav"], div[class*="toolbar"]');
      if (possibleHeaders.length > 0) {
        return possibleHeaders[0].outerHTML;
      }
      
      return 'No header found';
    });
    
    console.log('📄 Header HTML:');
    console.log(headerHTML);
    
    // Also extract relevant CSS
    const headerCSS = await page.evaluate(() => {
      const styles = Array.from(document.styleSheets);
      let headerRelatedCSS = '';
      
      for (const sheet of styles) {
        try {
          const rules = Array.from(sheet.cssRules || sheet.rules || []);
          for (const rule of rules) {
            if (rule.selectorText && (
              rule.selectorText.includes('header') ||
              rule.selectorText.includes('nav') ||
              rule.selectorText.includes('toolbar') ||
              rule.selectorText.includes('logo')
            )) {
              headerRelatedCSS += rule.cssText + '\n';
            }
          }
        } catch (e) {
          // Cross-origin stylesheets can't be read
        }
      }
      
      return headerRelatedCSS;
    });
    
    console.log('\n🎨 Related CSS:');
    console.log(headerCSS);
    
    return { headerHTML, headerCSS };
    
  } catch (error) {
    console.error('❌ Error extracting header:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run the extraction
extractHeader()
  .then(({ headerHTML, headerCSS }) => {
    console.log('\n✅ Header extraction completed');
  })
  .catch(error => {
    console.error('💥 Header extraction failed:', error);
    process.exit(1);
  });