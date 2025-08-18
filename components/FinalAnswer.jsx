export default function FinalAnswer({ finalAnswer, isLoading = false, isActive = false }) {
  if (isLoading) {
    return (
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-xl p-6 shadow-lg mb-6">
        <h3 className="text-blue-800 font-bold text-lg mb-4 flex items-center gap-2">
          <span className="text-2xl">💡</span>
          최종답변
        </h3>
        <div className="space-y-3">
          <div className="h-4 bg-blue-200 rounded animate-pulse"></div>
          <div className="h-4 bg-blue-200 rounded animate-pulse w-3/4"></div>
          <div className="h-4 bg-blue-200 rounded animate-pulse w-1/2"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-xl p-6 shadow-lg mb-6 transition-all duration-500 ${isActive ? 'opacity-100 shadow-xl' : 'opacity-50'}`}>
      <h3 className="text-blue-800 font-bold text-lg mb-4 flex items-center gap-2">
        <span className="text-2xl">💡</span>
        최종답변
      </h3>
      
      {finalAnswer ? (
        <div className="text-gray-800 leading-relaxed">
          <div className="bg-white/70 rounded-lg p-4 border border-blue-100">
            <p className="font-semibold text-blue-900 mb-2">📋 핵심 요약</p>
            <p className="text-gray-700">{finalAnswer.summary}</p>
          </div>
          
          {finalAnswer.keyPoints && (
            <div className="mt-4">
              <p className="font-semibold text-blue-900 mb-2">🎯 주요 포인트</p>
              <ul className="space-y-2">
                {finalAnswer.keyPoints.map((point, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">•</span>
                    <span className="text-gray-700">{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {finalAnswer.recommendation && (
            <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="font-semibold text-yellow-800 mb-2">💡 권고사항</p>
              <p className="text-yellow-700">{finalAnswer.recommendation}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="text-gray-500 italic">
          질의를 입력하면 AI가 최종답변을 생성합니다.
        </div>
      )}
    </div>
  );
}
