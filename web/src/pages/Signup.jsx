import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';

const initialForm = {
  email: '',
  password: '',
  passwordConfirm: '',
};

export default function Signup() {
  const [form, setForm] = useState(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const navigate = useNavigate();

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const validateForm = () => {
    if (!form.email.trim()) {
      return '이메일을 입력해주세요.';
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(form.email.trim())) {
      return '올바른 이메일 형식을 입력해주세요.';
    }

    if (form.password.length < 8 || form.password.length > 16) {
      return '비밀번호는 8자 이상 16자 이하로 입력해주세요.';
    }

    if (form.password !== form.passwordConfirm) {
      return '비밀번호와 비밀번호 확인이 일치하지 않습니다.';
    }

    return '';
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus({ type: '', message: '' });

    if (!supabase) {
      setStatus({
        type: 'error',
        message: 'Supabase 환경 변수를 찾을 수 없습니다. 관리자에게 문의하세요.',
      });
      return;
    }

    const validationMessage = validateForm();
    if (validationMessage) {
      setStatus({ type: 'error', message: validationMessage });
      return;
    }

    setIsSubmitting(true);
    const { error } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
    });

    setIsSubmitting(false);

    if (error) {
      setStatus({ type: 'error', message: error.message ?? '회원가입에 실패했습니다.' });
      return;
    }

    setStatus({
      type: 'success',
      message: '회원가입이 완료되었습니다. 이메일 인증 후 운영진 승인을 기다려주세요.',
    });
    setForm(initialForm);
    setIsModalOpen(true);
  };

  const handleModalConfirm = () => {
    setIsModalOpen(false);
    navigate('/');
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
          <input
            id="signup-email"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            placeholder="you@example.com"
            required
          />

          <label htmlFor="signup-password">비밀번호</label>
          <input
            id="signup-password"
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            placeholder="최소 8자"
            minLength={8}
            required
          />

          <label htmlFor="signup-password-confirm">비밀번호 확인</label>
          <input
            id="signup-password-confirm"
            name="passwordConfirm"
            type="password"
            value={form.passwordConfirm}
            onChange={handleChange}
            placeholder="비밀번호 재입력"
            minLength={8}
            required
          />

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? '가입 처리 중…' : '가입 하기'}
          </button>
          {status.message && (
            <p className={`form-note ${status.type === 'error' ? 'error' : 'success'}`}>
              {status.message}
            </p>
          )}
          <p className="form-note with-link">
            <Link to="/" className="text-button">
              돌아가기
            </Link>
            <span>입력된 정보는 운영진 승인 후 활성화됩니다.</span>
          </p>
        </form>
      </main>

      {isModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card">
            <p className="modal-title">회원가입이 완료되었습니다.</p>
            <p className="modal-body">관리자 승인을 기다려주세요.</p>
            <button type="button" className="modal-button" onClick={handleModalConfirm}>
              확인
            </button>
          </div>
        </div>
      )}
    </>
  );
}
