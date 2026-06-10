import React, { useState, useEffect, useContext, useMemo } from 'react';
import { ConfigContext } from '../context/ConfigContext';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { io } from 'socket.io-client';
import { apiUrl, assetUrl, getApiBaseUrl } from '../lib/api';

export default function AdminPage() {
  const { config, refreshConfig } = useContext(ConfigContext);
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  const [activeTab, setActiveTab] = useState('settings');
  
  // State for settings tab
  const [editConfig, setEditConfig] = useState(null);
  const [saveStatus, setSaveStatus] = useState('');

  // State for chat tab
  const [socket, setSocket] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  
  // State for Fake Chat
  const [fakeUsername, setFakeUsername] = useState('AnDanhCa');
  const [fakeLevel, setFakeLevel] = useState(1);
  const [fakeText, setFakeText] = useState('Gà đá hay quá anh em ơi!');

  // State for articles & categories
  const [articles, setArticles] = useState([]);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    if (config) {
      setEditConfig(config);
    }
  }, [config]);

  useEffect(() => {
    if (activeTab === 'chat' && isAuthenticated) {
      const s = io(getApiBaseUrl(), { transports: ['websocket'] });
      setSocket(s);

      s.on('chatHistory', (history) => setChatHistory(history));
      s.on('chatMessage', (msg) => {
        setChatHistory(prev => [...prev.slice(-49), msg]);
      });
      s.on('messageDeleted', (id) => {
        setChatHistory(prev => prev.filter(m => m.id !== id));
      });
      s.on('chatCleared', () => {
        setChatHistory([]);
      });
      s.on('userBanned', (username) => {
        setChatHistory(prev => prev.filter(m => m.username !== username));
      });

      return () => {
        s.disconnect();
      };
    }
  }, [activeTab, isAuthenticated]);

  const fetchArticles = async () => {
    try {
      const res = await fetch(apiUrl('/api/articles'));
      const data = await res.json();
      if (data.success) {
        setArticles(data.articles);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch(apiUrl('/api/categories'));
      const data = await res.json();
      if (data.success) {
        setCategories(data.categories);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      if (activeTab === 'articles' || activeTab === 'categories') {
        fetchArticles();
        fetchCategories();
      }
    }
  }, [activeTab, isAuthenticated]);

  const generateSlug = (str) => {
    if (!str) return '';
    return String(str)
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9 -]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (password) {
      try {
        const res = await fetch(apiUrl('/api/verify-password'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password })
        });
        const data = await res.json();
        if (data?.success) {
          setIsAuthenticated(true);
        } else {
          alert('Sai mật khẩu quản trị!');
        }
      } catch (err) {
        alert('Lỗi kết nối máy chủ');
      }
    }
  };

  const handleSaveConfig = async () => {
    setSaveStatus('Đang lưu...');
    try {
      const res = await fetch(apiUrl('/api/config'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password, data: editConfig })
      });
      const json = await res.json();
      if (json.success) {
        setSaveStatus('Đã lưu thành công!');
        refreshConfig();
        setTimeout(() => setSaveStatus(''), 3000);
      } else {
        setSaveStatus('Lỗi: ' + json.message);
      }
    } catch (err) {
      setSaveStatus('Lỗi kết nối máy chủ');
    }
  };

  const updateSetting = (key, value) => {
    setEditConfig(prev => ({
      ...prev,
      settings: { ...prev.settings, [key]: value }
    }));
  };

  const handleArticleFieldChange = (id, field, value) => {
    setArticles(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a));
  };
  
  const handleCategoryFieldChange = (id, field, value) => {
    setCategories(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const handleSaveCategory = async (cat) => {
    const isNew = cat.id.toString().startsWith('temp_');
    const url = isNew ? apiUrl('/api/categories') : apiUrl(`/api/categories/${cat.id}`);
    const method = isNew ? 'POST' : 'PUT';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...cat, password })
      });
      const data = await res.json();
      if (data.success) {
        alert('Lưu danh mục thành công');
        fetchCategories();
      } else {
        alert('Lỗi: ' + data.message);
      }
    } catch (err) {
      alert('Lỗi kết nối máy chủ');
    }
  };

  const handleDeleteCategory = async (id) => {
    if(!window.confirm('Chắc chắn xóa danh mục này?')) return;
    if(id.toString().startsWith('temp_')) {
      setCategories(prev => prev.filter(c => c.id !== id));
      return;
    }
    try {
      const res = await fetch(apiUrl(`/api/categories/${id}`), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      if ((await res.json()).success) {
        fetchCategories();
      }
    } catch (err) {
      alert('Lỗi kết nối máy chủ');
    }
  };

  const handleSaveArticle = async (article) => {
    const isNew = article.id.toString().startsWith('temp_');
    const url = isNew ? apiUrl('/api/articles') : apiUrl(`/api/articles/${article.id}`);
    const method = isNew ? 'POST' : 'PUT';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...article, password })
      });
      const data = await res.json();
      if (data.success) {
        alert('Lưu bài viết thành công');
        fetchArticles();
      } else {
        alert('Lỗi: ' + data.message);
      }
    } catch (err) {
      alert('Lỗi kết nối máy chủ');
    }
  };

  const handleDeleteArticle = async (id) => {
    if(!window.confirm('Chắc chắn xóa bài viết này?')) return;
    if(id.toString().startsWith('temp_')) {
      setArticles(prev => prev.filter(a => a.id !== id));
      return;
    }
    try {
      const res = await fetch(apiUrl(`/api/articles/${id}`), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      if ((await res.json()).success) {
        fetchArticles();
      }
    } catch (err) {
      alert('Lỗi kết nối máy chủ');
    }
  };

  const handleUploadImage = async (file, articleId) => {
    const formData = new FormData();
    formData.append('image', file);
    try {
      const res = await fetch(apiUrl('/api/upload'), {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        handleArticleFieldChange(articleId, 'image_url', data.url);
      } else {
        alert('Lỗi: ' + data.message);
      }
    } catch (err) {
      alert('Lỗi upload ảnh');
    }
  };

  const handleInjectFakeChat = () => {
    if (socket && fakeText.trim()) {
      socket.emit('injectFakeChat', {
        adminPassword: password,
        username: fakeUsername,
        level: parseInt(fakeLevel, 10),
        text: fakeText
      });
      setFakeText('');
    }
  };

  const handleUploadLogo = async (file, type) => {
    const formData = new FormData();
    formData.append('image', file);
    try {
      const res = await fetch(apiUrl('/api/upload'), {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        let key = 'logoUrlLight';
        if (type === 'dark') key = 'logoUrlDark';
        else if (type === 'favicon') key = 'faviconUrl';
        updateSetting(key, data.url);
      } else {
        alert('Lỗi: ' + data.message);
      }
    } catch (err) {
      alert('Lỗi upload ảnh');
    }
  };

  // Chat Actions
  const deleteMessage = (id) => {
    if (window.confirm("Xóa tin nhắn này?")) {
      socket.emit('deleteMessage', { messageId: id, adminPassword: password });
    }
  };

  const banUser = (username) => {
    if (window.confirm(`Sẽ khóa chat và xóa toàn bộ tin nhắn của ${username}?`)) {
      socket.emit('banUser', { username, adminPassword: password });
    }
  };

  const clearChat = () => {
    if (window.confirm("BẠN CÓ CHẮC CHẮN XÓA TẤT CẢ LỊCH SỬ CHAT KHÔNG?")) {
      socket.emit('clearChat', { adminPassword: password });
    }
  };

  const modules = useMemo(() => ({
    toolbar: {
      container: [
        [{ 'header': [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        ['link', 'image', 'video'],
        ['clean']
      ],
      handlers: {
        image: function() {
          const input = document.createElement('input');
          input.setAttribute('type', 'file');
          input.setAttribute('accept', 'image/*');
          input.click();

          input.onchange = async () => {
            const file = input.files[0];
            const formData = new FormData();
            formData.append('image', file);
            try {
              const res = await fetch(apiUrl('/api/upload'), {
                method: 'POST',
                body: formData
              });
              const data = await res.json();
              if (data.success) {
                const range = this.quill.getSelection(true);
                this.quill.insertEmbed(range.index, 'image', assetUrl(data.url));
              } else {
                alert("Upload ảnh thất bại: " + data.message);
              }
            } catch (e) {
              console.error(e);
            }
          };
        }
      }
    }
  }), []);

  if (!isAuthenticated) {
    return (
      <div style={{ padding: '4rem 2rem', maxWidth: '400px', margin: '0 auto', color: 'var(--text-primary)' }}>
        <h2 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>Đăng Nhập Quản Trị</h2>
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <input 
            type="password" 
            placeholder="Mật khẩu Admin" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)}
            style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--panel-border)', background: 'var(--panel-bg)', color: 'var(--text-primary)' }}
          />
          <button type="submit" style={{ padding: '0.75rem', background: 'var(--accent-color)', color: 'white', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>
            Vào Trang Quản Trị
          </button>
        </form>
      </div>
    );
  }



  if (!editConfig) return <div style={{ padding: '2rem' }}>Đang tải cấu hình...</div>;

  return (
    <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto', color: 'var(--text-primary)' }}>
      <h2 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--panel-border)', paddingBottom: '1rem' }}>DAGA CPC - Admin Dashboard</h2>
      
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        <button onClick={() => setActiveTab('settings')} style={{ background: activeTab === 'settings' ? 'var(--accent-color)' : 'var(--panel-bg)', color: activeTab === 'settings' ? 'white' : 'var(--text-primary)', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer' }}>Cấu Hình Chung</button>
        <button onClick={() => setActiveTab('seo')} style={{ background: activeTab === 'seo' ? 'var(--accent-color)' : 'var(--panel-bg)', color: activeTab === 'seo' ? 'white' : 'var(--text-primary)', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer' }}>Kênh SEO CPC</button>
        <button onClick={() => setActiveTab('categories')} style={{ background: activeTab === 'categories' ? 'var(--accent-color)' : 'var(--panel-bg)', color: activeTab === 'categories' ? 'white' : 'var(--text-primary)', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer' }}>Quản Lý Danh Mục</button>
        <button onClick={() => setActiveTab('articles')} style={{ background: activeTab === 'articles' ? 'var(--accent-color)' : 'var(--panel-bg)', color: activeTab === 'articles' ? 'white' : 'var(--text-primary)', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer' }}>Quản Lý Bài Viết</button>
        <button onClick={() => setActiveTab('chat')} style={{ background: activeTab === 'chat' ? 'var(--live-color)' : 'var(--panel-bg)', color: activeTab === 'chat' ? 'white' : 'var(--text-primary)', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer' }}>Kiểm Duyệt Chat</button>
      </div>

      {activeTab === 'seo' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {Object.keys(editConfig.seoDictionary).map(channel => (
            <div key={channel} style={{ background: 'var(--panel-bg)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--panel-border)' }}>
              <h3 style={{ marginBottom: '1rem', color: 'var(--live-color)' }}>{channel === 'HOME' ? 'Trang Chủ (HOME)' : channel}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label>Title (H1)</label>
                  <input type="text" value={editConfig.seoDictionary[channel].title} onChange={e => {
                    const val = e.target.value;
                    setEditConfig(prev => ({...prev, seoDictionary: {...prev.seoDictionary, [channel]: {...prev.seoDictionary[channel], title: val}}}));
                  }} style={inputStyle} />
                </div>
                <div>
                  <label>Subtitle (H2)</label>
                  <input type="text" value={editConfig.seoDictionary[channel].h2} onChange={e => {
                    const val = e.target.value;
                    setEditConfig(prev => ({...prev, seoDictionary: {...prev.seoDictionary, [channel]: {...prev.seoDictionary[channel], h2: val}}}));
                  }} style={inputStyle} />
                </div>
                <div>
                  <label>Meta Title</label>
                  <input type="text" value={editConfig.seoDictionary[channel].metaTitle} onChange={e => {
                    const val = e.target.value;
                    setEditConfig(prev => ({...prev, seoDictionary: {...prev.seoDictionary, [channel]: {...prev.seoDictionary[channel], metaTitle: val}}}));
                  }} style={inputStyle} />
                </div>
                <div>
                  <label>Meta Description</label>
                  <textarea value={editConfig.seoDictionary[channel].metaDesc} onChange={e => {
                    const val = e.target.value;
                    setEditConfig(prev => ({...prev, seoDictionary: {...prev.seoDictionary, [channel]: {...prev.seoDictionary[channel], metaDesc: val}}}));
                  }} style={{...inputStyle, height: '60px'}} />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label>Đoạn văn SEO 1 (Hỗ trợ HTML)</label>
                  <div style={{ background: '#fff', color: '#000', borderRadius: '6px', marginTop: '0.5rem', overflow: 'hidden' }}>
                    <ReactQuill theme="snow" value={editConfig.seoDictionary[channel].p1} onChange={html => {
                      setEditConfig(prev => ({...prev, seoDictionary: {...prev.seoDictionary, [channel]: {...prev.seoDictionary[channel], p1: html}}}));
                    }} modules={modules} />
                  </div>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label>Đoạn văn SEO 2 (Hỗ trợ HTML)</label>
                  <div style={{ background: '#fff', color: '#000', borderRadius: '6px', marginTop: '0.5rem', overflow: 'hidden' }}>
                    <ReactQuill theme="snow" value={editConfig.seoDictionary[channel].p2} onChange={html => {
                      setEditConfig(prev => ({...prev, seoDictionary: {...prev.seoDictionary, [channel]: {...prev.seoDictionary[channel], p2: html}}}));
                    }} modules={modules} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'settings' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="admin-field" style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label>Logo (Chữ hoặc HTML)</label>
                <input type="text" value={editConfig.settings.logoTitle || ''} onChange={e => updateSetting('logoTitle', e.target.value)} style={inputStyle} />
              </div>
              <div style={{ borderTop: '1px dashed var(--panel-border)', paddingTop: '0.5rem' }}>
                <label>Tải Ảnh Favicon Lên (Icon Thu Nhỏ Trình Duyệt)</label>
                <input type="file" accept="image/*" onChange={(e) => { if(e.target.files[0]) handleUploadLogo(e.target.files[0], 'favicon') }} style={{ ...inputStyle, padding: '0.4rem' }} />
                {editConfig.settings.faviconUrl && (
                  <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <img src={`https://api.dagacpc.live${editConfig.settings.faviconUrl}`} alt="Favicon" style={{ height: '35px', objectFit: 'contain', background: 'rgba(100,100,100,0.1)', padding: '2px', borderRadius: '4px' }} />
                    <button onClick={() => updateSetting('faviconUrl', '')} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>Gỡ Bỏ</button>
                  </div>
                )}
              </div>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label>Logo Giao Diện Sáng (Nền Trắng)</label>
                <input type="file" accept="image/*" onChange={(e) => { if(e.target.files[0]) handleUploadLogo(e.target.files[0], 'light') }} style={{ ...inputStyle, padding: '0.4rem' }} />
                {(editConfig.settings.logoUrlLight || editConfig.settings.logoUrl) && (
                  <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <img src={`https://api.dagacpc.live${editConfig.settings.logoUrlLight || editConfig.settings.logoUrl}`} alt="Logo Light" style={{ height: '35px', objectFit: 'contain', background: '#ccc', padding: '2px', borderRadius: '4px' }} />
                    <button onClick={() => updateSetting('logoUrlLight', '')} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>Gỡ Bỏ</button>
                  </div>
                )}
              </div>
              <div style={{ borderTop: '1px dashed var(--panel-border)', paddingTop: '0.5rem' }}>
                <label>Logo Giao Diện Tối (Nền Đen)</label>
                <input type="file" accept="image/*" onChange={(e) => { if(e.target.files[0]) handleUploadLogo(e.target.files[0], 'dark') }} style={{ ...inputStyle, padding: '0.4rem' }} />
                {(editConfig.settings.logoUrlDark || editConfig.settings.logoUrl) && (
                  <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <img src={`https://api.dagacpc.live${editConfig.settings.logoUrlDark || editConfig.settings.logoUrl}`} alt="Logo Dark" style={{ height: '35px', objectFit: 'contain', background: '#000', padding: '2px', borderRadius: '4px' }} />
                    <button onClick={() => updateSetting('logoUrlDark', '')} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>Gỡ Bỏ</button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="admin-field">
            <label>Breadcrumbs SEO</label>
            <input type="text" value={editConfig.settings.breadcrumbs} onChange={e => updateSetting('breadcrumbs', e.target.value)} style={inputStyle} />
          </div>
          <div className="admin-field" style={{ background: 'var(--panel-bg)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--panel-border)' }}>
            <h4 style={{ color: 'var(--accent-color)', marginBottom: '1rem' }}>Thanh Bên (Sidebar Textlink)</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label>Tiêu đề danh mục Sidebar</label>
                <input type="text" value={editConfig.settings.sidebarTitle || ''} onChange={e => updateSetting('sidebarTitle', e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label>Nội dung HTML (Danh sách Link)</label>
                <div style={{ background: '#fff', color: '#000', borderRadius: '6px', overflow: 'hidden', marginTop: '0.5rem' }}>
                  <ReactQuill theme="snow" value={editConfig.settings.sidebarHtml || ''} onChange={html => updateSetting('sidebarHtml', html)} modules={modules} />
                </div>
                <small style={{ color: 'var(--text-secondary)', display: 'block', marginTop: '0.5rem' }}>
                  <strong>Cú pháp đặc biệt:</strong> Gõ <code>[LIVE]</code> để tạo nút LIVE nhấp nháy, gõ <code>[&gt;]</code> để tạo dấu mũi tên đen.
                </small>
              </div>
            </div>
          </div>
          <div className="admin-field">
            <label>Link "Vào Cây Gà"</label>
            <input type="text" value={editConfig.settings.vaoCayGaLink || ''} onChange={e => updateSetting('vaoCayGaLink', e.target.value)} style={inputStyle} />
          </div>
          <div className="admin-field">
            <label>Link "Liên Hệ CSKH"</label>
            <input type="text" value={editConfig.settings.lienHeLink || ''} onChange={e => updateSetting('lienHeLink', e.target.value)} style={inputStyle} />
          </div>
          <div className="admin-field" style={{ background: 'var(--panel-bg)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--panel-border)', marginTop: '1rem' }}>
            <h4 style={{ color: 'var(--accent-color)', marginBottom: '1rem' }}>Cấu Hình Chân Trang (Footer)</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label>Mô tả Footer</label>
                <textarea value={editConfig.settings.footerDescription || ''} onChange={e => updateSetting('footerDescription', e.target.value)} style={{...inputStyle, height: '80px'}} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label>Cột Footer 1 (Tiêu đề)</label>
                  <input type="text" value={editConfig.settings.footerCol1Title || ''} onChange={e => updateSetting('footerCol1Title', e.target.value)} style={inputStyle} />
                  <label style={{ marginTop: '1rem', display: 'block' }}>Cột Footer 1 (Links HTML)</label>
                  <div style={{ background: '#fff', color: '#000', borderRadius: '6px', overflow: 'hidden', marginTop: '0.5rem' }}>
                    <ReactQuill theme="snow" value={editConfig.settings.footerCol1HTML || ''} onChange={html => updateSetting('footerCol1HTML', html)} modules={modules} />
                  </div>
                </div>
                <div>
                  <label>Cột Footer 2 (Tiêu đề)</label>
                  <input type="text" value={editConfig.settings.footerCol2Title || ''} onChange={e => updateSetting('footerCol2Title', e.target.value)} style={inputStyle} />
                  <label style={{ marginTop: '1rem', display: 'block' }}>Cột Footer 2 (Links HTML)</label>
                  <div style={{ background: '#fff', color: '#000', borderRadius: '6px', overflow: 'hidden', marginTop: '0.5rem' }}>
                    <ReactQuill theme="snow" value={editConfig.settings.footerCol2HTML || ''} onChange={html => updateSetting('footerCol2HTML', html)} modules={modules} />
                  </div>
                </div>
              </div>
              <div>
                <label>Footer Text (Dưới cùng)</label>
                <input type="text" value={editConfig.settings.footerText || ''} onChange={e => updateSetting('footerText', e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label>Script hoặc Ảnh DMCA (Hiển thị cuối trang)</label>
                <textarea value={editConfig.settings.dmcaHTML || ''} onChange={e => updateSetting('dmcaHTML', e.target.value)} style={{...inputStyle, height: '80px', fontFamily: 'monospace', fontSize: '0.9rem'}} placeholder="<a href='#'><img src='...' alt='DMCA'/></a>" />
                <small style={{ color: 'var(--text-secondary)' }}>Nhập mã HTML nhúng logo DMCA tại đây.</small>
              </div>
            </div>
          </div>
          <div className="admin-field">
            <label>Khối Script Đo Lường (Google Analytics / Pixel)</label>
            <textarea value={editConfig.settings.scriptTags || ''} onChange={e => updateSetting('scriptTags', e.target.value)} style={{...inputStyle, height: '100px'}} />
            <small style={{ color: 'var(--text-secondary)' }}>Chỉ nhập các thẻ &lt;script&gt; hợp lệ</small>
          </div>
        </div>
      )}

      {activeTab === 'articles' && (
        <div>
          {articles.map((art) => (
            <div key={art.id} style={{ background: 'var(--panel-bg)', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', border: '1px solid var(--panel-border)' }}>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <input type="text" value={art.title} onChange={e => handleArticleFieldChange(art.id, 'title', e.target.value)} placeholder="Tựa đề bài viết" style={inputStyle} />
                  
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <select value={art.category_slug || ''} onChange={e => handleArticleFieldChange(art.id, 'category_slug', e.target.value)} style={{...inputStyle, flex: 1}}>
                      <option value="">-- Chọn danh mục --</option>
                      {categories.map(c => <option key={c.id} value={c.slug}>{c.name}</option>)}
                    </select>
                    <input type="date" value={art.date || new Date().toISOString().split('T')[0]} onChange={e => handleArticleFieldChange(art.id, 'date', e.target.value)} style={{...inputStyle, flex: 1}} />
                  </div>
                  
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input type="text" value={art.slug || ''} onChange={e => handleArticleFieldChange(art.id, 'slug', e.target.value)} placeholder="Đường dẫn (slug-bai-viet)" style={{...inputStyle, flex: 2}} />
                    <button onClick={() => handleArticleFieldChange(art.id, 'slug', generateSlug(art.title))} style={{ background: 'var(--accent-color)', color: 'white', border: 'none', borderRadius: '6px', padding: '0 1rem', cursor: 'pointer', flex: 1 }}>Tạo Slug từ Tựa đề</button>
                  </div>
                </div>
                <div style={{ width: '150px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                  {art.image_url ? (
                    <img src={`https://api.dagacpc.live${art.image_url}`} alt="Thumbnail" style={{ width: '100%', height: '80px', objectFit: 'cover', borderRadius: '4px' }} />
                  ) : (
                    <div style={{ width: '100%', height: '80px', background: 'var(--panel-border)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>Chưa có ảnh</div>
                  )}
                  <input type="file" accept="image/*" onChange={(e) => { if(e.target.files[0]) handleUploadImage(e.target.files[0], art.id) }} style={{ fontSize: '0.75rem', width: '100%' }} />
                </div>
              </div>
              <div style={{ background: '#fff', color: '#000', borderRadius: '6px', overflow: 'hidden', marginTop: '0.5rem' }}>
                <ReactQuill theme="snow" value={art.content} onChange={html => handleArticleFieldChange(art.id, 'content', html)} modules={modules} placeholder="Nội dung" />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button onClick={() => handleDeleteArticle(art.id)} style={{ padding: '0.5rem 1rem', background: '#ef4444', color: 'white', borderRadius: '4px', border: 'none', cursor: 'pointer' }}>Xóa</button>
                <button onClick={() => handleSaveArticle(art)} style={{ padding: '0.5rem 1rem', background: '#10b981', color: 'white', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>Lưu Bài Viết Này</button>
              </div>
            </div>
          ))}
          <button onClick={() => {
            setArticles([{ id: 'temp_' + Date.now(), title: '', content: '', date: new Date().toLocaleDateString(), category_slug: '', slug: '', image_url: '' }, ...articles]);
          }} style={{ background: 'var(--panel-bg)', color: 'var(--text-primary)', padding: '0.5rem 1rem', border: '1px dashed var(--panel-border)', cursor: 'pointer', borderRadius: '8px' }}>+ Thêm Bài Viết Mới</button>
        </div>
      )}

      {activeTab === 'categories' && (
        <div>
          {categories.map((cat) => (
            <div key={cat.id} style={{ background: 'var(--panel-bg)', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', display: 'flex', gap: '1rem', alignItems: 'center', border: '1px solid var(--panel-border)' }}>
              <input type="text" value={cat.name} onChange={e => handleCategoryFieldChange(cat.id, 'name', e.target.value)} placeholder="Tên danh mục" style={inputStyle} />
              <input type="text" value={cat.slug} onChange={e => handleCategoryFieldChange(cat.id, 'slug', e.target.value)} placeholder="slug-danh-muc" style={inputStyle} />
              <button onClick={() => handleCategoryFieldChange(cat.id, 'slug', generateSlug(cat.name))} style={{ background: 'var(--accent-color)', color: 'white', border: 'none', borderRadius: '6px', padding: '0.75rem', cursor: 'pointer', minWidth: '100px' }}>Tạo Slug</button>
              <button onClick={() => handleDeleteCategory(cat.id)} style={{ padding: '0.75rem 1rem', background: '#ef4444', color: 'white', borderRadius: '6px', border: 'none', cursor: 'pointer' }}>Xóa</button>
              <button onClick={() => handleSaveCategory(cat)} style={{ padding: '0.75rem 1rem', background: '#10b981', color: 'white', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>Lưu</button>
            </div>
          ))}
          <button onClick={() => {
            setCategories([...categories, { id: 'temp_' + Date.now(), name: '', slug: '' }]);
          }} style={{ background: 'var(--panel-bg)', color: 'var(--text-primary)', padding: '0.5rem 1rem', border: '1px dashed var(--panel-border)', cursor: 'pointer', borderRadius: '8px' }}>+ Thêm Danh Mục</button>
        </div>
      )}

      {activeTab === 'chat' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ background: 'var(--panel-bg)', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ color: '#ef4444' }}>Cảnh Báo: Khu vực kiểm duyệt</h3>
              <button onClick={clearChat} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>XÓA SẠCH MAIN CHAT</button>
            </div>
            <div style={{ height: '400px', overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {chatHistory.length === 0 ? <p style={{ color: 'var(--text-secondary)' }}>Kênh chat đang trống.</p> : null}
              {chatHistory.map((msg, i) => (
                <div key={i} style={{ padding: '0.5rem', background: 'var(--panel-bg)', border: '1px solid var(--panel-border)', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <strong style={{ color: 'var(--text-primary)' }}>{msg.lvl} - {msg.username}</strong>
                    <p style={{ color: 'var(--text-secondary)', margin: '0.25rem 0 0 0', wordBreak: 'break-all' }}>{msg.text}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => deleteMessage(msg.id)} style={{ background: 'transparent', color: 'orange', padding: '0.25rem 0.5rem', border: '1px solid orange', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}>Xóa T.Nhắn</button>
                    <button onClick={() => banUser(msg.username)} style={{ background: '#ef4444', color: 'white', padding: '0.25rem 0.5rem', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}>KHÓA TÀI KHOẢN</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ background: 'var(--panel-bg)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--panel-border)' }}>
             <h3 style={{ marginBottom: '1rem', color: 'var(--accent-color)' }}>Công cụ Bot Chat (Bơm tương tác ảo)</h3>
             <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
               <div>
                 <label style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Tên người dùng ảo</label>
                 <input type="text" value={fakeUsername} onChange={e => setFakeUsername(e.target.value)} style={inputStyle} placeholder="Ví dụ: Khach789" />
               </div>
               <div>
                 <label style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Cấp độ (Level)</label>
                 <input type="number" value={fakeLevel} onChange={e => setFakeLevel(e.target.value)} style={inputStyle} min="1" max="99" />
               </div>
             </div>
             <div>
               <label style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Nội dung tương tác</label>
               <input type="text" value={fakeText} onChange={e => setFakeText(e.target.value)} style={inputStyle} placeholder="Gõ câu nói ảo..." onKeyDown={(e) => { if (e.key === 'Enter') handleInjectFakeChat(); }} />
             </div>
             <button onClick={handleInjectFakeChat} style={{ marginTop: '1rem', background: '#10b981', color: 'white', padding: '0.75rem 2rem', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>
               🚀 Bơm Tin Nhắn Lên Kênh
             </button>
          </div>
          
          <div style={{ background: 'var(--panel-bg)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--panel-border)' }}>
             <h3 style={{ marginBottom: '1rem', color: 'var(--accent-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
               <input type="checkbox" checked={editConfig.settings.botEnabled || false} onChange={e => updateSetting('botEnabled', e.target.checked)} style={{ width: '20px', height: '20px' }} />
               Kích Hoạt Auto Bot (Chat Tự Động)
             </h3>
             <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
               <div>
                 <label style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Nghỉ Tối Thiểu (Giây)</label>
                 <input type="number" value={editConfig.settings.botMinDelay || 10} onChange={e => updateSetting('botMinDelay', e.target.value)} style={inputStyle} min="1" />
               </div>
               <div>
                 <label style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Nghỉ Tối Đa (Giây)</label>
                 <input type="number" value={editConfig.settings.botMaxDelay || 30} onChange={e => updateSetting('botMaxDelay', e.target.value)} style={inputStyle} min="2" />
               </div>
             </div>
             <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
               <div>
                 <label style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', display: 'block', marginBottom: '0.3rem' }}>
                   ❤️ Kịch Bản Duy Trì (Luồng Heartbeat) - <small>Nhắn ngẫu nhiên mỗi 30 giây</small>
                 </label>
                 <textarea 
                   value={editConfig.settings.botScriptHeartbeat || 'Chào anh em nha | Khach12 | 2\nNay đông vui quá | ThanhG | 3'} 
                   onChange={e => updateSetting('botScriptHeartbeat', e.target.value)} 
                   style={{ ...inputStyle, height: '80px', whiteSpace: 'pre-wrap' }} 
                   placeholder="Nhập 1 câu/dòng: Nội dung | Tên | Cấp độ"
                 />
               </div>
               <div>
                 <label style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', display: 'block', marginBottom: '0.3rem' }}>
                   💬 Kịch Bản Phân Tích (Luồng Burst) - <small>Nhắn liên tiếp 1-3 câu</small>
                 </label>
                 <textarea 
                   value={editConfig.settings.botScript || 'Gà đá hay quá anh em! | Khach01 | 3\nTuyệt vời | ĐamMêGà | 8'} 
                   onChange={e => updateSetting('botScript', e.target.value)} 
                   style={{ ...inputStyle, height: '120px', whiteSpace: 'pre-wrap' }} 
                   placeholder="Nhập 1 câu/dòng: Nội dung | Tên | Cấp độ"
                 />
               </div>
               <div>
                 <label style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', display: 'block', marginBottom: '0.3rem' }}>
                   🔥 Kịch Bản Cao Trào (Luồng Kickoff Wave) - <small>Cả đám đông nhảy vào spam nhanh</small>
                 </label>
                 <textarea 
                   value={editConfig.settings.botScriptKickoff || 'Vô mánh rồi | TàiPro | 5\nHay quá | GàXanh | 2\nChết nhe mày | DuyXuyên | 7\nĂn rồi | Khach | 1'} 
                   onChange={e => updateSetting('botScriptKickoff', e.target.value)} 
                   style={{ ...inputStyle, height: '100px', whiteSpace: 'pre-wrap' }} 
                   placeholder="Nhập 1 câu/dòng: Nội dung | Tên | Cấp độ"
                 />
               </div>
             </div>
             <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>* Hệ thống sẽ tự quản lý xáo trộn và kích hoạt các kịch bản này một cách ngẫu nhiên.</p>
          </div>
          
          <div style={{ background: 'var(--panel-bg)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--panel-border)' }}>
             <h3 style={{ marginBottom: '1rem', color: 'var(--accent-color)' }}>Thông tin ghim trên khung chat</h3>
             <input 
               type="text" 
               value={editConfig.settings.chatPinnedMessage || ''} 
               onChange={e => updateSetting('chatPinnedMessage', e.target.value)} 
               style={inputStyle} 
               placeholder="Nhập nội dung ghim (hỗ trợ HTML: <a href='...' target='_blank'>Link</a>)" 
             />
             <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
               <button onClick={handleSaveConfig} style={{ background: 'var(--accent-color)', color: 'white', padding: '0.5rem 1.5rem', borderRadius: '6px', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>
                 Lưu Cấu Hình Chat & Bot
               </button>
               {saveStatus && <span style={{ color: saveStatus.includes('Lỗi') ? '#ef4444' : '#10b981', fontWeight: 'bold' }}>{saveStatus}</span>}
             </div>
          </div>
        </div>
      )}

      {activeTab !== 'chat' && activeTab !== 'articles' && activeTab !== 'categories' && (
        <div style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid var(--panel-border)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={handleSaveConfig} style={{ background: 'var(--accent-color)', color: 'white', padding: '0.75rem 2rem', borderRadius: '8px', border: 'none', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer' }}>
            Lưu Toàn Bộ Cấu Hình
          </button>
          {saveStatus && <span style={{ color: saveStatus.includes('Lỗi') ? '#ef4444' : '#10b981', fontWeight: 'bold' }}>{saveStatus}</span>}
        </div>
      )}

    </div>
  );
}

const inputStyle = {
  width: '100%',
  padding: '0.75rem',
  background: 'var(--panel-bg)',
  border: '1px solid var(--panel-border)',
  borderRadius: '6px',
  color: 'var(--text-primary)',
  fontFamily: 'inherit'
};
