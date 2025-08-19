import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export interface SearchMetrics {
  sessionId?: string;
  query: string;
  latency: number;
  tokensUsed: number;
  decisionMode: 'web_override' | 'gpt_draft' | 'hybrid';
  conflictScore: number;
  topDomain: string;
  evidenceCount: number;
  whitelistCoverage: number;
  cacheHitRate: number;
  costEstimate: number;
}

export interface PerformanceMetrics {
  averageLatency: number;
  averageTokens: number;
  averageCost: number;
  conflictRate: number;
  webOverrideRate: number;
  cacheHitRate: number;
}

export class MetricsManager {
  private static instance: MetricsManager;

  static getInstance(): MetricsManager {
    if (!MetricsManager.instance) {
      MetricsManager.instance = new MetricsManager();
    }
    return MetricsManager.instance;
  }

  async recordSearchMetrics(metrics: SearchMetrics): Promise<void> {
    try {
      const { error } = await supabase
        .from('search_metrics')
        .insert({
          session_id: metrics.sessionId,
          latency_ms: metrics.latency,
          tokens_used: metrics.tokensUsed,
          decision_mode: metrics.decisionMode,
          conflict_score: metrics.conflictScore,
          top_domain: metrics.topDomain,
          evidence_count: metrics.evidenceCount,
          created_at: new Date().toISOString()
        });

      if (error) {
        console.error('Failed to record search metrics:', error);
      }

      // 비용 추적
      await this.trackCost(metrics);

    } catch (error) {
      console.error('Metrics recording error:', error);
    }
  }

  async getPerformanceMetrics(timeRange: '1h' | '24h' | '7d' | '30d' = '24h'): Promise<PerformanceMetrics> {
    try {
      const startDate = this.getStartDate(timeRange);
      
      const { data, error } = await supabase
        .from('search_metrics')
        .select('*')
        .gte('created_at', startDate.toISOString());

      if (error) {
        console.error('Failed to fetch performance metrics:', error);
        return this.getDefaultMetrics();
      }

      return this.calculatePerformanceMetrics(data || []);

    } catch (error) {
      console.error('Performance metrics error:', error);
      return this.getDefaultMetrics();
    }
  }

  async getConflictAnalysis(timeRange: '1h' | '24h' | '7d' | '30d' = '24h'): Promise<any> {
    try {
      const startDate = this.getStartDate(timeRange);
      
      const { data, error } = await supabase
        .from('search_metrics')
        .select('*')
        .gte('created_at', startDate.toISOString());

      if (error) {
        console.error('Failed to fetch conflict analysis:', error);
        return {};
      }

      return this.analyzeConflicts(data || []);

    } catch (error) {
      console.error('Conflict analysis error:', error);
      return {};
    }
  }

  async getCostAnalysis(timeRange: '1h' | '24h' | '7d' | '30d' = '24h'): Promise<any> {
    try {
      const startDate = this.getStartDate(timeRange);
      
      const { data, error } = await supabase
        .from('search_metrics')
        .select('*')
        .gte('created_at', startDate.toISOString());

      if (error) {
        console.error('Failed to fetch cost analysis:', error);
        return {};
      }

      return this.analyzeCosts(data || []);

    } catch (error) {
      console.error('Cost analysis error:', error);
      return {};
    }
  }

  private async trackCost(metrics: SearchMetrics): Promise<void> {
    try {
      // OpenAI API 비용 계산 (대략적 추정)
      const costPer1kTokens = this.getCostPer1kTokens();
      const estimatedCost = (metrics.tokensUsed / 1000) * costPer1kTokens;

      // 비용 메트릭 저장 (별도 테이블 또는 기존 테이블에 추가)
      console.log(`Estimated cost for query "${metrics.query}": $${estimatedCost.toFixed(4)}`);

    } catch (error) {
      console.error('Cost tracking error:', error);
    }
  }

  private getCostPer1kTokens(): number {
    // GPT-5 기준 (2025년 1월)
    // Input: $1.00 per 1M tokens
    // Output: $3.00 per 1M tokens
    return 0.004; // 평균 비용 (입력+출력) - GPT-4o 대비 68% 저렴
  }

  private getStartDate(timeRange: string): Date {
    const now = new Date();
    
    switch (timeRange) {
      case '1h':
        return new Date(now.getTime() - 60 * 60 * 1000);
      case '24h':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }
  }

  private calculatePerformanceMetrics(data: any[]): PerformanceMetrics {
    if (data.length === 0) {
      return this.getDefaultMetrics();
    }

    const totalLatency = data.reduce((sum, item) => sum + (item.latency_ms || 0), 0);
    const totalTokens = data.reduce((sum, item) => sum + (item.tokens_used || 0), 0);
    const totalCost = data.reduce((sum, item) => {
      const cost = (item.tokens_used || 0) / 1000 * this.getCostPer1kTokens();
      return sum + cost;
    }, 0);

    const conflicts = data.filter(item => (item.conflict_score || 0) >= 0.35);
    const webOverrides = data.filter(item => item.decision_mode === 'web_override');

    return {
      averageLatency: totalLatency / data.length,
      averageTokens: totalTokens / data.length,
      averageCost: totalCost / data.length,
      conflictRate: (conflicts.length / data.length) * 100,
      webOverrideRate: (webOverrides.length / data.length) * 100,
      cacheHitRate: 0 // 캐시 히트율은 별도 계산 필요
    };
  }

