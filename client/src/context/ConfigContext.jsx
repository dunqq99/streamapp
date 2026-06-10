import React, { createContext, useState, useEffect } from 'react';

export const ConfigContext = createContext(null);

export const ConfigProvider = ({ children }) => {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchConfig = async () => {
    try {
      const res = await fetch('https://api.dagacpc.live/api/config');
      const json = await res.json();
      if (json.success) {
        setConfig(json.data);
      }
    } catch (err) {
      console.error('Failed to load config:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const refreshConfig = () => {
    return fetchConfig();
  };

  // If loading, we could return a spinner, but it's better to just return children with null config so UI doesn't bounce.
  return (
    <ConfigContext.Provider value={{ config, loading, refreshConfig }}>
      {children}
    </ConfigContext.Provider>
  );
};
