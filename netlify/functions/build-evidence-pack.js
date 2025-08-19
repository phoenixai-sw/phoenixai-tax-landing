const axios = require('axios');
const searchPolicy = require('../../config/search-policy.json');

// 베이스 URL 안정화 함수
function getInternalBase() {
  if (process.env.NETLIFY_DEV === 'true' && process.env.PORT) {
    return `http://localhost:${process.env.PORT}`;
  }
  return process.env.URL || '';
}

// 내부 함수 호출용 헬퍼 함수
async function callInternalFunction(functionName, data) {
  const base = getInternalBase();
  const response = await fetch(`${base}/.netlify/functions/${functionName}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(data)
  });
  
  if (!response.ok) {
    throw new Error(`Internal function call failed: ${response.status}`);
  }
  
  return await response.json();
}

exports.handler = async (event, context) => {
  // CORS 헤더 설정
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    const { query, forceRefresh = false, fastMode = true } = JSON.parse(event.body || '{}');
    
    if (!query) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Query is required' })
      };
    }

    const startTime = Date.now();
    
    // 성능 최적화: fastMode 적용
    const evidencePack = await buildEvidencePackOptimized(query, forceRefresh, fastMode);
    const latency = Date.now() - startTime;

    // 메트릭 기록
    console.log(`Evidence pack built: query="${query}", latency=${latency}ms, evidence_count=${evidencePack.evidence.length}, fastMode=${fastMode}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        evidencePack,
        metadata: {
          query,
          latency,
          forceRefresh,
          fastMode,
          whitelist_coverage: calculateWhitelistCoverage(evidencePack.evidence),
          domain_diversity: calculateDomainDiversity(evidencePack.evidence),
          cache_hit_rate: evidencePack.cacheStats.hitRate
        }
      })
    };

  } catch (error) {
    console.error('Evidence pack build error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Evidence pack build failed', details: error.message })
    };
  }
};

async function buildEvidencePackOptimized(query, forceRefresh = false, fastMode = true) {
  const cacheKey = generateCacheKey(query);
  
  // 1. 캐시 확인 (강제 새로고침이 아닌 경우)
  if (!forceRefresh) {
    const cachedResult = await checkCache(cacheKey);
    if (cachedResult) {
      return {
        evidence: cachedResult.evidence,
        cacheStats: { hitRate: 1.0, source: 'cache' }
      };
    }
  }

  // 2. 최적화된 어댑티브 검색 수행
  const searchResults = await performAdaptiveSearchOptimized(query, fastMode);
  
  // 3. 조건부 웹페이지 본문 추출 (fastMode에서는 제한)
  const extractedContents = fastMode 
    ? await extractWebContentsFast(searchResults)
    : await extractWebContents(searchResults);
  
  // 4. 최적화된 재랭킹
  const rerankedResults = await rerankSearchResultsOptimized(query, extractedContents, fastMode);
  
  // 5. 증거팩 포맷팅
  const evidencePack = formatEvidencePack(rerankedResults);
  
  // 6. 캐시 저장
  await saveToCache(cacheKey, evidencePack);
  
  return {
    evidence: evidencePack,
    cacheStats: { hitRate: 0.0, source: 'fresh' }
  };
}

async function performAdaptiveSearchOptimized(query, fastMode = true) {
  const config = searchPolicy.search_config;
  
  // fastMode에서는 화이트리스트만 검색
  if (fastMode) {
    return await searchWithWhitelist(query, Math.min(config.initial_n, 5));
  }
  
  // 1단계: 화이트리스트 우선 검색
  const whitelistResults = await searchWithWhitelist(query, config.initial_n);
  
  // 2단계: 어댑티브 확장 (필요시)
  if (whitelistResults.length < config.min_whitelist_results) {
    console.log(`Expanding search: whitelist results (${whitelistResults.length}) < minimum (${config.min_whitelist_results})`);
    const webResults = await searchFullWeb(query, config.expand_n);
    return mergeAndDeduplicate(whitelistResults, webResults);
  }
  
  return whitelistResults;
}

async function searchWithWhitelist(query, n) {
  const whitelist = getAllWhitelistDomains();
  const siteRestrict = whitelist.join('|');
  
  return await performGoogleSearch(query, n, siteRestrict);
}

async function searchFullWeb(query, n) {
  return await performGoogleSearch(query, n);
}