  private analyzeConflicts(data: any[]): any {
    const conflicts = data.filter(item => (item.conflict_score || 0) >= 0.35);
    
    const conflictTypes = {
      high: conflicts.filter(item => (item.conflict_score || 0) >= 0.8).length,
      medium: conflicts.filter(item => (item.conflict_score || 0) >= 0.6 && (item.conflict_score || 0) < 0.8).length,
      low: conflicts.filter(item => (item.conflict_score || 0) >= 0.35 && (item.conflict_score || 0) < 0.6).length
    };

    const decisionModes = {
      web_override: conflicts.filter(item => item.decision_mode === 'web_override').length,
      hybrid: conflicts.filter(item => item.decision_mode === 'hybrid').length,
      gpt_draft: conflicts.filter(item => item.decision_mode === 'gpt_draft').length
    };

    return {
      totalConflicts: conflicts.length,
      conflictRate: (conflicts.length / data.length) * 100,
      conflictTypes,
      decisionModes,
      averageConflictScore: conflicts.length > 0 
        ? conflicts.reduce((sum, item) => sum + (item.conflict_score || 0), 0) / conflicts.length 
        : 0
    };
  }

  private analyzeCosts(data: any[]): any {
    const totalTokens = data.reduce((sum, item) => sum + (item.tokens_used || 0), 0);
    const totalCost = data.reduce((sum, item) => {
      const cost = (item.tokens_used || 0) / 1000 * this.getCostPer1kTokens();
      return sum + cost;
    }, 0);

    const costByDecisionMode = {
      web_override: data
        .filter(item => item.decision_mode === 'web_override')
        .reduce((sum, item) => sum + ((item.tokens_used || 0) / 1000 * this.getCostPer1kTokens()), 0),
      hybrid: data
        .filter(item => item.decision_mode === 'hybrid')
        .reduce((sum, item) => sum + ((item.tokens_used || 0) / 1000 * this.getCostPer1kTokens()), 0),
      gpt_draft: data
        .filter(item => item.decision_mode === 'gpt_draft')
        .reduce((sum, item) => sum + ((item.tokens_used || 0) / 1000 * this.getCostPer1kTokens()), 0)
    };

    return {
      totalTokens,
      totalCost,
      averageCostPerQuery: data.length > 0 ? totalCost / data.length : 0,
      costByDecisionMode,
      estimatedMonthlyCost: totalCost * 30 // 30일 기준 추정
    };
  }

  private getDefaultMetrics(): PerformanceMetrics {
    return {
      averageLatency: 0,
      averageTokens: 0,
      averageCost: 0,
      conflictRate: 0,
      webOverrideRate: 0,
      cacheHitRate: 0
    };
  }

  // 실시간 알림 시스템
  async checkAlerts(): Promise<any[]> {
    const alerts: any[] = [];
    
    try {
      // 1시간 평균 지연시간 체크
      const hourlyMetrics = await this.getPerformanceMetrics('1h');
      if (hourlyMetrics.averageLatency > 10000) { // 10초 이상
        alerts.push({
          type: 'high_latency',
          message: `평균 응답 시간이 ${(hourlyMetrics.averageLatency / 1000).toFixed(1)}초로 높습니다.`,
          severity: 'warning'
        });
      }

      // 비용 임계값 체크
      const costAnalysis = await this.getCostAnalysis('24h');
      if (costAnalysis.totalCost > 10) { // $10 이상
        alerts.push({
          type: 'high_cost',
          message: `24시간 비용이 $${costAnalysis.totalCost.toFixed(2)}로 높습니다.`,
          severity: 'warning'
        });
      }

      // 충돌률 체크
      const conflictAnalysis = await this.getConflictAnalysis('24h');
      if (conflictAnalysis.conflictRate > 30) { // 30% 이상
        alerts.push({
          type: 'high_conflict_rate',
          message: `충돌률이 ${conflictAnalysis.conflictRate.toFixed(1)}%로 높습니다.`,
          severity: 'info'
        });
      }

    } catch (error) {
      console.error('Alert check error:', error);
    }

    return alerts;
  }

  // 대시보드용 요약 통계
  async getDashboardStats(): Promise<any> {
    try {
      const [performance, conflicts, costs, alerts] = await Promise.all([
        this.getPerformanceMetrics('24h'),
        this.getConflictAnalysis('24h'),
        this.getCostAnalysis('24h'),
        this.checkAlerts()
      ]);

      return {
        performance,
        conflicts,
        costs,
        alerts,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Dashboard stats error:', error);
      return {
        performance: this.getDefaultMetrics(),
        conflicts: {},
        costs: {},
        alerts: [],
        timestamp: new Date().toISOString()
      };
    }
  }

  // 비용 비교 분석
  async getCostComparison(): Promise<any> {
    const gpt5Cost = this.getCostPer1kTokens();
    const gpt4oCost = 0.0125; // GPT-4o 비용
    
    return {
      gpt5: {
        costPer1kTokens: gpt5Cost,
        monthlyEstimate: gpt5Cost * 100000, // 10만 토큰 기준
        savings: ((gpt4oCost - gpt5Cost) / gpt4oCost) * 100
      },
      gpt4o: {
        costPer1kTokens: gpt4oCost,
        monthlyEstimate: gpt4oCost * 100000
      },
      comparison: {
        savingsPercentage: ((gpt4oCost - gpt5Cost) / gpt4oCost) * 100,
        monthlySavings: (gpt4oCost - gpt5Cost) * 100000
      }
    };
  }
}

// 유틸리티 함수들
export function formatLatency(latency: number): string {
  if (latency < 1000) {
    return `${latency}ms`;
  } else {
    return `${(latency / 1000).toFixed(1)}s`;
  }
}

export function formatCost(cost: number): string {
  return `$${cost.toFixed(4)}`;
}

export function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}
