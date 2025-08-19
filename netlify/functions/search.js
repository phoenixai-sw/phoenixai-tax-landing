// netlify/functions/search.js
// Node 20: 글로벌 fetch 사용 (node-bundler=esbuild)
exports.handler = async (event) => {
  try {
    // 1) 본문 파싱 (UTF-8 명시 / base64 대응)
    let bodyText = event.body || "{}";
    if (event.isBase64Encoded) bodyText = Buffer.from(bodyText, "base64").toString("utf8");
    const { query = "", expand = false } = JSON.parse(bodyText);

    // 2) CSE 쿼리 파라미터 구성 (기본 12건 + 최근 8주)
    const base = new URLSearchParams({
      key: process.env.GOOGLE_API_KEY,
      cx: process.env.SEARCH_ENGINE_ID,
      q: query,
      lr: "lang_ko",
      num: expand ? "20" : "12",
    });
    if (!expand) base.set("dateRestrict", "w8");

    const url = `https://customsearch.googleapis.com/customsearch/v1?${base.toString()}`;

    // 3) CSE 호출 (JSON으로 직접 파싱, 인코딩 변환 금지)
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`CSE ${res.status}`);
    const data = await res.json();

    const items = Array.isArray(data.items) ? data.items : [];
    const whitelist = new Set([
      "law.go.kr", "www.law.go.kr",
      "nts.go.kr", "www.nts.go.kr", "taxlaw.nts.go.kr"
    ]);

    // 4) 1차 필터
    const toRow = (it) => {
      const link = it.link || "";
      let domain = "";
      try { domain = new URL(link).hostname; } catch {}
      return {
        title: it.title || "",
        link,
        snippet: it.snippet || "",
        domain,
        priority: whitelist.has(domain) ? 5 : 1,
      };
    };
    let rows = items.map(toRow);
    let filtered = rows.filter(r => whitelist.has(r.domain));

    // 5) 폴백: 화이트리스트 적중이 부족하면 날짜 제한 해제해 재조회
    if (!expand && filtered.length < 3) {
      const p2 = new URLSearchParams({
        key: process.env.GOOGLE_API_KEY,
        cx: process.env.SEARCH_ENGINE_ID,
        q: query,
        lr: "lang_ko",
        num: "20", // 확대
      });
      const url2 = `https://customsearch.googleapis.com/customsearch/v1?${p2.toString()}`;
      const r2 = await fetch(url2, { headers: { Accept: "application/json" } });
      const d2 = await r2.json();
      const items2 = Array.isArray(d2.items) ? d2.items : [];
      rows = items2.map(toRow);
      filtered = rows.filter(r => whitelist.has(r.domain));
    }

    // 6) TopK=3 추리기
    const topK = filtered.slice(0, 3);
    const coverage = rows.length ? (filtered.length / rows.length) * 100 : 0;
    const diversity = filtered.length
      ? (new Set(filtered.map(r => r.domain)).size / filtered.length) * 100
      : 0;

    // 7) UTF-8로 명시 응답
    return {
      statusCode: 200,
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        results: topK,
        metadata: {
          query,
          expand: expand || (filtered.length < 3),
          whitelist_coverage: coverage,
          domain_diversity: diversity
        }
      }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({ error: String(e?.message || e) }),
    };
  }
};
