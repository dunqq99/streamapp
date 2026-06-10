import React, { useEffect, useRef } from 'react';
import Artplayer from 'artplayer';
import flvjs from 'flv.js';
import Hls from 'hls.js';

export default function ArtPlayerFLV({ url, getInstance, ...rest }) {
  const containerRef = useRef(null);

  useEffect(() => {
    let finalUrl = url;
    let finalType = url.includes('.m3u8') ? 'm3u8' : 'flv';
    
    // Bulletproof Apple (iOS/Mac Safari) detection
    const isAppleWebKit = /AppleWebKit/i.test(navigator.userAgent) && !/Chrome|Android/i.test(navigator.userAgent);
    const isIOSMobile = /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isCriOS = /CriOS/i.test(navigator.userAgent); // Chrome on iOS
    const isFxiOS = /FxiOS/i.test(navigator.userAgent); // Firefox on iOS
    
    if (finalType !== 'm3u8' && (isAppleWebKit || isIOSMobile || isCriOS || isFxiOS || !flvjs.isSupported())) {
      // url input is typically: https://api.dagacpc.live/live/main.flv?sign=XXX
      // We need it to be: https://api.dagacpc.live/api/hls/main/index.m3u8
      const urlWithoutSign = url.split('?')[0]; 
      finalUrl = urlWithoutSign.replace('/live/', '/api/hls/').replace('.flv', '/index.m3u8');
      finalType = 'm3u8';
    }

    const art = new Artplayer({
      container: containerRef.current,
      url: finalUrl,
      type: finalType,
      isLive: true,
      autoplay: true,
      muted: true,
      pip: true,
      fullscreen: true,
      setting: false,
      playsInline: true,
      theme: '#3b82f6', // modern blue
      customType: {
        flv: function (video, streamUrl, art) {
          if (flvjs.isSupported()) {
            const flvPlayer = flvjs.createPlayer({
              type: 'flv',
              isLive: true,
              url: streamUrl
            }, {
              enableWorker: false, // Must be false in Vite to prevent Webpack worker errors
              enableStashBuffer: false,
              stashInitialSize: 128,
              autoCleanupSourceBuffer: true,
              autoCleanupMaxBackwardDuration: 2 * 60,
              autoCleanupMinBackwardDuration: 1 * 60
            });
            flvPlayer.attachMediaElement(video);
            flvPlayer.load();
            
            art.flv = flvPlayer; // Attach to art instance for global access

            // Wait for player to be ready before playing to avoid DOM constraint errors
            art.on('ready', () => {
              art.play().catch(() => {
                art.notice.show = 'Chạm vào video để chạy!';
              });
            });

            art.on('destroy', () => flvPlayer.destroy());
          } else {
            console.error('FLV.js is not supported in this browser.');
            art.notice.show = 'Môi trường không hỗ trợ luồng FLV.';
          }
        },
        m3u8: function (video, streamUrl, art) {
          if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = streamUrl;
          } else if (Hls.isSupported()) {
            const hls = new Hls({
              liveSyncDurationCount: 2,
              maxLiveSyncPlaybackRate: 1.5,
              lowLatencyMode: true,
            });
            hls.loadSource(streamUrl);
            hls.attachMedia(video);
            art.hls = hls;
            art.on('destroy', () => hls.destroy());
          } else {
            console.error('HLS is not supported in this browser.');
            art.notice.show = 'Môi trường không hỗ trợ luồng HLS.';
          }

          video.addEventListener('loadedmetadata', () => {
            art.play().catch(() => {
              art.notice.show = 'Chạm vào màn hình để xem!';
            });
          }, { once: true });
        }
      },
    });

    if (getInstance) {
      getInstance(art);
    }

    // --- ANTI-BLOAT & LIVE SYNC LOGIC ---
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // User left the tab/minimized app
        if (art.flv) {
          // Xóa ống hút băng thông FLV, xả rỗng RAM đệm video
          art.flv.pause();
          art.flv.unload();
        } else {
          art.pause();
        }
      } else {
        // User returned to tab
        if (art.flv) {
          // Cắm lại ống hút từ Live mới nhất
          art.flv.load();
          art.play().catch(()=>{});
        } else {
          // Safari Native (iOS): Nhảy cóc đến khoảnh khắc Live hiện tại
          const video = art.template.$video;
          if (video && video.seekable && video.seekable.length > 0) {
            video.currentTime = video.seekable.end(video.seekable.length - 1);
          }
          art.play().catch(()=>{});
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      art.destroy(false);
    };
  }, [url]);

  return <div ref={containerRef} {...rest} />;
}
