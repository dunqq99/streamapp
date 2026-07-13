import React, { useState, useEffect, useContext, Suspense, lazy } from 'react';
import { useParams } from 'react-router-dom';
import { ConfigContext } from '../context/ConfigContext';
import { apiUrl, getApiBaseUrl } from '../lib/api';
import EmbedPlayer from '../components/EmbedPlayer';

// Lazy load heavy video player libraries (Artplayer + FLV.js) to slash chunk size and fix 710ms TBT
const ArtPlayerFLV = lazy(() => import('../components/ArtPlayerFLV'));
// Lazy load chat to defer Socket.io and Emoji logic from Main Thread during critical path
const LiveCommentSection = lazy(() => import('../components/LiveCommentSection'));

function getChannelData(slug, seoDictionary) {
  if (!slug || slug.toLowerCase() === 'home') {
    return seoDictionary?.['HOME'] || {
      title: 'Đá Gà Trực Tiếp - Trực Tiếp Đá Gà Thomo',
      h2: 'Xem Trực Tiếp Đá Gà Tốc Độ Cao Tại DagaCPC.Live',
      metaTitle: 'Đá Gà Trực Tiếp - Xem Đá Gà Thomo Hôm Nay DagaCPC.Live',
      metaDesc: 'Xem trực tiếp đá gà Thomo mới nhất hôm nay. Tường thuật đá gà cpc1, cpc2, cpc3, cpc4 cực nét, không giật lag.',
      p1: 'Chào mừng bạn đến với <strong>dagacpc.live</strong> - Kênh xem <strong>đá gà trực tiếp</strong> uy tín và chất lượng cao nhất hiện nay...',
      p2: 'Theo dõi bảng tỷ số, lịch thi đấu SV388...'
    };
  }

  const match = slug?.match(/^truc-tiep-da-ga-(cpc[1-6])$/i);
  if (match) {
    const name = match[1].toUpperCase();
    if (seoDictionary && seoDictionary[name]) {
      return seoDictionary[name];
    }
  }
  return {
    title: 'Đá Gà Trực Tiếp - Trực Tiếp Đá Gà Thomo',
    h2: 'Xem Trực Tiếp Đá Gà Tốc Độ Cao Tại DagaCPC.Live',
    metaTitle: 'Đá Gà Trực Tiếp - Xem Đá Gà Thomo Hôm Nay DagaCPC.Live',
    metaDesc: 'Xem trực tiếp đá gà Thomo mới nhất hôm nay. Tường thuật đá gà cpc1, cpc2, cpc3, cpc4 cực nét, không giật lag.',
    p1: 'Chào mừng bạn đến với <strong>dagacpc.live</strong> - Kênh xem <strong>đá gà trực tiếp</strong> uy tín và chất lượng cao nhất hiện nay. Chúng tôi liên tục phát sóng <strong>trực tiếp đá gà Thomo</strong> từ các bồ gà danh tiếng như: <strong>đá gà cpc1, cpc2, cpc3, cpc4</strong>. Đi kèm công nghệ truyền tải hiện đại, đảm bảo mang đến những trận <strong>đá gà</strong> nhãn mãn, đường truyền ổn định siêu mượt.',
    p2: 'Theo dõi bảng tỷ số, lịch thi đấu SV388 và trao đổi cùng hàng ngàn sư kê đam mê <strong>trực tiếp đá gà cpc</strong> qua hệ thống Live Chat. Đừng quên truy cập trang chủ <em>dagacpc.live</em> mỗi ngày để đón xem những giải đấu gà kinh điển nóng hổi nhất!'
  };
}

