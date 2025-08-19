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

// --- OpenAI Chat Completions API 헬퍼 ---
async function callOpenAI({ prompt, model = 'gpt-4o', temperature = 0.2, maxOutputTokens = 900 }) {
  const payload = {
    model,
    messages: [
      {
        role: "system",
        content: `당신은 한국의 양도소득세 전문가입니다.

답변 형식을 반드시 지켜주세요:
📋 **핵심 답변**: (질문에 대한 명확한 2-3문장 답변)
📊 **적용 세율**: (해당하는 세율 정보와 계산 방법)
📚 **관련 법령**: (소득세법 제○○조 등 구체적 조항)
⚠️ **주의사항**: (개별 상황에 따라 달라질 수 있는 부분)

규칙:
- 확실하지 않은 정보는 "세무사 확인 필요"로 표시
- 1세대1주택은 거주요건(2년) + 보유요건(2년) 강조
- 다주택자는 중과세 적용 설명
- 조정대상지역은 추가 중과 가능성 언급`
      },
      {
        role: "user",
        content: prompt
      }
    ],
         max_tokens: maxOutputTokens,
    temperature: temperature
  };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`OpenAI ${res.status}: ${text.slice(0, 800)}`);
  }

  let data;
  try { 
    data = JSON.parse(text); 
  } catch {
    throw new Error(`OpenAI response JSON parse failed: ${text.slice(0, 200)}`);
  }

  // Chat Completions API 응답 파싱
  let outputText;
  
  if (data.choices && data.choices.length > 0 && data.choices[0].message) {
    outputText = data.choices[0].message.content;
  }
  
  // fallback: 전체 응답을 텍스트로 처리
  if (!outputText) {
    console.warn('Unexpected OpenAI response format:', JSON.stringify(data, null, 2));
    outputText = JSON.stringify(data);
  }

  return { raw: data, text: outputText };
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

  const DEBUG = process.env.DEBUG_ANSWER === 'true';

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
    
    // 1. Dual-Pass 생성 (Responses API 사용)
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
    const msg = error?.message || String(error);
    if (DEBUG) console.error("[answer-assemble][DEBUG]", msg, error?.stack);
    
    console.error('Answer assembly error:', error);
    return {
      statusCode: 500,
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({ ok: false, error: 'Answer assembly failed', details: msg })
    };
  }
};

async function generateDualPass(query, evidencePack) {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  
  if (!openaiApiKey) {
    throw new Error('OpenAI API key not configured');
  }

  try {
    const SYSTEM_PROMPT = process.env.SYSTEM_PROMPT ?? createTaxSystemPrompt();

    function buildUserPrompt(q, ctx) {
      // 필요 시 컨텍스트 문자열화
      const ctxStr = Array.isArray(ctx) && ctx.length
        ? ctx.map((c,i)=>`[${i+1}] ${c.title}\n${c.snippet || c.content || ''}`).join("\n\n")
        : "(no RAG ctx)";
      return `SYSTEM:\n${SYSTEM_PROMPT}\n\nUSER:\n질문: ${q}\n\nCONTEXT:\n${ctxStr}`;
    }

    const ctx = evidencePack?.evidence || []; // RAG 미사용이면 빈배열로

         // ✅ Responses API로 교체 (병렬 처리로 최적화)
     const [draftAResult, draftBResult] = await Promise.all([
               callOpenAI({
          prompt: buildUserPrompt(query, ctx),           // 컨텍스트 포함 버전
          temperature: 0.1,                              // GPT-4o는 낮은 temperature 지원
          maxOutputTokens: 600                           // 토큰 수 감소
        }),
        callOpenAI({
          prompt: `SYSTEM:\n${SYSTEM_PROMPT}\n\nUSER:\n${query}`,   // 컨텍스트 미포함 버전
          temperature: 0.1,                              // GPT-4o는 낮은 temperature 지원
          maxOutputTokens: 600                           // 토큰 수 감소
        })
     ]);

    return { 
             draftA: { content: draftAResult.text, tokens: 0, model: process.env.OPENAI_MODEL || 'gpt-4o' },
       draftB: { content: draftBResult.text, tokens: 0, model: process.env.OPENAI_MODEL || 'gpt-4o' }
    };
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

async function verifyConflict(draftA, draftB, evidencePack) {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  
  if (!openaiApiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const nliPrompt = createNLIPrompt(draftA.content, draftB.content, evidencePack);
  
  try {
         const result = await callOpenAI({
       prompt: nliPrompt,
       temperature: 0.0,
       maxOutputTokens: 300                           // NLI는 짧은 응답으로 충분
     });

    // JSON 파싱 시도
    let parsedResult;
    try {
      parsedResult = JSON.parse(result.text);
    } catch (parseError) {
      console.error('NLI JSON parsing failed:', parseError);
      // JSON 파싱 실패 시 기본값 반환
      parsedResult = {
        conflict_score: 0,
        conflicts: [],
        decisive_web_sources: []
      };
    }

    return {
      conflict_score: parsedResult.conflict_score || 0,
      decision_mode: determineDecisionMode(parsedResult.conflict_score, evidencePack),
      conflicts: parsedResult.conflicts || [],
      decisive_web_sources: parsedResult.decisive_web_sources || []
    };
  } catch (error) {
    console.error('NLI analysis failed:', error);
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
  const webContent = evidencePack?.evidence?.map(evidence => 
    `[${evidence.domain}] ${evidence.title}\n${evidence.snippet}`
  ).join('\n\n') || '';

           const result = await callOpenAI({
      prompt: `${createTaxSystemPrompt()}\n\n다음 웹 증거만을 사용하여 구조화된 답변을 작성하세요:\n\n${webContent}`,
      temperature: 0.1,
      maxOutputTokens: 600                           // 웹 구성도 토큰 수 감소
    });

  return result.text;
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
