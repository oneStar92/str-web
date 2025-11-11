import { Link } from 'react-router-dom';

export default function Login() {
  const handleSubmit = (event) => {
    event.preventDefault();
    // TODO: Supabase Auth 로그인 연동
  };

  return (
    <>
      <header className="login-hero">
        <h1>STr 로그인</h1>
      </header>

      <main>
        <form className="login-card" onSubmit={handleSubmit}>
          <label htmlFor="email">이메일</label>
          <input id="email" type="email" placeholder="you@example.com" required />

          <label htmlFor="password">비밀번호</label>
          <input id="password" type="password" placeholder="••••••••" required />

          <button type="submit">로그인</button>
          <p className="form-note with-link signup-only">
            <Link to="/signup" className="text-button">
              회원가입
            </Link>
          </p>
        </form>
      </main>
    </>
  );
}
