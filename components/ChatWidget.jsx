import { useState } from 'react';
import { useRouter } from 'next/router';

export default function ChatWidget() {
  const [isMinimized, setIsMinimized] = useState(false);
  const router = useRouter();

  const handleClick = () => {
    router.push('/agent');
  };

  return (
    <button
      aria-label="AI Tax Agent 열기"
      onClick={handleClick}
      className={`fixed bottom-6 right-6 h-16 w-16 sm:h-14 sm:w-14 rounded-full
                 bg-blue-600 text-white grid place-items-center shadow-xl
                 hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-300
                 transition-all duration-300 z-50
                 ${isMinimized ? 'min-w-[60px]' : 'min-w-[200px]'}`}
    >
      <div className="flex items-center gap-2">
        <div className="text-xl animate-pulse">🤖</div>
        {!isMinimized && (
          <span className="text-sm font-semibold whitespace-nowrap">
            AI Tax Agent
          </span>
        )}
      </div>
    </button>
  );
}
