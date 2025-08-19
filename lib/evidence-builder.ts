import { ExtractedContent, extractWebContent } from './extract';
import { rerankSearchResults, SearchResult, RerankedResult } from './rerank';
import searchPolicy from '../config/search-policy.json';

export interface EvidenceItem {
  domain: string;
  title: string;
  snippet: string;
  url: string;
  publishedAt?: Date;
  priority: number;
  score: number;
  type: 'law' | 'precedent' | 'guide' | 'calculation' | 'general';
  relevance: number;
}

export interface EvidencePack {
  evidence: EvidenceItem[];
  metadata: {
    query: string;
    latency: number;
    whitelistCoverage: number;
    domainDiversity: number;
    averageRelevance: number;
    cacheHitRate: number;
  };
}

export interface EvidenceBuilderOptions {
  query: string;
  forceRefresh?: boolean;
  maxResults?: number;
  includePrecedents?: boolean;
  includeCalculations?: boolean;
}

export async function buildTaxEvidencePack(options: EvidenceBuilderOptions): Promise<EvidencePack> {
  const {
    query,
    forceRefresh = false,
    maxResults = searchPolicy.search_config.final_k,
    includePrecedents = true,
    includeCalculations = true
  } = options;

  const startTime = Date.now();

  // 1. 기본 검색 수행
  const baseResults = await performTaxSearch(query);
  
  // 2. 양도세 특화 확장 검색
  const expandedResults = await expandTaxSearch(query, baseResults, {
    includePrecedents,
    includeCalculations
  });

  // 3. 웹페이지 본문 추출
  const extractedResults = await extractTaxContents(expandedResults);
  
  // 4. 양도세 특화 재랭킹
  const rerankedResults = await rerankTaxResults(query, extractedResults);
  
  // 5. 증거팩 포맷팅
  const evidencePack = formatTaxEvidencePack(rerankedResults, maxResults);
  
  const latency = Date.now() - startTime;

  return {
    evidence: evidencePack,
    metadata: {
      query,
      latency,
      whitelistCoverage: calculateWhitelistCoverage(evidencePack),
      domainDiversity: calculateDomainDiversity(evidencePack),
      averageRelevance: calculateAverageRelevance(evidencePack),
      cacheHitRate: 0.0 // 실제로는 캐시 시스템에서 계산
    }
  };
}

async function performTaxSearch(query: string): Promise<SearchResult[]> {
  // 기본 검색 로직 (실제로는 search.js 함수 호출)
  const searchResults: SearchResult[] = [];
  
  // 화이트리스트 우선 검색
  const whitelistDomains = getAllWhitelistDomains();
  
  // 각 우선순위별로 검색
  for (const priority of [1, 2, 3, 4]) {
    const domains = getDomainsByPriority(priority);
    const results = await searchDomains(query, domains);
    searchResults.push(...results);
  }
  
  return searchResults;
}

async function expandTaxSearch(
  query: string, 
  baseResults: SearchResult[], 
  options: { includePrecedents: boolean; includeCalculations: boolean }
): Promise<SearchResult[]> {
  const expandedResults = [...baseResults];
  
  // 1. 판례 검색 (필요시)
  if (options.includePrecedents) {
    const precedentQuery = `${query} 판례 2025`;
    const precedentResults = await searchPrecedents(precedentQuery);
    expandedResults.push(...precedentResults);
  }
  
  // 2. 계산기 검색 (필요시)
  if (options.includeCalculations) {
    const calculationQuery = `${query} 계산기 자동계산`;
    const calculationResults = await searchCalculations(calculationQuery);
    expandedResults.push(...calculationResults);
  }
  
  // 3. 최신 개정사항 검색
  const amendmentQuery = `${query} 2025년 개정`;
  const amendmentResults = await searchAmendments(amendmentQuery);
  expandedResults.push(...amendmentResults);
  
  return expandedResults;
}

async function searchPrecedents(query: string): Promise<SearchResult[]> {
  // 대법원, 택스넷 등에서 판례 검색
  const precedentDomains = ['scourt.go.kr', 'taxnet.co.kr'];
  return await searchDomains(query, precedentDomains);
}

async function searchCalculations(query: string): Promise<SearchResult[]> {
  // 홈택스, 국세청 등에서 계산기 검색
  const calculationDomains = ['hometax.go.kr', 'nts.go.kr'];
  return await searchDomains(query, calculationDomains);
}

async function searchAmendments(query: string): Promise<SearchResult[]> {
  // 최신 개정사항 검색
  const amendmentDomains = ['easylaw.go.kr', 'korea.kr'];
  return await searchDomains(query, amendmentDomains);
}

async function searchDomains(query: string, domains: string[]): Promise<SearchResult[]> {
  // 실제로는 Google CSE API 호출
  // 임시 구현
  return domains.map(domain => ({
    title: `${query} 관련 정보`,
    link: `https://${domain}/search?q=${encodeURIComponent(query)}`,
    snippet: `${domain}에서 제공하는 ${query} 관련 정보입니다.`,
    domain,
    priority: getDomainPriority(domain)
  }));
}

async function extractTaxContents(results: SearchResult[]): Promise<(SearchResult & { content?: ExtractedContent })[]> {
  const extractionPromises = results.map(async (result) => {
    try {
      const content = await extractWebContent(result.link);
      return {
        ...result,
        content
      };
    } catch (error) {
      console.warn(`Failed to extract content from ${result.link}:`, error);
      return result;
    }
  });

  return await Promise.all(extractionPromises);
}

async function rerankTaxResults(
  query: string, 
  results: (SearchResult & { content?: ExtractedContent })[]
): Promise<RerankedResult[]> {
  // 기본 재랭킹 수행
  const rerankedResults = await rerankSearchResults({ query, results });
  
  // 양도세 특화 가중치 적용
  return rerankedResults.map(result => ({
    ...result,
    score: applyTaxSpecificWeights(result, query)
  }));
}

