import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import OlivierApp from '../component.jsx';

const Root = () => {
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    const inMiniApp =
      tg &&
      (tg.initDataUnsafe?.user != null || String(tg.initData || '').trim() !== '');
    if (!inMiniApp) return;

    tg.ready();
    tg.expand();
    if (typeof tg.disableVerticalSwipes === 'function') {
      tg.disableVerticalSwipes();
    }

    if (tg.backgroundColor) {
      document.body.style.backgroundColor = tg.backgroundColor;
    } else {
      document.body.style.backgroundColor = '#f3f4f6';
    }
  }, []);

  return <OlivierApp />;
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);

