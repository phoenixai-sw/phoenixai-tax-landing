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
    const { query, evidencePack, sessionId } = JSON.parse(event.body || '{}');
    
    if (!query) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Query is required' })
      };
    }

    const startTime = Date.now();
    
    // 1. Dual-Pass 생성
    const { draftA, draftB } = await generateDualPass(query, evidencePack);
    
    // 2. 충돌 검증
    const conflictResult = await verifyConflict(draftA, draftB, evidencePack);
    
    // 3. 최종 답변 조립
    const finalAnswer = await assembleFinalAnswer(draftA, draftB, evidencePack, conflictResult);
    
    // 4. 섹션별 분할
    const sectionedAnswer = splitIntoAnswerSections(finalAnswer);
    
    const latency = Date.now() - startTime;

    // 메트릭 기록
    await recordMetrics({
      sessionId,
      query,
      latency,
      conflictScore: conflictResult.conflict_score,
      decisionMode: conflictResult.decision_mode,
      tokensUsed: draftA.tokens + draftB.tokens
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        answer: sectionedAnswer,
        metadata: {
          query,
          latency,
          conflictScore: conflictResult.conflict_score,
          decisionMode: conflictResult.decision_mode,
          evidenceCount: evidencePack?.evidence?.length || 0,
          whitelistCoverage: evidencePack?.metadata?.whitelistCoverage || 0
        }
      })
    };

  } catch (error) {
    console.error('Answer assembly error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Answer assembly failed', details: error.message })
    };
  }
};

async function generateDualPass(query, evidencePack) {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || 'gpt-5';
  
  if (!openaiApiKey) {
    throw new Error('OpenAI API key not configured');
  }

  try {
    // Draft A: 증거팩 포함 (재시도 로직 추가)
    const draftA = await retryWithTimeout(() => generateWithEvidence(query, evidencePack, model), 3);
    
    // Draft B: 증거팩 미포함 (재시도 로직 추가)
    const draftB = await retryWithTimeout(() => generateWithoutEvidence(query, model), 3);

    return { draftA, draftB };
  } catch (error) {
    console.error('Dual-pass generation failed:', error);
    throw new Error(`GPT generation failed: ${error.message}`);
  }
}

