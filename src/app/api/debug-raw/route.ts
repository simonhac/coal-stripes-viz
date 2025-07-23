import { NextResponse } from 'next/server';
import { OpenElectricityClient } from 'openelectricity';
import fs from 'fs/promises';
import path from 'path';

export async function GET() {
  try {
    const apiKey = process.env.OPENELECTRICITY_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    const client = new OpenElectricityClient({ apiKey });
    
    console.log('Fetching Bayswater data for July 21-25, 2025...');
    
    const response = await client.getFacilityData(
      'NEM',
      ['BAYSW'],
      ['energy'],
      {
        interval: '1d',
        dateStart: '2025-07-21',
        dateEnd: '2025-07-26' // API treats end as exclusive
      }
    );
    
    // Prepare the output
    const output = {
      fetchedAt: new Date().toISOString(),
      fetchedAtBrisbane: new Date().toLocaleString('en-AU', { timeZone: 'Australia/Brisbane' }),
      request: {
        network: 'NEM',
        facility: 'BAYSW',
        metrics: ['energy'],
        dateStart: '2025-07-21',
        dateEnd: '2025-07-26'
      },
      rawResponse: response
    };
    
    // Save to file
    const filePath = path.join(process.cwd(), 'oe-raw-response.json');
    await fs.writeFile(filePath, JSON.stringify(output, null, 2));
    
    // Also create a simplified view
    const simplified: any[] = [];
    if (response.datatable?.rows) {
      response.datatable.rows.forEach((row: any) => {
        const dateValue = row.interval || row.date || row.period;
        const dateStr = dateValue instanceof Date ? 
          dateValue.toISOString() : 
          dateValue;
          
        simplified.push({
          unit: row.unit_code || row.code || row.duid,
          date: dateStr,
          date_parsed: dateStr ? new Date(dateStr).toLocaleDateString('en-AU', { timeZone: 'Australia/Brisbane' }) : null,
          energy_MWh: row.energy,
          capacity_MW: row.unit_capacity || row.capacity || 660,
          calculated_CF: row.energy !== null ? 
            Math.round((row.energy / 24) / 660 * 100 * 10) / 10 : null,
          raw_row: row
        });
      });
      
      // Sort by unit and date
      simplified.sort((a, b) => {
        const unitCmp = (a.unit || '').localeCompare(b.unit || '');
        if (unitCmp !== 0) return unitCmp;
        return (a.date || '').localeCompare(b.date || '');
      });
    }
    
    const simplifiedPath = path.join(process.cwd(), 'oe-simplified.json');
    await fs.writeFile(simplifiedPath, JSON.stringify(simplified, null, 2));
    
    return NextResponse.json({
      message: 'Raw data saved to files',
      files: ['oe-raw-response.json', 'oe-simplified.json'],
      summary: {
        rowCount: response.datatable?.rows?.length || 0,
        firstRow: response.datatable?.rows?.[0],
        lastRow: response.datatable?.rows?.slice(-1)[0]
      }
    });
    
  } catch (error) {
    console.error('Error fetching data:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}