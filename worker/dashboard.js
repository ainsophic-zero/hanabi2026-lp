/**
 * カンボジア花火2026 ダッシュボード Worker
 * Basic Auth: admin:hanabi
 *
 * Cloudflare Secrets:
 *   SQUARE_ACCESS_TOKEN  - Square 本番アクセストークン
 *
 * KV Binding: HANABI_KV (namespace: hanabi2026-manual-entries)
 *   Key "manual_entries" → JSON array of manual bank-transfer rows
 */

const LOCATION_ID = 'LDF0BDGH0XHPJ';
const SQUARE_API  = 'https://connect.squareup.com/v2';
const PASSWORD    = 'hanabi';
const HANABI_TAG  = 'カンボジア花火2026';   // Line item名フィルタ
const LINE_URL    = 'https://line.me/ti/g/ea9AdppvxE';
const REDIRECT_URL = 'https://hanabi2026.agsymphony.net/thanks.html';

// ── コース定義（サーバー側で価格を保持。クライアント送信値は信用しない）─
// 早期/通常の判定はサーバー側で日付チェック（JST 2026-08-01）
const COURSE_CATALOG = {
  'basic':       { label: 'カンボジア花火2026｜基本コース（村日帰り）',         early: 150000, regular: 175000 },
  'well':        { label: 'カンボジア花火2026｜井戸掘り・村宿泊コース',          early: 180000, regular: 200000 },
  'kid-elem':    { label: 'カンボジア花火2026｜小中学生',                          early: 110000, regular: 110000 },
  'kid-pre':     { label: 'カンボジア花火2026｜未就学児',                          early: 55000,  regular: 55000  },
  'kid-infant':  { label: 'カンボジア花火2026｜2歳未満（食事・席なし）',           early: 0,      regular: 0      },
};

function isRegularPricing() {
  // JST で 2026-08-01 00:00 以降は通常料金
  const cutoff = Date.UTC(2026, 7, 1) - 9 * 60 * 60 * 1000; // JST=UTC+9
  return Date.now() >= cutoff;
}

// ── コース名の整形 ────────────────────────────────────────────
const COURSE_MAP = {
  '基本コース（村日帰り）早期': { label: '基本コース｜早期', badge: '🌅 BASIC 早期', color: '#F5C451' },
  '基本コース（村日帰り）通常': { label: '基本コース｜通常', badge: '🌅 BASIC',      color: '#C9CFE2' },
  '井戸掘り・村宿泊コース早期': { label: '井戸掘り｜早期',   badge: '🌊 WELL 早期',  color: '#F5C451' },
  '井戸掘り・村宿泊コース通常': { label: '井戸掘り｜通常',   badge: '🌊 WELL',       color: '#C9CFE2' },
  '小中学生':   { label: '小中学生',       badge: '👦 小中学生',   color: '#86efac' },
  '未就学児':   { label: '未就学児',       badge: '👶 未就学児',   color: '#86efac' },
};
function parseCourse(name) {
  const clean = name.replace(/^カンボジア花火2026[｜|]/, '').trim();
  for (const [key, val] of Object.entries(COURSE_MAP)) {
    if (clean.includes(key.replace(/\s/g, ''))) return { ...val, raw: clean };
  }
  return { label: clean, badge: clean, color: '#8C95B7', raw: clean };
}

