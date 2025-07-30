import { createCapFacYear } from '../cap-fac-year';
import { GeneratingUnitCapFacHistoryDTO } from '@/shared/types';
import { MockCanvas } from './helpers/mock-canvas';

// Mock OffscreenCanvas
global.OffscreenCanvas = MockCanvas as any;

describe('cap-fac-year', () => {
  describe('createCapFacYear', () => {
    it('should create region capacity factors for NEM units', () => {
      const mockData: GeneratingUnitCapFacHistoryDTO = {
        type: 'capacity_factors',
        version: '1.0',
        created_at: '2024-01-01',
        data: [
          {
            network: 'NEM',
            region: 'NSW1',
            data_type: 'capacity_factor',
            units: 'MW',
            capacity: 100,
            duid: 'UNIT1',
            facility_code: 'FAC1',
            facility_name: 'Facility 1',
            fueltech: 'coal_black',
            history: {
              start: '2024-01-01',
              last: '2024-12-31',
              interval: 'month',
              data: [0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0.0, 0.1, 0.2, 0.3]
            }
          },
          {
            network: 'NEM',
            region: 'NSW1',
            data_type: 'capacity_factor',
            units: 'MW',
            capacity: 200,
            duid: 'UNIT2',
            facility_code: 'FAC1',
            facility_name: 'Facility 1',
            fueltech: 'coal_black',
            history: {
              start: '2024-01-01',
              last: '2024-12-31',
              interval: 'month',
              data: [0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0.2, 0.3, 0.4]
            }
          }
        ]
      };

      const result = createCapFacYear(2024, mockData);

      expect(result.regionCapacityFactors.has('NSW1')).toBe(true);
      const nsw1Factors = result.regionCapacityFactors.get('NSW1');
      expect(nsw1Factors).toHaveLength(12);
      
      // Check capacity-weighted average for first month: (0.8*100 + 0.9*200)/(100+200) = 0.867
      expect(nsw1Factors![0]).toBeCloseTo(0.867, 3);
      
      // Check capacity-weighted average for last month: (0.3*100 + 0.4*200)/(100+200) = 0.367
      expect(nsw1Factors![11]).toBeCloseTo(0.367, 3);
    });

    it('should handle WEM network units with WEM region', () => {
      const mockData: GeneratingUnitCapFacHistoryDTO = {
        type: 'capacity_factors',
        version: '1.0',
        created_at: '2024-01-01',
        data: [
          {
            network: 'WEM',
            // Note: WEM units don't have a region property
            data_type: 'capacity_factor',
            units: 'MW',
            capacity: 150,
            duid: 'WEM_UNIT1',
            facility_code: 'WEM_FAC1',
            facility_name: 'WEM Facility 1',
            fueltech: 'coal_black',
            history: {
              start: '2024-01-01',
              last: '2024-12-31',
              interval: 'month',
              data: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]
            }
          }
        ]
      };

      const result = createCapFacYear(2024, mockData);

      expect(result.regionCapacityFactors.has('WEM')).toBe(true);
      const wemFactors = result.regionCapacityFactors.get('WEM');
      expect(wemFactors).toHaveLength(12);
      
      // All months should be 0.5
      for (let i = 0; i < 12; i++) {
        expect(wemFactors![i]).toBe(0.5);
      }
    });

    it('should handle null capacity factors correctly', () => {
      const mockData: GeneratingUnitCapFacHistoryDTO = {
        type: 'capacity_factors',
        version: '1.0',
        created_at: '2024-01-01',
        data: [
          {
            network: 'NEM',
            region: 'QLD1',
            data_type: 'capacity_factor',
            units: 'MW',
            capacity: 100,
            duid: 'UNIT1',
            facility_code: 'FAC1',
            facility_name: 'Facility 1',
            fueltech: 'coal_black',
            history: {
              start: '2024-01-01',
              last: '2024-12-31',
              interval: 'month',
              data: [0.8, null, 0.6, null, null, null, 0.2, 0.1, null, 0.1, 0.2, 0.3]
            }
          },
          {
            network: 'NEM',
            region: 'QLD1',
            data_type: 'capacity_factor',
            units: 'MW',
            capacity: 200,
            duid: 'UNIT2',
            facility_code: 'FAC2',
            facility_name: 'Facility 2',
            fueltech: 'coal_black',
            history: {
              start: '2024-01-01',
              last: '2024-12-31',
              interval: 'month',
              data: [null, 0.8, 0.7, null, 0.5, null, null, 0.2, null, null, 0.3, null]
            }
          }
        ]
      };

      const result = createCapFacYear(2024, mockData);

      const qld1Factors = result.regionCapacityFactors.get('QLD1');
      expect(qld1Factors).toHaveLength(12);
      
      // Month 0: only unit 1 has data (0.8)
      expect(qld1Factors![0]).toBe(0.8);
      
      // Month 1: only unit 2 has data (0.8)
      expect(qld1Factors![1]).toBe(0.8);
      
      // Month 2: both units have data, weighted average: (0.6*100 + 0.7*200)/(100+200) = 0.667
      expect(qld1Factors![2]).toBeCloseTo(0.667, 3);
      
      // Month 3: both units have null
      expect(qld1Factors![3]).toBe(null);
      
      // Month 5: both units have null
      expect(qld1Factors![5]).toBe(null);
    });

    it('should handle units with missing region as UNKNOWN', () => {
      const mockData: GeneratingUnitCapFacHistoryDTO = {
        type: 'capacity_factors',
        version: '1.0',
        created_at: '2024-01-01',
        data: [
          {
            network: 'NEM',
            // Missing region property
            data_type: 'capacity_factor',
            units: 'MW',
            capacity: 100,
            duid: 'UNIT1',
            facility_code: 'FAC1',
            facility_name: 'Facility 1',
            fueltech: 'coal_black',
            history: {
              start: '2024-01-01',
              last: '2024-12-31',
              interval: 'month',
              data: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]
            }
          }
        ]
      };

      const result = createCapFacYear(2024, mockData);

      expect(result.regionCapacityFactors.has('UNKNOWN')).toBe(true);
      const unknownFactors = result.regionCapacityFactors.get('UNKNOWN');
      expect(unknownFactors).toHaveLength(12);
    });

    it('should handle multiple regions correctly', () => {
      const mockData: GeneratingUnitCapFacHistoryDTO = {
        type: 'capacity_factors',
        version: '1.0',
        created_at: '2024-01-01',
        data: [
          {
            network: 'NEM',
            region: 'NSW1',
            data_type: 'capacity_factor',
            units: 'MW',
            capacity: 100,
            duid: 'NSW_UNIT1',
            facility_code: 'NSW_FAC1',
            facility_name: 'NSW Facility',
            fueltech: 'coal_black',
            history: {
              start: '2024-01-01',
              last: '2024-12-31',
              interval: 'month',
              data: [0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8]
            }
          },
          {
            network: 'NEM',
            region: 'VIC1',
            data_type: 'capacity_factor',
            units: 'MW',
            capacity: 200,
            duid: 'VIC_UNIT1',
            facility_code: 'VIC_FAC1',
            facility_name: 'VIC Facility',
            fueltech: 'coal_black',
            history: {
              start: '2024-01-01',
              last: '2024-12-31',
              interval: 'month',
              data: [0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6]
            }
          },
          {
            network: 'WEM',
            data_type: 'capacity_factor',
            units: 'MW',
            capacity: 150,
            duid: 'WEM_UNIT1',
            facility_code: 'WEM_FAC1',
            facility_name: 'WEM Facility',
            fueltech: 'coal_black',
            history: {
              start: '2024-01-01',
              last: '2024-12-31',
              interval: 'month',
              data: [0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4]
            }
          }
        ]
      };

      const result = createCapFacYear(2024, mockData);

      // Should have 3 regions
      expect(result.regionCapacityFactors.size).toBe(3);
      expect(result.regionCapacityFactors.has('NSW1')).toBe(true);
      expect(result.regionCapacityFactors.has('VIC1')).toBe(true);
      expect(result.regionCapacityFactors.has('WEM')).toBe(true);

      // Check values
      expect(result.regionCapacityFactors.get('NSW1')![0]).toBe(0.8);
      expect(result.regionCapacityFactors.get('VIC1')![0]).toBe(0.6);
      expect(result.regionCapacityFactors.get('WEM')![0]).toBe(0.4);
    });

    it('should handle zero capacity correctly', () => {
      const mockData: GeneratingUnitCapFacHistoryDTO = {
        type: 'capacity_factors',
        version: '1.0',
        created_at: '2024-01-01',
        data: [
          {
            network: 'NEM',
            region: 'NSW1',
            data_type: 'capacity_factor',
            units: 'MW',
            capacity: 100,
            duid: 'UNIT1',
            facility_code: 'FAC1',
            facility_name: 'Facility 1',
            fueltech: 'coal_black',
            history: {
              start: '2024-01-01',
              last: '2024-12-31',
              interval: 'month',
              data: [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]
            }
          }
        ]
      };

      const result = createCapFacYear(2024, mockData);

      const nsw1Factors = result.regionCapacityFactors.get('NSW1');
      
      // All months should be 0.0 (not null)
      for (let i = 0; i < 12; i++) {
        expect(nsw1Factors![i]).toBe(0.0);
      }
    });
  });
});