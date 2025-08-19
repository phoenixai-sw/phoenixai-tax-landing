-- Phoenix AI Tax Landing - 권한 테스트 스크립트
-- Supabase SQL Editor에서 실행하여 RLS 정책 테스트

-- 1. 현재 인증 상태 확인
SELECT 
  auth.uid() as current_user_id,
  auth.role() as current_role,
  auth.email() as current_email;

-- 2. 테이블 존재 확인
SELECT 
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('users', 'search_history', 'chat_sessions', 'chat_messages', 'web_cache', 'search_metrics')
ORDER BY table_name;

-- 3. RLS 활성화 상태 확인
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('users', 'search_history', 'chat_sessions', 'chat_messages', 'web_cache', 'search_metrics');

-- 4. RLS 정책 확인
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 5. 테스트 데이터 삽입 (인증된 사용자만 가능)
-- Users 테이블 테스트
INSERT INTO users (email) 
VALUES (auth.email())
ON CONFLICT (email) DO NOTHING
RETURNING id, email, created_at;

-- 6. 현재 사용자의 데이터 조회 테스트
SELECT 'users' as table_name, COUNT(*) as record_count FROM users WHERE id = auth.uid()
UNION ALL
SELECT 'search_history' as table_name, COUNT(*) as record_count FROM search_history WHERE user_id = auth.uid()
UNION ALL
SELECT 'chat_sessions' as table_name, COUNT(*) as record_count FROM chat_sessions WHERE user_id = auth.uid()
UNION ALL
SELECT 'chat_messages' as table_name, COUNT(*) as record_count FROM chat_messages 
WHERE session_id IN (SELECT id FROM chat_sessions WHERE user_id = auth.uid())
UNION ALL
SELECT 'web_cache' as table_name, COUNT(*) as record_count FROM web_cache
UNION ALL
SELECT 'search_metrics' as table_name, COUNT(*) as record_count FROM search_metrics 
WHERE session_id IN (SELECT id FROM chat_sessions WHERE user_id = auth.uid());

-- 7. 권한 테스트 (다른 사용자 데이터 접근 시도)
-- 이 쿼리는 RLS에 의해 차단되어야 함
SELECT 'RLS Test - Other user data access blocked' as test_result,
       COUNT(*) as blocked_records
FROM users 
WHERE id != auth.uid();

-- 8. 웹 캐시 공개 접근 테스트
SELECT 'web_cache public access' as test_name,
       COUNT(*) as accessible_records
FROM web_cache;

-- 9. 함수 권한 테스트
SELECT get_current_user_id() as fallback_user_id;

-- 10. 정책 요약
SELECT 
  tablename,
  COUNT(*) as policy_count,
  STRING_AGG(policyname, ', ') as policies
FROM pg_policies 
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;