// ── Square API helper ─────────────────────────────────────────
async function sq(path, method = 'GET', body = null, token) {
  const r = await fetch(`${SQUARE_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Square-Version': '2025-01-23',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return r.json();
}

// ── Basic Auth ────────────────────────────────────────────────
function unauthorized() {
  return new Response('要認証', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="花火ダッシュボード"',
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}
function checkAuth(request) {
  const h = request.headers.get('Authorization') || '';
  if (!h.startsWith('Basic ')) return false;
  try {
    const decoded = atob(h.slice(6));
    const pass = decoded.includes(':') ? decoded.split(':').slice(1).join(':') : decoded;
    return pass === PASSWORD;
  } catch { return false; }
}

// ── KV helpers ────────────────────────────────────────────────
async function getManual(kv) {
  const raw = await kv.get('manual_entries');
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}
async function putManual(kv, entries) {
  await kv.put('manual_entries', JSON.stringify(entries));
}

// ── HTML renderer ─────────────────────────────────────────────
function css() {
  return `
<style>
  :root{--gold:#F5C451;--bg:#0B1230;--card:#131e42;--border:rgba(245,196,81,.2);--text:#F5F7FF;--mute:#8C95B7;--green:#4ade80;--red:#f87171}
  *{box-sizing:border-box}
  body{margin:0;padding:24px;font-family:-apple-system,"Hiragino Sans",sans-serif;background:var(--bg);color:var(--text);font-size:14px}
  h1{color:var(--gold);font-size:22px;margin:0 0 4px}
  h2{color:var(--gold);font-size:16px;margin:32px 0 12px;border-bottom:1px solid var(--border);padding-bottom:8px}
  .sub{color:var(--mute);font-size:12px;margin:0 0 24px}
  .stats{display:flex;gap:16px;flex-wrap:wrap;margin-bottom:28px}
  .stat{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:16px 24px;min-width:140px}
  .stat__num{font-size:28px;font-weight:700;color:var(--gold);line-height:1}
  .stat__label{font-size:11px;color:var(--mute);margin-top:6px}
  .actions{display:flex;gap:8px;margin-bottom:12px}
  .btn-reload{color:var(--gold);text-decoration:none;font-size:12px;padding:6px 12px;border:1px solid var(--border);border-radius:8px;background:transparent;cursor:pointer}
  .btn-reload:hover{background:rgba(245,196,81,.1)}
  table{width:100%;border-collapse:collapse;margin-bottom:32px}
  th{background:rgba(245,196,81,.1);color:var(--gold);text-align:left;padding:10px 12px;font-size:11px;letter-spacing:.1em;font-weight:600}
  td{padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.05);vertical-align:middle}
  tr:hover td{background:rgba(255,255,255,.03)}
  .badge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;background:rgba(255,255,255,.08);white-space:nowrap}
  .empty{text-align:center;padding:48px;color:var(--mute)}
  .tag-manual{display:inline-block;font-size:10px;padding:1px 6px;border-radius:4px;background:rgba(255,255,255,.12);color:var(--mute);margin-left:4px;vertical-align:middle}
  /* 追加フォーム */
  .add-form{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:24px;margin-bottom:32px}
  .add-form h3{color:var(--gold);margin:0 0 16px;font-size:15px}
  .form-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px}
  .form-group{display:flex;flex-direction:column;gap:4px}
  label{font-size:11px;color:var(--mute);letter-spacing:.08em}
  input,select,textarea{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:8px;color:var(--text);padding:8px 10px;font-size:13px;font-family:inherit;width:100%}
  input:focus,select:focus{outline:none;border-color:var(--gold)}
  select option{background:#1a2550;color:var(--text)}
  .form-actions{margin-top:16px;display:flex;gap:8px}
  .btn-add{background:var(--gold);color:#1a1a1a;border:none;border-radius:8px;padding:8px 20px;font-size:13px;font-weight:700;cursor:pointer}
  .btn-add:hover{opacity:.85}
  .btn-del{background:transparent;color:var(--red);border:1px solid rgba(248,113,113,.3);border-radius:6px;padding:4px 8px;font-size:11px;cursor:pointer}
  .btn-del:hover{background:rgba(248,113,113,.1)}
  @media(max-width:680px){body{padding:12px}.form-grid{grid-template-columns:1fr}th.hide-sp,td.hide-sp{display:none}}
</style>`;
}

function renderHTML({ squareRows, manualRows, updatedAt }) {
  const allRows = [
    ...squareRows.map(r => ({ ...r, source: 'square' })),
    ...manualRows.map(r => ({ ...r, source: 'manual' })),
  ].sort((a, b) => new Date(b.rawDate) - new Date(a.rawDate));

  const completed = squareRows.filter(r => r.status === 'COMPLETED');
  const totalAmt  = [
    ...completed.map(r => r.amt),
    ...manualRows.map(r => r.amt),
  ].reduce((s, n) => s + n, 0);
  // 取引件数
  const totalCount = completed.length + manualRows.length;
  // 合計人数（複数申込にも対応）
  const totalPeople =
    completed.reduce((s, r) => s + (r.totalQty || 1), 0) +
    manualRows.reduce((s, r) => s + (parseInt(r.qty, 10) || 1), 0);

  const courseOptions = [
    '基本コース｜早期（150,000円）',
    '基本コース｜通常（175,000円）',
    '井戸掘り・村宿泊｜早期（180,000円）',
    '井戸掘り・村宿泊｜通常（200,000円）',
    '小中学生（110,000円）',
    '未就学児（55,000円）',
    '2歳未満（0円）',
    'その他',
  ].map(c => `<option value="${c}">${c}</option>`).join('');

  const tableRows = allRows.map(r => {
    const isManual = r.source === 'manual';
    // 複数アイテムなら各バッジを並べる、単一なら従来通り
    const courseHTML = (!isManual && Array.isArray(r.items) && r.items.length > 0)
      ? r.items.map(it =>
          `<span class="badge" style="color:${it.color||'#C9CFE2'};margin-right:4px;display:inline-block">${it.label}${it.qty > 1 ? `<strong style="color:var(--gold);margin-left:4px">×${it.qty}</strong>` : ''}</span>`
        ).join('')
      : `<span class="badge" style="color:${r.color||'#C9CFE2'}">${r.course || '-'}</span>`;
    const peopleCell = (r.totalQty && r.totalQty > 1)
      ? `<strong style="color:var(--gold)">${r.totalQty}名</strong>`
      : (isManual ? `${parseInt(r.qty, 10) || 1}名` : '1名');
    const delBtn = isManual
      ? `<form method="POST" action="/dashboard/delete" style="display:inline">
           <input type="hidden" name="id" value="${r.id}" />
           <button type="submit" class="btn-del" onclick="return confirm('削除しますか？')">削除</button>
         </form>`
      : '';
    const sourceTag = isManual
      ? '<span class="tag-manual">銀振</span>'
      : '';
    const amtStr = r.amt > 0 ? `¥${r.amt.toLocaleString()}` : '無料';
    const statusBadge = r.status === 'COMPLETED'
      ? '<span style="color:#4ade80">✓ 完了</span>'
      : r.status === 'manual'
        ? '<span style="color:#93c5fd">銀振</span>'
        : `<span style="color:#facc15">${r.status}</span>`;
    return `
<tr>
  <td>${r.date}${sourceTag}</td>
  <td class="hide-sp" style="font-size:12px">${r.email || '-'}</td>
  <td>${courseHTML}</td>
  <td style="text-align:center">${peopleCell}</td>
  <td style="text-align:right;font-family:monospace">${amtStr}</td>
  <td>${statusBadge}</td>
  <td class="hide-sp">${r.memo || (r.receiptUrl ? `<a href="${r.receiptUrl}" target="_blank" rel="noopener" style="color:var(--gold);font-size:12px">領収書</a>` : '-')}</td>
  <td>${delBtn}</td>
</tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>花火2026 ダッシュボード</title>
${css()}
</head>
<body>

<h1>🎆 カンボジア花火2026 申込ダッシュボード</h1>
<p class="sub">最終更新: ${updatedAt}　<a href="/dashboard" style="color:var(--gold);font-size:12px">↻ 更新</a></p>

<div class="stats">
  <div class="stat"><div class="stat__num">${totalCount}</div><div class="stat__label">申込件数</div></div>
  <div class="stat"><div class="stat__num">${totalPeople}<small style="font-size:.5em;color:var(--text-sub);margin-left:6px">名</small></div><div class="stat__label">合計人数</div></div>
  <div class="stat"><div class="stat__num">¥${totalAmt.toLocaleString()}</div><div class="stat__label">累計受入額</div></div>
  <div class="stat"><div class="stat__num">${Math.max(0, 50 - totalPeople)}</div><div class="stat__label">残席（定員50名）</div></div>
</div>

<!-- 銀行振込手動追加 -->
<h2>＋ 銀行振込・手動エントリ追加</h2>
<div class="add-form">
  <form method="POST" action="/dashboard/add">
    <div class="form-grid">
      <div class="form-group">
        <label>日付</label>
        <input type="date" name="date" required />
      </div>
      <div class="form-group">
        <label>お名前</label>
        <input type="text" name="name" placeholder="山田 太郎" required />
      </div>
      <div class="form-group">
        <label>メールアドレス</label>
        <input type="email" name="email" placeholder="xxx@example.com" />
      </div>
      <div class="form-group">
        <label>参加コース</label>
        <select name="course">${courseOptions}</select>
      </div>
      <div class="form-group">
        <label>人数</label>
        <input type="number" name="qty" placeholder="1" min="1" max="50" value="1" />
      </div>
      <div class="form-group">
        <label>金額（円）</label>
        <input type="number" name="amount" placeholder="150000" min="0" />
      </div>
      <div class="form-group">
        <label>メモ（入金日・振込名義など）</label>
        <input type="text" name="memo" placeholder="4/28入金確認済み" />
      </div>
    </div>
    <div class="form-actions">
      <button type="submit" class="btn-add">追加する</button>
    </div>
  </form>
</div>

<!-- 申込一覧 -->
<h2>申込一覧（Square決済＋銀行振込）</h2>
${allRows.length === 0
  ? '<div class="empty">まだ申込みはありません。</div>'
  : `<table>
<thead><tr>
  <th>日時(JST)</th>
  <th class="hide-sp">メール</th>
  <th>コース内訳</th>
  <th style="text-align:center">人数</th>
  <th style="text-align:right">金額</th>
  <th>状態</th>
  <th class="hide-sp">メモ/領収書</th>
  <th></th>
</tr></thead>
<tbody>${tableRows}</tbody>
</table>`}

<p style="color:var(--mute);font-size:11px;margin-top:8px">
  ※ Square決済のみリアルタイム反映。銀行振込は手動追加が必要です。<br>
  ※ 2歳未満無料の方は保護者のエントリに含めてください。
</p>
</body></html>`;
}

// ── /api/checkout: 複数アイテムをまとめて Square 決済リンク生成 ─────
async function handleCheckout(request, env) {
  const token = env.SQUARE_ACCESS_TOKEN;
  if (!token) {
    return jsonResponse({ success: false, error: 'Square token not configured' }, 500);
  }
  if (request.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
  }

  /** @type {{ items: Array<{ courseId: string, qty: number }> }} */
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ success: false, error: 'Invalid JSON' }, 400);
  }

  const items = Array.isArray(body?.items) ? body.items : [];
  if (items.length === 0) {
    return jsonResponse({ success: false, error: 'カートが空です' }, 400);
  }

  // line_items を構築（サーバー側カタログから価格を引く）
  const isRegular = isRegularPricing();
  const lineItems = [];
  for (const it of items) {
    const cat = COURSE_CATALOG[it?.courseId];
    const qty = parseInt(it?.qty, 10) || 0;
    if (!cat || qty <= 0) continue;
    if (qty > 50) {
      return jsonResponse({ success: false, error: '数量が多すぎます' }, 400);
    }
    const price = isRegular ? cat.regular : cat.early;
    const suffix = (cat.early !== cat.regular) ? (isRegular ? ' 通常' : ' 早期') : '';
    lineItems.push({
      name: `${cat.label}${suffix}`,
      quantity: String(qty),
      base_price_money: { amount: price, currency: 'JPY' },
    });
  }

  if (lineItems.length === 0) {
    return jsonResponse({ success: false, error: '有効な商品がありません' }, 400);
  }

  // 合計金額計算（無料コース＝2歳未満のみの場合は決済不要）
  const total = lineItems.reduce((sum, li) => sum + li.base_price_money.amount * parseInt(li.quantity, 10), 0);
  if (total <= 0) {
    return jsonResponse({ success: false, error: '無料コースのみのお申込みは別途ご連絡ください' }, 400);
  }

  // Square 決済リンク作成
  const description = `カンボジア花火2026 お申込み。決済完了後、参加者専用LINEグループにご参加ください。${LINE_URL}`;
  const payload = {
    idempotency_key: crypto.randomUUID(),
    order: {
      location_id: LOCATION_ID,
      line_items: lineItems,
    },
    checkout_options: {
      redirect_url: REDIRECT_URL,
      ask_for_shipping_address: false,
    },
    description,
  };

  const sqRes = await sq('/online-checkout/payment-links', 'POST', payload, token);
  if (!sqRes?.payment_link?.url) {
    return jsonResponse({
      success: false,
      error: 'Square決済リンクの作成に失敗しました',
      detail: sqRes?.errors || sqRes,
    }, 502);
  }

  return jsonResponse({
    success: true,
    url: sqRes.payment_link.url,
    total,
    items: lineItems.map(li => ({ name: li.name, qty: li.quantity, price: li.base_price_money.amount })),
  });
}

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

// ── メインハンドラー ──────────────────────────────────────────
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 公開API：/api/checkout（Basic認証スキップ）
    if (url.pathname === '/api/checkout') {
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          },
        });
      }
      return handleCheckout(request, env);
    }

    // ダッシュボードはBasic Auth必須
    if (!checkAuth(request)) return unauthorized();

    const method = request.method;
    const kv     = env.HANABI_KV;
    const token  = env.SQUARE_ACCESS_TOKEN;

    // POST /dashboard/add
    if (method === 'POST' && url.pathname === '/dashboard/add') {
      const body = await request.formData();
      const entries = await getManual(kv);
      const amt = parseInt(body.get('amount') || '0', 10);
      const qty = Math.max(1, parseInt(body.get('qty') || '1', 10) || 1);
      const entry = {
        id:      crypto.randomUUID(),
        date:    body.get('date') || '',
        rawDate: body.get('date') || '',
        name:    body.get('name') || '',
        email:   body.get('email') || '',
        course:  body.get('course') || '',
        color:   '#93c5fd',
        amt,
        qty,
        memo:    body.get('memo') || '',
        status:  'manual',
        createdAt: new Date().toISOString(),
      };
      entries.push(entry);
      await putManual(kv, entries);
      return Response.redirect(new URL('/dashboard', request.url).href, 303);
    }

    // POST /dashboard/delete
    if (method === 'POST' && url.pathname === '/dashboard/delete') {
      const body = await request.formData();
      const id = body.get('id');
      const entries = (await getManual(kv)).filter(e => e.id !== id);
      await putManual(kv, entries);
      return Response.redirect(new URL('/dashboard', request.url).href, 303);
    }

    // GET /dashboard
    if (!token) {
      return new Response('SQUARE_ACCESS_TOKEN が未設定です', {
        status: 500, headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    try {
      // Square: payments 取得
      const pd = await sq(
        `/payments?location_id=${LOCATION_ID}&limit=200&sort_order=DESC`,
        'GET', null, token
      );
      if (pd.errors?.some(e => e.category === 'AUTHENTICATION_ERROR')) {
        return new Response('⚠️ Square API 認証エラー。トークンが期限切れの可能性があります。', {
          status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      }
      const allPayments = pd.payments || [];

      // Order取得 → コース名フィルタ
      const orderIds = [...new Set(allPayments.filter(p => p.order_id).map(p => p.order_id))];
      const ordersMap = {};
      if (orderIds.length > 0) {
        const od = await sq('/orders/batch-retrieve', 'POST', { order_ids: orderIds.slice(0, 100) }, token);
        for (const o of (od.orders || [])) ordersMap[o.id] = o;
      }

      // 花火2026のみフィルタ
      const squareRows = allPayments
        .filter(p => {
          const order = ordersMap[p.order_id];
          if (!order) return false;
          return order.line_items?.some(li => li.name?.includes(HANABI_TAG));
        })
        .map(p => {
          const order    = ordersMap[p.order_id] || {};
          const lineItems = (order.line_items || []).filter(li => li.name?.includes(HANABI_TAG));
          // 全アイテムを {label, qty, color, badge} に展開
          const items = lineItems.map(li => {
            const c = parseCourse(li.name || '');
            const qty = parseInt(li.quantity || '1', 10) || 1;
            return { label: c.label, badge: c.badge, color: c.color, qty };
          });
          const totalQty = items.reduce((s, it) => s + it.qty, 0);
          // 表示用：1件なら「コース名」、複数なら「コース×2 / コース×1」形式
          const courseDisplay = items.length === 1 && items[0].qty === 1
            ? items[0].label
            : items.map(it => `${it.label}×${it.qty}`).join(' / ');
          const primaryColor = items[0]?.color || '#8C95B7';
          const created  = new Date(p.created_at);
          const date     = created.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
          return {
            id:         p.id,
            rawDate:    p.created_at,
            date,
            email:      p.buyer_email_address || '-',
            course:     courseDisplay,
            items,            // ← 詳細用
            totalQty,         // ← 合計人数
            color:      primaryColor,
            amt:        p.amount_money?.amount || 0,
            status:     p.status,
            receiptUrl: p.receipt_url || '',
          };
        });

      // 手動エントリ
      const manualRaw = await getManual(kv);
      const manualRows = manualRaw.map(e => ({
        ...e,
        rawDate: e.rawDate || e.createdAt || e.date || '',
        date:    e.date || '-',
      }));

      const updatedAt = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
      return new Response(renderHTML({ squareRows, manualRows, updatedAt }), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });

    } catch (err) {
      return new Response(`エラー: ${err.message}\n${err.stack}`, {
        status: 500, headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
  },
};
