import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { HiPencil, HiTrash } from 'react-icons/hi';
import { supabase } from '../lib/supabaseClient.js';

const ADMIN_ROLES = ['SUPER', 'ADMIN'];
const MEMBERS_PER_PAGE = 10;
const LOCK_MINUTES = 5;

export default function Members() {
  const navigate = useNavigate();
  const { userId, permission } = useOutletContext();
  const [now, setNow] = useState(Date.now());
  const activeLockRef = useRef(null);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [memberModalMode, setMemberModalMode] = useState('create'); // 'create' | 'edit'
  const [editingMember, setEditingMember] = useState(null);
  const [memberResultModal, setMemberResultModal] = useState({ open: false, type: '', message: '' });
  const [infoModal, setInfoModal] = useState({ open: false, message: '' });

  const [memberForm, setMemberForm] = useState({ name: '', first_squad_power: '', hero_power: '' });
  const [memberStatus, setMemberStatus] = useState({ type: '', message: '' });
  const [isSubmittingMember, setIsSubmittingMember] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeletingMember, setIsDeletingMember] = useState(false);

  const [members, setMembers] = useState([]);
  const [memberPage, setMemberPage] = useState(1);
  const [totalMembers, setTotalMembers] = useState(0);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [memberError, setMemberError] = useState('');

  const formatMember = useCallback((row) => {
    if (!row) return null;
    return {
      id: row.id,
      name: row.name ?? '',
      first_squad_power:
        row.first_squad_power !== null && row.first_squad_power !== undefined
          ? row.first_squad_power.toString()
          : '',
      hero_power:
        row.hero_power !== null && row.hero_power !== undefined ? row.hero_power.toString() : '',
      updated_at: row.updated_at,
      locked_by: row.locked_by,
      locked_until: row.locked_until,
    };
  }, []);

  const clearMemberLockState = useCallback((memberId) => {
    if (!memberId) return;
    setMembers((prev) =>
      prev.map((row) =>
        row.id === memberId ? { ...row, locked_by: null, locked_until: null } : row,
      ),
    );
  }, []);

  const loadMembers = useCallback(
    async (page = 1) => {
      if (!supabase) return;
      setIsLoadingMembers(true);
      setMemberError('');

      const from = (page - 1) * MEMBERS_PER_PAGE;
      const to = from + MEMBERS_PER_PAGE - 1;

      const { data, error, count } = await supabase
        .from('member')
        .select('id, name, first_squad_power, hero_power, updated_at, locked_by, locked_until', {
          count: 'exact',
        })
        .order('id', { ascending: true })
        .range(from, to);

      setIsLoadingMembers(false);

      if (error) {
        setMemberError(error.message ?? '연맹원 목록을 불러오지 못했습니다.');
        setMembers([]);
        setTotalMembers(0);
        return;
      }

      const formatted = (data ?? []).map((row) => formatMember(row));

      setMembers(formatted);
      setTotalMembers(count ?? 0);
    },
    [formatMember],
  );

  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel('member-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'member' },
        (payload) => {
          const type = payload.eventType;
          if (type === 'UPDATE') {
            const formatted = formatMember(payload.new);
            setMembers((prev) =>
              prev.map((row) => (row.id === payload.new.id ? formatted ?? row : row)),
            );
          } else if (type === 'DELETE') {
            setMembers((prev) => prev.filter((row) => row.id !== payload.old.id));
          }
          if (type === 'INSERT' || type === 'DELETE') {
            loadMembers(memberPage);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadMembers, memberPage, formatMember]);

  useEffect(() => {
    loadMembers(memberPage);
  }, [loadMembers, memberPage]);

  useEffect(() => {
    const nowTs = Date.now();
    const futureExpirations = members
      .map((row) => (row.locked_until ? new Date(row.locked_until).getTime() : null))
      .filter((ts) => ts && ts > nowTs);

    if (futureExpirations.length === 0) return undefined;

    const soonest = Math.min(...futureExpirations);
    const delta = soonest - nowTs + 500;
    const nextTickMs = Math.min(30000, Math.max(2000, delta));

    const timer = setTimeout(() => setNow(Date.now()), nextTickMs);
    return () => clearTimeout(timer);
  }, [members]);

  const acquireMemberLock = async (memberId) => {
    if (!supabase) return null;
    if (!userId) {
      setInfoModal({
        open: true,
        message: '사용자 정보를 불러오는 중입니다. 잠시 후 다시 시도하세요.',
      });
      return null;
    }

    const nowIso = new Date().toISOString();
    const lockUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('member')
      .update({ locked_by: userId, locked_until: lockUntil })
      .eq('id', memberId)
      .or(`locked_by.is.null,locked_until.lte.${nowIso},locked_by.eq.${userId}`)
      .select('id, locked_by, locked_until, updated_at')
      .maybeSingle();

    if (error || !data) {
      setInfoModal({
        open: true,
        message: '잠금을 설정하지 못했습니다. 잠금이 해제된 후 다시 시도하세요.',
      });
      return null;
    }

    activeLockRef.current = memberId;
    return data;
  };

  const releaseMemberLock = async (memberId) => {
    if (!memberId || !supabase) return;
    activeLockRef.current = null;
    await supabase
      .from('member')
      .update({ locked_by: null, locked_until: null })
      .eq('id', memberId)
      .eq('locked_by', userId);
    clearMemberLockState(memberId);
  };

  useEffect(() => {
    return () => {
      if (activeLockRef.current) {
        releaseMemberLock(activeLockRef.current);
      }
    };
  }, [releaseMemberLock]);

  const handleMemberChange = (event) => {
    const { name, value } = event.target;
    setMemberForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleMemberModalClose = () => {
    setIsMemberModalOpen(false);
    setMemberModalMode('create');
    if (editingMember?.id) {
      releaseMemberLock(editingMember.id);
      clearMemberLockState(editingMember.id);
    }
    setEditingMember(null);
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

  const isRowLocked = (row) => {
    if (!row.locked_by || !row.locked_until) return false;
    const expires = new Date(row.locked_until).getTime();
    if (Number.isNaN(expires) || expires <= now) return false;
    return row.locked_by !== userId;
  };

  const openCreateMemberModal = () => {
    setMemberModalMode('create');
    setEditingMember(null);
    setMemberForm({ name: '', first_squad_power: '', hero_power: '' });
    setMemberStatus({ type: '', message: '' });
    setIsMemberModalOpen(true);
  };

  const openEditMemberModal = (row) => {
    setMemberModalMode('edit');
    setEditingMember({ id: row.id, updated_at: row.updated_at });
    setMemberForm({
      name: row.name ?? '',
      first_squad_power: row.first_squad_power ?? '',
      hero_power: row.hero_power ?? '',
    });
    setMemberStatus({ type: '', message: '' });
    setIsMemberModalOpen(true);
  };

  const handleGuardedEdit = (row) => {
    if (isRowLocked(row)) {
      setInfoModal({
        open: true,
        message: '다른 사용자가 편집 중입니다. 잠금이 해제되면 다시 시도해주세요.',
      });
      return;
    }

    acquireMemberLock(row.id).then((lockedRow) => {
      if (!lockedRow) return;
      openEditMemberModal({
        ...row,
        locked_until: lockedRow.locked_until,
        updated_at: lockedRow.updated_at,
      });
      setMembers((prev) =>
        prev.map((item) =>
          item.id === row.id
            ? { ...item, locked_by: userId, locked_until: lockedRow.locked_until }
            : item,
        ),
      );
    });
  };

  const handleGuardedDelete = (row) => {
    if (isRowLocked(row)) {
      setInfoModal({
        open: true,
        message: '다른 사용자가 편집 중입니다. 잠금이 해제되면 다시 시도해주세요.',
      });
      return;
    }
    setDeleteTarget(row);
  };

  const handleMemberUpdate = async (event) => {
    event.preventDefault();
    if (!editingMember) return;

    if (!memberForm.name.trim()) {
      setMemberStatus({ type: 'error', message: '아이디(닉네임)를 입력해주세요.' });
      return;
    }

    setIsSubmittingMember(true);
    const { data, error } = await supabase
      .from('member')
      .update({
        name: memberForm.name.trim(),
        first_squad_power: memberForm.first_squad_power
          ? Number(memberForm.first_squad_power)
          : null,
        hero_power: memberForm.hero_power ? Number(memberForm.hero_power) : null,
      })
      .eq('id', editingMember.id)
      .eq('locked_by', userId)
      .eq('updated_at', editingMember.updated_at ?? null)
      .select()
      .maybeSingle();

    setIsSubmittingMember(false);

    if (error || !data) {
      const message =
        error?.message ??
        '다른 사용자가 먼저 수정했을 수 있습니다. 새로고침 후 다시 시도해주세요.';
      setMemberStatus({ type: 'error', message });
      setMemberResultModal({ open: true, type: 'error', message });
      return;
    }

    await releaseMemberLock(editingMember.id);
    clearMemberLockState(editingMember.id);

    setMemberResultModal({
      open: true,
      type: 'success',
      message: '연맹원 정보가 수정되었습니다.',
    });
    await loadMembers(memberPage);
  };

  const confirmDeleteMember = async () => {
    if (!deleteTarget) return;
    setIsDeletingMember(true);
    const { error } = await supabase.from('member').delete().eq('id', deleteTarget.id);
    setIsDeletingMember(false);

    if (error) {
      setMemberResultModal({
        open: true,
        type: 'error',
        message: error.message ?? '연맹원을 삭제하지 못했습니다.',
      });
      return;
    }

    clearMemberLockState(deleteTarget.id);

    setMemberResultModal({
      open: true,
      type: 'success',
      message: '연맹원이 삭제되었습니다.',
    });
    setDeleteTarget(null);
    loadMembers(memberPage);
  };

  const totalPages = Math.max(1, Math.ceil(totalMembers / MEMBERS_PER_PAGE));
  const isAdmin = ADMIN_ROLES.includes(permission);

  if (!isAdmin) {
    return (
      <article className="home-card">
        <h2>연맹원 관리</h2>
        <p>연맹원 관리는 SUPER 또는 ADMIN 권한이 필요합니다.</p>
      </article>
    );
  }

  return (
    <>
      <article className="home-card member-card">
        <header className="member-card-header">
          <div>
            <h2>연맹원 관리</h2>
            <p>등록된 연맹원 목록을 여기에서 확인합니다.</p>
          </div>
          <div className="member-actions">
            <button
              type="button"
              className="member-action-btn tertiary"
              onClick={openCreateMemberModal}
            >
              연맹원 추가
            </button>
          </div>
        </header>

        <div className="member-table-wrapper">
          {memberError && <p className="member-error">{memberError}</p>}

          {!memberError &&
            (window.innerWidth <= 768 ? (
              <div className="member-mobile-list">
                {isLoadingMembers ? (
                  <p className="member-mobile-empty">연맹원 정보를 불러오는 중입니다…</p>
                ) : members.length === 0 ? (
                  <p className="member-mobile-empty">등록된 연맹원이 없습니다.</p>
                ) : (
                  members.map((row) => (
                    <div className="member-mobile-card" key={row.id}>
                      {isRowLocked(row) ? <p className="member-lock-badge">다른 사용자가 편집 중</p> : null}
                      <div className="member-field">
                        <p className="member-field-label">아이디</p>
                        <p className="member-field-value">{row.name || '-'}</p>
                      </div>
                      <div className="member-field">
                        <p className="member-field-label">1군 투력</p>
                        <p className="member-field-value">{row.first_squad_power || '-'}</p>
                      </div>
                      <div className="member-field">
                        <p className="member-field-label">총 영웅 투력</p>
                        <p className="member-field-value">{row.hero_power || '-'}</p>
                      </div>
                      <div className="member-row-actions">
                        {(() => {
                          const locked = isRowLocked(row);
                          return (
                            <>
                              <button
                                type="button"
                                className={`member-icon-btn edit${locked ? ' disabled' : ''}`}
                                onClick={() => !locked && handleGuardedEdit(row)}
                                disabled={locked}
                                title={locked ? '다른 사용자가 편집 중' : '수정'}
                              >
                                <HiPencil aria-label="수정" />
                              </button>
                              <button
                                type="button"
                                className={`member-icon-btn delete${locked ? ' disabled' : ''}`}
                                onClick={() => !locked && handleGuardedDelete(row)}
                                disabled={locked}
                                title={locked ? '잠금 해제 후 삭제 가능' : '삭제'}
                              >
                                <HiTrash aria-label="삭제" />
                              </button>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <table className="member-table">
                <thead>
                  <tr>
                    <th>아이디</th>
                    <th>1군 투력</th>
                    <th>총 영웅 투력</th>
                    <th>작업</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingMembers ? (
                    <tr>
                      <td colSpan="4">연맹원 정보를 불러오는 중입니다…</td>
                    </tr>
                  ) : members.length === 0 ? (
                    <tr>
                      <td colSpan="4">등록된 연맹원이 없습니다.</td>
                    </tr>
                  ) : (
                    members.map((row) => (
                      <tr key={row.id}>
                        <td>
                          {row.name || '-'}
                          {isRowLocked(row) ? <span className="member-lock-pill">편집 중</span> : null}
                        </td>
                        <td>{row.first_squad_power || '-'}</td>
                        <td>{row.hero_power || '-'}</td>
                        <td className="member-actions-cell">
                          {(() => {
                            const locked = isRowLocked(row);
                            return (
                              <>
                                <button
                                  type="button"
                                  className={`member-icon-btn edit${locked ? ' disabled' : ''}`}
                                  onClick={() => !locked && handleGuardedEdit(row)}
                                  aria-label="수정"
                                  disabled={locked}
                                  title={locked ? '다른 사용자가 편집 중' : '수정'}
                                >
                                  <HiPencil />
                                </button>
                                <button
                                  type="button"
                                  className={`member-icon-btn delete${locked ? ' disabled' : ''}`}
                                  onClick={() => !locked && handleGuardedDelete(row)}
                                  aria-label="삭제"
                                  disabled={locked}
                                  title={locked ? '잠금 해제 후 삭제 가능' : '삭제'}
                                >
                                  <HiTrash />
                                </button>
                              </>
                            );
                          })()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ))}
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
        </div>
      </article>

      {isMemberModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <form
            className="modal-card form-modal"
            onSubmit={memberModalMode === 'edit' ? handleMemberUpdate : handleMemberSubmit}
          >
            <div className="modal-header">
              <p className="modal-title">
                {memberModalMode === 'edit' ? '연맹원 수정' : '연맹원 추가'}
              </p>
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
            {memberStatus.message && (
              <p
                className={`member-form-status${
                  memberStatus.type === 'error' ? ' error' : ' success'
                }`}
              >
                {memberStatus.message}
              </p>
            )}
            <div className="modal-actions">
              <button type="button" className="modal-button secondary" onClick={handleMemberModalClose}>
                취소하기
              </button>
              <button type="submit" className="modal-button" disabled={isSubmittingMember}>
                {isSubmittingMember
                  ? memberModalMode === 'edit'
                    ? '수정 중…'
                    : '추가 중…'
                  : memberModalMode === 'edit'
                    ? '수정하기'
                    : '추가하기'}
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

      {deleteTarget && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card">
            <p className="modal-title">연맹원 삭제</p>
            <p className="modal-body">
              <strong>{deleteTarget.name}</strong>을(를) 삭제할까요? 이 작업은 되돌릴 수 없습니다.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="modal-button secondary"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeletingMember}
              >
                취소
              </button>
              <button
                type="button"
                className="modal-button danger"
                onClick={confirmDeleteMember}
                disabled={isDeletingMember}
              >
                {isDeletingMember ? '삭제 중…' : '삭제하기'}
              </button>
            </div>
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
    </>
  );
}
