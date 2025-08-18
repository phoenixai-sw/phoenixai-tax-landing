import { useState } from 'react';

export default function TaxCalculator() {
  const [formData, setFormData] = useState({
    propertyValue: '',
    holdingPeriod: '',
    residencyPeriod: '',
    isMultiHome: false,
    isAdjustedArea: false
  });

  const [result, setResult] = useState(null);

  const calculateTax = () => {
    const { propertyValue, holdingPeriod, residencyPeriod, isMultiHome, isAdjustedArea } = formData;
    
    if (!propertyValue || !holdingPeriod || !residencyPeriod) return;

    const value = parseFloat(propertyValue);
    const holding = parseInt(holdingPeriod);
    const residency = parseInt(residencyPeriod);

    // 기본 세율 (6~45%)
    let baseRate = 6;
    if (value > 1200000000) baseRate = 45;
    else if (value > 900000000) baseRate = 42;
    else if (value > 600000000) baseRate = 39;
    else if (value > 300000000) baseRate = 33;
    else if (value > 150000000) baseRate = 24;
    else if (value > 60000000) baseRate = 15;

    // 장기보유특별공제
    let deductionRate = 0;
    if (holding >= 3 && residency >= 2) {
      deductionRate = 8 + (Math.min(residency - 2, 8) * 4);
      deductionRate = Math.min(deductionRate, 40);
    }

    // 중과세율
    let heavyTaxRate = 0;
    if (isMultiHome) {
      heavyTaxRate = 20; // 2주택 이상
    }

    // 최종 세율
    const finalRate = Math.max(baseRate - deductionRate + heavyTaxRate, 6);
    const taxAmount = (value * finalRate) / 100;

    setResult({
      baseRate,
      deductionRate,
      heavyTaxRate,
      finalRate,
      taxAmount,
      savings: (value * deductionRate) / 100
    });
  };

  return (
    <div className="bg-gradient-to-br from-green-50 to-blue-50 border-2 border-green-200 rounded-xl p-6 shadow-lg">
      <h3 className="text-green-800 font-bold text-lg mb-4 flex items-center gap-2">
        <span className="text-2xl">🧮</span>
        양도세 계산기
      </h3>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            부동산 가액 (만원)
          </label>
          <input
            type="number"
            value={formData.propertyValue}
            onChange={(e) => setFormData({...formData, propertyValue: e.target.value})}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            placeholder="예: 50000"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              보유기간 (년)
            </label>
            <input
              type="number"
              value={formData.holdingPeriod}
              onChange={(e) => setFormData({...formData, holdingPeriod: e.target.value})}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="예: 5"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              거주기간 (년)
            </label>
            <input
              type="number"
              value={formData.residencyPeriod}
              onChange={(e) => setFormData({...formData, residencyPeriod: e.target.value})}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="예: 3"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.isMultiHome}
              onChange={(e) => setFormData({...formData, isMultiHome: e.target.checked})}
              className="rounded text-green-600 focus:ring-green-500"
            />
            <span className="text-sm font-semibold text-gray-700">다주택자</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.isAdjustedArea}
              onChange={(e) => setFormData({...formData, isAdjustedArea: e.target.checked})}
              className="rounded text-green-600 focus:ring-green-500"
            />
            <span className="text-sm font-semibold text-gray-700">투기과열지구</span>
          </label>
        </div>

        <button
          onClick={calculateTax}
          className="w-full bg-gradient-to-r from-green-600 to-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:shadow-lg transition-all duration-300 hover:scale-105"
        >
          세율 계산하기
        </button>

        {result && (
          <div className="mt-6 bg-white/80 rounded-lg p-4 border border-green-200">
            <h4 className="font-bold text-green-800 mb-3">📊 계산 결과</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>기본 세율:</span>
                <span className="font-semibold">{result.baseRate}%</span>
              </div>
              <div className="flex justify-between">
                <span>장기보유공제:</span>
                <span className="font-semibold text-green-600">-{result.deductionRate}%</span>
              </div>
              {result.heavyTaxRate > 0 && (
                <div className="flex justify-between">
                  <span>중과세율:</span>
                  <span className="font-semibold text-red-600">+{result.heavyTaxRate}%</span>
                </div>
              )}
              <div className="border-t pt-2 flex justify-between font-bold text-lg">
                <span>최종 세율:</span>
                <span className="text-blue-600">{result.finalRate}%</span>
              </div>
              <div className="border-t pt-2 flex justify-between font-bold text-lg">
                <span>예상 세금:</span>
                <span className="text-red-600">{result.taxAmount.toLocaleString()}만원</span>
              </div>
              {result.savings > 0 && (
                <div className="flex justify-between text-green-600 font-semibold">
                  <span>절세 효과:</span>
                  <span>{result.savings.toLocaleString()}만원</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
