import React from 'react';
import { useCoalStripesWithRegions } from '../hooks/useCoalStripes';
import { CoalDisplayUtils } from '../lib/display-utils';
import { CoalUnit } from '../lib/types';
import { parseDate } from '@internationalized/date';

export default function ApiTestPage() {
  const { data, loading, error, regionsWithData, totalUnits, dateRange, lastGoodDay } = useCoalStripesWithRegions();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">🔄 Loading Coal Stripes Data...</h1>
          <div className="animate-pulse">
            <div className="h-4 bg-gray-700 rounded w-3/4 mb-4"></div>
            <div className="h-4 bg-gray-700 rounded w-1/2 mb-4"></div>
            <div className="h-4 bg-gray-700 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">❌ Error Loading Data</h1>
          <div className="bg-red-900 border border-red-500 rounded p-4">
            <p className="text-red-200">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">📭 No Data Available</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">🎨 Coal Stripes Data API Test</h1>
        
        {/* Summary */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">📊 Summary</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-gray-400">Total Units</p>
              <p className="text-2xl font-bold">{totalUnits}</p>
            </div>
            <div>
              <p className="text-gray-400">Date Range</p>
              <p className="text-sm font-mono">{dateRange}</p>
            </div>
            <div>
              <p className="text-gray-400">Last Good Day</p>
              <p className="text-sm font-mono">{lastGoodDay}</p>
            </div>
            <div>
              <p className="text-gray-400">Regions</p>
              <p className="text-2xl font-bold">{regionsWithData.length}</p>
            </div>
          </div>
        </div>

        {/* Regions */}
        <div className="space-y-6">
          {regionsWithData.map((region) => (
            <div key={region.name} className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">▼ {region.name.toUpperCase()}</h3>
              <div className="grid gap-2">
                {region.units.slice(0, 5).map((unit: CoalUnit) => (
                  <div key={unit.code} className="flex items-center space-x-4 text-sm">
                    <span className="font-mono w-16">{unit.code}</span>
                    <span className="w-48 truncate">{unit.facility_name}</span>
                    <span className="w-16 text-right">{unit.capacity} MW</span>
                    <div className="font-mono text-xs">
                      {data.dates.slice(-7).map(date => {
                        const energy = unit.data[date] || 0;
                        const cf = CoalDisplayUtils.calculateCapacityFactor(energy, unit.capacity);
                        const char = CoalDisplayUtils.getShadeCharacter(cf);
                        return <span key={date} className="inline-block w-3 text-center">{char}</span>;
                      })}
                    </div>
                  </div>
                ))}
                {region.units.length > 5 && (
                  <p className="text-gray-400 text-sm">... and {region.units.length - 5} more units</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Raw Data Debug */}
        <div className="mt-8 bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">🔍 Debug Info</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-400">Requested Days</p>
              <p className="font-mono">{data.requestedDays}</p>
            </div>
            <div>
              <p className="text-gray-400">Actual Days</p>
              <p className="font-mono">{data.actualDays}</p>
            </div>
            <div>
              <p className="text-gray-400">Sample Date Headers</p>
              <p className="font-mono text-xs">{CoalDisplayUtils.createWeeklyHeaders(data.dates.slice(0, 28).map(d => parseDate(d)))}</p>
            </div>
            <div>
              <p className="text-gray-400">Total Data Points</p>
              <p className="font-mono">{data.dates.length} days × {totalUnits} units</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}