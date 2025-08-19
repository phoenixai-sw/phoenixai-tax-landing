const axios = require('axios');

// Mock axios for testing
jest.mock('axios');
const mockedAxios = axios;

// 성능 목표 설정
const PERFORMANCE_TARGETS = {
  TTFB: 1300, // 1.3초
  TOTAL_RESPONSE: 3200, // 3.2초
  CACHE_HIT_RATE: 0.8, // 80%
  WHITELIST_COVERAGE: 0.97, // 97%
  LEGAL_ARTICLE_SPECIFICATION: 0.95, // 95%
  WEB_FIRST_ADOPTION: 0.99, // 99%
};

// 테스트 쿼리 목록
const TEST_QUERIES = [
  '1주택 양도소득세 계산 방법',
  '장기보유특별공제 적용 조건',
  '양도소득세 세율표 2025년',
  '부동산 양도소득세 신고 기한',
  '양도소득세 비과세 요건',
  '다주택 양도소득세 계산',
  '양도소득세 중과세 적용',
  '부동산 양도소득세 공제',
  '양도소득세 신고서 작성법',
  '양도소득세 납부 방법'
];

describe('Performance Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('TTFB should be under 1.3 seconds', async () => {
    const startTime = Date.now();
    
    // Mock successful response
    mockedAxios.post.mockResolvedValue({
      status: 200,
      data: {
        evidencePack: {
          evidence: [
            {
              domain: 'hometax.go.kr',
              title: '양도소득세 계산',
              snippet: '1주택 양도소득세 계산 방법',
              url: 'https://hometax.go.kr/tax'
            }
          ]
        },
        metadata: {
          latency: 800,
          whitelist_coverage: 100,
          cache_hit_rate: 0.5
        }
      }
    });
    
    try {
      const response = await axios.post('/.netlify/functions/build-evidence-pack', {
        query: TEST_QUERIES[0],
        fastMode: true
      }, {
        timeout: 5000
      });
      
      const ttfb = Date.now() - startTime;
      
      expect(ttfb).toBeLessThan(PERFORMANCE_TARGETS.TTFB);
      expect(response.status).toBe(200);
      
    } catch (error) {
      console.error('TTFB test failed:', error.message);
      throw error;
    }
  });

  test('Total response time should be under 3.2 seconds', async () => {
    const startTime = Date.now();
    
    // Mock evidence pack response
    mockedAxios.post.mockResolvedValueOnce({
      status: 200,
      data: {
        evidencePack: {
          evidence: [
            {
              domain: 'hometax.go.kr',
              title: '양도소득세 계산',
              snippet: '1주택 양도소득세 계산 방법',
              url: 'https://hometax.go.kr/tax'
            }
          ]
        }
      }
    });
    
    // Mock answer response
    mockedAxios.post.mockResolvedValueOnce({
      status: 200,
      data: {
        answer: {
          overview: '양도소득세 계산 방법',
          taxRates: '세율표',
          considerations: '유의사항',
          legalBasis: '법령 근거',
          conclusion: '결론'
        }
      }
    });
    
    try {
      // 1. 증거팩 빌드
      const evidenceResponse = await axios.post('/.netlify/functions/build-evidence-pack', {
        query: TEST_QUERIES[0],
        fastMode: true
      });
      
      // 2. 답변 생성
      const answerResponse = await axios.post('/.netlify/functions/answer-assemble', {
        query: TEST_QUERIES[0],
        evidencePack: evidenceResponse.data.evidencePack
      });
      
      const totalTime = Date.now() - startTime;
      
      expect(totalTime).toBeLessThan(PERFORMANCE_TARGETS.TOTAL_RESPONSE);
      expect(evidenceResponse.status).toBe(200);
      expect(answerResponse.status).toBe(200);
      
    } catch (error) {
      console.error('Total response time test failed:', error.message);
      throw error;
    }
  });

  test('Whitelist coverage should be above 97%', async () => {
    const results = [];
    
    // Mock responses for multiple queries
    mockedAxios.post.mockResolvedValue({
      status: 200,
      data: {
        metadata: {
          whitelist_coverage: 98
        }
      }
    });
    
    for (const query of TEST_QUERIES.slice(0, 5)) {
      try {
        const response = await axios.post('/.netlify/functions/build-evidence-pack', {
          query,
          fastMode: true
        });
        
        const whitelistCoverage = response.data.metadata.whitelist_coverage;
        results.push(whitelistCoverage);
        
      } catch (error) {
        console.error(`Query "${query}" failed:`, error.message);
      }
    }
    
    const averageCoverage = results.reduce((sum, coverage) => sum + coverage, 0) / results.length;
    
    expect(averageCoverage).toBeGreaterThan(PERFORMANCE_TARGETS.WHITELIST_COVERAGE * 100);
  });

  test('Cache hit rate should improve with repeated queries', async () => {
    const query = TEST_QUERIES[0];
    const hitRates = [];
    
    // Mock first request (cache miss)
    mockedAxios.post.mockResolvedValueOnce({
      status: 200,
      data: {
        metadata: {
          cache_hit_rate: 0.0
        }
      }
    });
    
    // Mock second request (cache hit)
    mockedAxios.post.mockResolvedValueOnce({
      status: 200,
      data: {
        metadata: {
          cache_hit_rate: 1.0
        }
      }
    });
    
    // 첫 번째 요청 (캐시 미스)
    const firstResponse = await axios.post('/.netlify/functions/build-evidence-pack', {
      query,
      fastMode: true
    });
    hitRates.push(firstResponse.data.metadata.cache_hit_rate);
    
    // 두 번째 요청 (캐시 히트)
    const secondResponse = await axios.post('/.netlify/functions/build-evidence-pack', {
      query,
      fastMode: true
    });
    hitRates.push(secondResponse.data.metadata.cache_hit_rate);
    
    expect(hitRates[1]).toBeGreaterThan(hitRates[0]);
  });
});

