import { useState, useEffect } from 'react';

export default function HoldingPeriodTimer() {
  const [acquisitionDate, setAcquisitionDate] = useState('');
  const [residenceDate, setResidenceDate] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const calculatePeriod = (startDate) => {
    if (!startDate) return null;
    
    const start = new Date(startDate);
    const diff = currentTime - start;
    const years = Math.floor(diff / (1000 * 60 * 60 * 24 * 365));
    const months = Math.floor((diff % (1000 * 60 * 60 * 24 * 365)) / (1000 * 60 * 60 * 24 * 30));
    const days = Math.floor((diff % (1000 * 60 * 60 * 24 * 30)) / (1000 * 60 * 60 * 24));
    
    return { years, months, days };
  };

  const holdingPeriod = calculatePeriod(acquisitionDate);
  const residencePeriod = calculatePeriod(residenceDate);

  const getDeductionRate = (holding, residence) => {
    if (holding >= 3 && residence >= 2) {
      const rate = 8 + (Math.min(residence - 2, 8) * 4);
      return Math.min(rate, 40);
    }
    return 0;
  };

  const holdingDeduction = getDeductionRate(holdingPeriod?.years || 0, residencePeriod?.years || 0);

  return (
    <div className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200 rounded-xl p-6 shadow-lg">
      <h3 className="text-purple-800 font-bold text-lg mb-4 flex items-center gap-2">
        <span className="text-2xl">⏰</span>
        보유기간 타이머
      </h3>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            취득일
          </label>
          <input
            type="date"
            value={acquisitionDate}
            onChange={(e) => setAcquisitionDate(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            거주시작일
          </label>
          <input
            type="date"
            value={residenceDate}
            onChange={(e) => setResidenceDate(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          {holdingPeriod && (
            <div className="bg-white/80 rounded-lg p-4 border border-purple-200">
              <h4 className="font-bold text-purple-800 mb-2">🏠 보유기간</h4>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {holdingPeriod.years}년 {holdingPeriod.months}개월
                </div>
                <div className="text-sm text-gray-600">
                  {holdingPeriod.days}일
                </div>
                {holdingPeriod.years >= 3 && (
                  <div className="mt-2 text-green-600 font-semibold">
                    ✅ 장기보유 요건 충족
                  </div>
                )}
              </div>
            </div>
          )}

          {residencePeriod && (
            <div className="bg-white/80 rounded-lg p-4 border border-purple-200">
              <h4 className="font-bold text-purple-800 mb-2">🏡 거주기간</h4>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {residencePeriod.years}년 {residencePeriod.months}개월
                </div>
                <div className="text-sm text-gray-600">
                  {residencePeriod.days}일
                </div>
                {residencePeriod.years >= 2 && (
                  <div className="mt-2 text-green-600 font-semibold">
                    ✅ 거주 요건 충족
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {holdingDeduction > 0 && (
          <div className="bg-gradient-to-r from-green-100 to-blue-100 rounded-lg p-4 border border-green-200">
            <h4 className="font-bold text-green-800 mb-2">🎯 장기보유특별공제</h4>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">
                {holdingDeduction}%
              </div>
              <div className="text-sm text-gray-600 mt-1">
                세율에서 차감 가능
              </div>
            </div>
          </div>
        )}

        <div className="text-xs text-gray-500 text-center">
          현재 시간: {currentTime.toLocaleString('ko-KR')}
        </div>
      </div>
    </div>
  );
}
