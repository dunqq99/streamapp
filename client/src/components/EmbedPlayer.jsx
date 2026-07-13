import React from 'react';

export default function EmbedPlayer({ url, title = 'Video stream', ...rest }) {
  return (
    <iframe
      src={url}
      title={title}
      frameBorder="0"
      scrolling="0"
      allowFullScreen
      style={{ width: '100%', height: '100%', border: '0', display: 'block', background: '#000' }}
      {...rest}
    />
  );
}
