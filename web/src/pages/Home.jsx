import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';

const ADMIN_ROLES = ['SUPER', 'ADMIN'];
const NAV_ITEMS = [
  { id: 'desert', label: '사막폭풍 전장', restricted: false },
  { id: 'canyon', label: '협곡폭풍 전장', restricted: false },
  { id: 'member', label: '연맹원 관리', restricted: true },
];
const MEMBERS_PER_PAGE = 10;

export default function Home() {
  const navigate = useNavigate();
  const [userEmail, setUserEmail] = useState('');
  const [permission, setPermission] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('desert');

  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [memberResultModal, setMemberResultModal] = useState({ open: false, type: '', message: '' });
  const [infoModal, setInfoModal] = useState({ open: false, message: '' });

  const [memberForm, setMemberForm] = useState({ name: '', first_squad_power: '', hero_power: '' });
  const [memberStatus, setMemberStatus] = useState({ type: '', message: '' });
  const [isSubmittingMember, setIsSubmittingMember] = useState(false);

  const [members, setMembers] = useState([]);
  const [originalMembers, setOriginalMembers] = useState([]);
  const [memberPage, setMemberPage] = useState(1);
  const [totalMembers, setTotalMembers] = useState(0);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [isSavingMembers, setIsSavingMembers] = useState(false);
  const [memberError, setMemberError] = useState('');

  useEffect(() => {
    if (!supabase) {
      navigate('/');
      return;
    }

    const fetchProfile = async () => {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        navigate('/');
        return;
      }

      setUserEmail(user.email ?? '');

      const { data, error } = await supabase
        .from('user_info')
        .select('permission, approval_status')
        .eq('auth_user_id', user.id)
        .maybeSingle();

      if (error || !data || data.approval_status !== 'APPROVED') {
        navigate('/');
        return;
      }

      setPermission(data.permission ?? '');
      setLoading(false);
    };

    fetchProfile();
  }, [navigate]);

  const loadMembers = useCallback(
    async (page = 1) => {
      if (!supabase) return;
      setIsLoadingMembers(true);
      setMemberError('');

      const from = (page - 1) * MEMBERS_PER_PAGE;
      const to = from + MEMBERS_PER_PAGE - 1;

      const { data, error, count } = await supabase
        .from('member')
        .select('id, name, first_squad_power, hero_power', { count: 'exact' })
        .order('id', { ascending: true })
        .range(from, to);

      setIsLoadingMembers(false);

      if (error) {
        setMemberError(error.message ?? '연맹원 목록을 불러오지 못했습니다.');
        setMembers([]);
        setOriginalMembers([]);
        setTotalMembers(0);
        return;
      }

      const formatted = (data ?? []).map((row) => ({
        id: row.id,
        name: row.name ?? '',
        first_squad_power:
          row.first_squad_power !== null && row.first_squad_power !== undefined
            ? row.first_squad_power.toString()
            : '',
        hero_power:
          row.hero_power !== null && row.hero_power !== undefined ? row.hero_power.toString() : '',
      }));

      setMembers(formatted);
      setOriginalMembers(formatted.map((row) => ({ ...row })));
      setTotalMembers(count ?? 0);
    },
    [supabase],
  );

  useEffect(() => {
    if (activeSection === 'member' && ADMIN_ROLES.includes(permission)) {
      loadMembers(memberPage);
    }
  }, [activeSection, memberPage, permission, loadMembers]);

  const handleLogout = async () => {
    await supabase?.auth.signOut();
    navigate('/');
  };

  const handleMemberChange = (event) => {
    const { name, value } = event.target;
    setMemberForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleMemberModalClose = () => {
    setIsMemberModalOpen(false);
    setMemberForm({ name: '', first_squad_power: '', hero_power: '' });
    setMemberStatus({ type: '', message: '' });
    setMemberResultModal({ open: false, type: '', message: '' });
    setIsSubmittingMember(false);
  };

  const handleMemberSubmit = async (event) => {
    event.preventDefault();
    setMemberStatus({ type: '', message: '' });

    if (!memberForm.name.trim()) {
      setMemberStatus({ type: 'error', message: '아이디(닉네임)를 입력해주세요.' });
      return;
    }

    setIsSubmittingMember(true);
    const { error } = await supabase.from('member').insert({
      name: memberForm.name.trim(),
      first_squad_power: memberForm.first_squad_power
        ? Number(memberForm.first_squad_power)
        : null,
      hero_power: memberForm.hero_power ? Number(memberForm.hero_power) : null,
    });
    setIsSubmittingMember(false);

    if (error) {
      const message = error.message ?? '연맹원 추가에 실패했습니다.';
      setMemberStatus({ type: 'error', message });
      setMemberResultModal({ open: true, type: 'error', message });
      return;
    }

    setMemberResultModal({
      open: true,
      type: 'success',
      message: '연맹원이 성공적으로 추가되었습니다.',
    });
    await loadMembers(memberPage);
  };

  const handleMemberResultConfirm = () => {
    if (memberResultModal.type === 'success') {
      handleMemberModalClose();
    } else {
      setMemberResultModal({ open: false, type: '', message: '' });
    }
  };

  const handleNavSelect = (item) => {
    if (item.id === 'desert' || item.id === 'canyon') {
      setInfoModal({ open: true, message: '구현중...' });
      return;
    }

    const disabled = item.restricted && !ADMIN_ROLES.includes(permission);
    if (disabled) return;

    setActiveSection(item.id);
    if (item.id === 'member') {
      setMemberPage(1);
    }
  };

  const handleMemberFieldChange = (id, field, value) => {
    setMembers((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
    );
  };

  const originalMemberMap = useMemo(() => {
    const map = new Map();
    originalMembers.forEach((row) => map.set(row.id, row));
    return map;
  }, [originalMembers]);

  const hasMemberChanges = useMemo(
    () =>
      members.length > 0 &&
      members.some((row) => {
        const original = originalMemberMap.get(row.id);
        if (!original) return true;
        return (
          original.name !== row.name ||
          original.first_squad_power !== row.first_squad_power ||
          original.hero_power !== row.hero_power
        );
      }),
    [members, originalMemberMap],
  );

  const handleMemberRevert = () => {
    setMembers(originalMembers.map((row) => ({ ...row })));
  };

  const handleMemberSave = async () => {
    if (!hasMemberChanges) {
      return;
    }

    const dirtyRows = members.filter((row) => {
      const original = originalMemberMap.get(row.id);
      if (!original) return true;
      return (
        original.name !== row.name ||
        original.first_squad_power !== row.first_squad_power ||
        original.hero_power !== row.hero_power
      );
    });

    if (!dirtyRows.length) {
      return;
    }

    const updates = dirtyRows.map((row) => ({
      id: row.id,
      name: row.name.trim(),
      first_squad_power: Number(row.first_squad_power),
      hero_power: Number(row.hero_power),
    }));

    setIsSavingMembers(true);
    const { error } = await supabase.from('member').upsert(updates, { onConflict: 'id' });
    setIsSavingMembers(false);

    if (error) {
      setMemberResultModal({
        open: true,
        type: 'error',
        message: error.message ?? '연맹원 정보를 저장하지 못했습니다.',
      });
      return;
    }

    setMemberResultModal({
      open: true,
      type: 'success',
      message: '변경 사항이 저장되었습니다.',
    });
    loadMembers(memberPage);
  };

  const totalPages = Math.max(1, Math.ceil(totalMembers / MEMBERS_PER_PAGE));

  const renderContent = () => {
    if (activeSection === 'member') {
      const disabled = !ADMIN_ROLES.includes(permission);
      if (disabled) {
        return (
          <article className="home-card">
            <h2>연맹원 관리</h2>
            <p>연맹원 관리는 SUPER 또는 ADMIN 권한이 필요합니다.</p>
          </article>
        );
      }

      return (
        <article className="home-card member-card">
          <header className="member-card-header">
            <div>
              <h2>연맹원 관리</h2>
              <p>등록된 연맹원 목록을 여기에서 확인합니다.</p>
            </div>
            <div className="member-actions">
              <button
                type="button"
                className="member-action-btn secondary"
                disabled={!hasMemberChanges || isSavingMembers}
                onClick={handleMemberRevert}
              >
                되돌리기
              </button>
              <button
                type="button"
                className="member-action-btn primary"
                disabled={!hasMemberChanges || isSavingMembers}
                onClick={handleMemberSave}
              >
                {isSavingMembers ? '저장 중…' : '저장하기'}
              </button>
            </div>
          </header>

          <div className="member-table-wrapper">
            {memberError && <p className="member-error">{memberError}</p>}

            {!memberError && (
              <table className="member-table">
                <thead>
                  <tr>
                    <th>아이디</th>
                    <th>1군 투력</th>
                    <th>총 영웅 투력</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingMembers ? (
                    <tr>
                      <td colSpan="3">연맹원 정보를 불러오는 중입니다…</td>
                    </tr>
                  ) : members.length === 0 ? (
                    <tr>
                      <td colSpan="3">등록된 연맹원이 없습니다.</td>
                    </tr>
                  ) : (
                    members.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <input
                            type="text"
                            value={row.name}
                            onChange={(event) =>
                              handleMemberFieldChange(row.id, 'name', event.target.value)
                            }
                            disabled={isSavingMembers}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            step="0.01"
                            value={row.first_squad_power}
                            onChange={(event) =>
                              handleMemberFieldChange(row.id, 'first_squad_power', event.target.value)
                            }
                            disabled={isSavingMembers}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            step="1"
                            value={row.hero_power}
                            onChange={(event) =>
                              handleMemberFieldChange(row.id, 'hero_power', event.target.value)
                            }
                            disabled={isSavingMembers}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>

          <div className="member-footer">
            <div className="member-pagination">
              {Array.from({ length: totalPages }).map((_, index) => {
                const pageNumber = index + 1;
                if (totalPages <= 1) {
                  return null;
                }
                return (
                  <button
                    key={pageNumber}
                    type="button"
                    className={`page-btn${pageNumber === memberPage ? ' active' : ''}`}
                    onClick={() => setMemberPage(pageNumber)}
                    disabled={pageNumber === memberPage || isLoadingMembers}
                  >
                    {pageNumber}
                  </button>
                );
              })}
            </div>

            <button type="button" className="member-add-btn" onClick={() => setIsMemberModalOpen(true)}>
              연맹원 추가
            </button>
          </div>
        </article>
      );
    }

    const title = activeSection === 'desert' ? '사막폭풍 전장' : '협곡폭풍 전장';
    return (
      <article className="home-card">
        <h2>{title}</h2>
        <p>해당 전장의 편성 및 신청 현황을 곧 표시할 예정입니다.</p>
      </article>
    );
  };

  if (loading) {
    return (
      <div className="home-page loading">
        <p>프로필을 불러오는 중입니다…</p>
      </div>
    );
  }

  return (
    <div className="home-page">
      <aside className="home-sidebar">
        <div className="brand">STr 관리</div>
        <nav>
          {NAV_ITEMS.map((item) => {
            const disabled = item.restricted && !ADMIN_ROLES.includes(permission);
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                className={`sidebar-btn${isActive ? ' active' : ''}${disabled ? ' disabled' : ''}`}
                type="button"
                disabled={disabled}
                onClick={() => handleNavSelect(item)}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="home-main">
        <header className="home-header">
          <div>
            <p className="welcome-label">환영합니다</p>
            <h1>{permission} 권한 계정</h1>
          </div>
          <div className="user-panel">
            <span className="user-email">{userEmail}</span>
            <button type="button" className="logout-btn" onClick={handleLogout}>
              로그아웃
            </button>
          </div>
        </header>

        <section className="home-content">{renderContent()}</section>
      </main>

      <nav className="home-bottom-nav">
        {NAV_ITEMS.map((item) => {
          const disabled = item.restricted && !ADMIN_ROLES.includes(permission);
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              className={`bottom-btn${isActive ? ' active' : ''}${disabled ? ' disabled' : ''}`}
              type="button"
              disabled={disabled}
              onClick={() => handleNavSelect(item)}
            >
              {item.label}
            </button>
          );
        })}
      </nav>

      {isMemberModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <form className="modal-card form-modal" onSubmit={handleMemberSubmit}>
            <div className="modal-header">
              <p className="modal-title">연맹원 추가</p>
              <button type="button" className="modal-close" onClick={handleMemberModalClose}>
                ×
              </button>
            </div>
            <label htmlFor="member-name">아이디</label>
            <input
              id="member-name"
              name="name"
              type="text"
              placeholder="닉네임 또는 아이디"
              value={memberForm.name}
              onChange={handleMemberChange}
              required
            />
            <label htmlFor="member-first-power">1군 투력</label>
            <input
              id="member-first-power"
              name="first_squad_power"
              type="number"
              step="0.01"
              placeholder="예: 123.45"
              value={memberForm.first_squad_power}
              onChange={handleMemberChange}
            />
            <label htmlFor="member-hero-power">총 영웅 투력</label>
            <input
              id="member-hero-power"
              name="hero_power"
              type="number"
              step="1"
              placeholder="예: 123456"
              value={memberForm.hero_power}
              onChange={handleMemberChange}
            />
            <div className="modal-actions">
              <button type="button" className="modal-button secondary" onClick={handleMemberModalClose}>
                취소하기
              </button>
              <button type="submit" className="modal-button" disabled={isSubmittingMember}>
                {isSubmittingMember ? '추가 중…' : '추가하기'}
              </button>
            </div>
          </form>
        </div>
      )}

      {memberResultModal.open && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card">
            <p className="modal-title">
              {memberResultModal.type === 'success' ? '처리 완료' : '처리 실패'}
            </p>
            <p className="modal-body">{memberResultModal.message}</p>
            <button type="button" className="modal-button" onClick={handleMemberResultConfirm}>
              확인
            </button>
          </div>
        </div>
      )}

      {infoModal.open && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card">
            <p className="modal-title">알림</p>
            <p className="modal-body">{infoModal.message}</p>
            <button
              type="button"
              className="modal-button"
              onClick={() => setInfoModal({ open: false, message: '' })}
            >
              확인
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
