import { useCallback, useEffect, useMemo, useState } from 'react';
import DatePicker, { registerLocale } from 'react-datepicker';
import { ko } from 'date-fns/locale';
import { useOutletContext } from 'react-router-dom';
import { HiTrash } from 'react-icons/hi';
import { supabase } from '../lib/supabaseClient.js';
import 'react-datepicker/dist/react-datepicker.css';

registerLocale('ko', ko);

const ADMIN_ROLES = ['SUPER', 'ADMIN'];
const STATUS_LABELS = { PENDING: '미확정', CONFIRMED: '확정' };

const formatDate = (date) => {
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toDatePart = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value.split('T')[0];
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return formatDate(parsed);
};

const formatDisplayDate = (scheduledAt, squad) => {
  const datePart = toDatePart(scheduledAt);
  if (!datePart) return '-';
  const timeLabel = squad === 'A' ? '오후 8시' : '오전 10시';
  return `${datePart} ${timeLabel}`;
};

const isDateAllowedForSquad = (squad, date) => {
  if (!date) return true;
  const day = date.getDay(); // 0=Sun ... 6=Sat
  if (squad === 'A') return day === 5; // Friday
  if (squad === 'B') return day === 6; // Saturday
  return true;
};

export default function Desert() {
  const { userId, permission } = useOutletContext();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({ squad: 'A', date: null });
  const [formStatus, setFormStatus] = useState({ type: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resultModal, setResultModal] = useState({ open: false, type: '', message: '' });
  const [events, setEvents] = useState([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [eventsError, setEventsError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isSavingDetail, setIsSavingDetail] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [memberOptions, setMemberOptions] = useState([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState({});
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [memberLoadError, setMemberLoadError] = useState('');
  const [removeSelectionConfirm, setRemoveSelectionConfirm] = useState({ open: false, member: null });
  const [removeParticipantConfirm, setRemoveParticipantConfirm] = useState(null);
  const [editingParticipantId, setEditingParticipantId] = useState(null);
  const [editingPower, setEditingPower] = useState('');
  const [participantStatus, setParticipantStatus] = useState({ type: '', message: '' });
  const [memberSort, setMemberSort] = useState('asc');
  const [isLoadingParticipants, setIsLoadingParticipants] = useState(false);
  const [participantMenuOpen, setParticipantMenuOpen] = useState(null);
  const [deletedNotice, setDeletedNotice] = useState(false);

  const isAdmin = useMemo(() => ADMIN_ROLES.includes(permission), [permission]);

  const loadEvents = useCallback(async () => {
    if (!supabase) return;
    setIsLoadingEvents(true);
    setEventsError('');
    const { data, error } = await supabase
      .from('battle_event')
      .select('id, scheduled_at, squad, status, applicant_count')
      .eq('battle_type', 'DESERT')
      .order('scheduled_at', { ascending: false })
      .order('id', { ascending: false });
    setIsLoadingEvents(false);
    if (error) {
      setEventsError(error.message ?? '사막 편성을 불러오지 못했습니다.');
      setEvents([]);
      return;
    }
    setEvents(data ?? []);
  }, []);

  const refreshEvent = useCallback(
    async (eventId) => {
      if (!supabase || !eventId) return;
      const { data } = await supabase
        .from('battle_event')
        .select('id, scheduled_at, squad, status, applicant_count')
        .eq('id', eventId)
        .maybeSingle();
      if (data) {
        setEvents((prev) => prev.map((row) => (row.id === data.id ? { ...row, ...data } : row)));
      }
    },
    [],
  );

  const loadParticipants = useCallback(
    async (eventId) => {
      if (!eventId || !supabase) return;
      setIsLoadingParticipants(true);
      setParticipantStatus({ type: '', message: '' });
      const { data, error } = await supabase
        .from('battle_entry')
        .select('id, status, updated_at, member:member_id (id, name, hero_power, first_squad_power)')
        .eq('event_id', eventId)
        .order('id', { ascending: true });
      setIsLoadingParticipants(false);
      if (error) {
        setParticipantStatus({
          type: 'error',
          message: error.message ?? '참가자 목록을 불러오지 못했습니다.',
        });
        setParticipants([]);
        return;
      }
      const mapped =
        data?.map((row) => ({
          entryId: row.id,
          memberId: row.member?.id ?? null,
          name: row.member?.name ?? '',
          power:
            row.member?.hero_power?.toString() ??
            row.member?.first_squad_power?.toString() ??
            '',
          status: row.status ?? 'PENDING',
          updatedAt: row.updated_at,
        })) ?? [];
      setParticipants(mapped);
    },
    [],
  );

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel('battle-event-live')
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'battle_event' },
        (payload) => {
          const deletedId = payload.old?.id;
          if (!deletedId) return;
          setEvents((prev) => prev.filter((row) => row.id !== deletedId));
          if (selectedEvent?.id === deletedId) {
            setSelectedEvent(null);
            setDeletedNotice(true);
            setIsMemberModalOpen(false);
            setSelectedMemberIds({});
            setParticipants([]);
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'battle_event' },
        (payload) => {
          if (!payload.new || payload.new.battle_type !== 'DESERT') return;
          setEvents((prev) => [{ ...payload.new }, ...prev]);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedEvent]);

  useEffect(() => {
    if (!supabase || !selectedEvent?.id) return;
    const channel = supabase
      .channel(`battle-entry-${selectedEvent.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'battle_entry', filter: `event_id=eq.${selectedEvent.id}` },
        () => {
          loadParticipants(selectedEvent.id);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedEvent?.id, loadParticipants]);

  useEffect(() => {
    if (selectedEvent?.id) {
      loadParticipants(selectedEvent.id);
    } else {
      setParticipants([]);
    }
  }, [selectedEvent?.id, loadParticipants]);

  const closeModal = () => {
    setIsModalOpen(false);
    setForm({ squad: 'A', date: null });
    setFormStatus({ type: '', message: '' });
    setIsSubmitting(false);
  };

  const handleCreate = async () => {
    setFormStatus({ type: '', message: '' });

    if (!isAdmin) {
      setFormStatus({ type: 'error', message: '운영진만 편성을 생성할 수 있습니다.' });
      return;
    }

    if (!supabase) {
      setFormStatus({
        type: 'error',
        message: 'Supabase 설정을 확인할 수 없습니다. 환경 변수를 먼저 설정해주세요.',
      });
      return;
    }

    if (!userId) {
      setFormStatus({
        type: 'error',
        message: '사용자 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.',
      });
      return;
    }

    if (!form.date) {
      setFormStatus({ type: 'error', message: '일자를 선택해주세요.' });
      return;
    }

    if (!isDateAllowedForSquad(form.squad, form.date)) {
      setFormStatus({ type: 'error', message: '해당 조가 선택할 수 없는 요일입니다.' });
      return;
    }

    const battleDate = formatDate(form.date);
    setIsSubmitting(true);
    const { data, error } = await supabase
      .from('battle_event')
      .insert({
        battle_type: 'DESERT',
        squad: form.squad,
        scheduled_at: battleDate,
      })
      .select('id, scheduled_at, squad, status, applicant_count')
      .maybeSingle();
    setIsSubmitting(false);

    if (error || !data) {
      const duplicate =
        error?.code === '23505' ||
        (error?.message && error.message.toLowerCase().includes('duplicate key'));
      const message = duplicate
        ? '이미 선택한 날짜와 조로 생성된 사막 편성이 있습니다.'
        : error?.message ?? '편성 생성에 실패했습니다. 잠시 후 다시 시도해주세요.';
      setFormStatus({ type: 'error', message });
      return;
    }

    closeModal();
    setResultModal({
      open: true,
      type: 'success',
      message: `${formatDisplayDate(battleDate, data.squad)} ${data.squad}조 사막 편성이 생성되었습니다.`,
    });
    loadEvents();
  };

  const handleDelete = (event) => {
    setParticipantMenuOpen(null);
    setDeleteTarget(event);
  };

  const confirmDelete = async () => {
    if (!deleteTarget || !supabase) return;
    setIsDeleting(true);
    const { error } = await supabase.from('battle_event').delete().eq('id', deleteTarget.id);
    setIsDeleting(false);
    setParticipantMenuOpen(null);
    if (error) {
      setResultModal({
        open: true,
        type: 'error',
        message: error.message ?? '편성을 삭제하지 못했습니다.',
      });
      return;
    }
    setDeleteTarget(null);
    setResultModal({
      open: true,
      type: 'success',
      message: '편성이 삭제되었습니다.',
    });
    loadEvents();
    if (selectedEvent?.id === deleteTarget.id) {
      setSelectedEvent(null);
    }
  };

  const cancelDelete = () => {
    setDeleteTarget(null);
  };

  const handleDetailSave = () => {
    setIsSavingDetail(true);
    setTimeout(() => {
      setIsSavingDetail(false);
      setResultModal({
        open: true,
        type: 'success',
        message: '편성 정보를 저장했습니다. (추가 필드는 추후 연동 예정)',
      });
      if (selectedEvent?.id) {
        refreshEvent(selectedEvent.id);
      }
    }, 250);
  };

  const loadMembers = async () => {
    if (!supabase) return;
    setIsLoadingMembers(true);
    setMemberLoadError('');
    const { data, error } = await supabase
      .from('member')
      .select('id, name, first_squad_power, hero_power')
      .order('name', { ascending: true });
    setIsLoadingMembers(false);
    if (error) {
      setMemberLoadError(error.message ?? '연맹원 목록을 불러오지 못했습니다.');
      setMemberOptions([]);
      return;
    }
    setMemberOptions(data ?? []);
  };

  const openMemberModal = () => {
    setIsMemberModalOpen(true);
    setMemberSearch('');
    setSelectedMemberIds({});
    loadMembers();
  };

  const closeMemberModal = () => {
    setIsMemberModalOpen(false);
    setMemberSearch('');
    setRemoveSelectionConfirm({ open: false, member: null });
  };

  const filteredMembers = memberOptions
    .filter((member) => !participants.some((p) => p.memberId === member.id))
    .filter((member) => {
      if (!memberSearch.trim()) return true;
      return member.name?.toLowerCase().includes(memberSearch.trim().toLowerCase());
    });

  const sortedMembers = [...filteredMembers].sort((a, b) => {
    const aName = a.name?.toLowerCase() ?? '';
    const bName = b.name?.toLowerCase() ?? '';
    if (aName === bName) return 0;
    return memberSort === 'asc' ? aName.localeCompare(bName) : bName.localeCompare(aName);
  });

  const handleToggleMember = (member) => {
    const isSelected = !!selectedMemberIds[member.id];
    setSelectedMemberIds((prev) => ({ ...prev, [member.id]: !isSelected }));
  };

  const applySelection = async () => {
    const selectedIds = Object.entries(selectedMemberIds)
      .filter(([, checked]) => checked)
      .map(([id]) => Number(id));

    if (!selectedEvent || selectedIds.length === 0) {
      closeMemberModal();
      return;
    }

    const payload = selectedIds.map((id) => ({
      event_id: selectedEvent.id,
      member_id: id,
      status: 'PENDING',
    }));

    const { error } = await supabase?.from('battle_entry').insert(payload);
    if (error) {
      const isDuplicate =
        error.code === '23505' ||
        (error.message && error.message.toLowerCase().includes('duplicate key'));
      if (isDuplicate) {
        setParticipantStatus({
          type: 'success',
          message: '이미 등록된 참가자는 건너뛰고 추가했습니다.',
        });
        await loadParticipants(selectedEvent.id);
      } else {
        setParticipantStatus({
          type: 'error',
          message: error.message ?? '참가자를 추가하지 못했습니다.',
        });
        return;
      }
    } else {
      setParticipantStatus({ type: 'success', message: '참가자가 추가되었습니다.' });
      await loadParticipants(selectedEvent.id);
    }
    closeMemberModal();
  };

  const confirmUnselectProceed = () => {
    const targetId = removeSelectionConfirm.member?.id;
    if (!targetId) {
      setRemoveSelectionConfirm({ open: false, member: null });
      return;
    }
    setSelectedMemberIds((prev) => {
      const next = { ...prev };
      delete next[targetId];
      return next;
    });
    setParticipants((prev) => prev.filter((p) => p.memberId !== targetId));
    setRemoveSelectionConfirm({ open: false, member: null });
  };

  const cancelUnselect = () => {
    setRemoveSelectionConfirm({ open: false, member: null });
  };

  const startEditParticipant = (participant) => {
    setParticipantMenuOpen(null);
    setEditingParticipantId(participant.memberId ?? participant.id);
    setEditingPower(participant.power ?? '');
    setParticipantStatus({ type: '', message: '' });
  };

  const cancelEditParticipant = () => {
    setEditingParticipantId(null);
    setEditingPower('');
  };

  const saveParticipantPower = async (participant) => {
    if (!editingParticipantId) return;
    const nextPower = editingPower.trim();
    if (!nextPower) {
      setParticipantStatus({ type: 'error', message: '투력을 입력해주세요.' });
      return;
    }

    if (participant.memberId && supabase) {
      const { error } = await supabase
        .from('member')
        .update({ first_squad_power: Number(nextPower) })
        .eq('id', participant.memberId);
      if (error) {
        setParticipantStatus({
          type: 'error',
          message: error.message ?? '투력을 저장하지 못했습니다.',
        });
        return;
      }
    }

    setParticipants((prev) =>
      prev.map((p) =>
        (p.memberId ?? p.id) === (participant.memberId ?? participant.id)
          ? { ...p, power: nextPower }
          : p,
      ),
    );
    setParticipantStatus({ type: 'success', message: '투력이 저장되었습니다.' });
    setEditingParticipantId(null);
    setEditingPower('');
  };

  const requestRemoveParticipant = (participant) => {
    setParticipantMenuOpen(null);
    setRemoveParticipantConfirm(participant);
  };

  const confirmRemoveParticipant = async () => {
    if (!removeParticipantConfirm) return;
    const targetId = removeParticipantConfirm.memberId ?? removeParticipantConfirm.id;
    if (removeParticipantConfirm.entryId && supabase) {
      const { error } = await supabase
        .from('battle_entry')
        .delete()
        .eq('id', removeParticipantConfirm.entryId)
        .eq('updated_at', removeParticipantConfirm.updatedAt ?? null);
      if (error) {
        setParticipantStatus({
          type: 'error',
          message: error.message ?? '참가자를 삭제하지 못했습니다.',
        });
        setRemoveParticipantConfirm(null);
        return;
      }
    }
    setParticipants((prev) =>
      prev.filter((p) => (p.memberId ?? p.id) !== targetId),
    );
    setSelectedMemberIds((prev) => {
      const next = { ...prev };
      if (targetId in next) delete next[targetId];
      return next;
    });
    if (selectedEvent?.id) {
      loadParticipants(selectedEvent.id);
    }
    setRemoveParticipantConfirm(null);
  };

  const cancelRemoveParticipant = () => {
    setRemoveParticipantConfirm(null);
  };

  const handleBackToList = () => {
    if (selectedEvent?.id) {
      refreshEvent(selectedEvent.id).finally(() => setSelectedEvent(null));
    } else {
      setSelectedEvent(null);
    }
  };

  const renderSquadButtons = () => {
    const options = [
      { value: 'A', label: 'A조 (금요일 20시 KST)' },
      { value: 'B', label: 'B조 (토요일 10시 KST)' },
    ];
    return (
      <div className="squad-toggle">
        {options.map((option) => {
          const isActive = form.squad === option.value;
          return (
            <button
              key={option.value}
              type="button"
              className={`squad-btn${isActive ? ' active' : ''}`}
              onClick={() =>
                setForm((prev) => {
                  const next = { ...prev, squad: option.value };
                  if (next.date && !isDateAllowedForSquad(option.value, next.date)) {
                    next.date = null;
                  }
                  return next;
                })
              }
            >
              {option.label}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <article className="home-card">
      {!selectedEvent && (
        <>
          <header className="desert-header">
            <h2>사막폭풍 전장</h2>
            <div className="desert-actions">
              <button type="button" className="member-action-btn primary" onClick={() => setIsModalOpen(true)}>
                사막 편성 추가
              </button>
            </div>
          </header>
          {!isAdmin && (
            <p className="member-error">운영진 권한이 있어야 새 사막 편성을 생성할 수 있습니다.</p>
          )}
        </>
      )}
      {(() => {
        if (eventsError) {
          return (
            <section className="desert-list">
              <h3>생성된 편성</h3>
              <p className="member-error">{eventsError}</p>
            </section>
          );
        }

        if (isLoadingEvents) {
          return (
            <section className="desert-list">
              <p className="desert-empty">불러오는 중입니다…</p>
            </section>
          );
        }

        if (events.length === 0) {
          return (
            <section className="desert-list">
              <p className="desert-empty">등록된 사막 편성이 없습니다.</p>
            </section>
          );
        }

        if (selectedEvent) {
          return (
            <section className="desert-list detail-mode">
              <div className="desert-detail">
                <div className="desert-detail-header">
                  <div className="desert-detail-top">
                    <button
                      type="button"
                      className="back-button"
                      onClick={handleBackToList}
                    >
                      ←
                    </button>
                    <div className="desert-detail-actions-inline">
                      <button
                        type="button"
                        className="member-action-btn danger"
                        onClick={() => handleDelete(selectedEvent)}
                      >
                        삭제하기
                      </button>
                      <button
                        type="button"
                        className="member-action-btn primary"
                        onClick={handleDetailSave}
                        disabled={isSavingDetail}
                      >
                        {isSavingDetail ? '확정 중…' : '확정하기'}
                      </button>
                    </div>
                  </div>
                  <div className="desert-detail-headline">
                    <span className="desert-event-chip primary">{selectedEvent.squad}조</span>
                    <div className="desert-detail-datestatus">
                      <span className="desert-detail-title">
                        {formatDisplayDate(selectedEvent.scheduled_at, selectedEvent.squad)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="desert-participants">
                  <div className="desert-participants-header">
                    <div className="participant-header-left">
                      <h4>참가자 관리</h4>
                      {participantStatus.message && (
                        <span
                          className={`form-note inline ${
                            participantStatus.type === 'error' ? 'error' : 'success'
                          }`}
                        >
                          {participantStatus.message}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      className="member-action-btn danger"
                      onClick={openMemberModal}
                    >
                      + 참가자 추가
                    </button>
                  </div>
                  {isLoadingParticipants ? (
                    <p className="desert-empty">참가자를 불러오는 중입니다…</p>
                  ) : participants.length === 0 ? (
                    <p className="desert-empty">추가된 참가자가 없습니다.</p>
                  ) : (
                    <div className="participant-grid">
                      {participants.map((p) => {
                        const isEditing = editingParticipantId === (p.memberId ?? p.id);
                        return (
                          <div key={p.memberId ?? p.id} className="participant-card">
                            <div className="participant-card-main">
                              <p className="participant-name">{p.name || '이름 없음'}</p>
                              <div className="participant-power">
                                <label htmlFor={`power-${p.memberId ?? p.id}`}>투력</label>
                                {isEditing ? (
                                  <input
                                    id={`power-${p.memberId ?? p.id}`}
                                    type="number"
                                    className="modal-input compact"
                                    value={editingPower}
                                    onChange={(e) => setEditingPower(e.target.value)}
                                    step="0.01"
                                  />
                                ) : (
                                  <span>{p.power ? `${p.power}m` : '-'}</span>
                                )}
                              </div>
                            </div>
                            <div className="participant-actions">
                              {isEditing ? (
                                <>
                                  <button
                                    type="button"
                                    className="member-action-btn tertiary"
                                    onClick={cancelEditParticipant}
                                  >
                                    취소
                                  </button>
                                  <button
                                    type="button"
                                    className="member-action-btn primary"
                                    onClick={() => saveParticipantPower(p)}
                                  >
                                    저장
                                  </button>
                                </>
                              ) : (
                                <div className="participant-more">
                                  <button
                                    type="button"
                                    className="more-btn"
                                    aria-label="작업 메뉴 열기"
                                    aria-expanded={participantMenuOpen === (p.memberId ?? p.id)}
                                    onClick={() =>
                                      setParticipantMenuOpen((prev) =>
                                        prev === (p.memberId ?? p.id) ? null : p.memberId ?? p.id,
                                      )
                                    }
                                  >
                                    ⋮
                                  </button>
                                  {participantMenuOpen === (p.memberId ?? p.id) && (
                                    <div className="action-menu">
                                      <button
                                        type="button"
                                        className="action-menu-item"
                                        onClick={() => {
                                          setParticipantMenuOpen(null);
                                          startEditParticipant(p);
                                        }}
                                      >
                                        수정
                                      </button>
                                      <button
                                        type="button"
                                        className="action-menu-item danger"
                                        onClick={() => {
                                          setParticipantMenuOpen(null);
                                          requestRemoveParticipant(p);
                                        }}
                                      >
                                        삭제
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </section>
          );
        }

        return (
          <section className="desert-list">
            <ul className="desert-events">
              {events.map((event) => (
                <li
                  key={event.id}
                  className="desert-event-row clickable"
                  onClick={() => setSelectedEvent(event)}
                >
                  <div className="desert-event-main">
                    <div className="desert-event-head">
                      <span className="desert-event-chip primary">{event.squad}조</span>
                    </div>
                    <span className="desert-event-date">
                      {formatDisplayDate(event.scheduled_at, event.squad)}
                    </span>
                    <div className="desert-event-meta-group">
                      <span className="desert-event-chip subtle">
                        {(event.applicant_count ?? 0).toString()}명
                      </span>
                      <span className="desert-event-chip subtle">
                        {STATUS_LABELS[event.status] ?? '미확정'}
                      </span>
                    </div>
                  </div>
                  <div className="desert-event-actions">
                    <button
                      type="button"
                      className="delete-icon-btn"
                      aria-label="편성 삭제"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(event);
                      }}
                    >
                      <HiTrash />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })()}
      {deleteTarget && (
        <div className="modal-backdrop" role="alertdialog" aria-modal="true">
          <div className="modal-card">
            <p className="modal-title">편성 삭제</p>
            <div className="modal-body">
              <p>
                {formatDisplayDate(deleteTarget.scheduled_at, deleteTarget.squad)} 편성을 삭제할까요?
              </p>
            </div>
            <div className="modal-actions">
              <button type="button" className="modal-button secondary" onClick={cancelDelete}>
                취소
              </button>
              <button type="button" className="modal-button danger" onClick={confirmDelete} disabled={isDeleting}>
                {isDeleting ? '삭제 중…' : '삭제하기'}
              </button>
            </div>
          </div>
        </div>
      )}
      {removeSelectionConfirm.open && (
        <div className="modal-backdrop" role="alertdialog" aria-modal="true">
          <div className="modal-card">
            <p className="modal-title">참가 해제</p>
            <div className="modal-body">
              <p>참가자 신청한 사용자입니다. 참가를 해제하시겠습니까?</p>
            </div>
            <div className="modal-actions">
              <button type="button" className="modal-button secondary" onClick={cancelUnselect}>
                취소
              </button>
              <button type="button" className="modal-button danger" onClick={confirmUnselectProceed}>
                해제하기
              </button>
            </div>
          </div>
        </div>
      )}
      {removeParticipantConfirm && (
        <div className="modal-backdrop" role="alertdialog" aria-modal="true">
          <div className="modal-card">
            <p className="modal-title">참가자 삭제</p>
            <div className="modal-body">
              <p>{removeParticipantConfirm.name ?? '참가자'}를 삭제할까요?</p>
            </div>
            <div className="modal-actions">
              <button type="button" className="modal-button secondary" onClick={cancelRemoveParticipant}>
                취소
              </button>
              <button type="button" className="modal-button danger" onClick={confirmRemoveParticipant}>
                삭제하기
              </button>
            </div>
          </div>
        </div>
      )}
      {deletedNotice && (
        <div className="modal-backdrop" role="alertdialog" aria-modal="true">
          <div className="modal-card">
            <p className="modal-title">편성이 삭제되었습니다</p>
            <div className="modal-body">
              <p>다른 사용자에 의해 해당 편성이 삭제되었습니다.</p>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="modal-button"
                onClick={() => setDeletedNotice(false)}
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
      {isMemberModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card form-modal">
            <div className="modal-header">
              <p className="modal-title">참가자 추가</p>
              <button type="button" className="modal-close" onClick={closeMemberModal}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="participant-search">
                <input
                  type="text"
                  className="modal-input compact"
                  placeholder="닉네임 검색"
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                />
                <div className="member-sort-controls">
                  <button
                    type="button"
                    className="sort-chip"
                    onClick={() => setMemberSort((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                  >
                    닉네임 {memberSort === 'asc' ? 'A↑' : 'A↓'}
                  </button>
                </div>
              </div>
              {memberLoadError && <p className="member-error">{memberLoadError}</p>}
              {isLoadingMembers ? (
                <p className="desert-empty">멤버를 불러오는 중입니다…</p>
              ) : (
                <div className="member-select-list">
                  {sortedMembers.map((member) => {
                    const isChecked = !!selectedMemberIds[member.id];
                    return (
                      <label key={member.id} className="member-select-row">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleMember(member)}
                        />
                        <div className="member-select-info">
                          <span className="member-name">{member.name}</span>
                        </div>
                      </label>
                    );
                  })}
                  {sortedMembers.length === 0 && <p className="desert-empty">검색 결과가 없습니다.</p>}
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button type="button" className="modal-button secondary" onClick={closeMemberModal}>
                취소
              </button>
              <button type="button" className="modal-button" onClick={applySelection}>
                추가하기
              </button>
            </div>
          </div>
        </div>
      )}
      {isModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card">
            <p className="modal-title">사막 편성 추가</p>
            <div className="modal-body">
              <label className="modal-label" htmlFor="desert-squad">
                조 선택
              </label>
              {renderSquadButtons()}

              <label className="modal-label" htmlFor="desert-date">
                일자
              </label>
              <div className="modal-datepicker">
                <DatePicker
                  id="desert-date"
                  selected={form.date}
                  onChange={(date) => setForm((prev) => ({ ...prev, date }))}
                  dateFormat="yyyy-MM-dd"
                  placeholderText="일자를 선택하세요"
                  className="modal-input"
                  shouldCloseOnSelect
                  locale="ko"
                  minDate={new Date()}
                  filterDate={(date) => isDateAllowedForSquad(form.squad, date)}
                />
              </div>
              {formStatus.message && (
                <p className={`form-note ${formStatus.type === 'error' ? 'error' : 'success'}`}>
                  {formStatus.message}
                </p>
              )}
            </div>
            <div className="modal-actions">
              <button type="button" className="modal-button" onClick={handleCreate} disabled={isSubmitting}>
                생성
              </button>
              <button type="button" className="modal-button secondary" onClick={closeModal}>
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
      {resultModal.open && (
        <div className="modal-backdrop" role="alertdialog" aria-modal="true">
          <div className="modal-card">
            <p className="modal-title">{resultModal.type === 'success' ? '처리 완료' : '알림'}</p>
            <div className="modal-body">
              <p>{resultModal.message}</p>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="modal-button"
                onClick={() => setResultModal({ open: false, type: '', message: '' })}
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
