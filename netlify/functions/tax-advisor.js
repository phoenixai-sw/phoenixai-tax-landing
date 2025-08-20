const { OpenAI } = require('openai');

// CORS 헤더 설정
const headers = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

// 모범답안 데이터 로드
const modelAnswers = require('../../data/model-answers.json');

// OpenAI 클라이언트 초기화
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// 유사도 계산 함수 (간단하고 효율적인 버전)
function calculateSimilarity(query, modelAnswer) {
  // 간단한 텍스트 정규화 (한글 보존)
  const normalizeText = (text) => {
    if (!text) return '';
    return text.toLowerCase().trim();
  };

  const normalizedQuery = normalizeText(query);
  const normalizedQuestion = normalizeText(modelAnswer.question);
  const keywords = modelAnswer.keywords || [];
  
  console.log(`🔍 질문 비교: "${normalizedQuery}" vs "${normalizedQuestion}"`);
  
  let score = 0;
  
  // 질문 직접 매칭 (최고 우선순위)
  if (normalizedQuery === normalizedQuestion) {
    score += 20;
    console.log(`🎯 완전 매칭: +20점`);
    return score;
  }
  
  // 키워드 매칭
  keywords.forEach(keyword => {
    if (normalizedQuery.includes(keyword.toLowerCase())) {
      score += 4;
      console.log(`✅ 키워드 매칭: ${keyword} (+4점)`);
    }
  });
  
  // 핵심 단어 매칭
  const coreTerms = ['1세대', '1주택', '비과세', '양도소득세', '부동산매매업자', '신고', '분양권', '상속', '농지', '감면'];
  coreTerms.forEach(term => {
    if (normalizedQuery.includes(term) && normalizedQuestion.includes(term)) {
      score += 3;
      console.log(`✅ 핵심단어 매칭: ${term} (+3점)`);
    }
  });
  
  // 카테고리 매칭
  if (modelAnswer.category && normalizedQuery.includes(modelAnswer.category)) {
    score += 2;
    console.log(`✅ 카테고리 매칭: ${modelAnswer.category} (+2점)`);
  }
  
  console.log(`📊 최종 점수: ${score} (ID: ${modelAnswer.id})`);
  return score;
}

// 모범답안 매칭 함수
function findBestModelAnswer(query) {
  let bestMatch = null;
  let bestScore = 0;
  
  modelAnswers.answers.forEach(answer => {
    const score = calculateSimilarity(query, answer);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = answer;
    }
  });
  
  return { match: bestMatch, score: bestScore };
}

// Google Search 함수 (화이트리스트 우선)
async function performGoogleSearch(query) {
  try {
    // 화이트리스트 도메인들
    const whiteListDomains = [
      'law.go.kr',    // 국가법령정보센터
      'nts.go.kr',    // 국세청
      'molit.go.kr',  // 국토교통부
      'scourt.go.kr'  // 대법원
    ];
    
    let allResults = [];
    
    // 1단계: 화이트리스트 도메인 우선 검색
    for (const domain of whiteListDomains) {
      try {
        const whiteListUrl = `https://www.googleapis.com/customsearch/v1?key=${process.env.GOOGLE_API_KEY}&cx=${process.env.SEARCH_ENGINE_ID}&q=${encodeURIComponent(query + ' 양도소득세 2025')}&siteSearch=${domain}&num=2`;
        
        const response = await fetch(whiteListUrl);
        const data = await response.json();
        
        if (data.items && data.items.length > 0) {
          console.log(`✅ 화이트리스트 검색 성공: ${domain}`);
          allResults.push(...data.items.map(item => ({
            title: item.title,
            snippet: item.snippet,
            link: item.link,
            source: 'official' // 공식 출처 표시
          })));
        }
      } catch (error) {
        console.log(`❌ 화이트리스트 검색 실패: ${domain}`, error.message);
      }
    }
    
    // 2단계: 일반 검색 (화이트리스트 결과가 부족한 경우)
    if (allResults.length < 3) {
      try {
        const generalUrl = `https://www.googleapis.com/customsearch/v1?key=${process.env.GOOGLE_API_KEY}&cx=${process.env.SEARCH_ENGINE_ID}&q=${encodeURIComponent(query + ' 양도소득세 2025')}&num=${3 - allResults.length}`;
        
        const response = await fetch(generalUrl);
        const data = await response.json();
        
        if (data.items && data.items.length > 0) {
          console.log(`✅ 일반 검색 성공: ${data.items.length}개 결과`);
          allResults.push(...data.items.map(item => ({
            title: item.title,
            snippet: item.snippet,
            link: item.link,
            source: 'general'
          })));
        }
      } catch (error) {
        console.log(`❌ 일반 검색 실패:`, error.message);
      }
    }
    
    // 결과 정렬 (공식 출처 우선)
    allResults.sort((a, b) => {
      if (a.source === 'official' && b.source !== 'official') return -1;
      if (a.source !== 'official' && b.source === 'official') return 1;
      return 0;
    });
    
    console.log(`📊 총 검색 결과: ${allResults.length}개 (공식: ${allResults.filter(r => r.source === 'official').length}개)`);
    
    return allResults.slice(0, 3); // 최대 3개 반환
  } catch (error) {
    console.error('Google Search error:', error);
    return [];
  }
}

