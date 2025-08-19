import { createClient } from '@supabase/supabase-js';
import searchPolicy from '../config/search-policy.json';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export interface CacheItem {
  key: string;
  data: any;
  ttl: Date;
  created_at: Date;
}

export interface CacheStats {
  hitRate: number;
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
}

export class CacheManager {
  private static instance: CacheManager;
  private stats: CacheStats = {
    hitRate: 0,
    totalRequests: 0,
    cacheHits: 0,
    cacheMisses: 0
  };

  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  async get(key: string): Promise<any | null> {
    this.stats.totalRequests++;
    
    try {
      const { data, error } = await supabase
        .from('web_cache')
        .select('*')
        .eq('url', key)
        .gt('ttl', new Date().toISOString())
        .single();

      if (error || !data) {
        this.stats.cacheMisses++;
        this.updateHitRate();
        return null;
      }

      this.stats.cacheHits++;
      this.updateHitRate();
      return data.content;

    } catch (error) {
      console.error('Cache get error:', error);
      this.stats.cacheMisses++;
      this.updateHitRate();
      return null;
    }
  }

  async set(key: string, data: any, ttlHours: number = 24): Promise<void> {
    try {
      const ttl = new Date();
      ttl.setHours(ttl.getHours() + ttlHours);

      const { error } = await supabase
        .from('web_cache')
        .upsert({
          url: key,
          domain: extractDomainFromKey(key),
          content: data,
          ttl: ttl.toISOString(),
          created_at: new Date().toISOString()
        }, {
          onConflict: 'url'
        });

      if (error) {
        console.error('Cache set error:', error);
      }

    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('web_cache')
        .delete()
        .eq('url', key);

      if (error) {
        console.error('Cache delete error:', error);
      }

    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }

  async clear(): Promise<void> {
    try {
      const { error } = await supabase
        .from('web_cache')
        .delete()
        .lt('ttl', new Date().toISOString());

      if (error) {
        console.error('Cache clear error:', error);
      }

    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }

  async cleanup(): Promise<void> {
    try {
      // 만료된 캐시 항목 삭제
      const { error } = await supabase
        .from('web_cache')
        .delete()
        .lt('ttl', new Date().toISOString());

      if (error) {
        console.error('Cache cleanup error:', error);
      }

      // 캐시 크기 제한 확인
      await this.enforceCacheSizeLimit();

    } catch (error) {
      console.error('Cache cleanup error:', error);
    }
  }

  private async enforceCacheSizeLimit(): Promise<void> {
    try {
      const maxSize = searchPolicy.cache.max_cache_size;
      
      // 전체 캐시 항목 수 확인
      const { count, error } = await supabase
        .from('web_cache')
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.error('Cache size check error:', error);
        return;
      }

      if (count && count > maxSize) {
        // 가장 오래된 항목들 삭제
        const { error: deleteError } = await supabase
          .from('web_cache')
          .delete()
          .in('id', 
            supabase
              .from('web_cache')
              .select('id')
              .order('created_at', { ascending: true })
              .limit(count - maxSize)
          );

        if (deleteError) {
          console.error('Cache size limit enforcement error:', deleteError);
        }
      }

    } catch (error) {
      console.error('Cache size limit enforcement error:', error);
    }
  }

  getStats(): CacheStats {
    return { ...this.stats };
  }

  private updateHitRate(): void {
    if (this.stats.totalRequests > 0) {
      this.stats.hitRate = this.stats.cacheHits / this.stats.totalRequests;
    }
  }

  async getWhitelistCache(key: string): Promise<any | null> {
    // 화이트리스트 도메인은 더 긴 TTL 적용
    const ttlHours = 7 * 24; // 7일
    return this.getWithCustomTTL(key, ttlHours);
  }

  async setWhitelistCache(key: string, data: any): Promise<void> {
    // 화이트리스트 도메인은 더 긴 TTL 적용
    const ttlHours = 7 * 24; // 7일
    await this.set(key, data, ttlHours);
  }

  private async getWithCustomTTL(key: string, ttlHours: number): Promise<any | null> {
    this.stats.totalRequests++;
    
    try {
      const ttl = new Date();
      ttl.setHours(ttl.getHours() + ttlHours);

      const { data, error } = await supabase
        .from('web_cache')
        .select('*')
        .eq('url', key)
        .gt('ttl', ttl.toISOString())
        .single();

      if (error || !data) {
        this.stats.cacheMisses++;
        this.updateHitRate();
        return null;
      }

      this.stats.cacheHits++;
      this.updateHitRate();
      return data.content;

    } catch (error) {
      console.error('Cache get error:', error);
      this.stats.cacheMisses++;
      this.updateHitRate();
      return null;
    }
  }
}

// 증거팩 캐시 관리
export class EvidencePackCache {
  private cacheManager: CacheManager;

