import React, { useEffect, useState } from 'react';
import { perfMonitor } from '../lib/performance-monitor';

export const PerformanceDisplay: React.FC = () => {
  const [fps, setFps] = useState(0);
  const [memory, setMemory] = useState<{ heapUsed: number; heapTotal: number } | null>(null);
  const [metrics, setMetrics] = useState<Record<string, { count: number; avgDuration: number; totalDuration: number }>>({});
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setFps(perfMonitor.getCurrentFPS());
      setMemory(perfMonitor.getMemoryInfo());
      setMetrics(perfMonitor.getSummary());
    }, 500); // Update twice per second

    return () => clearInterval(interval);
  }, []);

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
      
      {showDetails && (
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
    </div>
  );
};