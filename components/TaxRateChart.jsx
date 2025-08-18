import { useState } from 'react';

export default function TaxRateChart() {
  const [selectedPeriod, setSelectedPeriod] = useState(3);

  const taxRates = [
    { period: 1, rate: 6, color: 'bg-red-500' },
    { period: 2, rate: 6, color: 'bg-red-500' },
    { period: 3, rate: 6, color: 'bg-orange-500' },
    { period: 4, rate: 6, color: 'bg-yellow-500' },
    { period: 5, rate: 6, color: 'bg-green-500' },
    { period: 6, rate: 6, color: 'bg-green-500' },
    { period: 7, rate: 6, color: 'bg-green-500' },
    { period: 8, rate: 6, color: 'bg-green-500' },
    { period: 9, rate: 6, color: 'bg-green-500' },
    { period: 10, rate: 6, color: 'bg-green-500' }
  ];

  const deductionRates = [
    { period: 1, rate: 0, color: 'bg-gray-300' },
    { period: 2, rate: 0, color: 'bg-gray-300' },
    { period: 3, rate: 8, color: 'bg-blue-400' },
    { period: 4, rate: 12, color: 'bg-blue-500' },
    { period: 5, rate: 16, color: 'bg-blue-600' },
    { period: 6, rate: 20, color: 'bg-blue-700' },
    { period: 7, rate: 24, color: 'bg-blue-800' },
    { period: 8, rate: 28, color: 'bg-blue-900' },
    { period: 9, rate: 32, color: 'bg-indigo-600' },
    { period: 10, rate: 36, color: 'bg-indigo-700' }
  ];

  const finalRates = taxRates.map((tax, index) => ({
    period: tax.period,
    rate: Math.max(tax.rate - deductionRates[index].rate, 6),
    color: tax.rate - deductionRates[index].rate <= 6 ? 'bg-green-600' : 'bg-orange-500'
  }));

  const selectedData = finalRates.find(item => item.period === selectedPeriod);

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-6 shadow-lg">
      <h3 className="text-blue-800 font-bold text-lg mb-4 flex items-center gap-2">
        <span className="text-2xl">📊</span>
        세율 변화 차트
      </h3>

      <div className="space-y-4">
        <div className="text-center">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            거주기간 선택
          </label>
          <div className="flex gap-2 justify-center">
            {[3, 4, 5, 6, 7, 8, 9, 10].map(period => (
              <button
                key={period}
                onClick={() => setSelectedPeriod(period)}
                className={`px-3 py-2 rounded-lg font-semibold transition-all duration-300 ${
                  selectedPeriod === period
                    ? 'bg-blue-600 text-white shadow-lg scale-105'
                    : 'bg-white text-gray-600 hover:bg-blue-100'
                }`}
              >
                {period}년
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white/80 rounded-lg p-4 border border-blue-200">
          <h4 className="font-bold text-blue-800 mb-3 text-center">
            {selectedPeriod}년 거주 시 세율 분석
          </h4>
          
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-sm text-gray-600">기본 세율</div>
              <div className="text-2xl font-bold text-red-600">6%</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">공제율</div>
              <div className="text-2xl font-bold text-blue-600">
                {deductionRates.find(d => d.period === selectedPeriod)?.rate || 0}%
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">최종 세율</div>
              <div className="text-2xl font-bold text-green-600">
                {selectedData?.rate || 6}%
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="font-bold text-blue-800 mb-2">세율 변화 그래프</h4>
          <div className="bg-white/80 rounded-lg p-4 border border-blue-200">
            <div className="flex items-end justify-between h-32 gap-1">
              {finalRates.map((item) => (
                <div key={item.period} className="flex-1 flex flex-col items-center">
                  <div 
                    className={`w-full rounded-t transition-all duration-300 ${
                      item.period === selectedPeriod ? 'ring-2 ring-blue-600' : ''
                    }`}
                    style={{ 
                      height: `${Math.max((item.rate / 6) * 20, 10)}px`,
                      backgroundColor: item.period === selectedPeriod ? '#2563eb' : '#6b7280'
                    }}
                  ></div>
                  <div className="text-xs text-gray-600 mt-1">{item.period}년</div>
                  <div className="text-xs font-semibold">{item.rate}%</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-green-100 to-blue-100 rounded-lg p-4 border border-green-200">
          <h4 className="font-bold text-green-800 mb-2">💡 절세 팁</h4>
          <ul className="text-sm text-green-700 space-y-1">
            <li>• 3년 이상 보유 + 2년 이상 거주 시 공제 시작</li>
            <li>• 거주기간이 길수록 공제율 증가 (최대 40%)</li>
            <li>• 10년 이상 거주 시 최대 절세 효과</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
