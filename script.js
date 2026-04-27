/* =========================================================
   カンボジア花火2026 LP - script.js
   依存なし。軽量インタラクションのみ。
   ========================================================= */

(() => {
  'use strict';

  /* ----- 1. ヘッダー：スクロールで濃色化 ----- */
  const header = document.getElementById('header');
  const onScroll = () => {
    if (!header) return;
    if (window.scrollY > 30) header.classList.add('is-scrolled');
    else header.classList.remove('is-scrolled');
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ----- 2. カウントダウン（2026/11/07 18:00 ICT = UTC+7） ----- */
  const target = new Date('2026-11-07T18:00:00+07:00').getTime();
  const cd = {
    d: document.querySelector('[data-cd="d"]'),
    h: document.querySelector('[data-cd="h"]'),
    m: document.querySelector('[data-cd="m"]'),
    s: document.querySelector('[data-cd="s"]'),
  };
  const pad = (n) => String(Math.max(0, n)).padStart(2, '0');
  const tick = () => {
    if (!cd.d) return;
    const diff = target - Date.now();
    if (diff <= 0) {
      cd.d.textContent = '00';
      cd.h.textContent = '00';
      cd.m.textContent = '00';
      cd.s.textContent = '00';
      return;
    }
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const mins = Math.floor((diff / (1000 * 60)) % 60);
    const secs = Math.floor((diff / 1000) % 60);
    cd.d.textContent = pad(days);
    cd.h.textContent = pad(hours);
    cd.m.textContent = pad(mins);
    cd.s.textContent = pad(secs);
  };
  tick();
  setInterval(tick, 1000);

  /* ----- 3. IntersectionObserverでフェードイン ----- */
  const reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('is-visible');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -10% 0px' });
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('is-visible'));
  }

  /* ----- 4. FAQアコーディオン ----- */
  const qs = document.querySelectorAll('.faq__q');
  qs.forEach((q) => {
    const a = q.nextElementSibling;
    q.addEventListener('click', () => {
      const isOpen = q.getAttribute('aria-expanded') === 'true';
      q.setAttribute('aria-expanded', String(!isOpen));
      if (!isOpen) {
        a.style.maxHeight = a.scrollHeight + 'px';
      } else {
        a.style.maxHeight = '0px';
      }
    });
  });

  /* ----- 5. スムーススクロール（ヘッダー高さ補正） ----- */
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const href = a.getAttribute('href');
      if (!href || href === '#') return;
      const target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      const headerH = header ? header.offsetHeight : 0;
      const top = target.getBoundingClientRect().top + window.scrollY - headerH + 1;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });

  /* ----- 6. 早期申込 ↔ 通常料金 自動切り替え（JST 2026/8/1 00:00 〜）----- */
  // [data-early]   = 早期申込専用の要素（〜7月末：表示 / 8月以降：非表示）
  // [data-regular] = 通常料金専用の要素（〜7月末：非表示 / 8月以降：表示）
  function applyPricingMode() {
    const nowJST   = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
    const cutoff   = new Date('2026-08-01T00:00:00+09:00');
    const isRegular = nowJST >= cutoff;

    // 早期要素：8月以降は非表示
    document.querySelectorAll('[data-early]').forEach(el => {
      el.style.display = isRegular ? 'none' : '';
    });

    // 通常要素：8月以降に表示 ＆ ボタンを Primary に昇格
    document.querySelectorAll('[data-regular]').forEach(el => {
      el.style.display = isRegular ? '' : 'none';
      if (isRegular) {
        el.classList.remove('btn--ghost');
        el.classList.add('btn--primary');
      }
    });
  }
  applyPricingMode();
  // 日をまたいだ場合に備えて1時間ごとに再チェック
  setInterval(applyPricingMode, 3_600_000);

})();
