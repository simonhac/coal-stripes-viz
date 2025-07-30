import { LRUCache } from '../lru-cache';

describe('LRUCache', () => {
  let cache: LRUCache<string>;

  beforeEach(() => {
    cache = new LRUCache<string>(3);
  });

  describe('basic operations', () => {
    it('should store and retrieve values', () => {
      cache.set('key1', 'value1', 100, 'label1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('should return undefined for non-existent keys', () => {
      expect(cache.get('nonexistent')).toBeUndefined();
    });

    it('should check if key exists', () => {
      cache.set('key1', 'value1', 100, 'label1');
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('key2')).toBe(false);
    });

    it('should track cache size', () => {
      expect(cache.size()).toBe(0);
      cache.set('key1', 'value1', 100, 'label1');
      expect(cache.size()).toBe(1);
      cache.set('key2', 'value2', 200, 'label2');
      expect(cache.size()).toBe(2);
    });

    it('should clear the cache', () => {
      cache.set('key1', 'value1', 100, 'label1');
      cache.set('key2', 'value2', 200, 'label2');
      cache.clear();
      expect(cache.size()).toBe(0);
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBeUndefined();
    });
  });

  describe('LRU eviction', () => {
    it('should evict the least recently used item when cache is full', () => {
      cache.set('key1', 'value1', 100, 'label1');
      cache.set('key2', 'value2', 200, 'label2');
      cache.set('key3', 'value3', 300, 'label3');
      cache.set('key4', 'value4', 400, 'label4'); // Should evict key1

      expect(cache.has('key1')).toBe(false);
      expect(cache.has('key2')).toBe(true);
      expect(cache.has('key3')).toBe(true);
      expect(cache.has('key4')).toBe(true);
      expect(cache.size()).toBe(3);
    });

    it('should update access order on get', () => {
      cache.set('key1', 'value1', 100, 'label1');
      cache.set('key2', 'value2', 200, 'label2');
      cache.set('key3', 'value3', 300, 'label3');
      
      // Access key1 to make it most recently used
      cache.get('key1');
      
      // Add key4, should evict key2 (now oldest)
      cache.set('key4', 'value4', 400, 'label4');

      expect(cache.has('key1')).toBe(true);
      expect(cache.has('key2')).toBe(false);
      expect(cache.has('key3')).toBe(true);
      expect(cache.has('key4')).toBe(true);
    });

    it('should handle updating existing keys', () => {
      cache.set('key1', 'value1', 100, 'label1');
      cache.set('key2', 'value2', 200, 'label2');
      cache.set('key3', 'value3', 300, 'label3');
      
      // Update key1
      cache.set('key1', 'newValue1', 150, 'newLabel1');
      
      expect(cache.get('key1')).toBe('newValue1');
      expect(cache.size()).toBe(3);
      
      // key1 should now be most recently used
      cache.set('key4', 'value4', 400, 'label4');
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('key2')).toBe(false); // key2 should be evicted
    });
  });

  describe('statistics', () => {
    it('should return accurate cache statistics', () => {
      cache.set('key1', 'value1', 1024, 'label1');
      cache.set('key2', 'value2', 2048, 'label2');
      
      const stats = cache.getStats();
      expect(stats.numItems).toBe(2);
      expect(stats.totalKB).toBe(3); // (1024 + 2048) / 1024
      expect(stats.labels).toEqual(['label1', 'label2']);
    });

    it('should return labels in access order (oldest to newest)', () => {
      cache.set('key1', 'value1', 100, 'label1');
      cache.set('key2', 'value2', 200, 'label2');
      cache.set('key3', 'value3', 300, 'label3');
      
      // Access key1 to move it to end
      cache.get('key1');
      
      const stats = cache.getStats();
      expect(stats.labels).toEqual(['label2', 'label3', 'label1']);
    });

    it('should update totalKB when items are evicted', () => {
      cache.set('key1', 'value1', 1024, 'label1');
      cache.set('key2', 'value2', 2048, 'label2');
      cache.set('key3', 'value3', 3072, 'label3');
      
      let stats = cache.getStats();
      expect(stats.totalKB).toBe(6); // (1024 + 2048 + 3072) / 1024
      
      // Add key4, should evict key1
      cache.set('key4', 'value4', 4096, 'label4');
      
      stats = cache.getStats();
      expect(stats.totalKB).toBe(9); // (2048 + 3072 + 4096) / 1024
    });

    it('should update totalKB when updating existing items', () => {
      cache.set('key1', 'value1', 1024, 'label1');
      
      let stats = cache.getStats();
      expect(stats.totalKB).toBe(1);
      
      // Update with different size
      cache.set('key1', 'value1Updated', 2048, 'label1Updated');
      
      stats = cache.getStats();
      expect(stats.totalKB).toBe(2);
    });
  });
});