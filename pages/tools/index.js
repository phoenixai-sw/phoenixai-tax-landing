import { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import TaxCalculator from '../../components/TaxCalculator';
import HoldingPeriodTimer from '../../components/HoldingPeriodTimer';
import TaxRateChart from '../../components/TaxRateChart';

export default function ToolsPage() {
  const router = useRouter();

  const handleBackToAgent = () => {
    router.push('/agent');
  };

  return (
    <>
      <Head>
        <title>세무 도구 - AI Tax Agent</title>
        <meta name="description" content="양도세 계산기, 보유기간 타이머, 세율 변화 차트 등 전문 세무 도구" />
      </Head>

      <main className="max-w-[1200px] mx-auto px-4 py-8 min-h-screen">
        {/* Back to Agent Button */}
        <div className="mb-6">
          <button
            onClick={handleBackToAgent}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-xl hover:shadow-lg transition-all duration-300 hover:scale-105"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            AI Tax Agent로 돌아가기
          </button>
        </div>

        {/* Page Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-black mb-4 bg-gradient-to-r from-yellow-500 to-orange-500 bg-clip-text text-transparent">
            🛠️ 세무 도구
          </h1>
          <p className="text-xl text-gray-600">
            양도세 계산, 보유기간 확인, 세율 분석을 위한 전문 도구들
          </p>
        </div>

        {/* Tools Grid */}
        <div className="grid gap-8 md:grid-cols-1 lg:grid-cols-2">
          {/* Tax Calculator */}
          <div className="lg:col-span-1">
            <TaxCalculator />
          </div>

          {/* Holding Period Timer */}
          <div className="lg:col-span-1">
            <HoldingPeriodTimer />
          </div>

          {/* Tax Rate Chart */}
          <div className="lg:col-span-2">
            <TaxRateChart />
          </div>
        </div>

        {/* Additional Info */}
        <div className="mt-12 bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-200 rounded-xl p-6">
          <h3 className="text-xl font-bold text-yellow-800 mb-4">💡 도구 사용 안내</h3>
          <div className="grid md:grid-cols-3 gap-4 text-sm text-yellow-700">
            <div>
              <h4 className="font-semibold mb-2">🧮 양도세 계산기</h4>
              <p>부동산 가액, 보유기간, 거주기간을 입력하여 예상 양도세를 계산합니다.</p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">⏰ 보유기간 타이머</h4>
              <p>취득일과 거주시작일을 입력하여 실시간으로 보유기간을 확인합니다.</p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">📊 세율 변화 차트</h4>
              <p>거주기간에 따른 세율 변화를 시각적으로 확인할 수 있습니다.</p>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
