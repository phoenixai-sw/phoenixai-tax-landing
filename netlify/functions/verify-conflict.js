const axios = require('axios');
const searchPolicy = require('../../config/search-policy.json');

// --- OpenAI Responses API 헬퍼 ---
async function callOpenAI({ prompt, model = process.env.OPENAI_MODEL || 'gpt-5', temperature = 0.2, maxOutputTokens = 900 }) {
  const payload = {
    model,
    input: prompt,                 // ✅ Responses API는 input 사용
    temperature,
    max_output_tokens: maxOutputTokens, // ✅ max_output_tokens 사용 (chat의 max_tokens 아님)
  };

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  if (!res.ok) {
    // 400 본문을 그대로 에러에 붙여 원인 파악이 쉬움
    throw new Error(`OpenAI ${res.status}: ${text.slice(0, 800)}`);
  }

  let data;
  try { data = JSON.parse(text); } catch {
    throw new Error(`OpenAI response JSON parse failed: ${text.slice(0, 200)}`);
  }

  // 다양한 포맷 방어적으로 파싱
  const outputText =
    data.output_text ??
    (Array.isArray(data.output)
      ? data.output
          .find(x => x.type === "message")?.content?.find(c => c.type === "output_text")?.text
        ?? data.output.find(x => x.type === "message")?.content?.[0]?.text
        ?? data.output.find(x => x.type === "output_text")?.text
      : undefined);

  if (!outputText) {
    throw new Error(`OpenAI response missing output_text: ${text.slice(0, 200)}`);
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

  try {
    const { draftA, draftB, evidencePack, query } = JSON.parse(event.body || '{}');
    
    if (!draftA || !draftB) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Both draftA and draftB are required' })
      };
    }

    const startTime = Date.now();
    
    // 1. NLI 기반 충돌 검증
    const nliResult = await performNLIAnalysis(draftA, draftB, evidencePack);
    
    // 2. 규칙 기반 충돌 검증
    const ruleResult = await performRuleBasedAnalysis(draftA, draftB, evidencePack);
    
    // 3. 종합 충돌 점수 계산
    const conflictScore = calculateConflictScore(nliResult, ruleResult);
    
    // 4. 결정 모드 결정
    const decisionMode = determineDecisionMode(conflictScore, evidencePack);
    
    const latency = Date.now() - startTime;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        conflict_score: conflictScore,
        decision_mode: decisionMode,
        nli_analysis: nliResult,
        rule_analysis: ruleResult,
        metadata: {
          query,
          latency,
          threshold: searchPolicy.conflict_threshold,
          whitelist_coverage: calculateWhitelistCoverage(evidencePack)
        }
      })
    };

  } catch (error) {
    console.error('Conflict verification error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Conflict verification failed', details: error.message })
    };
  }
};

