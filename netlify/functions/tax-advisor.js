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

// GPT-4o 답변 생성 함수 (개선된 버전)
async function generateAnswerWithGPT4o(query) {
  try {
    // 질문 분석을 위한 키워드 추출
    const keywords = extractKeywords(query);
    
    const prompt = `당신은 한국의 양도소득세 전문가입니다. 

🚨 **중요한 규칙 - 반드시 지켜주세요:**
- "죄송합니다", "질문이 명확하지 않습니다", "질문이 명확하지 않지만" 등의 표현을 절대 사용하지 마세요
- 모든 질문에 대해 즉시 직접적으로 답변을 시작하세요
- 보수적이거나 사과하는 문구 없이 바로 핵심 내용을 설명하세요
- 질문의 구체적인 내용에 맞춰 정확한 답변을 제공하세요

사용자 질문: ${query}

질문 분석 결과:
- 주요 키워드: ${keywords.join(', ')}
- 질문 유형: ${analyzeQuestionType(query)}
- 생성된 제목: ${generateSpecificTitle(query)}

위 질문에 대해 다음 형식으로 구체적이고 정확한 답변을 제공해주세요.

📋 **답변 형식 (반드시 지켜주세요):**

**${generateSpecificTitle(query)}**
---

### ■ 기본 원칙
- 핵심 내용을 명확하게 설명
- 법조항과 근거 명시

### ■ 구체적 요건 및 조건
- 단계별로 구체적인 요건 설명
- 표나 예시 활용 가능

### ■ 예외 사항 (해당하는 경우)
- 예외 상황이나 특별한 경우 설명

### ■ 참고 사항
- 추가 확인이 필요한 내용

### ✅ 결론
- 명확한 결론과 실무적 조언

🚨 **중요: 위 제목 "${generateSpecificTitle(query)}"을 반드시 그대로 사용하세요!**

📚 **세무 규칙 (참고용):**
- 1세대1주택 비과세: 거주요건 2년 + 보유요건 2년
- 다주택자: 중과세 적용 (2주택 20%p, 3주택 이상 30%p)
- 조정대상지역: 추가 중과 가능성
- 분양권: 2021.1.1 이후 취득 시 주택수 포함
- 부동산매매업자: 신고 의무 있음
- 상속농지: 8년 이상 자경 시 감면 가능
- 일시적 2주택: 특별 요건 확인
- 조정대상지역: 서울 4개구 등

답변 시작 예시:
❌ "죄송합니다. 질문이 명확하지 않지만..."
✅ "**${generateSpecificTitle(query)}**"`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: prompt
        }
      ],
      max_tokens: 1500,
      temperature: 0.1
    });

    let answer = completion.choices[0].message.content;
    
    // 제목을 강제로 교체
    const specificTitle = generateSpecificTitle(query);
    console.log(`🔧 제목 교체 시도: "${specificTitle}"`);
    
    if (answer.includes('**양도소득세 관련 질문에 대한 답변**')) {
      answer = answer.replace('**양도소득세 관련 질문에 대한 답변**', `**${specificTitle}**`);
      console.log('✅ 기본 제목 교체 완료');
    } else if (answer.includes('**양도소득세의 기본 개념과 적용**')) {
      answer = answer.replace('**양도소득세의 기본 개념과 적용**', `**${specificTitle}**`);
      console.log('✅ 기본 제목 교체 완료');
    } else if (answer.startsWith('**')) {
      // 다른 제목이 있는 경우 첫 번째 제목을 교체
      const titleEndIndex = answer.indexOf('**', 2);
      if (titleEndIndex !== -1) {
        answer = `**${specificTitle}**` + answer.substring(titleEndIndex + 2);
        console.log('✅ 첫 번째 제목 교체 완료');
      }
    }

    return answer;
  } catch (error) {
    console.error('GPT-4o 답변 생성 오류:', error);
    return null;
  }
}

// 키워드 추출 함수
function extractKeywords(query) {
  const keywords = [];
  
  if (query.includes('분양권')) keywords.push('분양권');
  if (query.includes('부동산매매업자')) keywords.push('부동산매매업자');
  if (query.includes('상속') && query.includes('농지')) keywords.push('상속농지');
  if (query.includes('일시적') && query.includes('2주택')) keywords.push('일시적2주택');
  if (query.includes('조정') || query.includes('지역')) keywords.push('조정대상지역');
  if (query.includes('1세대') && query.includes('1주택')) keywords.push('1세대1주택');
  if (query.includes('비과세')) keywords.push('비과세');
  if (query.includes('신고')) keywords.push('신고');
  if (query.includes('감면')) keywords.push('감면');
  
  return keywords;
}