async function performGoogleSearch(query, n, siteRestrict = null) {
  const apiKey = process.env.GOOGLE_API_KEY;
  const searchEngineId = process.env.SEARCH_ENGINE_ID;
  
  if (!apiKey || !searchEngineId) {
    throw new Error('Google API credentials not configured');
  }

  const params = {
    key: apiKey,
    cx: searchEngineId,
    q: query,
    num: Math.min(n, 10),
    lr: 'lang_ko',
    gl: 'kr',
    cr: 'countryKR',
    filter: '1',
    dateRestrict: searchPolicy.search_config.freshness
  };

  if (siteRestrict) {
    params.siteSearch = siteRestrict;
  }

  try {
    const response = await axios.get('https://www.googleapis.com/customsearch/v1', { 
      params,
      timeout: 10000 // 10초 타임아웃
    });
    
    if (response.data.items) {
      return response.data.items.map(item => ({
        title: item.title,
        link: item.link,
        snippet: item.snippet,
        domain: extractDomain(item.link),
        priority: getDomainPriority(item.link)
      }));
    }
    
    return [];
  } catch (error) {
    console.error('Google CSE error:', error.response?.data || error.message);
    throw new Error('Google search failed');
  }
}

async function extractWebContentsFast(searchResults) {
  // fastMode: 상위 3개만 추출, 병렬 처리, 짧은 타임아웃
  const topResults = searchResults.slice(0, 3);
  
  const extractionPromises = topResults.map(async (result) => {
    try {
      const content = await extractWebContentFast(result.link);
      return {
        ...result,
        content
      };
    } catch (error) {
      console.warn(`Failed to extract content from ${result.link}:`, error.message);
      return result;
    }
  });

  return await Promise.all(extractionPromises);
}

async function extractWebContents(searchResults) {
  const extractionPromises = searchResults.map(async (result) => {
    try {
      const content = await extractWebContent(result.link);
      return {
        ...result,
        content
      };
    } catch (error) {
      console.warn(`Failed to extract content from ${result.link}:`, error.message);
      return result;
    }
  });

  return await Promise.all(extractionPromises);
}

async function extractWebContentFast(url) {
  try {
    const response = await axios.get(url, {
      timeout: 5000, // 5초 타임아웃 (fastMode)
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8'
      },
      maxRedirects: 3 // 리다이렉트 제한
    });

    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status}`);
    }

    // 간단한 HTML 파싱 (실제로는 Readability 사용)
    const html = response.data;
    const title = extractTitleFromHTML(html);
    const textContent = extractTextFromHTMLFast(html); // 짧은 텍스트만
    const publishedAt = extractPublishedDateFromHTML(html);

    return {
      title: title || '제목 없음',
      textContent: textContent || '',
      publishedAt,
      domain: extractDomain(url),
      url
    };

  } catch (error) {
    throw new Error(`Extraction failed: ${error.message}`);
  }
}

async function extractWebContent(url) {
  try {
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8'
      },
      maxRedirects: 5
    });

    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status}`);
    }

    // 간단한 HTML 파싱 (실제로는 Readability 사용)
    const html = response.data;
    const title = extractTitleFromHTML(html);
    const textContent = extractTextFromHTML(html);
    const publishedAt = extractPublishedDateFromHTML(html);

    return {
      title: title || '제목 없음',
      textContent: textContent || '',
      publishedAt,
      domain: extractDomain(url),
      url
    };

  } catch (error) {
    throw new Error(`Extraction failed: ${error.message}`);
  }
}

function extractTitleFromHTML(html) {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return titleMatch ? titleMatch[1].trim() : null;
}

function extractTextFromHTMLFast(html) {
  // fastMode: 짧은 텍스트만 추출
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 500); // 최대 500자 (fastMode)
}

function extractTextFromHTML(html) {
  // 간단한 텍스트 추출 (실제로는 Readability 사용)
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 2000); // 최대 2000자
}

