import React, { useEffect, useState } from 'react';
import { perfMonitor } from '@/shared/performance-monitor';
import { yearDataVendor } from '@/client/year-data-vendor';
import { tileCache } from '@/client/tile-system/TileCache';
import type { CacheStats } from '@/client/lru-cache';

type DisplayMode = 'performance' | 'caches';

export const PerformanceDisplay: React.FC = () => {
  const [fps, setFps] = useState(0);
  const [memory, setMemory] = useState<{ heapUsed: number; heapTotal: number } | null>(null);
  const [metrics, setMetrics] = useState<Record<string, { count: number; avgDuration: number; totalDuration: number }>>({});
  const [showDetails, setShowDetails] = useState(false);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('performance');
  const [cacheStats, setCacheStats] = useState<{ capFac: CacheStats | null; tile: CacheStats | null }>({ capFac: null, tile: null });

  useEffect(() => {
    const interval = setInterval(() => {
      setFps(perfMonitor.getCurrentFPS());
      setMemory(perfMonitor.getMemoryInfo());
      setMetrics(perfMonitor.getSummary());
      
      // Update cache stats if in cache mode
      if (displayMode === 'caches') {
        setCacheStats({
          capFac: yearDataVendor.getCacheStats(),
          tile: tileCache.getCacheStats()
        });
      }
    }, 500); // Update twice per second

    return () => clearInterval(interval);
  }, [displayMode]);

  const handleLogReport = () => {
    perfMonitor.logReport();
  };

  const handleClear = () => {
    perfMonitor.clear();
    setMetrics({});
  };

  return (
    <div style={{
      position: 'fixed',
      top: 10,
      right: 10,
      background: 'rgba(0, 0, 0, 0.8)',
      color: '#0f0',
      padding: '10px',
      borderRadius: '5px',
      fontFamily: 'monospace',
      fontSize: '12px',
      minWidth: '200px',
      zIndex: 10000
    }}>
      <div style={{ marginBottom: '5px' }}>
        FPS: <span style={{ color: fps < 30 ? '#f00' : fps < 50 ? '#ff0' : '#0f0' }}>
          {fps.toFixed(1)}
        </span>
      </div>
      
      {memory && (
        <div style={{ marginBottom: '5px' }}>
          Memory: {memory.heapUsed.toFixed(1)}MB / {memory.heapTotal.toFixed(1)}MB
        </div>
      )}
      
      <div style={{ marginBottom: '5px' }}>
        <button 
          onClick={() => setDisplayMode(displayMode === 'performance' ? 'caches' : 'performance')}
          style={{ 
            background: '#333', 
            color: '#0f0', 
            border: '1px solid #0f0',
            borderRadius: '3px',
            padding: '2px 5px',
            cursor: 'pointer',
            marginRight: '5px'
          }}
        >
          {displayMode === 'performance' ? 'Caches' : 'Performance'}
        </button>
        {displayMode === 'performance' && (
          <button 
            onClick={() => setShowDetails(!showDetails)}
            style={{ 
              background: '#333', 
              color: '#0f0', 
              border: '1px solid #0f0',
              borderRadius: '3px',
              padding: '2px 5px',
              cursor: 'pointer',
              marginRight: '5px'
            }}
          >
            {showDetails ? 'Hide' : 'Show'} Details
          </button>
        )}
        <button 
          onClick={handleLogReport}
          style={{ 
            background: '#333', 
            color: '#0f0', 
            border: '1px solid #0f0',
            borderRadius: '3px',
            padding: '2px 5px',
            cursor: 'pointer',
            marginRight: '5px'
          }}
        >
          Log Report
        </button>
        <button 
          onClick={handleClear}
          style={{ 
            background: '#333', 
            color: '#f00', 
            border: '1px solid #f00',
            borderRadius: '3px',
            padding: '2px 5px',
            cursor: 'pointer'
          }}
        >
          Clear
        </button>
      </div>
      
      {displayMode === 'performance' && showDetails && (
        <div style={{ 
          marginTop: '10px', 
          maxHeight: '400px', 
          overflowY: 'auto',
          borderTop: '1px solid #0f0',
          paddingTop: '5px'
        }}>
          {Object.entries(metrics)
            .sort(([, a], [, b]) => b.totalDuration - a.totalDuration)
            .slice(0, 10)
            .map(([name, stats]) => (
              <div key={name} style={{ marginBottom: '5px', fontSize: '10px' }}>
                <div style={{ color: '#0f0' }}>{name}:</div>
                <div style={{ marginLeft: '10px', color: '#888' }}>
                  Count: {stats.count} | 
                  Avg: {stats.avgDuration.toFixed(1)}ms | 
                  Total: {stats.totalDuration.toFixed(0)}ms
                </div>
              </div>
            ))}
        </div>
      )}
      
      {displayMode === 'caches' && (
        <div style={{ 
          marginTop: '10px', 
          borderTop: '1px solid #0f0',
          paddingTop: '5px'
        }}>
          {/* Render both caches with the same structure */}
          {['capFac', 'tile'].map(cacheType => {
            const stats = cacheStats[cacheType as keyof typeof cacheStats];
            const cacheName = cacheType === 'capFac' ? 'CapFac Cache' : 'Tile Cache';
            
            if (!stats) return null;
            
            return (
              <div key={cacheType} style={{ marginBottom: '10px' }}>
                <div style={{ color: '#0f0', fontSize: '12px', marginBottom: '5px' }}>{cacheName}:</div>
                <div style={{ marginLeft: '10px', fontSize: '10px', color: '#888' }}>
                  Items: {stats.numItems} | 
                  Size: {(stats.totalKB / 1024).toFixed(2)}MB
                </div>
                {stats.labels.length > 0 && (
                  <div style={{ marginLeft: '10px', marginTop: '5px' }}>
                    {stats.labels.map(label => (
                      <span
                        key={label}
                        style={{
                          display: 'inline-block',
                          padding: '2px 6px',
                          margin: '2px',
                          backgroundColor: '#444',
                          color: '#999',
                          borderRadius: '10px',
                          fontSize: '9px'
                        }}
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          
          {!cacheStats.capFac && !cacheStats.tile && (
            <div style={{ color: '#888', fontSize: '10px' }}>No cache data available</div>
          )}
        </div>
      )}
    </div>
  );
};