export default function LiveStreamPage() {
  const { channelSlug, slug } = useParams();
  const finalSlug = channelSlug || slug;
  const { config } = useContext(ConfigContext);
  
  const seoData = getChannelData(finalSlug, config?.seoDictionary);

  const [streamUrl, setStreamUrl] = useState(null);
  const [streamFormat, setStreamFormat] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    document.title = seoData.metaTitle;
    let metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute('content', seoData.metaDesc);
    } else {
      metaDesc = document.createElement('meta');
      metaDesc.name = "description";
      metaDesc.content = seoData.metaDesc;
      document.head.appendChild(metaDesc);
    }

    // Dynamic JSON-LD LiveStream Schema
    let schemaScript = document.getElementById('seo-livestream-schema');
    if (!schemaScript) {
      schemaScript = document.createElement('script');
      schemaScript.id = 'seo-livestream-schema';
      schemaScript.type = 'application/ld+json';
      document.head.appendChild(schemaScript);
    }
    
    const liveSchema = {
      "@context": "https://schema.org",
      "@type": "VideoObject",
      "name": seoData.title || "Xem Trực Tiếp Đá Gà Thomo Hôm Nay",
      "description": seoData.metaDesc || "Xem trực tiếp đá gà Thomo mới nhất hôm nay. CPC1, CPC2, CPC3, CPC4 cực nét, không giật lag.",
      "thumbnailUrl": [
        apiUrl('/favicon.svg')
      ],
      "uploadDate": new Date().toISOString(),
      "contentUrl": window.location.href,
      "embedUrl": window.location.href,
      "interactionStatistic": {
        "@type": "InteractionCounter",
        "interactionType": { "@type": "WatchAction" },
        "userInteractionCount": 14520
      },
      "publication": {
        "@type": "BroadcastEvent",
        "isLiveBroadcast": true,
        "startDate": new Date().toISOString(),
        "endDate": new Date(Date.now() + 8 * 3600000).toISOString()
      }
    };
    schemaScript.textContent = JSON.stringify(liveSchema);

    // Cleanup Schema on unmount
    return () => {
      const schemaScript = document.getElementById('seo-livestream-schema');
      if (schemaScript) {
        schemaScript.remove();
      }
    };
  }, [seoData]);

  useEffect(() => {
    // A11y patch for Artplayer internal elements Lighthouse score
    const timer = setTimeout(() => {
      const elements = document.querySelectorAll('.art-control, .art-icon');
      elements.forEach(el => {
        if (el.hasAttribute('aria-label') && !el.hasAttribute('role')) {
           el.setAttribute('role', 'button'); 
        }
      });
    }, 2000);
    return () => clearTimeout(timer);
  }, [streamUrl]);

  useEffect(() => {
    const fetchToken = async () => {
      try {
        const apiBaseUrl = getApiBaseUrl();
        const streamName = import.meta.env.VITE_HLS_STREAM_NAME || 'main';
        const playerMode = (import.meta.env.VITE_STREAM_FORMAT || 'flv').toLowerCase();
        setStreamFormat(playerMode);

        if (playerMode === 'iframe') {
          const embedUrl = import.meta.env.VITE_EMBED_URL || '';
          if (embedUrl) {
            setStreamUrl(embedUrl);
            return;
          }
          setError(true);
          return;
        }

        if (playerMode === 'hls') {
          const hlsUrl = import.meta.env.VITE_HLS_STREAM_URL || `${apiBaseUrl}/api/hls/${streamName}/index.m3u8`;
          setStreamUrl(hlsUrl);
          return;
        }

        // Fetch dynamic signature
        const res = await fetch(`${apiBaseUrl}/api/stream/token`);
        const data = await res.json();
        
        if (data.success) {
          const baseUrl = import.meta.env.VITE_FLV_STREAM_URL || `${apiBaseUrl}/live/${streamName}.flv`;
          setStreamUrl(`${baseUrl}?sign=${data.sign}`);
        } else {
          setError(true);
        }
      } catch (err) {
        console.error("Token fetch fail:", err);
        setError(true);
      }
    };
    
    fetchToken();
  }, []);

  return (
    <div className="live-stream-container">
      <div className="live-header">
        <div className="live-header-content">
          <h1>{seoData.title}</h1>
          <p>{seoData.metaDesc}</p>
        </div>
      </div>
      <div className="live-content">
        <div className="player-column">
          <div className="player-wrapper">
            {!streamUrl && !error && (
              <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                Đang liên kết luồng bảo mật...
              </div>
            )}
            {error && (
              <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
                Không thể tải mã bảo vệ luồng xem.
              </div>
            )}
            {streamUrl && (
              streamFormat === 'iframe' ? (
                <EmbedPlayer
                  url={streamUrl}
                  title={seoData.title}
                  className="player-instance"
                />
              ) : (
                <Suspense fallback={
                  <div style={{ display: 'flex', height: '100%', width: '100%', alignItems: 'center', justifyContent: 'center', background: 'var(--panel-bg)'}}>
                    <div className="pulse-circle"></div>
                  </div>
                }>
                  <ArtPlayerFLV 
                    url={streamUrl} 
                    className="player-instance"
                  />
                </Suspense>
              )
            )}
          </div>
          <div className="action-buttons-wrapper">
            <a href={config?.settings?.vaoCayGaLink || "#"} target="_blank" className="action-btn btn-register-action" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Vào Cây Gà</a>
            <a href={config?.settings?.lienHeLink || "#"} target="_blank" className="action-btn btn-contact-action" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Liên Hệ CSKH</a>
            {streamFormat === 'iframe' && streamUrl && (
              <a href={streamUrl} target="_blank" rel="noopener noreferrer" className="action-btn btn-open-player" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Mở Video</a>
            )}
          </div>
        </div>
        <div className="chat-wrapper">
          <Suspense fallback={
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '1rem', gap: '1rem'}}>
              <div style={{ height: '2rem', background: 'var(--panel-border)', borderRadius: '4px', animation: 'pulse 1.5s infinite ease-in-out' }}></div>
              <div style={{ flex: 1, background: 'var(--panel-border)', borderRadius: '4px', opacity: 0.5, animation: 'pulse 1.5s infinite ease-in-out' }}></div>
              <div style={{ height: '3rem', background: 'var(--panel-border)', borderRadius: '8px', animation: 'pulse 1.5s infinite ease-in-out' }}></div>
            </div>
          }>
            <LiveCommentSection />
          </Suspense>
        </div>
      </div>

      <div className="seo-content" style={{ marginTop: '2rem', padding: '2rem', background: 'var(--panel-bg)', borderRadius: '16px', border: '1px solid var(--panel-border)' }}>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: 'var(--accent-color)' }}>{seoData.h2}</h2>
        <div style={{ marginBottom: '1rem', lineHeight: '1.6', color: 'var(--text-secondary)', overflow: 'hidden' }} dangerouslySetInnerHTML={{ __html: seoData.p1 }} className="quill-content-inject" />
        <div style={{ lineHeight: '1.6', color: 'var(--text-secondary)', overflow: 'hidden' }} dangerouslySetInnerHTML={{ __html: seoData.p2 }} className="quill-content-inject" />
      </div>
    </div>
  );
}
