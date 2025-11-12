import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';

const initialForm = {
  email: '',
  password: '',
};

export default function Login() {
  const [form, setForm] = useState(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [modalContent, setModalContent] = useState({ title: '', body: '' });
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

    if (form.password.length < 8 || form.password.length > 64) {
      return '비밀번호는 8자 이상 입력해주세요.';
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
    const { data, error } = await supabase.auth.signInWithPassword({
      email: form.email.trim(),
      password: form.password,
    });

    if (error) {
      setIsSubmitting(false);
      setStatus({ type: 'error', message: error.message ?? '로그인에 실패했습니다.' });
      return;
    }

    const authUserId = data?.user?.id;
    if (!authUserId) {
      setIsSubmitting(false);
      setStatus({
        type: 'error',
        message: '사용자 정보를 확인할 수 없습니다. 잠시 후 다시 시도하세요.',
      });
      return;
    }

    const { data: userInfoData, error: userInfoError } = await supabase
      .from('user_info')
      .select('permission, approval_status:approval_status(status, description)')
      .eq('auth_user_id', authUserId)
      .maybeSingle();

    setIsSubmitting(false);

    if (userInfoError) {
      setStatus({
        type: 'error',
        message: userInfoError.message ?? '권한 정보를 가져오지 못했습니다.',
      });
      return;
    }

    const permission = userInfoData?.permission ?? '미지정';
    const approvalStatus = userInfoData?.approval_status?.status ?? 'UNKNOWN';
    const approvalDescription =
      userInfoData?.approval_status?.description ?? '승인 정보를 확인할 수 없습니다.';

    if (approvalStatus === 'APPROVED') {
      navigate('/home');
      return;
    }

    const title = '승인 상태 확인';
    let body = approvalDescription;
    if (approvalStatus === 'PENDING') {
      body = `${approvalDescription} (권한: ${permission})`;
    } else if (approvalStatus === 'REJECTED') {
      body = `${approvalDescription} (권한 요청 필요)`;
    }

    setModalContent({ title, body });
    setIsModalOpen(true);
    setForm(initialForm);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setStatus({ type: '', message: '' });
  };

  return (
    <>
      <header className="login-hero">
        <h1>STr 로그인</h1>
      </header>

      <main>
        <form className="login-card" onSubmit={handleSubmit}>
          <label htmlFor="email">이메일</label>
          <input
            id="email"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            placeholder="you@example.com"
            required
          />

          <label htmlFor="password">비밀번호</label>
          <input
            id="password"
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            placeholder="••••••••"
            minLength={8}
            required
          />

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? '로그인 중…' : '로그인'}
          </button>
          {status.message && (
            <p className={`form-note ${status.type === 'error' ? 'error' : 'success'}`}>
              {status.message}
            </p>
          )}
          <p className="form-note with-link signup-only">
            <Link to="/signup" className="text-button">
              회원가입
            </Link>
          </p>
        </form>
      </main>

      {isModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card">
            <p className="modal-title">{modalContent.title}</p>
            <p className="modal-body">{modalContent.body}</p>
            <button type="button" className="modal-button" onClick={handleModalClose}>
              확인
            </button>
          </div>
        </div>
      )}
    </>
  );
}
