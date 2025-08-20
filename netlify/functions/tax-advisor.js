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

// 유사도 계산 함수 (정밀한 키워드 매칭)
function calculateSimilarity(query, modelAnswer) {
  // 한글 인코딩 문제 해결을 위한 정규화
  const normalizeText = (text) => {
    return text.toLowerCase()
      .replace(/[^\w\s가-힣]/g, ' ') // 특수문자 제거
      .replace(/\s+/g, ' ') // 연속 공백을 단일 공백으로
      .trim();
  };

  const normalizedQuery = normalizeText(query);
  const normalizedQuestion = normalizeText(modelAnswer.question);
  const normalizedAnswer = normalizeText(modelAnswer.answer);
  const keywords = modelAnswer.keywords || [];
  
  let score = 0;
  
  // 질문 직접 매칭 (가장 높은 가중치)
  const questionWords = normalizedQuestion.split(/\s+/);
  const queryWords = normalizedQuery.split(/\s+/);
  
  // 핵심 용어 매칭
  const coreTerms = ['1세대', '1주택', '비과세', '양도소득세', '중과세', '조정대상지역', '분양권', '상속', '증여'];
  let coreTermMatches = 0;
  
  coreTerms.forEach(term => {
    const normalizedTerm = normalizeText(term);
    if (normalizedQuery.includes(normalizedTerm) && 
        (normalizedQuestion.includes(normalizedTerm) || normalizedAnswer.includes(normalizedTerm))) {
      coreTermMatches++;
      score += 3;
      console.log(`✅ 핵심용어 매칭: ${term} (점수: +3)`);
    }
  });
  
  // 키워드 매칭 (중간 가중치)
  let keywordMatches = 0;
  keywords.forEach(keyword => {
    const normalizedKeyword = normalizeText(keyword);
    if (normalizedQuery.includes(normalizedKeyword)) {
      keywordMatches++;
      score += 2;
      console.log(`✅ 키워드 매칭: ${keyword} (점수: +2)`);
    }
  });
  
  // 질문 단어 매칭 (낮은 가중치)
  queryWords.forEach(word => {
    if (word.length > 1 && questionWords.includes(word)) {
      score += 1;
      console.log(`✅ 질문 단어 매칭: ${word} (점수: +1)`);
    }
  });
  
  // 카테고리 매칭
  if (modelAnswer.category) {
    const normalizedCategory = normalizeText(modelAnswer.category);
    if (normalizedQuery.includes(normalizedCategory)) {
      score += 2;
      console.log(`✅ 카테고리 매칭: ${modelAnswer.category} (점수: +2)`);
    }
  }
  
  // 부정 매칭 (잘못된 매칭 방지)
  const negativeTerms = {
    '부동산매매업자': ['1세대', '1주택', '비과세'],
    '신고': ['1세대', '1주택', '비과세'],
    '사업소득': ['1세대', '1주택', '비과세']
  };
  
  Object.keys(negativeTerms).forEach(negativeTerm => {
    if (keywords.includes(negativeTerm)) {
      negativeTerms[negativeTerm].forEach(positiveTerm => {
        if (normalizedQuery.includes(normalizeText(positiveTerm))) {
          score -= 5; // 부정 매칭 페널티
          console.log(`❌ 부정 매칭: ${negativeTerm} vs ${positiveTerm} (점수: -5)`);
        }
      });
    }
  });
  
  console.log(`📊 최종 매칭 점수: ${score} (질문: "${query}" vs 답변ID: ${modelAnswer.id})`);
  return Math.max(0, score); // 음수 점수 방지
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

// Google Search 함수
async function performGoogleSearch(query) {
  try {
    const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${process.env.GOOGLE_API_KEY}&cx=${process.env.SEARCH_ENGINE_ID}&q=${encodeURIComponent(query + ' 양도소득세 2025')}&num=3`;
    
    const response = await fetch(searchUrl);
    const data = await response.json();
    
    if (data.items && data.items.length > 0) {
      return data.items.map(item => ({
        title: item.title,
        snippet: item.snippet,
        link: item.link
      }));
    }
    
    return [];
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
    
    // 매칭 점수가 높으면 모범답안 우선 사용
    if (matchScore >= 8) {
      console.log(`✅ 모범답안 매칭 성공 (점수: ${matchScore})`);
      decisionMode = 'model_answer';
      finalAnswer = modelAnswer.answer;
    } else {
      console.log(`🔍 모범답안 매칭 점수 낮음 (점수: ${matchScore}), Google Search 보완 진행`);
      
      // Phase 2: Google Search 보완
      console.log('🌐 Phase 2: Google Search 보완 중...');
      const searchResults = await performGoogleSearch(query);
      
      // Phase 3: GPT-4o 정리
      console.log('🤖 Phase 3: GPT-4o 정리 중...');
      const organizedAnswer = await organizeWithGPT4o(query, modelAnswer, searchResults);
      
      if (organizedAnswer) {
        finalAnswer = organizedAnswer;
        decisionMode = 'hybrid';
      } else {
        // GPT-4o 실패 시 모범답안 사용
        if (modelAnswer) {
          finalAnswer = modelAnswer.answer;
          decisionMode = 'model_answer_fallback';
        } else {
          finalAnswer = '죄송합니다. 현재 질문에 대한 답변을 생성할 수 없습니다.';
          decisionMode = 'error';
        }
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
