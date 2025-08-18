import { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import AnswerCard from '../../components/AnswerCard';
import EvidencePanel from '../../components/EvidencePanel';
import FinalAnswer from '../../components/FinalAnswer';

export default function AgentPage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState(null);

  const handleBackToMain = () => {
    router.push('/');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    try {
      // TODO: GPT-5 API 호출 구현
      console.log('Query submitted:', query);
      
      // 임시 결과 설정 (GPT-5 API 응답 구조 시뮬레이션)
      setResults({
        answers: [
          {
            title: "양도세 기본 개념",
            content: "양도소득세는 부동산 양도 시 발생하는 소득에 대해 과세하는 세금입니다. 양도소득은 양도가액에서 양도차익을 차감한 금액으로 계산됩니다."
          },
          {
            title: "보유기간별 세율 체계",
            content: "1년 미만 보유 시 30%, 1년 이상 2년 미만 20%, 2년 이상 3년 미만 15%, 3년 이상 10%의 세율이 적용됩니다. 장기보유특별공제를 통해 최대 40%까지 세율을 절감할 수 있습니다."
          },
          {
            title: "실무상 유의사항",
            content: "3년 이상 보유하고 2년 이상 거주한 경우 장기보유특별공제가 적용됩니다. 다주택자는 중과세율이 적용될 수 있으며, 투기과열지구는 추가 제한사항이 있습니다."
          },
          {
            title: "절세 전략",
            content: "장기보유를 통한 절세 효과를 극대화하고, 전문가 상담을 통해 최적의 양도 시점을 결정하는 것이 중요합니다. 또한 거주기간과 보유기간을 정확히 계산하여 공제 혜택을 최대한 활용해야 합니다."
          }
        ],
        finalAnswer: {
          summary: '양도소득세는 부동산 양도 시 발생하는 소득에 대해 과세하는 세금입니다. 장기보유특별공제를 통해 최대 40%까지 세율을 절감할 수 있습니다.',
          keyPoints: [
            '3년 이상 보유 + 2년 이상 거주 시 공제 시작',
            '거주기간이 길수록 공제율 증가 (최대 40%)',
            '다주택자는 중과세율 적용 가능',
            '투기과열지구는 추가 제한사항 있음'
          ],
          recommendation: '장기보유를 통한 절세 효과를 극대화하고, 전문가 상담을 통해 최적의 양도 시점을 결정하시기 바랍니다.'
        },
        evidence: [
          {
            domain: 'law.go.kr',
            title: '양도소득세법 제1조',
            snippet: '양도소득세에 관한 기본 규정...',
            url: 'https://law.go.kr/법령/양도소득세법/제1조'
          },
          {
            domain: 'nts.go.kr',
            title: '양도소득세 세율표',
            snippet: '보유기간별 세율 및 공제율 안내...',
            url: 'https://nts.go.kr/양도소득세/세율표'
          }
        ]
      });
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>AI Tax Agent - 세무 상담</title>
        <meta name="description" content="AI 기반 전문 세무 상담 서비스" />
      </Head>

             <main className="max-w-[1080px] mx-auto px-4 py-8 min-h-screen">
         {/* Top Navigation Bar */}
         <div className="mb-6 flex justify-between items-center">
           {/* Back to Main Button */}
           <button
             onClick={handleBackToMain}
             className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-xl hover:shadow-lg transition-all duration-300 hover:scale-105"
           >
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
             </svg>
             메인 페이지로 돌아가기
           </button>

           {/* Tools Banner */}
           <button
             onClick={() => router.push('/tools')}
             className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-yellow-400 to-orange-400 text-white font-bold rounded-xl hover:shadow-lg transition-all duration-300 hover:scale-105"
           >
             <span>양도세 계산기 등 부가기능</span>
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
             </svg>
           </button>
         </div>

         {/* Header */}
         <header className="mb-6 grid gap-3 md:grid-cols-[1fr_auto]">
           <form onSubmit={handleSubmit} className="flex gap-3">
             <input
               type="text"
               value={query}
               onChange={(e) => setQuery(e.target.value)}
               placeholder="양도세 질문을 입력하세요"
               className="flex-1 border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
               disabled={isLoading}
             />
             <button
               type="submit"
               disabled={isLoading || !query.trim()}
               className="rounded-xl px-5 py-3 bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
             >
               {isLoading ? '처리중...' : '질의'}
             </button>
           </form>
         </header>

         {/* Results Summary Bar */}
         {results && (
           <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl">
             <div className="flex items-center gap-2">
               <span className="text-green-600">✅</span>
               <span className="text-green-800 font-semibold">
                 질의 완료: "{query}"에 대한 답변을 생성했습니다.
               </span>
             </div>
           </div>
         )}

                   {/* Main Content Grid */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Left Column - Dynamic Answer Cards */}
            <section className="space-y-4">
              {!results ? (
                // 질문 전 상태 - 안내 메시지
                <div className="flex items-center justify-center h-64 bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl">
                  <div className="text-center text-gray-500">
                    <div className="text-4xl mb-4">💬</div>
                    <p className="text-lg font-semibold">양도세에 대해 궁금한 점을 물어보세요!</p>
                    <p className="text-sm mt-2">예: "1년된 주택을 1억의 시세차익을 두고 판매하였습니다"</p>
                  </div>
                </div>
              ) : (
                // 질문 후 상태 - 동적 답변 카드들
                <>
                  {results.answers?.map((answer, index) => (
                    <AnswerCard 
                      key={index}
                      title={answer.title}
                      content={answer.content}
                      isLoading={isLoading}
                    />
                  ))}
                </>
              )}
            </section>

            {/* Right Column - Final Answer & Evidence Panel */}
            <aside className="space-y-6">
              <FinalAnswer 
                finalAnswer={results?.finalAnswer} 
                isLoading={isLoading}
                isActive={!!results}
              />
              <EvidencePanel 
                evidence={results?.evidence} 
                isLoading={isLoading}
                isActive={!!results}
              />
            </aside>
          </div>

        {/* Loading State */}
        {isLoading && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white p-8 rounded-2xl shadow-xl">
              <div className="flex items-center gap-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="text-lg font-semibold">AI가 답변을 생성하고 있습니다...</span>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