async function performNLIAnalysis(draftA, draftB, evidencePack) {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  
  if (!openaiApiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const nliPrompt = createNLIPrompt(draftA, draftB, evidencePack);
  
  try {
    const result = await callOpenAI({
      prompt: `당신은 엄격한 NLI(자연어 추론) 판정자입니다. JSON 형식으로만 응답하세요.\n\n${nliPrompt}`,
      temperature: 0.0,
      maxOutputTokens: 800
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
        decisive_web_sources: [],
        reasoning: 'JSON 파싱 실패',
        confidence: 0
      };
    }
    
    return {
      conflict_score: parsedResult.conflict_score || 0,
      conflicts: parsedResult.conflicts || [],
      decisive_web_sources: parsedResult.decisive_web_sources || [],
      reasoning: parsedResult.reasoning || '',
      confidence: parsedResult.confidence || 0.5
    };

  } catch (error) {
    console.error('NLI analysis error:', error);
    return {
      conflict_score: 0,
      conflicts: [],
      decisive_web_sources: [],
      reasoning: 'NLI 분석 실패',
      confidence: 0
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
  "decisive_web_sources": ["결정적 웹 출처 1", "결정적 웹 출처 2"],
  "reasoning": "충돌 판정 근거",
  "confidence": 0.0-1.0
}

충돌 판정 기준:
- 수치/기간/세율 불일치: 0.8-1.0
- 조문/효력일 불일치: 0.6-0.8
- 해석 차이: 0.3-0.6
- 무충돌: 0.0-0.2

conflict_score ≥ 0.35면 충돌로 판정하세요.`;
}

async function performRuleBasedAnalysis(draftA, draftB, evidencePack) {
  const conflicts = [];
  let ruleScore = 0;

  // 1. 수치/기간/세율 불일치 검사
  const numericConflicts = detectNumericConflicts(draftA, draftB);
  conflicts.push(...numericConflicts);
  ruleScore += numericConflicts.length * 0.3;

  // 2. 조문/효력일 불일치 검사
  const legalConflicts = detectLegalConflicts(draftA, draftB);
  conflicts.push(...legalConflicts);
  ruleScore += legalConflicts.length * 0.2;

  // 3. 웹 증거와의 불일치 검사
  const webConflicts = detectWebConflicts(draftA, draftB, evidencePack);
  conflicts.push(...webConflicts);
  ruleScore += webConflicts.length * 0.4;

  return {
    rule_score: Math.min(ruleScore, 1.0),
    conflicts: conflicts,
    numeric_conflicts: numericConflicts,
    legal_conflicts: legalConflicts,
    web_conflicts: webConflicts
  };
}

function detectNumericConflicts(draftA, draftB) {
  const conflicts = [];
  
  // 수치 패턴 추출
  const numbersA = extractNumbers(draftA);
  const numbersB = extractNumbers(draftB);
  
  // 세율 관련 수치 비교
  const taxRatesA = numbersA.filter(n => n.includes('%') || n.includes('세율'));
  const taxRatesB = numbersB.filter(n => n.includes('%') || n.includes('세율'));
  
  if (taxRatesA.length > 0 && taxRatesB.length > 0 && !arraysEqual(taxRatesA, taxRatesB)) {
    conflicts.push(`세율 불일치: DraftA(${taxRatesA.join(', ')}) vs DraftB(${taxRatesB.join(', ')})`);
  }
  
  // 기간 관련 수치 비교
  const periodsA = numbersA.filter(n => n.includes('년') || n.includes('개월'));
  const periodsB = numbersB.filter(n => n.includes('년') || n.includes('개월'));
  
  if (periodsA.length > 0 && periodsB.length > 0 && !arraysEqual(periodsA, periodsB)) {
    conflicts.push(`기간 불일치: DraftA(${periodsA.join(', ')}) vs DraftB(${periodsB.join(', ')})`);
  }
  
  return conflicts;
}

function detectLegalConflicts(draftA, draftB) {
  const conflicts = [];
  
  // 조문 패턴 추출
  const articlesA = extractArticles(draftA);
  const articlesB = extractArticles(draftB);
  
  if (articlesA.length > 0 && articlesB.length > 0 && !arraysEqual(articlesA, articlesB)) {
    conflicts.push(`조문 불일치: DraftA(${articlesA.join(', ')}) vs DraftB(${articlesB.join(', ')})`);
  }
  
  // 효력일 패턴 추출
  const effectiveDatesA = extractEffectiveDates(draftA);
  const effectiveDatesB = extractEffectiveDates(draftB);
  
  if (effectiveDatesA.length > 0 && effectiveDatesB.length > 0 && !arraysEqual(effectiveDatesA, effectiveDatesB)) {
    conflicts.push(`효력일 불일치: DraftA(${effectiveDatesA.join(', ')}) vs DraftB(${effectiveDatesB.join(', ')})`);
  }
  
  return conflicts;
}

function detectWebConflicts(draftA, draftB, evidencePack) {
  const conflicts = [];
  
  if (!evidencePack?.evidence) return conflicts;
  
  // 웹 증거의 핵심 정보 추출
  const webInfo = evidencePack.evidence.map(evidence => ({
    domain: evidence.domain,
    title: evidence.title,
    snippet: evidence.snippet
  }));
  
  // Draft A와 웹 증거 비교
  const conflictsA = compareWithWebEvidence(draftA, webInfo);
  const conflictsB = compareWithWebEvidence(draftB, webInfo);
  
  if (conflictsA.length > 0) {
    conflicts.push(`DraftA 웹증거 불일치: ${conflictsA.join(', ')}`);
  }
  
  if (conflictsB.length > 0) {
    conflicts.push(`DraftB 웹증거 불일치: ${conflictsB.join(', ')}`);
  }
  
  return conflicts;
}

function extractNumbers(text) {
  const numberPattern = /(\d+(?:\.\d+)?%?)/g;
  return text.match(numberPattern) || [];
}

function extractArticles(text) {
  const articlePattern = /(?:조|제)\s*(\d+)/g;
  const matches = text.match(articlePattern) || [];
  return matches.map(match => match.trim());
}

function extractEffectiveDates(text) {
  const datePattern = /(\d{4}년\s*\d{1,2}월\s*\d{1,2}일)/g;
  return text.match(datePattern) || [];
}

function compareWithWebEvidence(draft, webInfo) {
  const conflicts = [];
  
  // 간단한 키워드 매칭으로 충돌 검사
  const draftKeywords = extractKeywords(draft);
  
  for (const info of webInfo) {
    const webKeywords = extractKeywords(`${info.title} ${info.snippet}`);
    const overlap = draftKeywords.filter(k => webKeywords.includes(k));
    
    if (overlap.length === 0 && webKeywords.length > 0) {
      conflicts.push(`${info.domain}의 핵심 정보 누락`);
    }
  }
  
  return conflicts;
}

function extractKeywords(text) {
  const keywords = [
    '양도소득세', '양도세', '장기보유특별공제', '1주택', '다주택',
    '비과세', '과세', '세율', '공제', '면제'
  ];
  
  return keywords.filter(keyword => text.includes(keyword));
}

function arraysEqual(arr1, arr2) {
  if (arr1.length !== arr2.length) return false;
  return arr1.every((val, index) => val === arr2[index]);
}

function calculateConflictScore(nliResult, ruleResult) {
  // NLI 점수와 규칙 점수의 가중 평균
  const nliWeight = 0.7;
  const ruleWeight = 0.3;
  
  const nliScore = nliResult.conflict_score || 0;
  const ruleScore = ruleResult.rule_score || 0;
  
  return (nliScore * nliWeight) + (ruleScore * ruleWeight);
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

function calculateWhitelistCoverage(evidencePack) {
  if (!evidencePack?.evidence || evidencePack.evidence.length === 0) return 0;
  
  const whitelistDomains = getAllWhitelistDomains();
  const whitelistCount = evidencePack.evidence.filter(e => 
    whitelistDomains.includes(e.domain)
  ).length;
  
  return (whitelistCount / evidencePack.evidence.length) * 100;
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
