import React, { useState, useEffect } from 'react';

export default function ScheduleModal({ isOpen, onClose }) {
  const [scheduleHTML, setScheduleHTML] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && !scheduleHTML) {
      setLoading(true);
      fetch('https://api.dagacpc.live/api/schedule')
        .then(res => res.json())
        .then(data => {
          if (data.success && data.html) {
            setScheduleHTML(data.html);
          } else {
            setError(data.message || 'Không thể lấy dữ liệu lịch thi đấu.');
          }
          setLoading(false);
        })
        .catch(err => {
          console.error(err);
          setError('Không thể kết nối với máy chủ nạp lịch thi đấu.');
          setLoading(false);
        });
    }
  }, [isOpen, scheduleHTML]);

  if (!isOpen) return null;

  return (
    <div className="schedule-modal-overlay" onClick={onClose}>
      <div className="schedule-modal-content" onClick={e => e.stopPropagation()}>
        <div className="schedule-modal-header">
          <h2>Lịch Trực Tiếp Đá Gà SV388</h2>
          <button className="schedule-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="schedule-modal-body">
          {loading ? (
            <div className="schedule-loading">
              <div className="spinner"></div>
              <p>Đang cập nhật lịch thi đấu mới nhất từ hệ thống...</p>
            </div>
          ) : error ? (
            <div className="schedule-error">
              <p>⚠️ {error}</p>
            </div>
          ) : (
            <div 
              className="sv388-schedule-wrapper"
              dangerouslySetInnerHTML={{ __html: scheduleHTML }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
