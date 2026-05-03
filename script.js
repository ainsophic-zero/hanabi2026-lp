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

    // カート内の価格スパン切替
    document.querySelectorAll('[data-price-early]').forEach(el => {
      el.hidden = isRegular;
    });
    document.querySelectorAll('[data-price-regular]').forEach(el => {
      el.hidden = !isRegular;
    });
  }
  applyPricingMode();
  // 日をまたいだ場合に備えて1時間ごとに再チェック
  setInterval(applyPricingMode, 3_600_000);

  /* ----- 7. カート（複数アイテムまとめ決済）----- */
  function setupCart() {
    const cart = document.querySelector('.cart');
    if (!cart) return;

    const totalEl = document.getElementById('cart-total');
    const submitBtn = document.getElementById('cart-submit');
    const submitText = document.getElementById('cart-submit-text');
    const errorEl = document.getElementById('cart-error');

    function isRegularPricing() {
      const nowJST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
      return nowJST >= new Date('2026-08-01T00:00:00+09:00');
    }

    function getQty(row) {
      return parseInt(row.querySelector('.cart__qty-input')?.value || '0', 10) || 0;
    }
    function setQty(row, val) {
      const input = row.querySelector('.cart__qty-input');
      if (!input) return;
      const v = Math.max(0, Math.min(50, val | 0));
      input.value = v;
    }

    function getRowPrice(row) {
      const isRegular = isRegularPricing();
      const earlyEl = row.querySelector('[data-price-early]');
      const regEl = row.querySelector('[data-price-regular]');
      const useEl = isRegular && regEl ? regEl : earlyEl;
      return useEl ? parseInt(useEl.textContent.replace(/[^\d]/g, ''), 10) || 0 : 0;
    }

    function recompute() {
      let total = 0;
      let totalQty = 0;
      cart.querySelectorAll('.cart__row').forEach(row => {
        const qty = getQty(row);
        const price = getRowPrice(row);
        total += qty * price;
        totalQty += qty;
      });
      if (totalEl) totalEl.textContent = total.toLocaleString('ja-JP');
      if (total > 0) {
        submitBtn.disabled = false;
        submitText.textContent = `${total.toLocaleString('ja-JP')}円を決済する（${totalQty}名分）`;
      } else {
        submitBtn.disabled = true;
        submitText.textContent = '数量を選択してください';
      }
    }

    // ＋／−ボタン & 直接入力
    cart.querySelectorAll('.cart__row').forEach(row => {
      const minus = row.querySelector('[data-qty-minus]');
      const plus = row.querySelector('[data-qty-plus]');
      const input = row.querySelector('.cart__qty-input');
      if (minus) minus.addEventListener('click', () => { setQty(row, getQty(row) - 1); recompute(); });
      if (plus)  plus.addEventListener('click',  () => { setQty(row, getQty(row) + 1); recompute(); });
      if (input) input.addEventListener('input', () => { setQty(row, parseInt(input.value, 10) || 0); recompute(); });
    });

    // 決済へ進む
    submitBtn.addEventListener('click', async () => {
      const items = [];
      cart.querySelectorAll('.cart__row').forEach(row => {
        const qty = getQty(row);
        const courseId = row.dataset.course;
        if (qty > 0 && courseId && courseId !== 'kid-infant') {
          items.push({ courseId, qty });
        }
      });
      if (items.length === 0) return;

      submitBtn.disabled = true;
      submitText.textContent = '決済リンクを生成中…';
      if (errorEl) { errorEl.hidden = true; errorEl.textContent = ''; }

      try {
        const res = await fetch('/api/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items }),
        });
        const data = await res.json();
        if (data.success && data.url) {
          window.location.href = data.url;
        } else {
          throw new Error(data.error || '決済リンクの生成に失敗しました');
        }
      } catch (err) {
        if (errorEl) {
          errorEl.hidden = false;
          errorEl.textContent = `エラー: ${err.message}。お手数ですが少し時間をおいて再度お試しください。`;
        }
        submitBtn.disabled = false;
        recompute();
      }
    });

    recompute();
  }
  setupCart();

  /* ----- 8. 寄付応援カート ----- */
  function setupDonation() {
    const input = document.getElementById('donation-amount');
    const submit = document.getElementById('donation-submit');
    const submitText = document.getElementById('donation-submit-text');
    const error = document.getElementById('donation-error');
    const presets = document.querySelectorAll('.donation__preset');
    if (!input || !submit) return;

    const MIN = 100;
    const MAX = 1000000;

    function clearPresetSelection() {
      presets.forEach(b => b.classList.remove('is-selected'));
    }

    function recompute() {
      const amt = parseInt(input.value, 10) || 0;
      if (amt >= MIN && amt <= MAX) {
        submit.disabled = false;
        submitText.textContent = `${amt.toLocaleString('ja-JP')}円を寄付して応援する`;
      } else {
        submit.disabled = true;
        submitText.textContent = '金額を選択してください';
      }
    }

    presets.forEach(btn => {
      btn.addEventListener('click', () => {
        const amt = parseInt(btn.dataset.amount, 10);
        input.value = amt;
        clearPresetSelection();
        btn.classList.add('is-selected');
        recompute();
      });
    });

    input.addEventListener('input', () => {
      // ユーザー直接入力ならプリセット選択を解除
      clearPresetSelection();
      // プリセット値と一致したら見た目選択状態に
      const v = parseInt(input.value, 10);
      presets.forEach(b => {
        if (parseInt(b.dataset.amount, 10) === v) b.classList.add('is-selected');
      });
      recompute();
    });

    submit.addEventListener('click', async () => {
      const amt = parseInt(input.value, 10) || 0;
      if (amt < MIN) return;

      submit.disabled = true;
      submitText.textContent = '決済リンクを生成中…';
      if (error) { error.hidden = true; error.textContent = ''; }

      try {
        const res = await fetch('/api/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ donation: { amount: amt } }),
        });
        const data = await res.json();
        if (data.success && data.url) {
          window.location.href = data.url;
        } else {
          throw new Error(data.error || '決済リンクの生成に失敗しました');
        }
      } catch (err) {
        if (error) {
          error.hidden = false;
          error.textContent = `エラー: ${err.message}。お時間をおいて再度お試しください。`;
        }
        submit.disabled = false;
        recompute();
      }
    });

    recompute();
  }
  setupDonation();

})();
