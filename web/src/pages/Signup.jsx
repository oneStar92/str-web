import { Link } from 'react-router-dom';

export default function Signup() {
  const handleSubmit = (event) => {
    event.preventDefault();
    // TODO: Supabase Auth 회원가입 연동
  };

  return (
    <>
      <header className="login-hero">
        <h1>STr 회원가입</h1>
        <p className="hero-copy">Supabase Auth로 운영진이 승인할 계정을 생성합니다.</p>
      </header>

      <main>
        <form className="login-card" onSubmit={handleSubmit}>
          <label htmlFor="signup-email">이메일</label>
          <input id="signup-email" type="email" placeholder="you@example.com" required />

          <label htmlFor="signup-password">비밀번호</label>
          <input id="signup-password" type="password" placeholder="최소 8자" required />

          <label htmlFor="signup-password-confirm">비밀번호 확인</label>
          <input id="signup-password-confirm" type="password" placeholder="비밀번호 재입력" required />

          <button type="submit">가입 하기</button>
          <p className="form-note with-link">
            <Link to="/" className="text-button">
              돌아가기
            </Link>
            <span>입력된 정보는 운영진 승인 후 활성화됩니다.</span>
          </p>
        </form>
      </main>
    </>
  );
}
