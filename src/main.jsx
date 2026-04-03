import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import OlivierApp from '../component.jsx';
import './index.css';

function shouldLoadTelegramWebAppScript() {
  if (typeof window === 'undefined') return false;
  const h = window.location.hash || '';
  const s = window.location.search || '';
  if (h.includes('tgWebAppData') || s.includes('tgWebAppData')) return true;
  try {
    return /Telegram/i.test(navigator.userAgent || '');
  } catch {
    return false;
  }
}

/** В PWA без VPN не грузим telegram.org — иначе скрипт может повесить старт. В Mini App — по UA/hash. */
function loadTelegramWebAppScript() {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve();
      return;
    }
    if (!shouldLoadTelegramWebAppScript()) {
      resolve();
      return;
    }
    if (window.Telegram?.WebApp) {
      resolve();
      return;
    }
    const existing = document.querySelector('script[data-olivier-telegram-webapp]');
    if (existing) {
      const done = () => resolve();
      existing.addEventListener('load', done, { once: true });
      existing.addEventListener('error', done, { once: true });
      return;
    }
    const t = window.setTimeout(() => resolve(), 8000);
    const sc = document.createElement('script');
    sc.src = 'https://telegram.org/js/telegram-web-app.js';
    sc.async = true;
    sc.defer = true;
    sc.dataset.olivierTelegramWebapp = '1';
    sc.onload = () => {
      window.clearTimeout(t);
      resolve();
    };
    sc.onerror = () => {
      window.clearTimeout(t);
      resolve();
    };
    document.head.appendChild(sc);
  });
}

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

loadTelegramWebAppScript().then(() => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <Root />
    </React.StrictMode>
  );
});

