import React from 'react';

export default function AnswerCard({ title, content, variant = 'primary', isLoading = false, isActive = false }) {
  const getVariantClasses = () => {
    switch (variant) {
      case 'secondary':
        return 'bg-gray-100 border-gray-300';
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-white border-gray-200';
    }
  };

  return (
    <div className={`p-6 rounded-xl transition-all duration-500 hover:shadow-md ${isActive ? 'animate-fadeInUp' : ''} ${getVariantClasses()} shadow-sm`}>
      <h3 className="mb-4 text-gray-800 font-semibold">{title}</h3>
      <div className="space-y-3">
        {isLoading ? (
          <>
            <div className="h-4 bg-gray-200 rounded animate-pulse" data-testid="loading-spinner"></div>
            <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2"></div>
          </>
        ) : (
          <div className="text-gray-600 leading-relaxed whitespace-pre-wrap">{content}</div>
        )}
      </div>
    </div>
  );
}
