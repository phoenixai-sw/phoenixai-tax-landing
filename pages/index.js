import Head from 'next/head';
import { useState, useEffect } from 'react';
import ChatWidget from '../components/ChatWidget';

export default function Home() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <>
      <Head>
        <title>AI신승 세무사 - AI 상담 서비스</title>
        <meta name="description" content="AI 기술을 활용한 전문 세무 상담 서비스로 비즈니스 성장을 도와드립니다" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="theme-color" content="#FFF9C4" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🚀</text></svg>" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </Head>

      <main className="min-h-screen bg-white">
        {/* Navigation */}
        <nav className="fixed top-0 w-full bg-yellow-100 backdrop-blur-md z-50 border-b border-yellow-300">
          <div className="max-w-7xl mx-auto flex justify-between items-center px-8 py-4">
            <div className="text-2xl font-bold text-black">Phoenix AI</div>
            <ul className="flex gap-8 items-center">
              <li><a href="#home" className="text-black font-bold hover:bg-yellow-200 px-4 py-2 rounded-lg transition-colors">Home</a></li>
              <li><a href="#about" className="text-black font-bold hover:bg-yellow-200 px-4 py-2 rounded-lg transition-colors">About</a></li>
              <li><a href="#courses" className="text-black font-bold hover:bg-yellow-200 px-4 py-2 rounded-lg transition-colors">과정소개</a></li>
              <li><a href="#premium" className="text-black font-bold hover:bg-yellow-200 px-4 py-2 rounded-lg transition-colors">프리미엄 서비스</a></li>
              <li><a href="#solutions" className="text-black font-bold hover:bg-yellow-200 px-4 py-2 rounded-lg transition-colors">솔루션</a></li>
              <li><a href="#portfolio" className="text-black font-bold hover:bg-yellow-200 px-4 py-2 rounded-lg transition-colors">Portfolio</a></li>
              <li><a href="#ceo" className="text-black font-bold hover:bg-yellow-200 px-4 py-2 rounded-lg transition-colors">CEO</a></li>
              <li><a href="#contact" className="text-black font-bold hover:bg-yellow-200 px-4 py-2 rounded-lg transition-colors">Contact</a></li>
            </ul>
          </div>
        </nav>

        <div className="max-w-7xl mx-auto px-5">
          {/* Header */}
          <header className={`text-center pt-36 pb-16 transition-opacity duration-1000 ${isVisible ? 'opacity-100' : 'opacity-0'}`} id="home">
            <div className="bg-purple-100 border-2 border-purple-300 rounded-3xl p-10 max-w-4xl mx-auto shadow-lg">
              <h1 className="text-6xl font-black mb-6 bg-gradient-to-r from-pink-500 via-blue-500 to-green-500 bg-clip-text text-transparent animate-pulse">
                AI신승 세무사
              </h1>
              <p className="text-xl text-purple-800 font-semibold max-w-3xl mx-auto">
                AI 기술을 활용한 <span className="bg-gradient-to-r from-pink-500 to-blue-500 bg-clip-text text-transparent font-bold">전문 세무 상담 서비스</span>로 비즈니스 성장을 도와드립니다
              </p>
            </div>
          </header>

          {/* About Section */}
          <section className="py-20 bg-yellow-100" id="about">
            <div className="max-w-7xl mx-auto px-5">
              <h2 className="text-4xl font-black text-center mb-12">About AI신승 세무사</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                <div>
                  <h3 className="text-3xl font-bold mb-4 text-black">AI 기반 전문 세무 상담</h3>
                  <p className="text-lg mb-6 text-black leading-relaxed">
                    최신 AI 기술을 활용하여 세무 상담의 새로운 패러다임을 제시합니다. 복잡한 세무 문제를 빠르고 정확하게 분석하고, 맞춤형 솔루션을 제공합니다.
                  </p>
                  <p className="text-lg text-black leading-relaxed">
                    기업의 세무 관리 효율성을 극대화하고, 세무 리스크를 최소화하여 비즈니스 성장을 지원하는 전문 서비스를 제공합니다.
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-8">
                  <div className="text-center p-8 bg-white rounded-2xl shadow-lg border-t-4 border-blue-500">
                    <span className="text-4xl font-bold text-blue-500 block">33+</span>
                    <div className="text-gray-600 mt-2 font-semibold">국세청 경력</div>
                  </div>
                  <div className="text-center p-8 bg-white rounded-2xl shadow-lg border-t-4 border-green-500">
                    <span className="text-4xl font-bold text-green-500 block">500+</span>
                    <div className="text-gray-600 mt-2 font-semibold">상담 완료</div>
                  </div>
                  <div className="text-center p-8 bg-white rounded-2xl shadow-lg border-t-4 border-purple-500">
                    <span className="text-4xl font-bold text-purple-500 block">98%</span>
                    <div className="text-gray-600 mt-2 font-semibold">고객 만족도</div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Services Section */}
          <section className="py-20" id="courses">
            <div className="max-w-7xl mx-auto px-5">
              <h2 className="text-4xl font-black text-center mb-6">AI 세무 상담 서비스</h2>
              <p className="text-xl text-gray-600 text-center mb-16 max-w-2xl mx-auto">전문적인 AI 기반 세무 상담 솔루션</p>
              
              <div className="space-y-10">
                {/* Service 1 */}
                <div className="bg-pink-50 border-2 border-pink-200 rounded-3xl p-10 transition-all duration-300 hover:shadow-xl hover:-translate-y-2">
                  <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-8">
                    <div>
                      <div className="inline-block bg-gradient-to-r from-pink-500 to-red-500 text-white px-6 py-3 rounded-full font-bold text-sm mb-6">
                        Service 1
                      </div>
                      <h2 className="text-3xl font-black mb-5">AI 세무 상담 서비스</h2>
                      <div className="bg-pink-100 text-red-700 px-4 py-2 rounded-full text-sm font-semibold inline-block mb-6">
                        실시간 AI 기반 세무 상담 및 분석
                      </div>
                      
                      <div className="space-y-4">
                        <h4 className="text-xl font-bold mb-4">📊 주요 서비스</h4>
                        
                        <div className="bg-pink-50 border border-pink-200 rounded-xl p-5">
                          <div className="font-bold mb-2">세무 분석 및 진단</div>
                          <ul className="text-gray-700 space-y-2">
                            <li><strong>AI 분석:</strong> 기업 세무 데이터 실시간 분석</li>
                            <li><strong>리스크 평가:</strong> 세무 리스크 자동 진단 및 예측</li>
                            <li><strong>최적화 방안:</strong> 세무 효율성 개선 방안 제시</li>
                          </ul>
                        </div>

                        <div className="bg-pink-50 border border-pink-200 rounded-xl p-5">
                          <div className="font-bold mb-2">세무 신고 지원</div>
                          <ul className="text-gray-700 space-y-2">
                            <li><strong>자동화:</strong> 세무 신고 프로세스 자동화</li>
                            <li><strong>검증:</strong> 신고 내용 AI 검증 및 오류 방지</li>
                            <li><strong>최적화:</strong> 세무 절약 방안 실시간 제안</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-center gap-5 min-w-[200px] border-l border-pink-200 pl-8">
                      <div className="bg-gray-100 text-gray-700 px-5 py-3 rounded-full text-sm font-semibold text-center">
                        실시간 서비스
                      </div>
                      <a href="#" className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-6 py-3 rounded-full font-semibold hover:shadow-lg transition-all duration-300">
                        상담 신청
                      </a>
                    </div>
                  </div>
                </div>

                {/* Service 2 */}
                <div className="bg-blue-50 border-2 border-blue-200 rounded-3xl p-10 transition-all duration-300 hover:shadow-xl hover:-translate-y-2">
                  <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-8">
                    <div>
                      <div className="inline-block bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-6 py-3 rounded-full font-bold text-sm mb-6">
                        Service 2
                      </div>
                      <h2 className="text-3xl font-black mb-5">AI 비즈니스 컨설팅</h2>
                      <div className="bg-blue-100 text-blue-700 px-4 py-2 rounded-full text-sm font-semibold inline-block mb-6">
                        AI 기반 비즈니스 전략 및 최적화 서비스
                      </div>
                      
                      <div className="space-y-4">
                        <h4 className="text-xl font-bold mb-4">🎯 주요 영역</h4>
                        
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
                          <div className="font-bold mb-2">비즈니스 전략 수립</div>
                          <div className="text-gray-700">
                            AI 기반 시장 분석, 경쟁사 분석, 비즈니스 모델 최적화 방안 제시
                          </div>
                        </div>

                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
                          <div className="font-bold mb-2">운영 효율성 개선</div>
                          <div className="text-gray-700">
                            프로세스 자동화, 비용 최적화, 생산성 향상 방안 컨설팅<br />
                            AI 도구 도입 및 활용 전략 수립
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-center gap-5 min-w-[200px] border-l border-blue-200 pl-8">
                      <div className="bg-gray-100 text-gray-700 px-5 py-3 rounded-full text-sm font-semibold text-center">
                        맞춤형 서비스
                      </div>
                      <a href="#" className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-6 py-3 rounded-full font-semibold hover:shadow-lg transition-all duration-300">
                        컨설팅 신청
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Contact Section */}
          <section className="py-20 bg-gradient-to-br from-blue-500 to-purple-600 text-white" id="contact">
            <div className="max-w-7xl mx-auto px-5">
              <h2 className="text-4xl font-black text-center mb-12">연락처</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
                <div>
                  <h3 className="text-3xl font-bold mb-8">Get In Touch</h3>
                  <div className="space-y-6">
                    <div className="flex items-center">
                      <span className="text-2xl mr-4">📞</span>
                      <span className="text-lg">070-8064-6118</span>
                    </div>
                    <div className="flex items-center">
                      <span className="text-2xl mr-4">📧</span>
                      <span className="text-lg">phoenixai.edu@gmail.com</span>
                    </div>
                    <div className="flex items-center">
                      <span className="text-2xl mr-4">📍</span>
                      <span className="text-lg">B-497, 202 Dasanjigeum-ro, Namyangju-si</span>
                    </div>
                  </div>
                </div>
                
                <form className="bg-white/10 backdrop-blur-md p-8 rounded-2xl">
                  <div className="space-y-6">
                    <input 
                      type="text" 
                      placeholder="이름" 
                      className="w-full p-4 rounded-xl bg-white/90 text-black"
                      required 
                    />
                    <input 
                      type="email" 
                      placeholder="이메일" 
                      className="w-full p-4 rounded-xl bg-white/90 text-black"
                      required 
                    />
                    <input 
                      type="text" 
                      placeholder="회사명" 
                      className="w-full p-4 rounded-xl bg-white/90 text-black"
                    />
                    <textarea 
                      placeholder="문의사항" 
                      className="w-full p-4 rounded-xl bg-white/90 text-black h-32 resize-none"
                    ></textarea>
                    <button 
                      type="submit" 
                      className="w-full p-4 bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-bold rounded-xl hover:shadow-lg transition-all duration-300"
                    >
                      문의하기
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </section>
        </div>

        {/* Chat Widget */}
        <ChatWidget />
      </main>
    </>
  );
}