function applyTaxSpecificWeights(result: RerankedResult, query: string): number {
  let adjustedScore = result.score;
  
  // 1. 양도세 관련 키워드 가중치
  const taxKeywords = ['양도소득세', '양도세', '장기보유특별공제', '1주택', '다주택'];
  const hasTaxKeywords = taxKeywords.some(keyword => 
    query.includes(keyword) || result.title.includes(keyword) || result.snippet.includes(keyword)
  );
  if (hasTaxKeywords) {
    adjustedScore *= 1.2;
  }
  
  // 2. 공식 사이트 가중치
  const officialDomains = ['hometax.go.kr', 'nts.go.kr'];
  if (officialDomains.includes(result.domain)) {
    adjustedScore *= 1.3;
  }
  
  // 3. 최신 판례 가중치
  if (result.domain === 'scourt.go.kr' && result.content?.publishedAt) {
    const daysDiff = (Date.now() - result.content.publishedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff <= 365) { // 1년 이내
      adjustedScore *= 1.2;
    }
  }
  
  // 4. 계산기/자동계산 가중치
  if (result.title.includes('계산기') || result.title.includes('자동계산')) {
    adjustedScore *= 1.1;
  }
  
  return adjustedScore;
}

function formatTaxEvidencePack(results: RerankedResult[], maxResults: number): EvidenceItem[] {
  return results.slice(0, maxResults).map(result => ({
    domain: result.domain,
    title: result.title,
    snippet: result.snippet,
    url: result.link,
    publishedAt: result.content?.publishedAt,
    priority: result.priority,
    score: result.score,
    type: determineEvidenceType(result),
    relevance: calculateRelevance(result)
  }));
}

function determineEvidenceType(result: RerankedResult): EvidenceItem['type'] {
  const { domain, title, snippet } = result;
  
  // 법령/고시
  if (domain === 'easylaw.go.kr' || title.includes('법령') || title.includes('고시')) {
    return 'law';
  }
  
  // 판례
  if (domain === 'scourt.go.kr' || title.includes('판례') || title.includes('판결')) {
    return 'precedent';
  }
  
  // 계산기/자동계산
  if (domain === 'hometax.go.kr' || title.includes('계산기') || title.includes('자동계산')) {
    return 'calculation';
  }
  
  // 가이드/안내
  if (domain === 'nts.go.kr' || title.includes('가이드') || title.includes('안내')) {
    return 'guide';
  }
  
  return 'general';
}

function calculateRelevance(result: RerankedResult): number {
  let relevance = result.score;
  
  // 도메인 우선순위에 따른 가중치
  const priority = result.priority;
  relevance *= (6 - priority) * 0.2;
  
  // 최신성 가중치
  if (result.content?.publishedAt) {
    const daysDiff = (Date.now() - result.content.publishedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff <= 56) { // 8주 이내
      relevance *= 1.2;
    } else if (daysDiff <= 365) { // 1년 이내
      relevance *= 1.1;
    }
  }
  
  return Math.min(relevance, 1.0); // 최대 1.0으로 제한
}

// 유틸리티 함수들
function getAllWhitelistDomains(): string[] {
  const { whitelist } = searchPolicy;
  return [
    ...whitelist.priority_1,
    ...whitelist.priority_2,
    ...whitelist.priority_3,
    ...whitelist.priority_4
  ];
}

function getDomainsByPriority(priority: number): string[] {
  const { whitelist } = searchPolicy;
  
  switch (priority) {
    case 1: return whitelist.priority_1;
    case 2: return whitelist.priority_2;
    case 3: return whitelist.priority_3;
    case 4: return whitelist.priority_4;
    default: return [];
  }
}

function getDomainPriority(domain: string): number {
  const { whitelist } = searchPolicy;
  
  if (whitelist.priority_1.includes(domain)) return 1;
  if (whitelist.priority_2.includes(domain)) return 2;
  if (whitelist.priority_3.includes(domain)) return 3;
  if (whitelist.priority_4.includes(domain)) return 4;
  return 5;
}

function calculateWhitelistCoverage(evidence: EvidenceItem[]): number {
  if (evidence.length === 0) return 0;
  const whitelistDomains = getAllWhitelistDomains();
  const whitelistCount = evidence.filter(e => whitelistDomains.includes(e.domain)).length;
  return (whitelistCount / evidence.length) * 100;
}

function calculateDomainDiversity(evidence: EvidenceItem[]): number {
  if (evidence.length === 0) return 0;
  const uniqueDomains = new Set(evidence.map(e => e.domain)).size;
  return (uniqueDomains / evidence.length) * 100;
}

function calculateAverageRelevance(evidence: EvidenceItem[]): number {
  if (evidence.length === 0) return 0;
  const totalRelevance = evidence.reduce((sum, e) => sum + e.relevance, 0);
  return totalRelevance / evidence.length;
}

// 양도세 특화 검색 키워드 생성
export function generateTaxSearchKeywords(query: string): string[] {
  const keywords = [query];
  
  // 기본 양도세 키워드 추가
  if (!query.includes('양도세') && !query.includes('양도소득세')) {
    keywords.push(`${query} 양도소득세`);
  }
  
  // 장기보유 관련 키워드
  if (query.includes('주택') || query.includes('부동산')) {
    keywords.push(`${query} 장기보유특별공제`);
  }
  
  // 1주택 관련 키워드
  if (query.includes('주택')) {
    keywords.push(`${query} 1주택`);
  }
  
  // 최신 키워드
  keywords.push(`${query} 2025년`);
  
  return keywords;
}
