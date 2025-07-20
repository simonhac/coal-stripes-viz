import { CoalDataService } from '../coal-data-service';
import { parseDate } from '@internationalized/date';

// Mock the OpenElectricityClient with units from different networks and regions
jest.mock('openelectricity', () => ({
  OpenElectricityClient: jest.fn().mockImplementation(() => ({
    getFacilities: jest.fn().mockResolvedValue({
      response: {
        data: [
          // WEM facilities (should come last)
          {
            code: 'COLLIE',
            name: 'Collie',
            network_region: 'WEM',
            units: [{
              code: 'COLLIE_G1',
              fueltech_id: 'coal_black',
              capacity_registered: 340,
              status_id: 'operating'
            }]
          },
          // NSW facilities (NEM)
          {
            code: 'BAYSW',
            name: 'Bayswater',
            network_region: 'NSW1',
            units: [
              {
                code: 'BW02',
                fueltech_id: 'coal_black',
                capacity_registered: 660,
                status_id: 'operating'
              },
              {
                code: 'BW01',
                fueltech_id: 'coal_black',
                capacity_registered: 660,
                status_id: 'operating'
              }
            ]
          },
          // QLD facilities (NEM)
          {
            code: 'CALLIDE',
            name: 'Callide',
            network_region: 'QLD1',
            units: [{
              code: 'CALL_B_1',
              fueltech_id: 'coal_black',
              capacity_registered: 350,
              status_id: 'operating'
            }]
          },
          // VIC facilities (NEM)
          {
            code: 'YWPS',
            name: 'Yallourn',
            network_region: 'VIC1',
            units: [{
              code: 'YWPS1',
              fueltech_id: 'coal_brown',
              capacity_registered: 360,
              status_id: 'operating'
            }]
          },
          // Another NSW facility to test facility sorting within region
          {
            code: 'ERARING',
            name: 'Eraring',
            network_region: 'NSW1',
            units: [{
              code: 'ER01',
              fueltech_id: 'coal_black',
              capacity_registered: 720,
              status_id: 'operating'
            }]
          }
        ]
      }
    }),
    getFacilityData: jest.fn().mockImplementation(() => {
      // Return minimal data
      return Promise.resolve({
        datatable: {
          rows: [{
            interval: new Date('2023-01-01T00:00:00+10:00'),
            facility_code: 'TEST',
            unit_code: 'TEST01',
            energy: 5000
          }]
        }
      });
    })
  }))
}));

describe('Unit Sorting', () => {
  let service: CoalDataService;
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    service = new CoalDataService('test-api-key');
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(async () => {
    consoleSpy.mockRestore();
    jest.clearAllMocks();
    await new Promise(resolve => setImmediate(resolve));
  });

  test('should sort units by network, region, facility, then duid', async () => {
    const result = await service.getCoalStripesDataRange(
      parseDate('2023-01-01'),
      parseDate('2023-01-01')
    );

    // Extract the unit order for verification
    const unitOrder = result.data.map(u => ({
      network: u.network,
      region: u.region || 'WEM',
      facility: u.facility_name,
      duid: u.duid
    }));

    console.log('\nUnit sorting order:');
    unitOrder.forEach((u, i) => {
      console.log(`${i + 1}. ${u.network} | ${u.region} | ${u.facility} | ${u.duid}`);
    });

    // Verify the expected order
    expect(unitOrder).toEqual([
      // NEM units first (sorted by region, facility, duid)
      { network: 'nem', region: 'NSW1', facility: 'Bayswater', duid: 'BW01' },
      { network: 'nem', region: 'NSW1', facility: 'Bayswater', duid: 'BW02' },
      { network: 'nem', region: 'NSW1', facility: 'Eraring', duid: 'ER01' },
      { network: 'nem', region: 'QLD1', facility: 'Callide', duid: 'CALL_B_1' },
      { network: 'nem', region: 'VIC1', facility: 'Yallourn', duid: 'YWPS1' },
      // WEM units last (no region)
      { network: 'wem', region: 'WEM', facility: 'Collie', duid: 'COLLIE_G1' }
    ]);
  });
});