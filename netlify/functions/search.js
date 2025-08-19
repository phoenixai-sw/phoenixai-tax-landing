// netlify/functions/search.js
// Google CSE JSON API: num은 1~10만 허용. 추가는 start=11 등으로 페이징.

exports.handler = async (event) => {
  const t0 = Date.now();
  try {
    // 1) 요청 파싱
    let raw = event.body || "{}";
    if (event.isBase64Encoded) raw = Buffer.from(raw, "base64").toString("utf8");
    const { query = "", expand = false } = JSON.parse(raw);

    // 2) 공용 유틸
    const mkParams = (p) =>
      new URLSearchParams({
        key: process.env.GOOGLE_API_KEY,
        cx: process.env.SEARCH_ENGINE_ID,
        q: query,
        lr: "lang_ko",
        ...p,
      });

    const callCSE = async (params) => {
      const url = `https://customsearch.googleapis.com/customsearch/v1?${mkParams(params).toString()}`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      const ct = res.headers.get("content-type") || "";
      let data, text;
      if (ct.includes("application/json")) {
        data = await res.json();
      } else {
        text = await res.text();
        console.error("CSE non-JSON", res.status, text.slice(0, 400));
        try { data = JSON.parse(text); } catch { data = {}; }
      }
      if (!res.ok) {
        const msg = data?.error?.message || `CSE ${res.status}`;
        throw new Error(msg);
      }
      return data;
    };

    // 3) 1차 호출: 최근 8주 제한 + num=10 (규격 준수)
    const first = await callCSE({ num: 10, dateRestrict: "w8" });
    const items1 = Array.isArray(first.items) ? first.items : [];

    const whitelist = new Set([
      "law.go.kr", "www.law.go.kr",
      "nts.go.kr", "www.nts.go.kr", "taxlaw.nts.go.kr",
    ]);

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

    const dedupByLink = (arr) => {
      const seen = new Set();
      const out = [];
      for (const x of arr) {
        if (!x.link) continue;
        if (seen.has(x.link)) continue;
        seen.add(x.link);
        out.push(x);
      }
      return out;
    };

    let rows = dedupByLink(items1.map(toRow));
    let filtered = rows.filter((r) => whitelist.has(r.domain));

    // 4) 폴백/확장: 화이트리스트 적중 <3 이거나 expand=true면
    //    날짜 제한을 풀고 2페이지까지 추가 수집 (start=1, 11; num=10씩)
    let didExpand = expand;
    if (expand || filtered.length < 3) {
      didExpand = true;

      // 페이지 1 (start=1)
      const p1 = await callCSE({ num: 10 }); // dateRestrict 없음
      const i1 = Array.isArray(p1.items) ? p1.items : [];

      // 페이지 2 (start=11)
      const p2 = await callCSE({ num: 10, start: 11 });
      const i2 = Array.isArray(p2.items) ? p2.items : [];

      rows = dedupByLink([...i1, ...i2].map(toRow));
      filtered = rows.filter((r) => whitelist.has(r.domain));
    }

    // 5) TopK=3
    const topK = filtered.slice(0, 3);
    const coverage = rows.length ? (filtered.length / rows.length) * 100 : 0;
    const diversity = filtered.length ? (new Set(filtered.map((r) => r.domain)).size / filtered.length) * 100 : 0;

    return {
      statusCode: 200,
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        results: topK,
        metadata: {
          query,
          latency: Date.now() - t0,
          expand: didExpand,
          fetched: rows.length,
          whitelist_coverage: coverage,
          domain_diversity: diversity,
        },
      }),
    };
  } catch (e) {
    console.error("search error:", e?.message || e);
    return {
      statusCode: 500,
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({ ok: false, error: String(e?.message || e) }),
    };
  }
};