  constructor() {
    this.cacheManager = CacheManager.getInstance();
  }

  async getEvidencePack(query: string): Promise<any | null> {
    const key = this.generateEvidencePackKey(query);
    return await this.cacheManager.get(key);
  }

  async setEvidencePack(query: string, evidencePack: any): Promise<void> {
    const key = this.generateEvidencePackKey(query);
    
    // 화이트리스트 커버리지에 따라 TTL 조정
    const whitelistCoverage = evidencePack.metadata?.whitelistCoverage || 0;
    const ttlHours = whitelistCoverage >= 80 ? 24 : 6; // 화이트리스트 높으면 더 긴 캐시
    
    await this.cacheManager.set(key, evidencePack, ttlHours);
  }

  async getSearchResults(query: string): Promise<any | null> {
    const key = this.generateSearchKey(query);
    return await this.cacheManager.get(key);
  }

  async setSearchResults(query: string, results: any): Promise<void> {
    const key = this.generateSearchKey(query);
    await this.cacheManager.set(key, results, 6); // 6시간 캐시
  }

  async getWebContent(url: string): Promise<any | null> {
    const key = this.generateWebContentKey(url);
    
    // 화이트리스트 도메인인지 확인
    const domain = extractDomainFromKey(key);
    const isWhitelist = isWhitelistDomain(domain);
    
    if (isWhitelist) {
      return await this.cacheManager.getWhitelistCache(key);
    } else {
      return await this.cacheManager.get(key);
    }
  }

  async setWebContent(url: string, content: any): Promise<void> {
    const key = this.generateWebContentKey(url);
    
    // 화이트리스트 도메인인지 확인
    const domain = extractDomainFromKey(key);
    const isWhitelist = isWhitelistDomain(domain);
    
    if (isWhitelist) {
      await this.cacheManager.setWhitelistCache(key, content);
    } else {
      await this.cacheManager.set(key, content, 24); // 24시간 캐시
    }
  }

  private generateEvidencePackKey(query: string): string {
    return `evidence_pack_${Buffer.from(query).toString('base64')}`;
  }

  private generateSearchKey(query: string): string {
    return `search_${Buffer.from(query).toString('base64')}`;
  }

  private generateWebContentKey(url: string): string {
    return `web_content_${Buffer.from(url).toString('base64')}`;
  }

  async getCacheStats(): Promise<CacheStats> {
    return this.cacheManager.getStats();
  }

  async cleanup(): Promise<void> {
    await this.cacheManager.cleanup();
  }
}

// 유틸리티 함수들
function extractDomainFromKey(key: string): string {
  try {
    // key에서 URL 추출 시도
    if (key.startsWith('web_content_')) {
      const url = Buffer.from(key.replace('web_content_', ''), 'base64').toString();
      return new URL(url).hostname.replace('www.', '');
    }
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

function isWhitelistDomain(domain: string): boolean {
  const whitelistDomains = getAllWhitelistDomains();
  return whitelistDomains.includes(domain);
}

function getAllWhitelistDomains(): string[] {
  const { whitelist } = searchPolicy;
  return [
    ...whitelist.priority_1,
    ...whitelist.priority_2,
    ...whitelist.priority_3,
    ...whitelist.priority_4
  ];
}

// 캐시 성능 모니터링
export class CacheMonitor {
  private static instance: CacheMonitor;
  private metrics: Map<string, number> = new Map();

  static getInstance(): CacheMonitor {
    if (!CacheMonitor.instance) {
      CacheMonitor.instance = new CacheMonitor();
    }
    return CacheMonitor.instance;
  }

  recordMetric(name: string, value: number): void {
    this.metrics.set(name, value);
  }

  getMetrics(): Map<string, number> {
    return new Map(this.metrics);
  }

  async logMetrics(): Promise<void> {
    const stats = CacheManager.getInstance().getStats();
    const metrics = this.getMetrics();
    
    console.log('Cache Performance Metrics:', {
      hitRate: stats.hitRate,
      totalRequests: stats.totalRequests,
      cacheHits: stats.cacheHits,
      cacheMisses: stats.cacheMisses,
      averageLatency: metrics.get('averageLatency') || 0,
      cacheSize: metrics.get('cacheSize') || 0
    });
  }
}
