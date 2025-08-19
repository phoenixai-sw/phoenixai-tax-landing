export interface AppError {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export class ErrorHandler {
  private static instance: ErrorHandler;
  private errorLog: AppError[] = [];

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  handleError(error: any, context: string): AppError {
    const appError: AppError = {
      code: this.getErrorCode(error),
      message: this.getErrorMessage(error),
      details: error,
      timestamp: new Date(),
      severity: this.getErrorSeverity(error)
    };

    this.logError(appError);
    this.notifyError(appError);

    return appError;
  }

  private getErrorCode(error: any): string {
    if (error.response?.status) {
      return `HTTP_${error.response.status}`;
    }
    if (error.code) {
      return error.code;
    }
    return 'UNKNOWN_ERROR';
  }

  private getErrorMessage(error: any): string {
    if (error.response?.data?.error) {
      return error.response.data.error;
    }
    if (error.message) {
      return error.message;
    }
    return '알 수 없는 오류가 발생했습니다.';
  }

  private getErrorSeverity(error: any): AppError['severity'] {
    const code = this.getErrorCode(error);
    
    // API 키 오류는 critical
    if (code.includes('UNAUTHORIZED') || code.includes('API_KEY')) {
      return 'critical';
    }
    
    // 네트워크 오류는 high
    if (code.includes('NETWORK') || code.includes('TIMEOUT')) {
      return 'high';
    }
    
    // 4xx 오류는 medium
    if (code.startsWith('HTTP_4')) {
      return 'medium';
    }
    
    // 5xx 오류는 high
    if (code.startsWith('HTTP_5')) {
      return 'high';
    }
    
    return 'low';
  }

  private logError(error: AppError): void {
    this.errorLog.push(error);
    
    // 로그 크기 제한 (최근 1000개만 유지)
    if (this.errorLog.length > 1000) {
      this.errorLog = this.errorLog.slice(-1000);
    }
    
    console.error(`[${error.severity.toUpperCase()}] ${error.code}: ${error.message}`, error.details);
  }

  private notifyError(error: AppError): void {
    // Critical 오류는 즉시 알림
    if (error.severity === 'critical') {
      this.sendAlert(error);
    }
    
    // High 오류는 5분 내 3개 이상이면 알림
    if (error.severity === 'high') {
      const recentHighErrors = this.errorLog.filter(e => 
        e.severity === 'high' && 
        e.timestamp.getTime() > Date.now() - 5 * 60 * 1000
      );
      
      if (recentHighErrors.length >= 3) {
        this.sendAlert(error);
      }
    }
  }

  private sendAlert(error: AppError): void {
    // 실제 구현에서는 Slack, 이메일 등으로 알림
    console.warn(`🚨 ALERT: ${error.severity.toUpperCase()} error detected:`, {
      code: error.code,
      message: error.message,
      timestamp: error.timestamp
    });
  }

  getErrorStats(timeRange: '1h' | '24h' | '7d' = '24h'): any {
    const now = Date.now();
    const timeRanges = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000
    };
    
    const cutoff = now - timeRanges[timeRange];
    const recentErrors = this.errorLog.filter(e => e.timestamp.getTime() > cutoff);
    
    const severityCounts = {
      critical: recentErrors.filter(e => e.severity === 'critical').length,
      high: recentErrors.filter(e => e.severity === 'high').length,
      medium: recentErrors.filter(e => e.severity === 'medium').length,
      low: recentErrors.filter(e => e.severity === 'low').length
    };
    
    const codeCounts = recentErrors.reduce((acc, error) => {
      acc[error.code] = (acc[error.code] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return {
      totalErrors: recentErrors.length,
      severityCounts,
      codeCounts,
      timeRange
    };
  }

  clearErrorLog(): void {
    this.errorLog = [];
  }
}

// 유틸리티 함수들
export function createRetryConfig(maxRetries: number = 3, baseDelay: number = 1000) {
  return {
    maxRetries,
    baseDelay,
    getDelay: (attempt: number) => Math.min(baseDelay * Math.pow(2, attempt), 10000)
  };
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config = createRetryConfig()
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < config.maxRetries) {
        const delay = config.getDelay(attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError!;
}

export function isRetryableError(error: any): boolean {
  const code = error.code || error.response?.status;
  
  // 네트워크 오류, 타임아웃, 5xx 서버 오류는 재시도 가능
  return (
    code === 'NETWORK_ERROR' ||
    code === 'TIMEOUT' ||
    (code >= 500 && code < 600) ||
    error.message?.includes('timeout') ||
    error.message?.includes('network')
  );
}

export function createTimeoutPromise<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string = 'Operation timed out'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
    )
  ]);
}
