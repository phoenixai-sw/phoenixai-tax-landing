import { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import AnswerCard from '../../components/AnswerCard';
import EvidencePanel from '../../components/EvidencePanel';
import FinalAnswer from '../../components/FinalAnswer';
import TaxCalculator from '../../components/TaxCalculator';
import HoldingPeriodTimer from '../../components/HoldingPeriodTimer';
import TaxRateChart from '../../components/TaxRateChart';

export default function AgentPage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [openCalc, setOpenCalc] = useState(false);
  const [openTimer, setOpenTimer] = useState(false);
  const [openChart, setOpenChart] = useState(false);

  const handleBackToMain = () => {
    router.push('/');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    try {
      // TODO: API 호출 구현
      console.log('Query submitted:', query);
             // 임시 결과 설정
       setResults({
         overview: '양도세에 대한 기본 정보...',
         taxRates: '보유기간별 세율 정보...',
         considerations: '실무상 유의사항...',
         legalBasis: '관련 법령 및 근거...',
         conclusion: '결론 및 권고사항...',
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
        {/* Back to Main Button */}
        <div className="mb-6">
          <button
            onClick={handleBackToMain}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-xl hover:shadow-lg transition-all duration-300 hover:scale-105"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            메인 페이지로 돌아가기
          </button>
        </div>

        

        

                 {/* Main Content Grid */}
         <div className="grid gap-6 md:grid-cols-[300px_1fr_350px]">
           {/* Left Column - Tools Banner (Dropdown) */}
           <aside className="sticky top-6 self-start space-y-4 h-fit">
             <div className="bg-gradient-to-b from-blue-50 to-purple-50 border-2 border-blue-200 rounded-xl p-4 shadow-lg">
               <h3 className="text-blue-800 font-bold text-lg mb-4 text-center">🛠️ 세무 도구</h3>
               <div className="space-y-3">
                 {/* Calculator Dropdown */}
                 <div>
                   <button
                     aria-expanded={openCalc}
                     onClick={() => setOpenCalc(!openCalc)}
                     className={`w-full text-white font-semibold py-3 px-4 rounded-lg hover:shadow-lg transition-all duration-300 flex items-center justify-between ${openCalc ? 'bg-gradient-to-r from-green-600 to-blue-600' : 'bg-gradient-to-r from-green-500 to-blue-500'}`}
                   >
                     <span className="flex items-center gap-2">
                       <span className="text-xl">🧮</span>
                       양도세 계산기
                     </span>
                     <span className="text-sm opacity-90">{openCalc ? '접기 ▲' : '펼치기 ▼'}</span>
                   </button>
                   {openCalc && (
                     <div className="mt-3 bg-white rounded-lg border border-green-200 p-3">
                       <TaxCalculator />
                     </div>
                   )}
                 </div>

                 {/* Timer Dropdown */}
                 <div>
                   <button
                     aria-expanded={openTimer}
                     onClick={() => setOpenTimer(!openTimer)}
                     className={`w-full text-white font-semibold py-3 px-4 rounded-lg hover:shadow-lg transition-all duration-300 flex items-center justify-between ${openTimer ? 'bg-gradient-to-r from-purple-600 to-pink-600' : 'bg-gradient-to-r from-purple-500 to-pink-500'}`}
                   >
                     <span className="flex items-center gap-2">
                       <span className="text-xl">⏰</span>
                       보유기간 타이머
                     </span>
                     <span className="text-sm opacity-90">{openTimer ? '접기 ▲' : '펼치기 ▼'}</span>
                   </button>
                   {openTimer && (
                     <div className="mt-3 bg-white rounded-lg border border-purple-200 p-3">
                       <HoldingPeriodTimer />
                     </div>
                   )}
                 </div>

                 {/* Chart Dropdown */}
                 <div>
                   <button
                     aria-expanded={openChart}
                     onClick={() => setOpenChart(!openChart)}
                     className={`w-full text-white font-semibold py-3 px-4 rounded-lg hover:shadow-lg transition-all duration-300 flex items-center justify-between ${openChart ? 'bg-gradient-to-r from-blue-600 to-indigo-600' : 'bg-gradient-to-r from-blue-500 to-indigo-500'}`}
                   >
                     <span className="flex items-center gap-2">
                       <span className="text-xl">📊</span>
                       세율 변화 차트
                     </span>
                     <span className="text-sm opacity-90">{openChart ? '접기 ▲' : '펼치기 ▼'}</span>
                   </button>
                   {openChart && (
                     <div className="mt-3 bg-white rounded-lg border border-blue-200 p-3">
                       <TaxRateChart />
                     </div>
                   )}
                 </div>
               </div>
             </div>
           </aside>

           {/* Center Column - Chat Interface */}
           <section className="bg-white border-2 border-gray-200 rounded-xl shadow-lg min-h-[600px] flex flex-col">
             {/* Chat Header */}
             <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 rounded-t-xl">
               <h2 className="text-xl font-bold flex items-center gap-2">
                 <span className="text-2xl">🤖</span>
                 AI Tax Agent
               </h2>
               <p className="text-blue-100 text-sm">전문 세무 상담을 도와드립니다</p>
             </div>

             {/* Chat Messages */}
             <div className="flex-1 p-6 space-y-4 overflow-y-auto">
               {!results ? (
                 <div className="text-center text-gray-500 py-8">
                   <div className="text-4xl mb-4">💬</div>
                   <p className="text-lg font-semibold">양도세에 대해 궁금한 점을 물어보세요!</p>
                   <p className="text-sm mt-2">예: "1년된 주택을 1억의 시세차익을 두고 판매하였습니다"</p>
                 </div>
               ) : (
                 <>
                   {/* User Message */}
                   <div className="flex justify-end">
                     <div className="bg-blue-600 text-white p-4 rounded-xl max-w-[80%]">
                       <p className="font-semibold">질문:</p>
                       <p>{query}</p>
                     </div>
                   </div>

                   {/* AI Response */}
                   <div className="flex justify-start">
                     <div className="bg-gray-100 p-4 rounded-xl max-w-[80%]">
                       <p className="font-semibold text-gray-800 mb-2">AI 답변:</p>
                       <div className="space-y-3">
                         <div>
                           <h4 className="font-semibold text-blue-600">1. 개요/기본 원칙</h4>
                           <p className="text-gray-700">{results.overview}</p>
                         </div>
                         <div>
                           <h4 className="font-semibold text-blue-600">2. 보유·거주기간/세율 표</h4>
                           <p className="text-gray-700">{results.taxRates}</p>
                         </div>
                         <div>
                           <h4 className="font-semibold text-blue-600">3. 실무상 유의사항</h4>
                           <p className="text-gray-700">{results.considerations}</p>
                         </div>
                         <div>
                           <h4 className="font-semibold text-blue-600">4. 관련 법령 및 근거</h4>
                           <p className="text-gray-700">{results.legalBasis}</p>
                         </div>
                       </div>
                     </div>
                   </div>
                 </>
               )}
             </div>

             {/* Chat Input */}
             <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
               <form onSubmit={handleSubmit} className="flex gap-3">
                 <input
                   type="text"
                   value={query}
                   onChange={(e) => setQuery(e.target.value)}
                   placeholder="양도세 질문을 입력하세요..."
                   className="flex-1 border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                   disabled={isLoading}
                 />
                 <button
                   type="submit"
                   disabled={isLoading || !query.trim()}
                   className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                 >
                   {isLoading ? '처리중...' : '전송'}
                 </button>
               </form>
             </div>
           </section>

           {/* Right Column - Final Answer & Evidence Panel */}
           <aside className="sticky top-6 self-start space-y-6">
             <FinalAnswer finalAnswer={results?.finalAnswer} isLoading={isLoading} />
             <EvidencePanel evidence={results?.evidence} isLoading={isLoading} />
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
