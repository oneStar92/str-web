# Storm Alliance Web

간단한 React(Vite) 기반 랜딩 페이지입니다. Supabase/Auth 연동 전 Netlify 배포 테스트용으로 사용할 수 있습니다.

## 개발 서버
```bash
npm install
cp .env.example .env # Supabase URL/키를 입력
npm run dev
```
브라우저에서 `http://localhost:5173`을 엽니다.

## 프로덕션 빌드
```bash
npm run build
npm run preview
```

Netlify에 배포할 때는 `npm run build` 후 생성되는 `dist/` 디렉터리를 그대로 업로드하면 됩니다.

## 환경 변수
Supabase Auth 연동을 위해 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`가 필요합니다. 제공된 `.env.example`을 복사해 값을 채우세요.