// 재시도 로직 함수
async function retryWithTimeout(fn, maxRetries = 3) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      console.warn(`Attempt ${attempt} failed:`, error.message);
      
      if (attempt < maxRetries) {
        // 지수 백오프
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

async function generateWithEvidence(query, evidencePack, model) {
  const systemPrompt = createTaxSystemPrompt();
  const userPrompt = createEvidencePrompt(query, evidencePack);

  const response = await axios.post('https://api.openai.com/v1/chat/completions', {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.2,
    max_tokens: 1500,
    top_p: 0.9
  }, {
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    timeout: 45000 // 45초로 증가 (Netlify Function 타임아웃 고려)
  });

  return {
    content: response.data.choices[0].message.content,
    tokens: response.data.usage.total_tokens,
    model: model
  };
}

async function generateWithoutEvidence(query, model) {
  const systemPrompt = createTaxSystemPrompt();
  const userPrompt = `다음 양도소득세 질문에 대해 답변해주세요: ${query}`;

  const response = await axios.post('https://api.openai.com/v1/chat/completions', {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.2,
    max_tokens: 1500,
    top_p: 0.9
  }, {
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    timeout: 45000 // 45초로 증가
  });

  return {
    content: response.data.choices[0].message.content,
    tokens: response.data.usage.total_tokens,
    model: model
  };
}

function createTaxSystemPrompt() {
  return `당신은 한국 양도소득세 전문 AI 세무사입니다. 다음 규칙을 엄격히 준수하세요:

1. **정확성**: 조문, 효력일, 출처를 반드시 명시하세요. 추정 금지.
2. **구조**: 다음 섹션으로 구성하세요:
   - 1. 개요/기본 원칙
   - 2. 보유·거주기간/세율 표
   - 3. 실무상 유의사항
   - 4. 관련 법령 및 근거
   - 5. 결론

3. **인용**: 각 단락에 문장수준 근거를 연결하고, 하단에 출처 목록을 제공하세요.
4. **최신성**: 2025년 기준 최신 법령을 반영하세요.
5. **법적 고지**: 마지막에 "본 답변은 참고용이며, 구체적인 세무상담은 전문가와 상담하시기 바랍니다."를 포함하세요.

양도소득세 관련 질문에 대해 정확하고 실용적인 답변을 제공하세요.`;
}

function createEvidencePrompt(query, evidencePack) {
  const evidenceText = evidencePack?.evidence?.map(evidence => 
    `[${evidence.domain}] ${evidence.title}\n${evidence.snippet}\nURL: ${evidence.url}`
  ).join('\n\n') || '';

  return `다음 양도소득세 질문에 대해 답변해주세요: ${query}

제공된 증거 자료를 참고하여 정확하고 신뢰할 수 있는 답변을 작성해주세요:

${evidenceText}

위 증거 자료를 바탕으로 구조화된 답변을 제공하되, 증거가 불충분한 경우 명시해주세요.`;
}

async function verifyConflict(draftA, draftB, evidencePack) {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || 'gpt-5';
  
  if (!openaiApiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const nliPrompt = createNLIPrompt(draftA.content, draftB.content, evidencePack);
  
  const response = await axios.post('https://api.openai.com/v1/chat/completions', {
    model,
    messages: [
      { 
        role: 'system', 
        content: '당신은 엄격한 NLI(자연어 추론) 판정자입니다. JSON 형식으로만 응답하세요.' 
      },
      { role: 'user', content: nliPrompt }
    ],
    temperature: 0.0,
    max_tokens: 500,
    response_format: { type: "json_object" }
  }, {
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    timeout: 30000 // 30초로 증가
  });

  try {
    const result = JSON.parse(response.data.choices[0].message.content);
    return {
      conflict_score: result.conflict_score || 0,
      decision_mode: determineDecisionMode(result.conflict_score, evidencePack),
      conflicts: result.conflicts || [],
      decisive_web_sources: result.decisive_web_sources || []
    };
  } catch (error) {
    console.error('NLI parsing error:', error);
    return {
      conflict_score: 0,
      decision_mode: 'gpt_draft',
      conflicts: [],
      decisive_web_sources: []
    };
  }
}

function createNLIPrompt(draftA, draftB, evidencePack) {
  const evidenceText = evidencePack?.evidence?.map(evidence => 
    `[${evidence.domain}] ${evidence.title}: ${evidence.snippet}`
  ).join('\n') || '';

  return `다음 두 개의 GPT 답변과 웹 증거를 비교하여 충돌을 분석하세요:

**Draft A (증거팩 포함):**
${draftA}

**Draft B (증거팩 미포함):**
${draftB}

**웹 증거:**
${evidenceText}

다음 JSON 형식으로 응답하세요:
{
  "conflict_score": 0.0-1.0,
  "conflicts": ["충돌 내용 1", "충돌 내용 2"],
  "decisive_web_sources": ["결정적 웹 출처 1", "결정적 웹 출처 2"]
}

충돌 판정 기준:
- 수치/기간/세율 불일치: 0.8-1.0
- 조문/효력일 불일치: 0.6-0.8
- 해석 차이: 0.3-0.6
- 무충돌: 0.0-0.2

conflict_score ≥ 0.35면 충돌로 판정하세요.`;
}

function determineDecisionMode(conflictScore, evidencePack) {
  if (conflictScore >= searchPolicy.conflict_threshold) {
    // 충돌 시 웹 우선 규칙 확인
    const hasWhitelistEvidence = evidencePack?.evidence?.some(e => 
      searchPolicy.whitelist.priority_1.includes(e.domain) ||
      searchPolicy.whitelist.priority_2.includes(e.domain)
    );
    
    return hasWhitelistEvidence ? 'web_override' : 'hybrid';
  }
  
  return 'gpt_draft';
}

async function assembleFinalAnswer(draftA, draftB, evidencePack, conflictResult) {
  switch (conflictResult.decision_mode) {
    case 'web_override':
      return await composeFromWeb(evidencePack);
    case 'hybrid':
      return await composeFromWebGuidedDraft(draftA, evidencePack);
    case 'gpt_draft':
    default:
      return await composeFromWebGuidedDraft(draftA, evidencePack);
  }
}

async function composeFromWeb(evidencePack) {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || 'gpt-5';
  
  const webContent = evidencePack?.evidence?.map(evidence => 
    `[${evidence.domain}] ${evidence.title}\n${evidence.snippet}`
  ).join('\n\n') || '';

  const response = await axios.post('https://api.openai.com/v1/chat/completions', {
    model,
    messages: [
      { role: 'system', content: createTaxSystemPrompt() },
      { 
        role: 'user', 
        content: `다음 웹 증거만을 사용하여 구조화된 답변을 작성하세요:\n\n${webContent}` 
      }
    ],
    temperature: 0.1,
    max_tokens: 1500
  }, {
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    timeout: 45000 // 45초로 증가
  });

  return response.data.choices[0].message.content;
}

async function composeFromWebGuidedDraft(draft, evidencePack) {
  // 웹 증거로 가이드된 GPT 답변 반환
  return draft.content;
}

function splitIntoAnswerSections(answer) {
  const sections = {
    overview: '',
    taxRates: '',
    considerations: '',
    legalBasis: '',
    conclusion: ''
  };

  // 섹션별로 분할
  const lines = answer.split('\n');
  let currentSection = 'overview';
  
  for (const line of lines) {
    if (line.includes('1. 개요') || line.includes('1. 개요/기본 원칙')) {
      currentSection = 'overview';
    } else if (line.includes('2. 보유·거주기간') || line.includes('2. 보유·거주기간/세율 표')) {
      currentSection = 'taxRates';
    } else if (line.includes('3. 실무상 유의사항')) {
      currentSection = 'considerations';
    } else if (line.includes('4. 관련 법령') || line.includes('4. 관련 법령 및 근거')) {
      currentSection = 'legalBasis';
    } else if (line.includes('5. 결론')) {
      currentSection = 'conclusion';
    }
    
    if (currentSection && line.trim()) {
      sections[currentSection] += line + '\n';
    }
  }

  return {
    overview: sections.overview.trim(),
    taxRates: sections.taxRates.trim(),
    considerations: sections.considerations.trim(),
    legalBasis: sections.legalBasis.trim(),
    conclusion: sections.conclusion.trim()
  };
}

async function recordMetrics(metrics) {
  try {
    // Supabase에 메트릭 저장 (실제 구현에서는 Supabase 클라이언트 사용)
    console.log('Metrics recorded:', metrics);
  } catch (error) {
    console.error('Failed to record metrics:', error);
  }
}
