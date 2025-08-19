import React, { useState, useEffect } from 'react';

export default function PerformanceDashboard() {
  const [metrics, setMetrics] = useState({
    averageLatency: 0,
    averageTokens: 0,
    averageCost: 0,
    conflictRate: 0,
    webOverrideRate: 0,
    cacheHitRate: 0,
    totalQueries: 0,
    errorRate: 0
  });

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000); // 30초마다 업데이트
    
    return () => clearInterval(interval);
  }, []);

  const fetchMetrics = async () => {
    try {
      // 실제 구현에서는 API에서 메트릭 가져오기
      const mockMetrics = {
        averageLatency: Math.random() * 2000 + 500, // 500-2500ms
        averageTokens: Math.random() * 1000 + 500, // 500-1500 tokens
        averageCost: Math.random() * 0.01 + 0.001, // $0.001-0.011
        conflictRate: Math.random() * 20 + 5, // 5-25%
        webOverrideRate: Math.random() * 30 + 70, // 70-100%
        cacheHitRate: Math.random() * 40 + 60, // 60-100%
        totalQueries: Math.floor(Math.random() * 1000) + 100,
        errorRate: Math.random() * 5 + 1 // 1-6%
      };
      
      setMetrics(mockMetrics);
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
    }
  };

  const getStatusColor = (value, threshold, type = 'lower') => {
    if (type === 'lower') {
      return value <= threshold ? 'text-green-600' : 'text-red-600';
    }
    return value >= threshold ? 'text-green-600' : 'text-red-600';
  };

  const formatLatency = (ms) => {
    return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;
  };

  const formatCost = (cost) => {
    return `$${cost.toFixed(4)}`;
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold text-gray-800 mb-6">
        성능 모니터링 대시보드
      </h2>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* 평균 응답 시간 */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">평균 응답 시간</p>
              <p className={`text-2xl font-bold ${getStatusColor(metrics.averageLatency, 1300, 'lower')}`}>
                {formatLatency(metrics.averageLatency)}
              </p>
            </div>
            <div className="text-blue-500">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-1">목표: ≤ 1.3초</p>
        </div>

        {/* 평균 토큰 사용량 */}
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">평균 토큰</p>
              <p className="text-2xl font-bold text-gray-800">
                {Math.round(metrics.averageTokens)}
              </p>
            </div>
            <div className="text-green-500">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-1">GPT-5 사용</p>
        </div>

        {/* 평균 비용 */}
        <div className="bg-yellow-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">평균 비용</p>
              <p className="text-2xl font-bold text-gray-800">
                {formatCost(metrics.averageCost)}
              </p>
            </div>
            <div className="text-yellow-500">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-1">GPT-4o 대비 68% 절감</p>
        </div>

        {/* 충돌률 */}
        <div className="bg-red-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">충돌률</p>
              <p className={`text-2xl font-bold ${getStatusColor(metrics.conflictRate, 30, 'lower')}`}>
                {metrics.conflictRate.toFixed(1)}%
              </p>
            </div>
            <div className="text-red-500">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-1">임계값: 35%</p>
        </div>

        {/* 웹 우선 채택률 */}
        <div className="bg-purple-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">웹 우선 채택률</p>
              <p className={`text-2xl font-bold ${getStatusColor(metrics.webOverrideRate, 99, 'higher')}`}>
                {metrics.webOverrideRate.toFixed(1)}%
              </p>
            </div>
            <div className="text-purple-500">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9" />
              </svg>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-1">목표: ≥ 99%</p>
        </div>

        {/* 캐시 히트율 */}
        <div className="bg-indigo-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">캐시 히트율</p>
              <p className={`text-2xl font-bold ${getStatusColor(metrics.cacheHitRate, 80, 'higher')}`}>
                {metrics.cacheHitRate.toFixed(1)}%
              </p>
            </div>
            <div className="text-indigo-500">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-1">목표: ≥ 80%</p>
        </div>

        {/* 총 쿼리 수 */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">총 쿼리 수</p>
              <p className="text-2xl font-bold text-gray-800">
                {metrics.totalQueries.toLocaleString()}
              </p>
            </div>
            <div className="text-gray-500">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-1">24시간 기준</p>
        </div>

        {/* 에러율 */}
        <div className="bg-orange-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">에러율</p>
              <p className={`text-2xl font-bold ${getStatusColor(metrics.errorRate, 5, 'lower')}`}>
                {metrics.errorRate.toFixed(1)}%
              </p>
            </div>
            <div className="text-orange-500">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-1">목표: ≤ 5%</p>
        </div>
      </div>

      {/* 성능 목표 달성 상태 */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">성능 목표 달성 상태</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center">
            <div className={`w-3 h-3 rounded-full mr-3 ${metrics.averageLatency <= 1300 ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm">TTFB ≤ 1.3초</span>
          </div>
          <div className="flex items-center">
            <div className={`w-3 h-3 rounded-full mr-3 ${metrics.webOverrideRate >= 99 ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm">웹 우선 채택률 ≥ 99%</span>
          </div>
          <div className="flex items-center">
            <div className={`w-3 h-3 rounded-full mr-3 ${metrics.cacheHitRate >= 80 ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm">캐시 히트율 ≥ 80%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
