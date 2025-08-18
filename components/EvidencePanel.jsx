export default function EvidencePanel({ evidence = [], isLoading = false }) {
  if (isLoading) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <h3 className="text-gray-800 font-semibold mb-4">📚 공식 출처</h3>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
              <div className="h-3 bg-gray-200 rounded animate-pulse w-3/4"></div>
              <div className="h-3 bg-gray-200 rounded animate-pulse w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
      <h3 className="text-gray-800 font-semibold mb-4">📚 공식 출처</h3>
      
      {evidence && evidence.length > 0 ? (
        <div className="space-y-4">
          {evidence.map((item, index) => (
            <div key={index} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-medium">
                  {item.domain}
                </span>
              </div>
              <h4 className="font-semibold text-gray-800 mb-2 text-sm">
                {item.title}
              </h4>
              <p className="text-gray-600 text-sm mb-3 leading-relaxed">
                {item.snippet}
              </p>
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 text-xs font-medium inline-flex items-center gap-1"
              >
                원문 보기
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-gray-500 text-sm italic">
          질의를 입력하면 관련 공식 출처가 여기에 표시됩니다.
        </div>
      )}
    </div>
  );
}