// 질문 유형 분석 함수
function analyzeQuestionType(query) {
  if (query.includes('분양권')) return '분양권 포함 여부';
  if (query.includes('부동산매매업자')) return '부동산매매업자 신고 의무';
  if (query.includes('상속') && query.includes('농지')) return '상속농지 감면';
  if (query.includes('일시적') && query.includes('2주택')) return '일시적 2주택 비과세';
  if (query.includes('조정') || query.includes('지역')) return '조정대상지역';
  if (query.includes('1세대') && query.includes('1주택')) return '1세대1주택 비과세';
  
  return '일반 양도소득세';
}

// 구체적 제목 생성 함수
function generateSpecificTitle(query) {
  console.log(`🔍 제목 생성 함수 호출: "${query}"`);
  
  if (query.includes('분양권') && query.includes('주택수')) {
    console.log('✅ 분양권 주택수 제목 생성');
    return '1세대 1주택 판단 시 분양권의 주택 수 포함 여부';
  }
  if (query.includes('부동산매매업자') && query.includes('신고')) {
    console.log('✅ 부동산매매업자 신고 제목 생성');
    return '부동산매매업자의 양도소득세 신고 의무';
  }
  if (query.includes('상속') && query.includes('농지') && query.includes('감면')) {
    console.log('✅ 상속농지 감면 제목 생성');
    return '상속받은 농지 양도 시 양도소득세 감면 가능 여부';
  }
  if (query.includes('일시적') && query.includes('2주택') && query.includes('비과세')) {
    console.log('✅ 일시적 2주택 제목 생성');
    return '일시적 2주택 비과세 요건';
  }
  if (query.includes('조정') || query.includes('지역')) {
    console.log('✅ 조정대상지역 제목 생성');
    return '양도소득세 조정대상지역 현황';
  }
  if (query.includes('1세대') && query.includes('1주택') && query.includes('2년')) {
    console.log('✅ 1세대 1주택 2년 제목 생성');
    return '1세대 1주택 비과세를 위한 2년 거주 요건의 필수 여부';
  }
  if (query.includes('1세대') && query.includes('1주택') && query.includes('비과세')) {
    console.log('✅ 1세대 1주택 비과세 제목 생성');
    return '1세대 1주택 양도소득세 비과세 요건';
  }
  
  console.log('❌ 기본 제목 사용');
  return '양도소득세 관련 질문에 대한 답변';
}

