'use client';

import { useEffect, useState } from 'react';
import { yearDataCache } from '@/client/tile-system/YearDataCache';
import { tileCache } from '@/client/tile-system/TileCache';
import { capFacCache } from '@/client/cap-fac-cache';

interface CacheStats {
  // CapFacCache/TimeSeriesCache stats
  capFacCacheStats: {
    yearCount: number;
    totalMB: number;
    cachedYears: number[];
  };
  // Tile system caches
  yearDataStats: {
    years: number;
    totalMB: number;
    yearList: number[];
  };
  tileStats: {
    tiles: number;
    totalMB: number;
    yearList: number[];
  };
}

export default function CacheInspectorPage() {
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const updateStats = () => {
    // Get stats from all caches
    const capFacCacheStats = capFacCache.getCacheStats();
    const yearDataStats = yearDataCache.getStats();
    const tileStats = tileCache.getStats();
    
    setStats({
      capFacCacheStats,
      yearDataStats,
      tileStats
    });
    setLastUpdated(new Date());
  };

  useEffect(() => {
    // Initial load
    updateStats();
    
    // Auto-refresh every 2 seconds
    const interval = setInterval(updateStats, 2000);
    
    return () => clearInterval(interval);
  }, []);

  const clearCapFacCache = () => {
    capFacCache.clear();
    updateStats();
  };

  const clearYearDataCache = () => {
    yearDataCache.clear();
    updateStats();
  };

  const clearTileCache = () => {
    tileCache.clear();
    updateStats();
  };

  const clearAllCaches = () => {
    capFacCache.clear();
    yearDataCache.clear();
    tileCache.clear();
    updateStats();
  };

  if (!stats) {
    return (
      <div style={{ 
        backgroundColor: '#faf9f6',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'DM Sans', sans-serif"
      }}>
        <div style={{ fontSize: '1.25rem', color: '#6b7280' }}>Loading cache data...</div>
      </div>
    );
  }

  const totalSize = stats.capFacCacheStats.totalMB + stats.yearDataStats.totalMB + stats.tileStats.totalMB;
  const totalItems = stats.capFacCacheStats.yearCount + stats.yearDataStats.years + stats.tileStats.tiles;

  return (
    <div style={{ 
      backgroundColor: '#faf9f6',
      minHeight: '100vh',
      fontFamily: "'DM Sans', sans-serif"
    }}>
      <div style={{ 
        maxWidth: '1200px', 
        margin: '0 auto', 
        padding: '2rem' 
      }}>
        {/* Header */}
        <h1 style={{ 
          fontSize: '2rem', 
          fontWeight: '700', 
          marginBottom: '2rem',
          color: '#353535' 
        }}>
          Cache Inspector
        </h1>
        
        <div style={{ 
          marginBottom: '2rem', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between' 
        }}>
          <div style={{ 
            fontSize: '0.875rem', 
            color: '#6b7280' 
          }}>
            Auto-refreshes every 2 seconds • Last updated: {lastUpdated.toLocaleTimeString()}
          </div>
          <button
            onClick={clearAllCaches}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#e34a33',
              color: 'white',
              border: 'none',
              borderRadius: '0.25rem',
              fontSize: '1rem',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#c73820'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#e34a33'}
          >
            Clear All Caches
          </button>
        </div>

        {/* Summary Cards */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '1.5rem',
          marginBottom: '2rem'
        }}>
          <div style={{ 
            backgroundColor: 'white',
            border: '1px solid #e5e5e5',
            borderRadius: '0.5rem',
            padding: '1.5rem'
          }}>
            <h3 style={{ 
              fontSize: '1.125rem',
              fontWeight: '600', 
              marginBottom: '0.75rem',
              color: '#353535' 
            }}>
              Total Cache Size
            </h3>
            <div style={{ fontSize: '2rem', fontWeight: '700', color: '#e34a33' }}>
              {totalSize.toFixed(2)} MB
            </div>
            <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
              Across all caches
            </div>
          </div>

          <div style={{ 
            backgroundColor: 'white',
            border: '1px solid #e5e5e5',
            borderRadius: '0.5rem',
            padding: '1.5rem'
          }}>
            <h3 style={{ 
              fontSize: '1.125rem',
              fontWeight: '600', 
              marginBottom: '0.75rem',
              color: '#353535' 
            }}>
              Cached Items
            </h3>
            <div style={{ fontSize: '2rem', fontWeight: '700', color: '#2b8cbe' }}>
              {totalItems}
            </div>
            <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
              Years + Tiles
            </div>
          </div>

          <div style={{ 
            backgroundColor: 'white',
            border: '1px solid #e5e5e5',
            borderRadius: '0.5rem',
            padding: '1.5rem'
          }}>
            <h3 style={{ 
              fontSize: '1.125rem',
              fontWeight: '600', 
              marginBottom: '0.75rem',
              color: '#353535' 
            }}>
              Cache Efficiency
            </h3>
            <div style={{ fontSize: '2rem', fontWeight: '700', color: '#756bb1' }}>
              {totalItems > 0 ? ((totalSize / totalItems) * 1024).toFixed(0) : '0'} KB
            </div>
            <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
              Average per item
            </div>
          </div>
        </div>

        {/* Cache Details */}
        <div style={{ display: 'flex', gap: '2rem' }}>
          <div style={{ flex: 1 }}>
            {/* Smart Cache (Main Page) */}
            <div style={{ 
              backgroundColor: 'white',
              border: '1px solid #e5e5e5',
              borderRadius: '0.5rem',
              padding: '1.5rem',
              marginBottom: '1rem'
            }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: '1rem'
              }}>
                <div>
                  <h2 style={{ 
                    fontSize: '1.25rem', 
                    fontWeight: '600', 
                    color: '#353535' 
                  }}>
                    Smart Cache
                  </h2>
                  <p style={{ 
                    fontSize: '0.875rem', 
                    color: '#6b7280', 
                    marginTop: '0.25rem' 
                  }}>
                    Used by main page for API data
                  </p>
                </div>
                <button
                  onClick={clearCapFacCache}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.25rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ef4444'}
                >
                  Clear
                </button>
              </div>
              
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr',
                gap: '1rem',
                marginBottom: '1rem'
              }}>
                <div style={{ 
                  backgroundColor: '#f9fafb',
                  padding: '0.75rem',
                  borderRadius: '0.25rem'
                }}>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Cached Years</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#4f46e5' }}>
                    {stats.capFacCacheStats.yearCount}
                  </div>
                </div>
                
                <div style={{ 
                  backgroundColor: '#f9fafb',
                  padding: '0.75rem',
                  borderRadius: '0.25rem'
                }}>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Total Size</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#0891b2' }}>
                    {stats.capFacCacheStats.totalMB.toFixed(2)} MB
                  </div>
                </div>
              </div>

              {stats.capFacCacheStats.cachedYears.length > 0 && (
                <div>
                  <p style={{ 
                    fontSize: '0.875rem', 
                    fontWeight: '500', 
                    color: '#374151',
                    marginBottom: '0.5rem'
                  }}>
                    Years in Cache:
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {stats.capFacCacheStats.cachedYears.sort((a, b) => b - a).map(year => (
                      <span
                        key={year}
                        style={{
                          padding: '0.25rem 0.75rem',
                          backgroundColor: '#e0e7ff',
                          color: '#4338ca',
                          borderRadius: '1rem',
                          fontSize: '0.75rem',
                          fontWeight: '500'
                        }}
                      >
                        {year}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {stats.capFacCacheStats.yearCount === 0 && (
                <div style={{ 
                  textAlign: 'center', 
                  padding: '2rem', 
                  color: '#9ca3af' 
                }}>
                  <p>No data cached yet - visit the main page</p>
                </div>
              )}
            </div>

            {/* Tile System Caches */}
            <div style={{ 
              backgroundColor: '#f3f4f6',
              borderRadius: '0.5rem',
              padding: '1rem'
            }}>
              <h3 style={{ 
                fontSize: '1.125rem',
                fontWeight: '600', 
                marginBottom: '1rem',
                color: '#353535' 
              }}>
                Tile System Caches
              </h3>
              
              {/* Year Data Cache */}
              <div style={{ 
                backgroundColor: 'white',
                border: '1px solid #e5e5e5',
                borderRadius: '0.5rem',
                padding: '1.5rem',
                marginBottom: '1rem'
              }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginBottom: '1rem'
                }}>
                  <div>
                    <h4 style={{ 
                      fontSize: '1.125rem', 
                      fontWeight: '600', 
                      color: '#353535' 
                    }}>
                      Year Data Cache
                    </h4>
                    <p style={{ 
                      fontSize: '0.875rem', 
                      color: '#6b7280', 
                      marginTop: '0.25rem' 
                    }}>
                      Tile system API data
                    </p>
                  </div>
                  <button
                    onClick={clearYearDataCache}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: '#ef4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '0.25rem',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ef4444'}
                  >
                    Clear
                  </button>
                </div>
                
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '1fr 1fr',
                  gap: '1rem',
                  marginBottom: stats.yearDataStats.yearList.length > 0 ? '1rem' : '0'
                }}>
                  <div style={{ 
                    backgroundColor: '#f9fafb',
                    padding: '0.75rem',
                    borderRadius: '0.25rem'
                  }}>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Years</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#2563eb' }}>
                      {stats.yearDataStats.years}
                    </div>
                  </div>
                  
                  <div style={{ 
                    backgroundColor: '#f9fafb',
                    padding: '0.75rem',
                    borderRadius: '0.25rem'
                  }}>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Size</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#10b981' }}>
                      {stats.yearDataStats.totalMB.toFixed(2)} MB
                    </div>
                  </div>
                </div>

                {stats.yearDataStats.yearList.length > 0 && (
                  <div>
                    <p style={{ 
                      fontSize: '0.875rem', 
                      fontWeight: '500', 
                      color: '#374151',
                      marginBottom: '0.5rem'
                    }}>
                      Years:
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {stats.yearDataStats.yearList.sort((a, b) => b - a).map(year => (
                        <span
                          key={year}
                          style={{
                            padding: '0.125rem 0.5rem',
                            backgroundColor: '#dbeafe',
                            color: '#1e40af',
                            borderRadius: '0.25rem',
                            fontSize: '0.75rem',
                            fontWeight: '500'
                          }}
                        >
                          {year}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Tile Cache */}
              <div style={{ 
                backgroundColor: 'white',
                border: '1px solid #e5e5e5',
                borderRadius: '0.5rem',
                padding: '1.5rem'
              }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginBottom: '1rem'
                }}>
                  <div>
                    <h4 style={{ 
                      fontSize: '1.125rem', 
                      fontWeight: '600', 
                      color: '#353535' 
                    }}>
                      Tile Cache
                    </h4>
                    <p style={{ 
                      fontSize: '0.875rem', 
                      color: '#6b7280', 
                      marginTop: '0.25rem' 
                    }}>
                      Rendered tiles
                    </p>
                  </div>
                  <button
                    onClick={clearTileCache}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: '#ef4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '0.25rem',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ef4444'}
                  >
                    Clear
                  </button>
                </div>
                
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '1fr 1fr',
                  gap: '1rem',
                  marginBottom: stats.tileStats.yearList.length > 0 ? '1rem' : '0'
                }}>
                  <div style={{ 
                    backgroundColor: '#f9fafb',
                    padding: '0.75rem',
                    borderRadius: '0.25rem'
                  }}>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Tiles</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#7c3aed' }}>
                      {stats.tileStats.tiles}
                    </div>
                  </div>
                  
                  <div style={{ 
                    backgroundColor: '#f9fafb',
                    padding: '0.75rem',
                    borderRadius: '0.25rem'
                  }}>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Size</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#f97316' }}>
                      {stats.tileStats.totalMB.toFixed(2)} MB
                    </div>
                  </div>
                </div>

                {stats.tileStats.yearList.length > 0 && (
                  <div>
                    <p style={{ 
                      fontSize: '0.875rem', 
                      fontWeight: '500', 
                      color: '#374151',
                      marginBottom: '0.5rem'
                    }}>
                      Years:
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {stats.tileStats.yearList.sort((a, b) => b - a).map(year => (
                        <span
                          key={year}
                          style={{
                            padding: '0.125rem 0.5rem',
                            backgroundColor: '#f3e8ff',
                            color: '#6d28d9',
                            borderRadius: '0.25rem',
                            fontSize: '0.75rem',
                            fontWeight: '500'
                          }}
                        >
                          {year}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Cache Statistics Sidebar */}
          <div style={{ width: '300px' }}>
            <div style={{ 
              backgroundColor: 'white',
              border: '1px solid #e5e5e5',
              borderRadius: '0.5rem',
              padding: '1.5rem',
              position: 'sticky',
              top: '2rem'
            }}>
              <h3 style={{ 
                fontSize: '1.125rem',
                fontWeight: '600', 
                marginBottom: '1rem',
                color: '#353535' 
              }}>
                Cache Usage Guide
              </h3>
              <div style={{ 
                fontSize: '0.875rem', 
                color: '#6b7280',
                lineHeight: '1.75'
              }}>
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontWeight: '500', color: '#374151' }}>CapFacCache</div>
                  <div>Used by the main page (/) for API data when dragging the timeline.</div>
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontWeight: '500', color: '#374151' }}>Year Data Cache</div>
                  <div>Used by the tile system (/tiles) to store API responses.</div>
                </div>
                <div>
                  <div style={{ fontWeight: '500', color: '#374151' }}>Tile Cache</div>
                  <div>Stores rendered canvas tiles for fast display.</div>
                </div>
              </div>
              
              <div style={{ 
                marginTop: '1.5rem',
                paddingTop: '1.5rem',
                borderTop: '1px solid #e5e7eb'
              }}>
                <h4 style={{ 
                  fontSize: '0.875rem',
                  fontWeight: '600', 
                  marginBottom: '0.5rem',
                  color: '#374151' 
                }}>
                  Performance Tips
                </h4>
                <ul style={{ 
                  fontSize: '0.75rem', 
                  color: '#6b7280',
                  lineHeight: '1.5',
                  paddingLeft: '1.25rem',
                  listStyleType: 'disc'
                }}>
                  <li>Clear caches when switching between test pages</li>
                  <li>Monitor cache size to avoid memory issues</li>
                  <li>Year caches persist across page navigation</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}