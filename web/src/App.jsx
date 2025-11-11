import { useMemo } from 'react';

const featureList = [
  { title: '회원 승인', description: '운영진이 직접 계정을 생성하고 승인 상태를 관리합니다.' },
  { title: '전장 편성', description: '사막/협곡 전장의 선발 규칙을 웹에서 손쉽게 적용합니다.' },
  { title: '실시간 현황', description: 'Supabase와 연동해 멤버/전장 데이터를 즉시 반영합니다.' },
];

export default function App() {
  const heroTitle = useMemo(() => 'Storm Alliance Portal', []);

  return (
    <div className="app-shell">
      <header className="hero">
        <p className="eyebrow">Supabase + Netlify</p>
        <h1>{heroTitle}</h1>
        <p className="subtitle">
          멤버 관리와 전장 편성을 하나의 대시보드에서 처리하는 React 기반 관리 도구입니다.
        </p>
        <div className="cta-row">
          <a className="primary" href="https://app.netlify.com/" target="_blank" rel="noreferrer">
            Netlify 대시보드
          </a>
          <a className="ghost" href="https://supabase.com/dashboard" target="_blank" rel="noreferrer">
            Supabase 콘솔
          </a>
        </div>
      </header>

      <main>
        <section className="card-grid">
          {featureList.map(({ title, description }) => (
            <article key={title}>
              <h2>{title}</h2>
              <p>{description}</p>
            </article>
          ))}
        </section>
      </main>

      <footer>
        <span>© {new Date().getFullYear()} Storm Alliance</span>
        <span>Made with React + Vite</span>
      </footer>
    </div>
  );
}
