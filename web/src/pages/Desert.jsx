import { useState } from 'react';
import DatePicker, { registerLocale } from 'react-datepicker';
import { ko } from 'date-fns/locale';
import 'react-datepicker/dist/react-datepicker.css';

registerLocale('ko', ko);

export default function Desert() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({ squad: 'A', date: null });

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <article className="home-card">
      <header className="desert-header">
        <h2>사막폭풍 전장</h2>
        <div className="desert-actions">
          <button type="button" className="member-action-btn primary" onClick={() => setIsModalOpen(true)}>
            사막 편성 추가
          </button>
        </div>
      </header>
      {isModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card">
            <p className="modal-title">사막 편성 추가</p>
            <div className="modal-body">
              <label className="modal-label" htmlFor="desert-squad">
                조 선택
              </label>
              <div className="modal-datepicker">
                <select
                  id="desert-squad"
                  name="squad"
                  value={form.squad}
                  onChange={handleChange}
                  className="modal-select"
                >
                  <option value="A">A조 (금요일 20시 KST)</option>
                  <option value="B">B조 (토요일 10시 KST)</option>
                </select>
              </div>

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
                />
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="modal-button">
                생성
              </button>
              <button type="button" className="modal-button secondary" onClick={() => setIsModalOpen(false)}>
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
