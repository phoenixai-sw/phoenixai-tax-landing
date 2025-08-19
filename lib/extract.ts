import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import axios from 'axios';

export interface ExtractedContent {
  title: string;
  content: string;
  textContent: string;
  excerpt: string;
  publishedAt?: Date;
  domain: string;
  url: string;
  metadata: {
    author?: string;
    siteName?: string;
    type?: string;
    keywords?: string[];
  };
}

export interface ExtractionOptions {
  timeout?: number;
  maxRetries?: number;
  userAgent?: string;
}

export async function extractWebContent(
  url: string, 
  options: ExtractionOptions = {}
): Promise<ExtractedContent | null> {
  const {
    timeout = 10000,
    maxRetries = 2,
    userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.get(url, {
        timeout,
        headers: {
          'User-Agent': userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        },
        maxRedirects: 5
      });

      if (response.status !== 200) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers['content-type'] || '';
      if (!contentType.includes('text/html')) {
        throw new Error(`Unsupported content type: ${contentType}`);
      }

      return await parseHTMLContent(url, response.data);

    } catch (error) {
      lastError = error as Error;
      console.warn(`Extraction attempt ${attempt + 1} failed for ${url}:`, error);
      
      if (attempt < maxRetries) {
        // 지수 백오프
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }

  console.error(`Failed to extract content from ${url} after ${maxRetries + 1} attempts:`, lastError);
  return null;
}

async function parseHTMLContent(url: string, html: string): Promise<ExtractedContent> {
  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  if (!article) {
    throw new Error('Failed to parse article content');
  }

  const domain = extractDomain(url);
  const publishedAt = extractPublishedDate(dom.window.document, url);
  const metadata = extractMetadata(dom.window.document, article);

  return {
    title: article.title || extractTitle(dom.window.document),
    content: article.content,
    textContent: article.textContent || '',
    excerpt: article.excerpt || '',
    publishedAt,
    domain,
    url,
    metadata
  };
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

function extractTitle(document: Document): string {
  // 다양한 제목 태그에서 추출
  const selectors = [
    'h1',
    'title',
    '[property="og:title"]',
    '[name="twitter:title"]',
    '.title',
    '.headline'
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) {
      const title = element.textContent?.trim() || element.getAttribute('content');
      if (title && title.length > 0) {
        return title;
      }
    }
  }

  return '제목 없음';
}

function extractPublishedDate(document: Document, url: string): Date | undefined {
  // 메타데이터에서 발행일 추출
  const selectors = [
    '[property="article:published_time"]',
    '[name="publish_date"]',
    '[name="pubdate"]',
    '[property="og:published_time"]',
    'time[datetime]',
    '.published',
    '.date',
    '.timestamp'
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) {
      const dateStr = element.getAttribute('content') || 
                     element.getAttribute('datetime') || 
                     element.textContent;
      
      if (dateStr) {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
    }
  }

  // URL에서 날짜 패턴 추출 (예: /2025/01/15/)
  const datePattern = /\/(\d{4})\/(\d{1,2})\/(\d{1,2})\//;
  const match = url.match(datePattern);
  if (match) {
    const [, year, month, day] = match;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }

  return undefined;
}

function extractMetadata(document: Document, article: any): ExtractedContent['metadata'] {
  const metadata: ExtractedContent['metadata'] = {};

  // 작성자 추출
  const authorSelectors = [
    '[property="article:author"]',
    '[name="author"]',
    '.author',
    '.byline',
    '[rel="author"]'
  ];

  for (const selector of authorSelectors) {
    const element = document.querySelector(selector);
    if (element) {
      metadata.author = element.textContent?.trim() || element.getAttribute('content');
      break;
    }
  }

  // 사이트명 추출
  const siteNameSelectors = [
    '[property="og:site_name"]',
    '[name="application-name"]',
    '.site-name',
    '.brand'
  ];

  for (const selector of siteNameSelectors) {
    const element = document.querySelector(selector);
    if (element) {
      metadata.siteName = element.textContent?.trim() || element.getAttribute('content');
      break;
    }
  }

  // 콘텐츠 타입 추출
  const typeSelectors = [
    '[property="og:type"]',
    '[name="content-type"]'
  ];

  for (const selector of typeSelectors) {
    const element = document.querySelector(selector);
    if (element) {
      metadata.type = element.getAttribute('content');
      break;
    }
  }

  // 키워드 추출
  const keywordsElement = document.querySelector('[name="keywords"]');
  if (keywordsElement) {
    const keywordsStr = keywordsElement.getAttribute('content');
    if (keywordsStr) {
      metadata.keywords = keywordsStr.split(',').map(k => k.trim());
    }
  }

  return metadata;
}

// 양도세 특화 콘텐츠 정규화
export function normalizeTaxContent(content: ExtractedContent): ExtractedContent {
  const normalized = { ...content };

  // 제목 정규화
  normalized.title = normalizeTitle(normalized.title);

  // 본문 정규화
  normalized.textContent = normalizeText(normalized.textContent);

  return normalized;
}

function normalizeTitle(title: string): string {
  return title
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s가-힣\-\(\)]/g, '')
    .trim();
}

function normalizeText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, '\n')
    .replace(/[^\w\s가-힣\-\(\)\.\,\;\:\!\?]/g, '')
    .trim();
}

// 캐시 키 생성
export function generateCacheKey(url: string): string {
  const domain = extractDomain(url);
  const path = new URL(url).pathname;
  return `${domain}${path}`;
}
