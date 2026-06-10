import React, { useState, useEffect, useRef, useContext } from 'react';
import { io } from 'socket.io-client';
import { ConfigContext } from '../context/ConfigContext';

const QUICK_EMOJIS = ["😂", "🤣", "😍", "🔥", "💯", "👍", "👏", "😡", "😱", "😭", "🐓", "💸", "🍺", "⚽", "🏆", "🐔", "🍗", "💰", "❤️", "🙌"];

export default function LiveCommentSection() {
  const { config } = useContext(ConfigContext);
  const [comments, setComments] = useState([]);
  const [inputVal, setInputVal] = useState('');
  const [username, setUsername] = useState('');
  const listRef = useRef(null);
  const socketRef = useRef(null);

  // Authentication States
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showAuthForm, setShowAuthForm] = useState(false);
  const [authType, setAuthType] = useState('login'); // 'login' or 'register'
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authPhone, setAuthPhone] = useState('');
  const [authError, setAuthError] = useState('');

  // Profile States
  const [userProfile, setUserProfile] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  
  // Emoji State
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const handleEmojiClick = (emoji) => {
    setInputVal((prev) => prev + emoji);
  };

  const getLevelColor = (level) => {
    const l = parseInt(level, 10) || 1;
    if (l < 5) return '#4b5563'; // 1-4: Xám đục (Contrast cao)
    if (l < 10) return '#15803d'; // 5-9: Xanh Lục đậm
    if (l < 15) return '#1d4ed8'; // 10-14: Xanh Lam đậm
    if (l < 20) return '#7e22ce'; // 15-19: Tím đậm
    if (l < 25) return '#c2410c'; // 20-24: Cam đậm
    if (l < 30) return '#b91c1c'; // 25-29: Đỏ sẫm
    if (l < 35) return '#0f766e'; // 30-34: Ngọc Lam đậm
    if (l < 40) return '#be185d'; // 35-39: Hồng sẫm
    if (l < 50) return '#a16207'; // 40-49: Vàng đồng đậm
    return '#111827'; // 50+: Hắc Kim (Đen)
  };

  const getVipBadge = (level) => {
    const l = parseInt(level, 10) || 1;
    // VIP 5: Hắc Kim (Đen bóng - Vàng chói)
    if (l >= 50) return { text: 'VIP5', color: '#fde047', bg: 'linear-gradient(90deg, #000000 0%, #52525b 50%, #000000 100%)' };
    // VIP 4: Kim Cương (Xanh Cyan lấp lánh chói)
    if (l >= 40) return { text: 'VIP4', color: '#082f49', bg: 'linear-gradient(90deg, #0ea5e9 0%, #bae6fd 50%, #0ea5e9 100%)' };
    // VIP 3: Vàng Ròng (Gold kim loại)
    if (l >= 30) return { text: 'VIP3', color: '#451a03', bg: 'linear-gradient(90deg, #d97706 0%, #fef08a 50%, #d97706 100%)' };
    // VIP 2: Bạc (Silver kim loại tráng gương)
    if (l >= 20) return { text: 'VIP2', color: '#171717', bg: 'linear-gradient(90deg, #9ca3af 0%, #f3f4f6 50%, #9ca3af 100%)' };
    // VIP 1: Đồng Ánh Kim (Bronze)
    if (l >= 10) return { text: 'VIP1', color: '#fff', bg: 'linear-gradient(90deg, #78350f 0%, #d97706 50%, #78350f 100%)' };
    return null;
  };

  useEffect(() => {
    // Check local session
    const session = localStorage.getItem('chatSession');
    if (session) {
      let db = JSON.parse(localStorage.getItem('local_chat_db') || '{}');
      if (db[session]) {
        setIsLoggedIn(true);
        setUsername(session);
        setUserProfile(db[session]);
      } else {
        localStorage.removeItem('chatSession');
      }
    } else {
      setUsername(`Guest${Math.floor(Math.random() * 10000)}`);
    }

    // Connect to WebSockets
    socketRef.current = io(import.meta.env.VITE_API_BASE_URL || 'https://api.dagacpc.live', { transports: ['websocket'] });

    socketRef.current.on('connect', () => {
      console.log('Connected to Live Chat Server');
    });

    socketRef.current.on('chatHistory', (history) => {
      setComments(history);
    });

    socketRef.current.on('chatMessage', (msg) => {
      setComments((prev) => [...prev, msg].slice(-50)); // keep max 50 in UI
    });

    socketRef.current.on('messageDeleted', (id) => {
      setComments((prev) => prev.filter(m => m.id !== id));
    });

    socketRef.current.on('chatCleared', () => {
      setComments([]);
    });

    socketRef.current.on('chatError', (errMsg) => {
      alert("Hệ thống: " + errMsg);
    });

    socketRef.current.on('userBanned', (bannedUsername) => {
      setComments((prev) => prev.filter(m => m.username !== bannedUsername));
      if (localStorage.getItem('chatSession') === bannedUsername) {
        localStorage.removeItem('chatSession');
        setIsLoggedIn(false);
        setUserProfile(null);
        setUsername(`Guest${Math.floor(Math.random() * 10000)}`);
        alert("Tài khoản của bạn đã bị khóa mõm bởi Quản Trị Viên!");
      }
    });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, []);

  const scrollToBottom = () => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [comments]);

  const submitAuth = () => {
    setAuthError('');
    if (!authUsername.trim() || !authPassword.trim() || (authType === 'register' && !authPhone.trim())) {
      setAuthError('Vui lòng nhập đầy đủ thông tin!');
      return;
    }

    let db = JSON.parse(localStorage.getItem('local_chat_db') || '{}');
    let uName = authUsername.trim();

    if (authType === 'register') {
      if (db[uName]) {
        setAuthError('Tài khoản đã tồn tại!');
        return;
      }
      db[uName] = { password: authPassword, phone: authPhone, level: 1, exp: 0 };
      localStorage.setItem('local_chat_db', JSON.stringify(db));
    } else {
      if (!db[uName] || db[uName].password !== authPassword) {
        setAuthError('Sai tài khoản hoặc mật khẩu!');
        return;
      }
    }

    // Login Success
    localStorage.setItem('chatSession', uName);
    setUsername(uName);
    setUserProfile(db[uName]);
    setIsLoggedIn(true);
    setShowAuthForm(false);
    setAuthUsername('');
    setAuthPassword('');
    setAuthPhone('');
  };

  const handleLogout = () => {
    localStorage.removeItem('chatSession');
    setIsLoggedIn(false);
    setUserProfile(null);
    setUsername(`Guest${Math.floor(Math.random() * 10000)}`);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputVal.trim() || !socketRef.current || !isLoggedIn || !userProfile) return;

    // Gain exp and level up
    let updatedProfile = { ...userProfile };
    updatedProfile.exp = (updatedProfile.exp || 0) + 1;
    updatedProfile.level = Math.floor(updatedProfile.exp / 5) + 1;

    let db = JSON.parse(localStorage.getItem('local_chat_db') || '{}');
    if (db[username]) {
      db[username] = updatedProfile;
      localStorage.setItem('local_chat_db', JSON.stringify(db));
    }
    setUserProfile(updatedProfile);

    const newComment = {
      id: Date.now() + Math.random(),
      author: username,
      level: updatedProfile.level,
      text: inputVal.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    socketRef.current.emit('chatMessage', newComment);
    setInputVal('');
  };

  return (
    <>
      <div className="comment-section">
        <div className="comment-header">
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>Live Chat</h2>
          <span className="live-badge">🟢 LIVE</span>
        </div>

        <div className="pinned-message">
          <div className="marquee-content" dangerouslySetInnerHTML={{ __html: config?.settings?.chatPinnedMessage || 'Nhóm chuyên đấm gà: <a href="https://bit.ly/abcca1" target="_blank" rel="noopener noreferrer">bit.ly/abcca1</a>' }} />
        </div>

        <div className="comment-list" ref={listRef}>
          {comments.map((c) => (
            <div key={c.id} className="comment-item-inline" style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '8px' }}>
              <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.1)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold', marginRight: '6px', flexShrink: 0, textTransform: 'uppercase' }}>
                {c.author.charAt(0)}
              </div>
              <div style={{ flex: 1, lineHeight: '1.4', fontSize: '0.85rem' }}>
                <span style={{ color: isLoggedIn && c.author === username ? 'var(--accent-color)' : '#fbbf24', fontWeight: 600, marginRight: '4px' }}>
                  {c.level && <span style={{ fontSize: '0.65rem', padding: '1px 4px', background: getLevelColor(c.level), color: '#fff', borderRadius: '3px', marginRight: '4px' }}>Lv.{c.level}</span>}
                  {(() => {
                    const vip = getVipBadge(c.level);
                    return vip ? <span className="vip-badge-shimmer" style={{ fontSize: '0.6rem', padding: '1px 4px', background: vip.bg, color: vip.color, borderRadius: '3px', marginRight: '4px', border: `1px solid rgba(255,255,255,0.2)`, fontWeight: 'bold' }}>{vip.text}</span> : null;
                  })()}
                  {c.author}
                </span>
                <span style={{ color: 'var(--text-primary)', wordBreak: 'break-word' }}>{c.text}</span>
              </div>
            </div>
          ))}
          {comments.length === 0 && <div className="no-comments">Kết nối Live Chat thành công! Hãy là người bình luận đầu tiên.</div>}
        </div>

        <div className="comment-input-wrapper">
          {!isLoggedIn && !showAuthForm && (
            <div className="chat-login-overlay">
              <button className="chat-login-btn" onClick={() => setShowAuthForm(true)}>đăng nhập để chat</button>
            </div>
          )}

          {showAuthForm && !isLoggedIn && (
            <div className="chat-auth-mini-form">
              <div className="auth-header">
                <div className="auth-tabs">
                  <button className={`auth-tab ${authType === 'login' ? 'active' : ''}`} onClick={() => setAuthType('login')}>Đăng Nhập</button>
                  <button className={`auth-tab ${authType === 'register' ? 'active' : ''}`} onClick={() => setAuthType('register')}>Đăng Ký</button>
                </div>
                <button className="auth-close-btn" onClick={() => setShowAuthForm(false)}>✕</button>
              </div>
              {authError && <div className="auth-error">{authError}</div>}

              <input
                type="text"
                placeholder="Tên đăng nhập..."
                value={authUsername}
                onChange={(e) => setAuthUsername(e.target.value)}
              />
              {authType === 'register' && (
                <input
                  type="text"
                  placeholder="Số điện thoại..."
                  value={authPhone}
                  onChange={(e) => setAuthPhone(e.target.value)}
                />
              )}
              <input
                type="password"
                placeholder="Mật khẩu..."
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
              />
              <div className="auth-actions">
                <button onClick={submitAuth} className="btn-login">{authType === 'login' ? 'Đăng Nhập' : 'Tạo Tài Khoản'}</button>
              </div>
            </div>
          )}

          <form
            className="comment-input-form"
            onSubmit={handleSubmit}
            style={{
              opacity: isLoggedIn ? 1 : 0.3,
              pointerEvents: isLoggedIn ? 'auto' : 'none',
              filter: isLoggedIn ? 'none' : 'grayscale(100%)'
            }}
          >
            <div className="comment-username-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', width: '100%', boxSizing: 'border-box' }}>
              <span
                style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                onClick={() => setShowProfileModal(true)}
              >
                Đang chat:
                <strong style={{ color: 'var(--accent-color)', textDecoration: 'underline' }}>
                  {userProfile ? `[Lv.${userProfile.level}] ` : ''}{username}
                </strong>
              </span>
              {isLoggedIn && (
                <button type="button" onClick={handleLogout} className="logout-btn" style={{ margin: 0 }}>Đăng xuất</button>
              )}
            </div>

            <div className="comment-input-row" style={{position: 'relative', zIndex: 50}}>
              <button 
                type="button" 
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                style={{
                  background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.2rem', padding: '0 4px', filter: 'grayscale(0%)',
                  display: 'flex', alignItems: 'center', flexShrink: 0
                }}
                disabled={!isLoggedIn}
              >🙂</button>
              
              {showEmojiPicker && isLoggedIn && (
                <div style={{
                  position: 'absolute', bottom: 'calc(100% + 8px)', left: '0', background: 'var(--bg-color)', 
                  border: '1px solid var(--panel-border)', borderRadius: '12px', padding: '10px', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)',
                  gap: '8px', boxShadow: '0 -4px 20px rgba(0,0,0,0.6)', zIndex: 99999, minWidth: '220px'
                }}>
                  {QUICK_EMOJIS.map(em => (
                    <span 
                      key={em} 
                      onClick={() => handleEmojiClick(em)}
                      style={{ cursor: 'pointer', fontSize: '1.4rem', textAlign: 'center', transition: 'transform 0.1s', display: 'inline-block' }}
                      onMouseEnter={(e) => e.target.style.transform = 'scale(1.2)'}
                      onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
                    >
                      {em}
                    </span>
                  ))}
                </div>
              )}
              
              <input
                type="text"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                placeholder="Nhập nội dung tương tác..."
                className="comment-input"
                style={{ minWidth: 0 }}
                required
              />
              <button type="submit" className="comment-submit" style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>Gửi</button>
            </div>
          </form>
        </div>
      </div>

      {/* Profile Modal Overlay */}
      {showProfileModal && userProfile && (
        <div className="profile-modal-overlay" onClick={() => setShowProfileModal(false)}>
          <div className="profile-modal" onClick={e => e.stopPropagation()}>
            <button className="profile-close" onClick={() => setShowProfileModal(false)}>✕</button>
            <div className="profile-avatar">👤</div>
            <h3 className="profile-name">{username}</h3>
            <div className="profile-badge">Cấp bậc: <strong style={{ color: getLevelColor(userProfile.level) }}>Lv. {userProfile.level}</strong></div>
            {(() => {
               const vip = getVipBadge(userProfile.level);
               return vip ? <div className="profile-badge" style={{marginTop: '4px'}}>Đặc quyền: <span className="vip-badge-shimmer" style={{ fontSize: '0.7rem', padding: '2px 6px', background: vip.bg, color: vip.color, borderRadius: '4px', border: `1px solid rgba(255,255,255,0.2)`, fontWeight: 'bold' }}>{vip.text}</span></div> : null;
            })()}
            <div className="profile-stats">
              <p className="stat-line">
                <span>SĐT:</span>
                <strong>{userProfile.phone ? userProfile.phone.replace(/(\d{3})\d+(\d{3})/, "$1****$2") : 'Chưa cập nhật'}</strong>
              </p>
              <p className="stat-line">
                <span>Điểm VIP (EXP):</span>
                <strong>{userProfile.exp} / {userProfile.level * 5}</strong>
              </p>
            </div>
            <div className="profile-progress-bar">
              <div className="profile-progress-fill" style={{ width: `${(userProfile.exp % 5) / 5 * 100}%` }}></div>
            </div>
            <p style={{ fontSize: '0.75rem', textAlign: 'center', marginTop: '10px', color: 'var(--text-secondary)' }}>Trò chuyện 5 tin nhắn để thăng cấp tiếp theo!</p>
          </div>
        </div>
      )}

    </>
  );
}
