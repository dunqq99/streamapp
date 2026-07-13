import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

export default function HlsVideoPlayer({ url, className = '', ...rest }) {
  const videoRef = useRef(null);
  const [message, setMessage] = useState('Dang tai luong live...');

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !url) return undefined;

    let hls;
    let destroyed = false;

    const play = () => {
      if (destroyed) return;
      video.muted = true;
      video.play().then(() => setMessage('')).catch(() => {
        setMessage('Bam nut play de xem live');
      });
    };

    const jumpToLive = () => {
      if (video.seekable && video.seekable.length > 0) {
        video.currentTime = video.seekable.end(video.seekable.length - 1);
      }
    };

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url;
      video.addEventListener('loadedmetadata', jumpToLive, { once: true });
      video.addEventListener('canplay', play, { once: true });
    } else if (Hls.isSupported()) {
      hls = new Hls({
        liveSyncDurationCount: 2,
        maxLiveSyncPlaybackRate: 1.5,
        lowLatencyMode: true,
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data?.fatal) {
          setMessage('Khong tai duoc luong HLS');
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
        }
      });

      hls.on(Hls.Events.MANIFEST_PARSED, play);
      hls.attachMedia(video);
      hls.loadSource(url);
    } else {
      setMessage('Trinh duyet khong ho tro HLS');
    }

    const handleVisibility = () => {
      if (!document.hidden) {
        jumpToLive();
        play();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      destroyed = true;
      document.removeEventListener('visibilitychange', handleVisibility);
      if (hls) hls.destroy();
      video.removeAttribute('src');
      video.load();
    };
  }, [url]);

  return (
    <div className={className} style={{ position: 'relative', width: '100%', height: '100%', background: '#000' }} {...rest}>
      <video
        ref={videoRef}
        controls
        muted
        autoPlay
        playsInline
        preload="auto"
        style={{ width: '100%', height: '100%', display: 'block', background: '#000' }}
      />
      {message && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontWeight: 700,
          background: 'rgba(0,0,0,0.35)',
          pointerEvents: 'none',
        }}>
          {message}
        </div>
      )}
    </div>
  );
}