// GPT-4o 정리 함수
async function organizeWithGPT4o(query, modelAnswer, searchResults) {
  try {
    let context = '';
    
    if (modelAnswer) {
      context += `모범답안:\n${modelAnswer.answer}\n\n`;
    }
    
    if (searchResults && searchResults.length > 0) {
      context += `추가 정보:\n`;
      searchResults.forEach((result, index) => {
        context += `${index + 1}. ${result.title}\n${result.snippet}\n\n`;
      });
    }
    
    const prompt = `당신은 한국의 양도소득세 전문가입니다. 

🚨 **중요한 규칙 - 반드시 지켜주세요:**
- "죄송합니다", "질문이 명확하지 않습니다", "질문이 명확하지 않지만" 등의 표현을 절대 사용하지 마세요
- 모든 질문에 대해 즉시 직접적으로 답변을 시작하세요
- 보수적이거나 사과하는 문구 없이 바로 핵심 내용을 설명하세요

사용자 질문: ${query}

위 질문에 대해 다음 정보를 바탕으로 정확하고 실용적인 답변을 제공해주세요:

${context}

답변 형식:
1. 개요
2. 보유/거주·세율표
3. 유의사항
4. 법령·근거
5. 결론

세무 규칙:
- 1세대1주택 비과세: 거주요건 2년 + 보유요건 2년
- 다주택자: 중과세 적용
- 조정대상지역: 추가 중과 가능성
- 확실하지 않은 정보는 "세무사 확인 필요"로 표시

답변 시작 예시:
❌ "죄송합니다. 질문이 명확하지 않지만..."
✅ "1세대1주택 비과세는 다음과 같습니다..."`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: prompt
        }
      ],
      max_tokens: 800,
      temperature: 0.1
    });

    return completion.choices[0].message.content;
  } catch (error) {
    console.error('GPT-4o error:', error);
    return null;
  }
}

// 메인 핸들러 함수
exports.handler = async (event) => {
  // OPTIONS 요청 처리
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'CORS preflight successful' })
    };
  }

  try {
    const startTime = Date.now();
    const { query } = JSON.parse(event.body);

    if (!query) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Query is required' })
      };
    }

    console.log(`🔍 하이브리드 시스템 시작: ${query}`);

    // Phase 1: 모범답안 매칭
    console.log('📚 Phase 1: 모범답안 매칭 중...');
    const { match: modelAnswer, score: matchScore } = findBestModelAnswer(query);
    
    let decisionMode = 'hybrid';
    let finalAnswer = '';
    
    // 매칭 점수별 답변 생성 모드 결정
    if (matchScore >= 8) {
      // 높은 매칭: 모범답안 직접 사용
      console.log(`✅ 모범답안 매칭 성공 (점수: ${matchScore})`);
      decisionMode = 'model_answer';
      finalAnswer = modelAnswer.answer;
    } else if (matchScore >= 3) {
      // 부분 매칭: 모범답안 + Google Search + GPT-4o
      console.log(`⚖️ 부분 매칭 성공 (점수: ${matchScore}), 모범답안 기반 보완 진행`);
      
      // Phase 2: Google Search 보완
      console.log('🌐 Phase 2: Google Search 보완 중...');
      const searchResults = await performGoogleSearch(query);
      
      // Phase 3: GPT-4o 정리 (모범답안 우선 활용)
      console.log('🤖 Phase 3: GPT-4o 정리 중 (모범답안 기반)...');
      const organizedAnswer = await organizeWithGPT4o(query, modelAnswer, searchResults);
      
      if (organizedAnswer) {
        finalAnswer = organizedAnswer;
        decisionMode = 'hybrid_partial';
      } else {
        // GPT-4o 실패 시 모범답안 사용
        finalAnswer = modelAnswer.answer;
        decisionMode = 'model_answer_fallback';
      }
    } else {
      // 매칭 실패: Google Search + GPT-4o만 사용
      console.log(`❌ 모범답안 매칭 실패 (점수: ${matchScore}), Google Search 전용 진행`);
      
      // Phase 2: Google Search 보완
      console.log('🌐 Phase 2: Google Search 보완 중...');
      const searchResults = await performGoogleSearch(query);
      
      // Phase 3: GPT-4o 정리 (검색결과만)
      console.log('🤖 Phase 3: GPT-4o 정리 중 (검색결과만)...');
      const organizedAnswer = await organizeWithGPT4o(query, null, searchResults);
      
      if (organizedAnswer) {
        finalAnswer = organizedAnswer;
        decisionMode = 'hybrid';
      } else {
        finalAnswer = '죄송합니다. 현재 질문에 대한 답변을 생성할 수 없습니다.';
        decisionMode = 'error';
      }
    }

    const latency = Date.now() - startTime;

    // 메트릭 기록
    const metrics = {
      sessionId: undefined,
      query: query,
      latency: latency,
      matchScore: matchScore,
      decisionMode: decisionMode,
      tokensUsed: 0
    };

    console.log(`📊 메트릭:`, metrics);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        answer: finalAnswer,
        metrics: metrics,
        modelAnswer: modelAnswer ? {
          id: modelAnswer.id,
          category: modelAnswer.category,
          keywords: modelAnswer.keywords
        } : null,
        matchScore: matchScore
      })
    };

  } catch (error) {
    console.error('❌ 하이브리드 시스템 오류:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message
      })
    };
  }
};
