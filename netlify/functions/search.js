const axios = require('axios');
const searchPolicy = require('../../config/search-policy.json');

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
    const { query, expand = false } = JSON.parse(event.body || '{}');
    
    if (!query) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Query is required' })
      };
    }

    const startTime = Date.now();
    const results = await performAdaptiveSearch(query, expand);
    const latency = Date.now() - startTime;

    // 메트릭 기록 (실제 구현에서는 DB에 저장)
    console.log(`Search metrics: query="${query}", latency=${latency}ms, results=${results.length}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        results,
        metadata: {
          query,
          latency,
          expand,
          whitelist_coverage: calculateWhitelistCoverage(results),
          domain_diversity: calculateDomainDiversity(results)
        }
      })
    };

  } catch (error) {
    console.error('Search error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Search failed', details: error.message })
    };
  }
};

async function performAdaptiveSearch(query, expand = false) {
  const config = searchPolicy.search_config;
  const n = expand ? config.expand_n : config.initial_n;
  
  // 1단계: 화이트리스트 우선 검색
  const whitelistResults = await searchWithWhitelist(query, n);
  
  // 2단계: 어댑티브 확장 (필요시)
  if (!expand && whitelistResults.length < config.min_whitelist_results) {
    console.log(`Expanding search: whitelist results (${whitelistResults.length}) < minimum (${config.min_whitelist_results})`);
    return await performAdaptiveSearch(query, true);
  }
  
  // 3단계: 전체 웹 검색 (확장 모드)
  if (expand) {
    const webResults = await searchFullWeb(query, n);
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
    num: Math.min(n, 10), // Google CSE 최대 10개
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
    const response = await axios.get('https://www.googleapis.com/customsearch/v1', { params });
    
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
  return 5; // 일반 웹
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

function calculateWhitelistCoverage(results) {
  if (results.length === 0) return 0;
  const whitelistDomains = getAllWhitelistDomains();
  const whitelistCount = results.filter(r => whitelistDomains.includes(r.domain)).length;
  return (whitelistCount / results.length) * 100;
}

function calculateDomainDiversity(results) {
  if (results.length === 0) return 0;
  const uniqueDomains = new Set(results.map(r => r.domain)).size;
  return (uniqueDomains / results.length) * 100;
}
