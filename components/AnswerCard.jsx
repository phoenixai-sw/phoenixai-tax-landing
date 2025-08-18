export default function AnswerCard({ title, content, variant = 'default', isLoading = false }) {
  const getCardStyles = () => {
    switch (variant) {
      case 'highlight':
        return 'bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 shadow-lg';
      default:
        return 'bg-white border border-gray-200 shadow-sm';
    }
  };

  const getTitleStyles = () => {
    switch (variant) {
      case 'highlight':
        return 'text-blue-800 font-bold text-lg';
      default:
        return 'text-gray-800 font-semibold';
    }
  };

  return (
    <div className={`p-6 rounded-xl transition-all duration-500 hover:shadow-md animate-fadeInUp ${getCardStyles()}`}>
      <h3 className={`mb-4 ${getTitleStyles()}`}>
        {title}
      </h3>
      
      {isLoading ? (
        <div className="space-y-3">
          <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2"></div>
        </div>
      ) : content ? (
        <div className="text-gray-700 leading-relaxed">
          {content}
        </div>
      ) : (
        <div className="text-gray-500 italic">
          질의를 입력하고 "질의" 버튼을 클릭하세요.
        </div>
      )}
    </div>
  );
}