function extractPublishedDateFromHTML(html) {
  // 메타데이터에서 발행일 추출
  const dateMatch = html.match(/<meta[^>]*(?:property|name)=["'](?:article:published_time|publish_date|pubdate)["'][^>]*content=["']([^"']+)["']/i);
  if (dateMatch) {
    const date = new Date(dateMatch[1]);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }
  return null;
}

async function rerankSearchResultsOptimized(query, results, fastMode = true) {
  // fastMode에서는 간단한 재랭킹만
  if (fastMode) {
    return rerankSearchResultsSimple(query, results);
  }
  
  // 전체 재랭킹 (실제로는 임베딩 + BM25 사용)
  const reranked = results.map(result => {
    let score = 0;
    
    // 화이트리스트 우선순위 점수
    const priority = result.priority || 5;
    score += (6 - priority) * 0.3; // 우선순위가 높을수록 높은 점수
    
    // 제목 매칭 점수
    if (result.title && query.toLowerCase().includes(result.title.toLowerCase())) {
      score += 0.2;
    }
    
    // 스니펫 매칭 점수
    if (result.snippet && query.toLowerCase().includes(result.snippet.toLowerCase())) {
      score += 0.1;
    }
    
    // 최신성 점수
    if (result.content?.publishedAt) {
      const daysDiff = (Date.now() - result.content.publishedAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysDiff <= 56) { // 8주 이내
        score += 0.2;
      } else if (daysDiff <= 365) { // 1년 이내
        score += 0.1;
      }
    }
    
    return {
      ...result,
      score
    };
  });

  // 점수순 정렬 및 도메인 다양성 보장
  return ensureDomainDiversity(reranked, searchPolicy.search_config.final_k);
}

function rerankSearchResultsSimple(query, results) {
  // 간단한 재랭킹 (fastMode용)
  return results.map(result => {
    let score = 0;
    
    // 화이트리스트 우선순위 점수만
    const priority = result.priority || 5;
    score += (6 - priority) * 0.5;
    
    // 제목 매칭 점수
    if (result.title && query.toLowerCase().includes(result.title.toLowerCase())) {
      score += 0.3;
    }
    
    return {
      ...result,
      score
    };
  }).sort((a, b) => b.score - a.score);
}

function ensureDomainDiversity(results, maxResults) {
  const selected = [];
  const selectedDomains = new Set();
  
  // 점수순 정렬
  const sortedResults = [...results].sort((a, b) => b.score - a.score);
  
  for (const result of sortedResults) {
    if (selected.length >= maxResults) break;
    
    // 도메인 다양성 확인
    if (selectedDomains.has(result.domain)) {
      // 이미 선택된 도메인이면 더 높은 점수여야 선택
      const existingScore = selected.find(r => r.domain === result.domain)?.score || 0;
      if (result.score > existingScore * 1.2) {
        selected.splice(selected.findIndex(r => r.domain === result.domain), 1);
        selected.push(result);
      }
    } else {
      selected.push(result);
      selectedDomains.add(result.domain);
    }
  }
  
  return selected.slice(0, maxResults);
}

function formatEvidencePack(results) {
  return results.map(result => ({
    domain: result.domain,
    title: result.title,
    snippet: result.snippet,
    url: result.link,
    publishedAt: result.content?.publishedAt,
    priority: result.priority,
    score: result.score
  }));
}

// 캐시 관련 함수들 (실제로는 Supabase 사용)
async function checkCache(key) {
  // 임시 구현 - 실제로는 Supabase web_cache 테이블 조회
  return null;
}

async function saveToCache(key, data) {
  // 임시 구현 - 실제로는 Supabase web_cache 테이블 저장
  console.log(`Caching evidence pack for key: ${key}`);
}

function generateCacheKey(query) {
  return `evidence_pack_${Buffer.from(query).toString('base64')}`;
}

// 유틸리티 함수들
function getAllWhitelistDomains() {
  const { whitelist } = searchPolicy;
  return [
    ...whitelist.priority_1,
    ...whitelist.priority_2,
    ...whitelist.priority_3,
    ...whitelist.priority_4
  ];
}

function getDomainPriority(url) {
  const domain = extractDomain(url);
  const { whitelist } = searchPolicy;
  
  if (whitelist.priority_1.includes(domain)) return 1;
  if (whitelist.priority_2.includes(domain)) return 2;
  if (whitelist.priority_3.includes(domain)) return 3;
  if (whitelist.priority_4.includes(domain)) return 4;
  return 5;
}

function extractDomain(url) {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

function mergeAndDeduplicate(whitelistResults, webResults) {
  const seen = new Set();
  const merged = [];
  
  // 화이트리스트 결과 우선
  for (const result of whitelistResults) {
    if (!seen.has(result.link)) {
      seen.add(result.link);
      merged.push(result);
    }
  }
  
  // 웹 결과 추가 (중복 제거)
  for (const result of webResults) {
    if (!seen.has(result.link)) {
      seen.add(result.link);
      merged.push(result);
    }
  }
  
  return merged.slice(0, searchPolicy.search_config.final_k);
}

function calculateWhitelistCoverage(evidence) {
  if (evidence.length === 0) return 0;
  const whitelistDomains = getAllWhitelistDomains();
  const whitelistCount = evidence.filter(e => whitelistDomains.includes(e.domain)).length;
  return (whitelistCount / evidence.length) * 100;
}

function calculateDomainDiversity(evidence) {
  if (evidence.length === 0) return 0;
  const uniqueDomains = new Set(evidence.map(e => e.domain)).size;
  return (uniqueDomains / evidence.length) * 100;
}
