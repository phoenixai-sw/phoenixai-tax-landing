import OpenAI from 'openai';
import { ExtractedContent } from './extract';
import searchPolicy from '../config/search-policy.json';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export interface SearchResult {
  title: string;
  link: string;
  snippet: string;
  domain: string;
  priority: number;
  content?: ExtractedContent;
}

export interface RerankedResult extends SearchResult {
  score: number;
  cosineScore: number;
  bm25Score: number;
  domainScore: number;
  recencyScore: number;
  whitelistScore: number;
}

export interface RerankOptions {
  query: string;
  results: SearchResult[];
  maxResults?: number;
}

export async function rerankSearchResults(options: RerankOptions): Promise<RerankedResult[]> {
  const { query, results, maxResults = searchPolicy.search_config.final_k } = options;
  
  if (results.length === 0) {
    return [];
  }

  // 1. 임베딩 점수 계산
  const cosineScores = await calculateCosineScores(query, results);
  
  // 2. BM25 점수 계산
  const bm25Scores = calculateBM25Scores(query, results);
  
  // 3. 도메인 다양성 점수
  const domainScores = calculateDomainScores(results);
  
  // 4. 최신성 점수
  const recencyScores = calculateRecencyScores(results);
  
  // 5. 화이트리스트 우선순위 점수
  const whitelistScores = calculateWhitelistScores(results);

  // 6. 종합 점수 계산
  const rerankedResults: RerankedResult[] = results.map((result, index) => {
    const config = searchPolicy.rerank;
    
    const finalScore = 
      cosineScores[index] * config.cosine_weight +
      bm25Scores[index] * config.bm25_weight +
      domainScores[index] * 0.1 +
      recencyScores[index] * 0.1 +
      whitelistScores[index] * 0.1;

    return {
      ...result,
      score: finalScore,
      cosineScore: cosineScores[index],
      bm25Score: bm25Scores[index],
      domainScore: domainScores[index],
      recencyScore: recencyScores[index],
      whitelistScore: whitelistScores[index]
    };
  });

  // 7. 점수순 정렬 및 도메인 다양성 보장
  const finalResults = ensureDomainDiversity(rerankedResults, maxResults);

  return finalResults;
}

async function calculateCosineScores(query: string, results: SearchResult[]): Promise<number[]> {
  try {
    // 쿼리 임베딩 생성
    const queryEmbedding = await generateEmbedding(query);
    
    // 결과 텍스트 임베딩 생성
    const resultTexts = results.map(r => `${r.title} ${r.snippet}`.trim());
    const resultEmbeddings = await Promise.all(
      resultTexts.map(text => generateEmbedding(text))
    );

    // 코사인 유사도 계산
    return resultEmbeddings.map(embedding => 
      cosineSimilarity(queryEmbedding, embedding)
    );

  } catch (error) {
    console.error('Cosine similarity calculation failed:', error);
    // 에러 시 균등 분배
    return new Array(results.length).fill(0.5);
  }
}

async function generateEmbedding(text: string): Promise<number[]> {
  const model = process.env.OPENAI_EMBED_MODEL || 'text-embedding-3-small';
  
  const response = await openai.embeddings.create({
    model,
    input: text,
    encoding_format: 'float'
  });

  return response.data[0].embedding;
}

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error('Vector dimensions must match');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

function calculateBM25Scores(query: string, results: SearchResult[]): number[] {
  const queryTerms = tokenize(query);
  const documents = results.map(r => `${r.title} ${r.snippet}`);
  
  // BM25 파라미터
  const k1 = 1.2;
  const b = 0.75;
  const avgDocLength = documents.reduce((sum, doc) => sum + doc.length, 0) / documents.length;

  return documents.map(doc => {
    const docTerms = tokenize(doc);
    let score = 0;

    for (const term of queryTerms) {
      const tf = docTerms.filter(t => t === term).length;
      const idf = calculateIDF(term, documents);
      
      score += idf * (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (doc.length / avgDocLength)));
    }

    return Math.max(0, score);
  });
}

