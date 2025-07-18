import { OpenElectricityClient } from 'openelectricity';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.local') });

const client = new OpenElectricityClient({
  apiKey: process.env.OPENELECTRICITY_API_KEY,
  baseUrl: process.env.OPENELECTRICITY_API_URL || 'https://api.openelectricity.org.au'
});

async function checkLastDate() {
  try {
    // Make the same request as our app
    const response = await fetch('http://localhost:3001/api/coal-stripes?days=365');
    const data = await response.json();
    
    console.log('API Response:');
    console.log(`Date start: ${data.actualDateStart}`);
    console.log(`Date end: ${data.actualDateEnd}`);
    console.log(`Total days: ${data.dates.length}`);
    console.log(`First date: ${data.dates[0]}`);
    console.log(`Last date: ${data.dates[data.dates.length - 1]}`);
    
    // Check what the date range header should show
    const formatDateRange = (startDate, endDate) => {
      const start = new Date(startDate + 'T00:00:00+10:00');
      const end = new Date(endDate + 'T00:00:00+10:00');
      
      const startFormatted = start.toLocaleDateString('en-AU', { 
        day: 'numeric',
        month: 'long', 
        year: 'numeric',
        timeZone: 'Australia/Brisbane'
      });
      
      const endFormatted = end.toLocaleDateString('en-AU', { 
        day: 'numeric',
        month: 'long', 
        year: 'numeric',
        timeZone: 'Australia/Brisbane'
      });
      
      return `${startFormatted} – ${endFormatted}`;
    };
    
    const formatTooltipDate = (dateStr) => {
      const date = new Date(dateStr + 'T00:00:00+10:00');
      return date.toLocaleDateString('en-AU', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric',
        timeZone: 'Australia/Brisbane'
      });
    };
    
    console.log('\nFormatted dates:');
    console.log(`Header range (fixed): ${formatDateRange(data.dates[0], data.dates[data.dates.length - 1])}`);
    console.log(`Last tooltip date: ${formatTooltipDate(data.dates[data.dates.length - 1])}`);
    
    console.log('\nFixed:');
    console.log(`Both header and tooltip now use the actual date range from the data array`);
    console.log(`First date: ${data.dates[0]}`);
    console.log(`Last date: ${data.dates[data.dates.length - 1]}`);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkLastDate();