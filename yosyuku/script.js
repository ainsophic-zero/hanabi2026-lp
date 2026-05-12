/**
 * 弥栄予祝会 in 銀座FEEEP — script.js
 * - ヘッダー透過
 * - IntersectionObserver フェードイン
 * - スムーススクロール
 * - カウントダウン
 * - カート：枚数 +/- / 合計更新 / Square チェックアウト POST
 */

// ── 日程の自動非表示（JST基準）────────────────────────────────
(function hideExpiredDates() {
  // JST 現在時刻
  const nowJST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));

  // 6/29 00:00 JST 以降: 6/28 関連を非表示
  const cutoff0628 = new Date('2026-06-29T00:00:00+09:00');
  if (nowJST >= cutoff0628) {
    // ヒーローの日付バッジ
    document.querySelector('.hero__date--0628')?.remove();
    document.querySelector('.hero__date-sep')?.remove();
    // カートの 6/28 行
    document.querySelector('.cart__row[data-ticket="0628"]')?.remove();
  }
})();

// ── ヘッダー スクロール ────────────────────────────────────────
const header = document.getElementById('header');
if (header) {
  window.addEventListener('scroll', () => {
    header.classList.toggle('is-scrolled', window.scrollY > 60);
  }, { passive: true });
}

// ── Reveal（IntersectionObserver）────────────────────────────
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('is-visible');
        observer.unobserve(e.target);
      }
    });
  },
  { threshold: 0.12 }
);
document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

// ── スムーススクロール ─────────────────────────────────────────
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const id = a.getAttribute('href').slice(1);
    const target = document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    const top = target.getBoundingClientRect().top + window.scrollY - 72;
    window.scrollTo({ top, behavior: 'smooth' });
  });
});

// ── カウントダウン ─────────────────────────────────────────────
function startCountdown(targetISO, elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const target = new Date(targetISO).getTime();

  function tick() {
    const diff = target - Date.now();
    if (diff <= 0) { el.textContent = '開催中！'; return; }
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    el.textContent =
      `${d}日 ${pad(h)}:${pad(m)}:${pad(s)}`;
  }
  function pad(n) { return String(n).padStart(2, '0'); }
  tick();
  setInterval(tick, 1000);
}

startCountdown('2026-06-28T19:00:00+09:00', 'countdown-0628');
startCountdown('2026-07-25T19:00:00+09:00', 'countdown-0725');

// ── カート ────────────────────────────────────────────────────
const UNIT_PRICE = 7700;

const submitBtn  = document.getElementById('cart-submit');
const submitText = document.getElementById('cart-submit-text');
const totalEl    = document.getElementById('cart-total');
const errorEl    = document.getElementById('cart-error');

// 数量を読む（.cart__qty-input の value）
function getQty(row) {
  const inp = row.querySelector('.cart__qty-input');
  return inp ? (parseInt(inp.value, 10) || 0) : 0;
}

// 数量を書く
function setQty(row, qty) {
  const inp = row.querySelector('.cart__qty-input');
  if (inp) inp.value = qty;
}

// 合計と CTA 状態を更新
function refreshCart() {
  let total = 0;
  const selected = []; // qty > 0 な ticketDate のリスト

  document.querySelectorAll('.cart__row[data-ticket]').forEach(row => {
    const qty = getQty(row);
    total += qty * UNIT_PRICE;
    if (qty > 0) selected.push(row.dataset.ticket);
  });

  if (totalEl) {
    totalEl.textContent = total > 0
      ? total.toLocaleString()
      : '0';
  }

  if (submitBtn) {
    if (selected.length === 0) {
      submitBtn.disabled = true;
      if (submitText) submitText.textContent = '日付と枚数を選択してください';
    } else if (selected.length === 1) {
      submitBtn.disabled = false;
      const label = selected[0] === '0628' ? '6月28日（土）' : '7月25日（金）';
      const qty   = getQty(document.querySelector(`.cart__row[data-ticket="${selected[0]}"]`));
      if (submitText) submitText.textContent = `${label} × ${qty}枚　カードで申し込む →`;
    } else {
      // 両日選択は非対応（別々に申し込んでもらう）
      submitBtn.disabled = true;
      if (submitText) submitText.textContent = '日程は1日ずつ、別々にお申込みください';
    }
  }

  // エラーメッセージ表示制御
  if (errorEl && selected.length > 1) {
    errorEl.textContent = '2日分ご参加の場合は、日程ごとに別々にお申込みください。';
    errorEl.hidden = false;
  } else if (errorEl) {
    errorEl.hidden = true;
    errorEl.textContent = '';
  }
}

// +/- ボタン
document.querySelectorAll('.cart__row[data-ticket]').forEach(row => {
  const plusBtn  = row.querySelector('[data-qty-plus]');
  const minusBtn = row.querySelector('[data-qty-minus]');

  if (plusBtn) {
    plusBtn.addEventListener('click', () => {
      const qty = getQty(row);
      setQty(row, Math.min(qty + 1, 20));
      refreshCart();
    });
  }
  if (minusBtn) {
    minusBtn.addEventListener('click', () => {
      const qty = getQty(row);
      setQty(row, Math.max(qty - 1, 0));
      refreshCart();
    });
  }
});

// 初期化
refreshCart();

// ── チェックアウト ─────────────────────────────────────────────
async function doCheckout() {
  // どちらの日付か確定
  let ticketDate = null;
  let qty = 0;

  document.querySelectorAll('.cart__row[data-ticket]').forEach(row => {
    const q = getQty(row);
    if (q > 0) { ticketDate = row.dataset.ticket; qty = q; }
  });

  if (!ticketDate || qty < 1) {
    showToast('日付と枚数を選択してください', 'warn');
    return;
  }

  if (submitBtn) { submitBtn.disabled = true; }
  if (submitText) { submitText.textContent = '決済ページへ移動中…'; }

  try {
    const res  = await fetch('/yosyuku/api/checkout', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ ticketDate, qty }),
    });
    const data = await res.json();

    if (data.success && data.url) {
      window.location.href = data.url;
    } else {
      showToast(data.error || '決済リンクの作成に失敗しました。時間を置いて再度お試しください。', 'error');
      refreshCart(); // ボタンを復元
    }
  } catch {
    showToast('通信エラーが発生しました。ネットワーク接続をご確認ください。', 'error');
    refreshCart();
  }
}

if (submitBtn) {
  submitBtn.addEventListener('click', doCheckout);
}

// ── トースト通知 ───────────────────────────────────────────────
function showToast(text, type = 'info') {
  const prev = document.getElementById('__toast');
  if (prev) prev.remove();

  const el = document.createElement('div');
  el.id = '__toast';
  el.textContent = text;
  el.style.cssText = [
    'position:fixed;bottom:24px;left:50%;transform:translateX(-50%)',
    `background:${type === 'error' ? '#dc2626' : type === 'warn' ? '#d97706' : '#166534'}`,
    'color:#fff;padding:12px 24px;border-radius:8px;font-size:14px;z-index:9999',
    'max-width:90vw;text-align:center;box-shadow:0 4px 16px rgba(0,0,0,.45)',
    'animation:__fadeIn .2s ease',
  ].join(';');

  if (!document.getElementById('__toast-style')) {
    const s = document.createElement('style');
    s.id = '__toast-style';
    s.textContent =
      '@keyframes __fadeIn{from{opacity:0;transform:translateX(-50%) translateY(8px)}' +
      'to{opacity:1;transform:translateX(-50%) translateY(0)}}';
    document.head.appendChild(s);
  }

  document.body.appendChild(el);
  setTimeout(() => el.remove(), 5000);
}