function tokenize(text: string): string[] {
  // 간단한 한국어 토큰화
  return text
    .toLowerCase()
    .replace(/[^\w\s가-힣]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 0);
}

function calculateIDF(term: string, documents: string[]): number {
  const docFreq = documents.filter(doc => 
    tokenize(doc).includes(term)
  ).length;
  
  if (docFreq === 0) return 0;
  
  return Math.log((documents.length - docFreq + 0.5) / (docFreq + 0.5));
}

function calculateDomainScores(results: SearchResult[]): number[] {
  const domainCounts = new Map<string, number>();
  
  // 도메인별 빈도 계산
  results.forEach(result => {
    domainCounts.set(result.domain, (domainCounts.get(result.domain) || 0) + 1);
  });

  // 다양성 점수 계산 (중복이 적을수록 높은 점수)
  return results.map(result => {
    const count = domainCounts.get(result.domain) || 1;
    return 1 / count; // 중복이 적을수록 높은 점수
  });
}

function calculateRecencyScores(results: SearchResult[]): number[] {
  const now = new Date();
  
  return results.map(result => {
    if (!result.content?.publishedAt) {
      return 0.5; // 발행일 없으면 중간 점수
    }

    const daysDiff = (now.getTime() - result.content.publishedAt.getTime()) / (1000 * 60 * 60 * 24);
    
    // 8주(56일) 이내면 높은 점수, 그 이후로는 점진적 감소
    if (daysDiff <= 56) {
      return 1.0;
    } else if (daysDiff <= 365) {
      return 0.8;
    } else {
      return 0.6;
    }
  });
}

function calculateWhitelistScores(results: SearchResult[]): number[] {
  const whitelistDomains = getAllWhitelistDomains();
  
  return results.map(result => {
    if (whitelistDomains.includes(result.domain)) {
      // 우선순위에 따른 가중치
      const priority = getDomainPriority(result.domain);
      return searchPolicy.rerank.whitelist_boost / priority;
    }
    return 0.1; // 화이트리스트가 아닌 경우 낮은 점수
  });
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

function getDomainPriority(domain: string): number {
  const { whitelist } = searchPolicy;
  
  if (whitelist.priority_1.includes(domain)) return 1;
  if (whitelist.priority_2.includes(domain)) return 2;
  if (whitelist.priority_3.includes(domain)) return 3;
  if (whitelist.priority_4.includes(domain)) return 4;
  return 5; // 일반 웹
}

function ensureDomainDiversity(results: RerankedResult[], maxResults: number): RerankedResult[] {
  const selected: RerankedResult[] = [];
  const selectedDomains = new Set<string>();
  
  // 점수순 정렬
  const sortedResults = [...results].sort((a, b) => b.score - a.score);
  
  for (const result of sortedResults) {
    if (selected.length >= maxResults) break;
    
    // 도메인 다양성 확인
    if (selectedDomains.has(result.domain)) {
      // 이미 선택된 도메인이면 더 높은 점수여야 선택
      const existingScore = selected.find(r => r.domain === result.domain)?.score || 0;
      if (result.score > existingScore * 1.2) { // 20% 이상 높아야 교체
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

// 성능 메트릭 계산
export function calculateRerankMetrics(results: RerankedResult[]): {
  whitelistCoverage: number;
  domainDiversity: number;
  averageScore: number;
} {
  if (results.length === 0) {
    return { whitelistCoverage: 0, domainDiversity: 0, averageScore: 0 };
  }

  const whitelistDomains = getAllWhitelistDomains();
  const whitelistCount = results.filter(r => whitelistDomains.includes(r.domain)).length;
  const uniqueDomains = new Set(results.map(r => r.domain)).size;
  const averageScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;

  return {
    whitelistCoverage: (whitelistCount / results.length) * 100,
    domainDiversity: (uniqueDomains / results.length) * 100,
    averageScore
  };
}
