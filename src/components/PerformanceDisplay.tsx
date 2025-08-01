import React, { useEffect, useState } from 'react';
import { perfMonitor } from '@/shared/performance-monitor';
import { yearDataVendor } from '@/client/year-data-vendor';
import type { CacheStats } from '@/shared/lru-cache';
import type { QueueStats } from '@/shared/request-queue';
import { featureFlags } from '@/shared/feature-flags';
import { useAllFeatureFlags } from '@/hooks/useFeatureFlag';

type DisplayMode = 'performance' | 'caches' | 'features';
type DisclosureState = 'collapsed' | 'detailed';

const greenButtonStyle = {
  background: '#333',
  color: '#0f0',
  border: '1px solid #0f0',
  borderRadius: '3px',
  padding: '1px 5px',
  cursor: 'pointer',
  fontSize: '10px'
};

const redButtonStyle = {
  background: '#333',
  color: '#f00',
  border: '1px solid #f00',
  borderRadius: '3px',
  padding: '1px 5px',
  cursor: 'pointer',
  fontSize: '10px'
};

export const PerformanceDisplay: React.FC = () => {
  const [fps, setFps] = useState(0);
  const [memory, setMemory] = useState<{ heapUsed: number; heapTotal: number } | null>(null);
  const [metrics, setMetrics] = useState<Record<string, { count: number; avgDuration: number; totalDuration: number }>>({});
  const [disclosureState, setDisclosureState] = useState<DisclosureState>('collapsed');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('caches');
  const [cacheStats, setCacheStats] = useState<(CacheStats & QueueStats) | null>(null);
  const [isVisible, setIsVisible] = useState(() => {
    // Load saved visibility state from localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = localStorage.getItem('performance-monitor-state');
      if (saved) {
        try {
          const state = JSON.parse(saved);
          return state.visible === true; // Default to false if not explicitly true
        } catch (e) {
          console.error('Failed to parse saved performance monitor state:', e);
        }
      }
    }
    // Default to hidden
    return false;
  });
  const [position, setPosition] = useState(() => {
    // Load saved position from localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = localStorage.getItem('performance-monitor-state');
      if (saved) {
        try {
          const state = JSON.parse(saved);
          if (state.position) {
            const coords = state.position;
            // Validate coordinates are within viewport
            if (coords.x >= 0 && coords.x <= window.innerWidth - 100 &&
                coords.y >= 0 && coords.y <= window.innerHeight - 100) {
              return coords;
            }
          }
        } catch (e) {
          console.error('Failed to parse saved performance monitor position:', e);
        }
      }
    }
    // Default position
    return { x: window.innerWidth / 2 - 50, y: 10 };
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const allFeatureFlags = useAllFeatureFlags();
  const [flagsChanged, setFlagsChanged] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setFps(perfMonitor.getCurrentFPS());
      setMemory(perfMonitor.getMemoryInfo());
      setMetrics(perfMonitor.getSummary());
      
      // Update cache stats if in cache mode
      if (displayMode === 'caches') {
        setCacheStats(yearDataVendor.getCacheStats());
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

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStart]);

  // Save position and visibility to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      // Debounce to avoid saving during drag
      const timeoutId = setTimeout(() => {
        const state = {
          position,
          visible: isVisible
        };
        localStorage.setItem('performance-monitor-state', JSON.stringify(state));
      }, 100);
      
      return () => clearTimeout(timeoutId);
    }
  }, [position, isVisible, isDragging]);

  // Handle keyboard shortcut (Shift+P)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey && e.key === 'P') {
        setIsVisible(prev => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Don't render if not visible
  if (!isVisible) {
    return null;
  }

  return (
    <div 
      onMouseDown={handleMouseDown}
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        background: 'rgba(0, 0, 0, 0.8)',
        color: '#0f0',
        padding: '10px',
        borderRadius: '5px',
        fontFamily: 'monospace',
        fontSize: '12px',
        width: disclosureState === 'collapsed' ? 'auto' : '250px',
        minWidth: disclosureState === 'collapsed' ? 'auto' : '250px',
        maxWidth: disclosureState === 'collapsed' ? 'none' : '250px',
        zIndex: 10000,
        overflow: 'hidden',
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none',
        boxSizing: 'border-box',
        opacity: disclosureState === 'collapsed' ? 0.2 : 1,
        transition: 'width 0.3s ease, min-width 0.3s ease, max-width 0.3s ease, opacity 0.3s ease'
      }}>
      <div style={{ marginBottom: '5px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span 
            onClick={() => {
              setDisclosureState(prev => prev === 'collapsed' ? 'detailed' : 'collapsed');
            }}
            style={{ 
              cursor: 'pointer',
              marginRight: '5px',
              fontSize: '18px',
              fontFamily: 'Arial',
              display: 'inline-block',
              transform: disclosureState === 'collapsed' ? 'rotate(0deg)' : 'rotate(90deg)',
              transition: 'transform 0.3s ease',
              userSelect: 'none'
            }}
          >
            ▸
          </span>
          <span style={{ color: fps < 30 ? '#f00' : fps < 50 ? '#ff0' : '#0f0' }}>
            {fps.toFixed(0)}fps
          </span>
        </div>
        {memory && disclosureState !== 'collapsed' && (
          <span style={{ fontSize: '11px', color: '#888' }}>
            Heap used <span style={{ fontWeight: 'bold' }}>{memory.heapUsed.toFixed(1)}/{memory.heapTotal.toFixed(1)} MB</span>
          </span>
        )}
      </div>
      
      {disclosureState !== 'collapsed' && (
        <div style={{ 
          marginBottom: '5px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '5px'
        }}>
          <div style={{ 
          display: 'inline-flex',
          border: '1px solid #0f0',
          borderRadius: '3px',
          overflow: 'hidden'
        }}>
          {(['caches', 'performance', 'features'] as const).map((mode, index) => {
            const buttonStyle = {
              background: displayMode === mode ? '#0f0' : '#333',
              color: displayMode === mode ? '#000' : '#0f0',
              border: 'none',
              borderRight: index < 2 ? '1px solid #0f0' : 'none',
              padding: '2px 8px',
              cursor: 'pointer',
              fontSize: '11px'
            };
            
            return (
              <button
                key={mode}
                onClick={() => setDisplayMode(mode)}
                style={buttonStyle}
              >
                {mode === 'caches' ? 'Cache' : mode === 'performance' ? 'Timing' : 'Features'}
              </button>
            );
          })}
        </div>
      </div>
      )}
      
      {displayMode === 'performance' && disclosureState === 'detailed' && (
        <div style={{ 
          marginTop: '10px', 
          borderTop: '1px solid #0f0',
          paddingTop: '5px'
        }}>
          <div style={{
            maxHeight: '300px', 
            overflowY: 'auto',
            marginBottom: '10px'
          }}>
          {Object.entries(metrics)
            .sort(([, a], [, b]) => b.totalDuration - a.totalDuration)
            .slice(0, 10)
            .map(([name, stats]) => (
              <div key={name} style={{ marginBottom: '5px', fontSize: '10px' }}>
                <div style={{ color: '#0f0', wordBreak: 'break-all', overflow: 'hidden' }}>{name}:</div>
                <div style={{ marginLeft: '10px', color: '#888', wordBreak: 'break-all', overflow: 'hidden' }}>
                  Count: {stats.count} | 
                  Avg: {stats.avgDuration.toFixed(1)}ms | 
                  Total: {stats.totalDuration.toFixed(0)}ms
                </div>
              </div>
            ))}
          </div>
          <div style={{ 
            display: 'flex',
            gap: '5px',
            justifyContent: 'flex-end'
          }}>
            <button 
              onClick={handleLogReport}
              style={greenButtonStyle}
            >
              Log
            </button>
            <button 
              onClick={handleClear}
              style={redButtonStyle}
            >
              Clear
            </button>
          </div>
        </div>
      )}
      
      {displayMode === 'caches' && disclosureState === 'detailed' && (
        <div style={{ 
          marginTop: '10px', 
          borderTop: '1px solid #0f0',
          paddingTop: '5px'
        }}>
          {cacheStats ? (
            <div style={{ marginBottom: '10px' }}>
              <div style={{ fontSize: '10px', color: '#4af' }}>
                Cached: ({cacheStats.numItems} items, {(cacheStats.totalKB / 1024).toFixed(1)}MB)
              </div>
              {cacheStats.labels.length > 0 && (
                <div style={{ 
                  marginLeft: '10px', 
                  marginTop: '5px',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '4px'
                }}>
                  {cacheStats.labels.map((label: string) => (
                    <span
                      key={label}
                      style={{
                        display: 'inline-block',
                        padding: '2px 6px',
                        backgroundColor: '#224466',
                        color: '#4af',
                        borderRadius: '10px',
                        fontSize: '9px',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {label}
                    </span>
                  ))}
                </div>
              )}
              <div style={{ marginTop: '5px' }}>
                <div style={{ fontSize: '10px', color: '#0f0', marginBottom: '3px' }}>Active:</div>
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '4px',
                  minHeight: '20px',
                  marginLeft: '10px'
                }}>
                  {cacheStats.activeLabels && cacheStats.activeLabels.length > 0 ? (
                    cacheStats.activeLabels.map((label: string) => (
                      <span
                        key={label}
                        style={{
                          display: 'inline-block',
                          padding: '2px 6px',
                          backgroundColor: '#005500',
                          color: '#0f0',
                          borderRadius: '10px',
                          fontSize: '9px',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {label}
                      </span>
                    ))
                  ) : (
                    <span style={{ fontSize: '9px', color: '#666' }}>None</span>
                  )}
                </div>
              </div>
              <div style={{ marginTop: '5px' }}>
                <div style={{ fontSize: '10px', color: '#ff0', marginBottom: '3px' }}>Queued:</div>
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '4px',
                  minHeight: '20px',
                  marginLeft: '10px'
                }}>
                  {cacheStats.queuedLabels && cacheStats.queuedLabels.length > 0 ? (
                    cacheStats.queuedLabels.map((label: string) => (
                      <span
                        key={label}
                        style={{
                          display: 'inline-block',
                          padding: '2px 6px',
                          backgroundColor: '#554400',
                          color: '#ff0',
                          borderRadius: '10px',
                          fontSize: '9px',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {label}
                      </span>
                    ))
                  ) : (
                    <span style={{ fontSize: '9px', color: '#666' }}>None</span>
                  )}
                </div>
              </div>
              {cacheStats.circuitOpen && (
                <div style={{ marginLeft: '10px', marginTop: '5px', color: '#f00', fontSize: '10px' }}>
                  ⚠️ Circuit Breaker Open
                </div>
              )}
            </div>
          ) : (
            <div style={{ color: '#888', fontSize: '10px' }}>No cache data available</div>
          )}
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            marginTop: '10px'
          }}>
            <button
              onClick={() => {
                yearDataVendor.clearCache();
                setCacheStats(yearDataVendor.getCacheStats());
              }}
              style={redButtonStyle}
            >
              Clear
            </button>
          </div>
        </div>
      )}
      
      {displayMode === 'features' && disclosureState === 'detailed' && (
        <div style={{ 
          marginTop: '10px', 
          borderTop: '1px solid #0f0',
          paddingTop: '5px'
        }}>
          <div style={{ 
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            {Object.entries(allFeatureFlags).length === 0 ? (
              <div style={{ color: '#888', fontSize: '10px' }}>No feature flags defined</div>
            ) : (
              Object.entries(allFeatureFlags).map(([flag, enabled]) => (
                <label
                  key={flag}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    fontSize: '11px',
                    color: '#0f0'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={() => {
                      featureFlags.toggle(flag);
                      setFlagsChanged(true);
                    }}
                    style={{
                      width: '12px',
                      height: '12px',
                      cursor: 'pointer'
                    }}
                  />
                  <span>{flag}</span>
                </label>
              ))
            )}
          </div>
          {flagsChanged && (
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              marginTop: '10px'
            }}>
              <button
                onClick={() => window.location.reload()}
                style={redButtonStyle}
              >
                Reload
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};