// 답변 검증 및 개선 함수 (강화된 버전)
async function verifyAnswerWithSearch(query, generatedAnswer) {
  try {
    console.log('🔍 답변 검증 및 개선 시작...');
    
    // 화이트리스트 도메인들
    const whiteListDomains = [
      'law.go.kr',    // 국가법령정보센터
      'nts.go.kr',    // 국세청
      'molit.go.kr',  // 국토교통부
      'scourt.go.kr'  // 대법원
    ];
    
    let verificationResults = [];
    let searchContext = '';
    
    // 각 공식 출처에서 검증 및 정보 수집
    for (const domain of whiteListDomains) {
      try {
        const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${process.env.GOOGLE_API_KEY}&cx=${process.env.SEARCH_ENGINE_ID}&q=${encodeURIComponent(query + ' 양도소득세 2025')}&siteSearch=${domain}&num=2`;
        
        const response = await fetch(searchUrl);
        const data = await response.json();
        
        if (data.items && data.items.length > 0) {
          console.log(`✅ ${domain} 검증 결과 확인`);
          
          // 검증 결과 저장
          verificationResults.push({
            source: domain,
            title: data.items[0].title,
            snippet: data.items[0].snippet,
            link: data.items[0].link
          });
          
          // 검색 컨텍스트에 추가
          searchContext += `[${domain}] ${data.items[0].title}\n${data.items[0].snippet}\n\n`;
          
          // 추가 정보가 있으면 포함
          if (data.items[1]) {
            searchContext += `[${domain} 추가] ${data.items[1].title}\n${data.items[1].snippet}\n\n`;
          }
        }
      } catch (error) {
        console.log(`❌ ${domain} 검증 실패:`, error.message);
      }
    }
    
    // 검증된 정보를 바탕으로 답변 개선
    if (searchContext && verificationResults.length > 0) {
      console.log('📝 검증 정보를 바탕으로 답변 개선 중...');
      const improvedAnswer = await improveAnswerWithVerification(query, generatedAnswer, searchContext);
      return {
        verificationResults: verificationResults,
        improvedAnswer: improvedAnswer,
        searchContext: searchContext
      };
    }
    
    return {
      verificationResults: verificationResults,
      improvedAnswer: generatedAnswer,
      searchContext: ''
    };
  } catch (error) {
    console.error('답변 검증 오류:', error);
    return {
      verificationResults: [],
      improvedAnswer: generatedAnswer,
      searchContext: ''
    };
  }
}

// 검증 정보를 바탕으로 답변 개선 함수
async function improveAnswerWithVerification(query, originalAnswer, searchContext) {
  try {
         const prompt = `당신은 한국의 양도소득세 전문가입니다.

사용자 질문: ${query}

기존 답변:
${originalAnswer}

공식 출처 검증 정보:
${searchContext}

위 검증 정보를 바탕으로 기존 답변을 개선해주세요.

📋 **개선 규칙:**
1. 기존 답변의 정확성을 검증 정보로 확인
2. 검증 정보에서 추가된 구체적 내용이 있으면 포함
3. 검증 정보와 모순되는 내용이 있으면 수정
4. 더 구체적이고 정확한 정보로 보완
5. 공식 출처의 최신 정보를 반영
6. 다음 형식을 유지하여 개선:

**${generateSpecificTitle(query)}**
---

### ■ 기본 원칙
- 핵심 내용을 명확하게 설명
- 법조항과 근거 명시

### ■ 구체적 요건 및 조건
- 단계별로 구체적인 요건 설명
- 표나 예시 활용 가능

### ■ 예외 사항 (해당하는 경우)
- 예외 상황이나 특별한 경우 설명

### ■ 참고 사항
- 추가 확인이 필요한 내용

### ✅ 결론
- 명확한 결론과 실무적 조언

개선된 답변을 제공해주세요.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: prompt
        }
      ],
      max_tokens: 1500,
      temperature: 0.1
    });

    return completion.choices[0].message.content;
  } catch (error) {
    console.error('답변 개선 오류:', error);
    return originalAnswer;
  }
}

// 메인 핸들러 함수 (새로운 구조)
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

    console.log(`🔍 새로운 시스템 시작: ${query}`);

    // Phase 1: GPT-4o 답변 생성
    console.log('🤖 Phase 1: GPT-4o 답변 생성 중...');
    const generatedAnswer = await generateAnswerWithGPT4o(query);
    
    if (!generatedAnswer) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: '답변 생성 실패',
          answer: '죄송합니다. 현재 질문에 대한 답변을 생성할 수 없습니다.'
        })
      };
    }

    // Phase 2: 검색을 통한 답변 검증 및 개선
    console.log('🔍 Phase 2: 답변 검증 및 개선 중...');
    const verificationData = await verifyAnswerWithSearch(query, generatedAnswer);
    
    // Phase 3: 최종 답변 생성
    console.log('📝 Phase 3: 최종 답변 생성 중...');
    let finalAnswer = verificationData.improvedAnswer || generatedAnswer;
    
    if (verificationData.verificationResults.length > 0) {
      // 검증 결과가 있으면 답변에 추가
      finalAnswer += '\n\n📚 **공식 출처 검증 결과:**\n';
      verificationData.verificationResults.forEach((result, index) => {
        finalAnswer += `${index + 1}. ${result.source}: ${result.title}\n`;
      });
      finalAnswer += '\n💡 위 정보는 공식 출처에서 검증되었습니다.';
    }

    const latency = Date.now() - startTime;

    // 메트릭 기록
    const metrics = {
      sessionId: undefined,
      query: query,
      latency: latency,
      decisionMode: 'gpt4o_verify_improved',
      verificationSources: verificationData.verificationResults.length,
      answerImproved: verificationData.improvedAnswer !== generatedAnswer,
      tokensUsed: 0
    };

    console.log(`📊 메트릭:`, metrics);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        answer: finalAnswer,
        metrics: metrics,
        verificationResults: verificationData.verificationResults,
        originalAnswer: generatedAnswer,
        improvedAnswer: verificationData.improvedAnswer,
        searchContext: verificationData.searchContext
      })
    };

  } catch (error) {
    console.error('❌ 새로운 시스템 오류:', error);
    
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
