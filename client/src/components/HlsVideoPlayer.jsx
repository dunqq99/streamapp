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

    const getLiveEdge = () => {
      if (hls && Number.isFinite(hls.liveSyncPosition)) {
        return hls.liveSyncPosition;
      }

      if (video.seekable && video.seekable.length > 0) {
        return video.seekable.end(video.seekable.length - 1);
      }

      return null;
    };

    const jumpToLive = (force = false) => {
      const liveEdge = getLiveEdge();
      if (!Number.isFinite(liveEdge)) return;

      const target = Math.max(0, liveEdge - 0.25);
      const drift = Math.abs(target - video.currentTime);
      if (force || drift > 2) {
        video.currentTime = target;
      }
    };

    const play = (syncToLive = true) => {
      if (destroyed) return;
      video.muted = true;
      if (syncToLive) jumpToLive(true);
      video.play().then(() => setMessage('')).catch(() => {
        setMessage('Bam nut play de xem live');
      });
    };

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url;
      video.addEventListener('loadedmetadata', jumpToLive, { once: true });
      video.addEventListener('canplay', () => play(true), { once: true });
    } else if (Hls.isSupported()) {
      hls = new Hls({
        liveSyncDurationCount: 2,
        maxLiveSyncPlaybackRate: 1.5,
        lowLatencyMode: true,
        liveDurationInfinity: true,
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data?.fatal) {
          setMessage('Khong tai duoc luong HLS');
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
        }
      });

      hls.on(Hls.Events.MANIFEST_PARSED, () => play(true));
      hls.on(Hls.Events.LEVEL_UPDATED, () => {
        if (!video.paused) jumpToLive(false);
      });
      hls.attachMedia(video);
      hls.loadSource(url);
    } else {
      setMessage('Trinh duyet khong ho tro HLS');
    }

    const handlePlay = () => jumpToLive(true);
    const handleVisibility = () => {
      if (!document.hidden) {
        jumpToLive(true);
        play(false);
      }
    };
    video.addEventListener('play', handlePlay);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      destroyed = true;
      video.removeEventListener('play', handlePlay);
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