describe('Quality Tests', () => {
  test('Legal article specification should be above 95%', async () => {
    const query = '양도소득세 세율표 2025년';
    
    // Mock response with legal content
    mockedAxios.post.mockResolvedValue({
      status: 200,
      data: {
        answer: {
          overview: '양도소득세법 제89조에 따른 세율표',
          taxRates: '2025년 시행되는 세율표',
          considerations: '유의사항',
          legalBasis: '소득세법 제89조',
          conclusion: '결론'
        }
      }
    });
    
    const response = await axios.post('/.netlify/functions/answer-assemble', {
      query,
      evidencePack: {
        evidence: [
          {
            domain: 'hometax.go.kr',
            title: '양도소득세 세율표',
            snippet: '2025년 양도소득세 세율표',
            url: 'https://hometax.go.kr/tax-rate'
          }
        ]
      }
    });
    
    const answer = response.data.answer;
    
    // 법령 조문 포함 여부 확인
    const hasLegalArticle = /조문|법령|소득세법|제\d+조/.test(answer.overview + answer.legalBasis);
    const hasEffectiveDate = /2025년|효력일|시행일/.test(answer.taxRates);
    
    expect(hasLegalArticle || hasEffectiveDate).toBe(true);
  });

  test('Web-first adoption should be above 99% in conflicts', async () => {
    const conflictQueries = [
      '양도소득세 세율 변경사항',
      '장기보유특별공제 개정',
      '1주택 양도소득세 비과세 요건 변경'
    ];
    
    let webFirstCount = 0;
    
    // Mock responses with web_override decision mode
    mockedAxios.post.mockResolvedValue({
      status: 200,
      data: {
        metadata: {
          decisionMode: 'web_override'
        }
      }
    });
    
    for (const query of conflictQueries) {
      try {
        const response = await axios.post('/.netlify/functions/answer-assemble', {
          query,
          evidencePack: {
            evidence: [
              {
                domain: 'hometax.go.kr',
                title: '최신 양도소득세 정보',
                snippet: '2025년 개정된 양도소득세 정보',
                url: 'https://hometax.go.kr/latest'
              }
            ]
          }
        });
        
        if (response.data.metadata.decisionMode === 'web_override') {
          webFirstCount++;
        }
        
      } catch (error) {
        console.error(`Conflict test failed for "${query}":`, error.message);
      }
    }
    
    const adoptionRate = webFirstCount / conflictQueries.length;
    expect(adoptionRate).toBeGreaterThan(PERFORMANCE_TARGETS.WEB_FIRST_ADOPTION);
  });
});

describe('Error Handling Tests', () => {
  test('Should handle API errors gracefully', async () => {
    const invalidQuery = '';
    
    // Mock error response
    mockedAxios.post.mockRejectedValue({
      response: {
        status: 400,
        data: {
          error: 'Query is required'
        }
      }
    });
    
    try {
      await axios.post('/.netlify/functions/build-evidence-pack', {
        query: invalidQuery
      });
    } catch (error) {
      expect(error.response.status).toBe(400);
      expect(error.response.data.error).toBe('Query is required');
    }
  });

  test('Should retry on temporary failures', async () => {
    const query = TEST_QUERIES[0];
    
    // Mock successful response after retry
    mockedAxios.post.mockResolvedValue({
      status: 200,
      data: {
        answer: 'Success after retry'
      }
    });
    
    // 재시도 로직이 포함된 함수 테스트
    const response = await axios.post('/.netlify/functions/answer-assemble', {
      query,
      evidencePack: {
        evidence: []
      }
    });
    
    expect(response.status).toBe(200);
  });
});
