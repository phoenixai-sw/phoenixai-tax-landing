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

                 {/* Tools Banner - Top Right */}
         <div className="mb-6 flex justify-end">
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

         {/* Main Content Grid */}
         <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
           {/* Center Column - Answer Cards */}
           <section className="space-y-4">
             <AnswerCard 
               title="1. 개요/기본 원칙" 
               content={results?.overview}
               isLoading={isLoading}
             />
             <AnswerCard 
               title="2. 보유·거주기간/세율 표" 
               content={results?.taxRates}
               isLoading={isLoading}
             />
             <AnswerCard 
               title="3. 실무상 유의사항" 
               content={results?.considerations}
               isLoading={isLoading}
             />
             <AnswerCard 
               title="4. 관련 법령 및 근거" 
               content={results?.legalBasis}
               isLoading={isLoading}
             />
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
