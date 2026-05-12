/**
 * カンボジア花火2026 予祝会 in 銀座FEEEP ダッシュボード Worker
 * ルーティングプレフィックス: /yosyuku/
 *
 * Cloudflare Secrets:
 *   SQUARE_ACCESS_TOKEN  - Square 本番アクセストークン
 *
 * Basic Auth: heiwa / matsuri (ダッシュボードのみ)
 */

const LOCATION_ID  = 'LDF0BDGH0XHPJ';
const SQUARE_API   = 'https://connect.squareup.com/v2';
const PASSWORD     = 'matsuri';
const USER         = 'heiwa';
const REDIRECT_URL = 'https://hanabi2026.agsymphony.net/yosyuku/thanks.html';
const LINE_URL     = 'https://line.me/ti/g/ea9AdppvxE';

// 予祝チケット定義（TODO: 価格は確定次第変更）
const TICKET_CATALOG = {
  '0628': {
    label:      '予祝会チケット｜6月28日（土）',
    squareName: 'カンボジア花火2026予祝会｜0628',
    price:      7700,
    date:       '2026-06-28',
  },
  '0725': {
    label:      '予祝会チケット｜7月25日（金）',
    squareName: 'カンボジア花火2026予祝会｜0725',
    price:      7700,
    date:       '2026-07-25',
  },
};

const YOSYUKU_TAG = 'カンボジア花火2026予祝会'; // line_item フィルタ用

// ── Square API helper ─────────────────────────────────────────
async function sq(path, method = 'GET', body = null, token) {
  const res = await fetch(`${SQUARE_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Square-Version': '2025-01-23',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

// ── Basic Auth ────────────────────────────────────────────────
function unauthorized() {
  return new Response('要認証', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="予祝会ダッシュボード"',
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}

function checkAuth(request) {
  const h = request.headers.get('Authorization') || '';
  if (!h.startsWith('Basic ')) return false;
  try {
    const decoded = atob(h.slice(6));
    // user:pass 形式で両方チェック
    const [u, ...rest] = decoded.split(':');
    const p = rest.join(':');
    return u === USER && p === PASSWORD;
  } catch {
    return false;
  }
}

// ── JSON レスポンス helper ────────────────────────────────────
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

// ── POST /yosyuku/api/checkout ────────────────────────────────
async function handleCheckout(request, env) {
  const token = env.SQUARE_ACCESS_TOKEN;
  if (!token) return jsonResponse({ success: false, error: 'Square token not configured' }, 500);
  if (request.method !== 'POST') return jsonResponse({ success: false, error: 'Method not allowed' }, 405);

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ success: false, error: 'Invalid JSON' }, 400);
  }

  const { ticketDate, qty: rawQty } = body || {};
  const ticket = TICKET_CATALOG[ticketDate];
  if (!ticket) {
    return jsonResponse({ success: false, error: '無効なチケット日程です' }, 400);
  }

  const qty = parseInt(rawQty, 10);
  if (!Number.isInteger(qty) || qty < 1 || qty > 20) {
    return jsonResponse({ success: false, error: '枚数は 1〜20 の範囲で指定してください' }, 400);
  }

  const payload = {
    idempotency_key: crypto.randomUUID(),
    order: {
      location_id: LOCATION_ID,
      line_items: [
        {
          name:               ticket.squareName,
          quantity:           String(qty),
          base_price_money:   { amount: ticket.price, currency: 'JPY' },
        },
      ],
    },
    checkout_options: {
      redirect_url:           REDIRECT_URL,
      ask_for_shipping_address: false,
    },
    description: `カンボジア花火2026 予祝会 in 銀座FEEEP お申込み。決済完了後、参加者専用LINEグループにご参加ください。${LINE_URL}`,
  };

  try {
    const sqRes = await sq('/online-checkout/payment-links', 'POST', payload, token);
    if (!sqRes?.payment_link?.url) {
      return jsonResponse({
        success: false,
        error: 'Square決済リンクの作成に失敗しました',
        detail: sqRes?.errors || sqRes,
      }, 502);
    }
    return jsonResponse({ success: true, url: sqRes.payment_link.url });
  } catch (err) {
    return jsonResponse({ success: false, error: err.message }, 500);
  }
}

// ── ダッシュボード CSS ────────────────────────────────────────
function css() {
  return `<style>
  :root{
    --gold:#F5C451;--bg:#0B1230;--card:#131e42;--border:rgba(245,196,81,.2);
    --text:#F5F7FF;--mute:#8C95B7;--green:#4ade80;--red:#f87171;
    --accent-0628:#60a5fa;--accent-0725:#a78bfa;
  }
  *{box-sizing:border-box}
  body{margin:0;padding:24px;font-family:-apple-system,"Hiragino Sans",sans-serif;background:var(--bg);color:var(--text);font-size:14px}
  h1{color:var(--gold);font-size:22px;margin:0 0 4px}
  .sub{color:var(--mute);font-size:12px;margin:0 0 24px}
  .stats{display:flex;gap:16px;flex-wrap:wrap;margin-bottom:28px}
  .stat{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:16px 24px;min-width:140px}
  .stat__num{font-size:28px;font-weight:700;color:var(--gold);line-height:1}
  .stat__label{font-size:11px;color:var(--mute);margin-top:6px}
  .controls{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;align-items:center}
  .controls a,.controls button{color:var(--gold);text-decoration:none;font-size:12px;padding:5px 12px;border:1px solid var(--border);border-radius:8px;background:transparent;cursor:pointer}
  .controls a:hover,.controls button:hover{background:rgba(245,196,81,.1)}
  .controls .active{background:rgba(245,196,81,.15);border-color:var(--gold)}
  table{width:100%;border-collapse:collapse;margin-bottom:32px}
  th{background:rgba(245,196,81,.1);color:var(--gold);text-align:left;padding:10px 12px;font-size:11px;letter-spacing:.1em;font-weight:600;white-space:nowrap}
  td{padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.05);vertical-align:middle}
  tr:hover td{background:rgba(255,255,255,.03)}
  .badge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;white-space:nowrap}
  .badge-0628{background:rgba(96,165,250,.15);color:var(--accent-0628)}
  .badge-0725{background:rgba(167,139,250,.15);color:var(--accent-0725)}
  .badge-completed{background:rgba(74,222,128,.12);color:var(--green)}
  .badge-pending{background:rgba(250,204,21,.12);color:#facc15}
  .badge-manual{background:rgba(251,146,60,.15);color:#fb923c}
  .badge-other{background:rgba(255,255,255,.08);color:var(--mute)}
  .empty{text-align:center;padding:48px;color:var(--mute)}
  .del-btn{background:none;border:none;cursor:pointer;color:var(--mute);font-size:14px;padding:2px 6px;border-radius:4px}
  .del-btn:hover{color:#f87171;background:rgba(248,113,113,.1)}
  /* 手動追加フォーム */
  .add-form{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:20px 24px;margin-bottom:24px;display:none}
  .add-form.open{display:block}
  .add-form h2{color:var(--gold);font-size:15px;margin:0 0 16px}
  .form-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;margin-bottom:14px}
  .form-grid label{display:flex;flex-direction:column;gap:4px;font-size:11px;color:var(--mute)}
  .form-grid input,.form-grid select{background:#0d1835;border:1px solid var(--border);border-radius:6px;padding:7px 10px;color:var(--text);font-size:13px;outline:none}
  .form-grid input:focus,.form-grid select:focus{border-color:var(--gold)}
  .form-actions{display:flex;gap:10px;align-items:center}
  .btn-add{background:var(--gold);color:#000;border:none;border-radius:8px;padding:8px 20px;font-weight:700;font-size:13px;cursor:pointer}
  .btn-add:hover{opacity:.85}
  .btn-cancel{background:none;border:1px solid var(--border);color:var(--mute);border-radius:8px;padding:8px 16px;font-size:13px;cursor:pointer}
  .form-msg{font-size:12px;margin-left:8px}
  @media(max-width:680px){body{padding:12px}th.hide-sp,td.hide-sp{display:none}.form-grid{grid-template-columns:1fr 1fr}}
</style>`;
}

// ── JST 現在日付を返す ────────────────────────────────────────
function nowJST() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
}

// ── ダッシュボード HTML レンダリング ─────────────────────────
function renderHTML({ rows, updatedAt, sort, filter }) {
  // 7/1 JST 以降は 6/28 関連を非表示
  const hide0628 = nowJST() >= new Date('2026-07-01T00:00:00+09:00');

  // 非表示日程のデータは統計から除外
  const activeRows = hide0628 ? rows.filter(r => r.ticketDate !== '0628') : rows;

  // フィルタ
  const filtered = filter && filter !== 'all'
    ? activeRows.filter(r => r.ticketDate === filter)
    : activeRows;

  // ソート
  const sorted = [...filtered].sort((a, b) => {
    const diff = new Date(a.rawDate) - new Date(b.rawDate);
    return sort === 'asc' ? diff : -diff;
  });

  // サマリー計算（activeRows 基準）
  const completed    = activeRows.filter(r => r.status === 'COMPLETED');
  const pending      = activeRows.filter(r => r.status !== 'COMPLETED');
  const totalAmt     = completed.reduce((s, r) => s + r.amt, 0);
  const count0628    = activeRows.filter(r => r.ticketDate === '0628').reduce((s, r) => s + r.qty, 0);
  const count0725    = activeRows.filter(r => r.ticketDate === '0725').reduce((s, r) => s + r.qty, 0);

  const tableRows = sorted.map(r => {
    const isManual = r.source === 'manual';
    const statusBadge = isManual
      ? '<span class="badge badge-manual">🏦 銀振</span>'
      : r.status === 'COMPLETED'
        ? '<span class="badge badge-completed">✓ 完了</span>'
        : `<span class="badge badge-pending">${r.status}</span>`;
    const dateBadge = r.ticketDate === '0628'
      ? '<span class="badge badge-0628">6/28</span>'
      : r.ticketDate === '0725'
        ? '<span class="badge badge-0725">7/25</span>'
        : '<span class="badge badge-other">-</span>';
    const amtStr = r.amt > 0 ? `¥${r.amt.toLocaleString()}` : '-';
    const cardStr = isManual
      ? (r.note ? `<span style="color:var(--mute);font-size:11px">${r.note}</span>` : '-')
      : r.card ? `${r.card.brand} ****${r.card.last4}` : '-';
    const delBtn = isManual
      ? `<form method="POST" action="/yosyuku/api/manual?action=delete&id=${r.id}" style="display:inline" onsubmit="return confirm('削除しますか？')">
           <button class="del-btn" type="submit" title="削除">🗑</button>
         </form>`
      : '';
    return `<tr${isManual ? ' style="background:rgba(251,146,60,.04)"' : ''}>
  <td style="white-space:nowrap">${r.date}</td>
  <td>${statusBadge}</td>
  <td>${dateBadge}</td>
  <td style="text-align:center">${r.qty}枚</td>
  <td style="text-align:right;font-family:monospace">${amtStr}</td>
  <td>${r.name || '-'}</td>
  <td class="hide-sp" style="font-size:12px">${r.email || '-'}</td>
  <td class="hide-sp" style="font-size:12px;color:var(--mute)">${cardStr}</td>
  <td>${delBtn}</td>
</tr>`;
  }).join('');

  const sortAscUrl  = `?sort=asc&filter=${filter || 'all'}`;
  const sortDescUrl = `?sort=desc&filter=${filter || 'all'}`;
  const filterAllUrl  = `?sort=${sort || 'desc'}&filter=all`;
  const filter0628Url = `?sort=${sort || 'desc'}&filter=0628`;
  const filter0725Url = `?sort=${sort || 'desc'}&filter=0725`;
  const isDesc = !sort || sort === 'desc';

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>予祝会ダッシュボード | カンボジア花火2026</title>
${css()}
</head>
<body>
<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:4px">
  <h1>✨ カンボジア花火2026 予祝会 申込ダッシュボード</h1>
  <button onclick="toggleForm()" style="background:rgba(251,146,60,.15);border:1px solid rgba(251,146,60,.4);color:#fb923c;border-radius:8px;padding:8px 16px;font-size:13px;font-weight:700;cursor:pointer">🏦 銀振り手動追加</button>
</div>
<p class="sub">最終更新: ${updatedAt}　<a href="/yosyuku/dashboard" style="color:var(--gold);font-size:12px">↻ 更新</a></p>

<div class="stats">
  <div class="stat">
    <div class="stat__num">¥${totalAmt.toLocaleString()}</div>
    <div class="stat__label">合計売上（COMPLETED）</div>
  </div>
  <div class="stat">
    <div class="stat__num" style="color:var(--green)">${completed.length}</div>
    <div class="stat__label">COMPLETED 件数</div>
  </div>
  <div class="stat">
    <div class="stat__num" style="color:#facc15">${pending.length}</div>
    <div class="stat__label">PENDING 件数</div>
  </div>
  ${!hide0628 ? `<div class="stat" style="border-color:rgba(96,165,250,.3)">
    <div class="stat__num" style="color:var(--accent-0628)">${count0628}</div>
    <div class="stat__label">6/28 参加人数</div>
  </div>` : ''}
  <div class="stat" style="border-color:rgba(167,139,250,.3)">
    <div class="stat__num" style="color:var(--accent-0725)">${count0725}</div>
    <div class="stat__label">7/25 参加人数</div>
  </div>
</div>

<!-- 手動追加フォーム -->
<div class="add-form" id="addForm">
  <h2>🏦 銀行振込 手動追加</h2>
  <div class="form-grid">
    <label>氏名 <span style="color:#f87171">*</span>
      <input id="f-name" placeholder="山田 太郎" required>
    </label>
    <label>参加日 <span style="color:#f87171">*</span>
      <select id="f-date">
        ${!hide0628 ? '<option value="0628">6月28日（土）</option>' : ''}
        <option value="0725">7月25日（金）</option>
      </select>
    </label>
    <label>枚数
      <input id="f-qty" type="number" value="1" min="1" max="20">
    </label>
    <label>金額（円）
      <input id="f-amt" type="number" value="7700" min="0">
    </label>
    <label>メールアドレス
      <input id="f-email" type="email" placeholder="example@mail.com">
    </label>
    <label>メモ（備考）
      <input id="f-note" placeholder="振込確認済など">
    </label>
  </div>
  <div class="form-actions">
    <button class="btn-add" onclick="submitManual()">追加する</button>
    <button class="btn-cancel" onclick="toggleForm()">キャンセル</button>
    <span class="form-msg" id="formMsg"></span>
  </div>
</div>

<div class="controls">
  <span style="color:var(--mute);font-size:11px">ソート：</span>
  <a href="${sortDescUrl}" class="${isDesc ? 'active' : ''}">申込日 ↓ 新しい順</a>
  <a href="${sortAscUrl}"  class="${!isDesc ? 'active' : ''}">申込日 ↑ 古い順</a>
  <span style="color:var(--mute);font-size:11px;margin-left:8px">フィルター：</span>
  <a href="${filterAllUrl}"  class="${!filter || filter === 'all'  ? 'active' : ''}">全部</a>
  ${!hide0628 ? `<a href="${filter0628Url}" class="${filter === '0628' ? 'active' : ''}">6/28のみ</a>` : ''}
  <a href="${filter0725Url}" class="${filter === '0725' ? 'active' : ''}">7/25のみ</a>
</div>

${sorted.length === 0
  ? '<div class="empty">該当する申込みはありません。</div>'
  : `<table>
<thead><tr>
  <th>申込日時（JST）</th>
  <th>ステータス</th>
  <th>参加日</th>
  <th style="text-align:center">枚数</th>
  <th style="text-align:right">金額</th>
  <th>氏名</th>
  <th class="hide-sp">メールアドレス</th>
  <th class="hide-sp">カード / メモ</th>
  <th></th>
</tr></thead>
<tbody>${tableRows}</tbody>
</table>`}

<p style="color:var(--mute);font-size:11px;margin-top:8px">
  ※ Square決済情報をリアルタイム反映しています。<br>
  ※ 参加日の判定は line_item 名に含まれる日付コード（0628 / 0725）で行います。<br>
  ※ 🏦 銀振 行は手動追加エントリです。🗑 ボタンで削除できます。
</p>
<script>
function toggleForm(){
  const f=document.getElementById('addForm');
  f.classList.toggle('open');
  if(f.classList.contains('open')) document.getElementById('f-name').focus();
}
async function submitManual(){
  const name=document.getElementById('f-name').value.trim();
  const ticketDate=document.getElementById('f-date').value;
  const qty=parseInt(document.getElementById('f-qty').value)||1;
  const amt=parseInt(document.getElementById('f-amt').value)||qty*7700;
  const email=document.getElementById('f-email').value.trim();
  const note=document.getElementById('f-note').value.trim();
  const msg=document.getElementById('formMsg');
  if(!name){msg.textContent='氏名を入力してください';msg.style.color='#f87171';return;}
  msg.textContent='送信中…';msg.style.color='var(--mute)';
  try{
    const r=await fetch('/yosyuku/api/manual',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({name,ticketDate,qty,amt,email,note})
    });
    const d=await r.json();
    if(d.success){location.reload();}
    else{msg.textContent=d.error||'エラーが発生しました';msg.style.color='#f87171';}
  }catch(e){msg.textContent='通信エラー';msg.style.color='#f87171';}
}
</script>
</body></html>`;
}

// ── KV: 手動エントリ CRUD ────────────────────────────────────
const KV_KEY = 'entries';

async function kvGetEntries(env) {
  if (!env.YOSYUKU_MANUAL) return [];
  const raw = await env.YOSYUKU_MANUAL.get(KV_KEY);
  return raw ? JSON.parse(raw) : [];
}

async function kvSaveEntries(env, entries) {
  await env.YOSYUKU_MANUAL.put(KV_KEY, JSON.stringify(entries));
}

// POST /yosyuku/api/manual → 手動エントリ追加 / 削除
async function handleManual(request, env) {
  const url    = new URL(request.url);
  const action = url.searchParams.get('action') || 'add';

  if (action === 'delete') {
    const id      = url.searchParams.get('id');
    const entries = await kvGetEntries(env);
    await kvSaveEntries(env, entries.filter(e => e.id !== id));
    return new Response(null, { status: 303, headers: { Location: '/yosyuku/dashboard' } });
  }

  // add
  let body;
  try { body = await request.json(); } catch { body = {}; }

  const { name, email, phone, ticketDate, qty: rawQty, amt: rawAmt, note } = body;
  if (!name || !ticketDate) {
    return jsonResponse({ success: false, error: '氏名と参加日は必須です' }, 400);
  }
  const qty = Math.max(1, parseInt(rawQty, 10) || 1);
  const amt = rawAmt != null ? parseInt(rawAmt, 10) : qty * 7700;

  const entry = {
    id:         crypto.randomUUID(),
    name:       String(name).slice(0, 60),
    email:      String(email || '').slice(0, 80),
    phone:      String(phone || '').slice(0, 20),
    ticketDate: ticketDate === '0628' ? '0628' : '0725',
    qty,
    amt,
    note:       String(note || '').slice(0, 100),
    createdAt:  new Date().toISOString(),
    source:     'manual',
  };

  const entries = await kvGetEntries(env);
  entries.push(entry);
  await kvSaveEntries(env, entries);
  return jsonResponse({ success: true, id: entry.id });
}

// ── GET /yosyuku/dashboard ────────────────────────────────────
async function handleDashboard(request, env) {
  const token = env.SQUARE_ACCESS_TOKEN;
  if (!token) {
    return new Response('SQUARE_ACCESS_TOKEN が未設定です', {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  const url    = new URL(request.url);
  const sort   = url.searchParams.get('sort') || 'desc';
  const filter = url.searchParams.get('filter') || 'all';

  try {
    // 1. 全ペイメント取得
    const pd = await sq(
      `/payments?location_id=${LOCATION_ID}&limit=200&sort_order=DESC`,
      'GET', null, token
    );
    if (pd.errors?.some(e => e.category === 'AUTHENTICATION_ERROR')) {
      return new Response('⚠️ Square API 認証エラー。トークンが期限切れの可能性があります。', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
    const allPayments = pd.payments || [];

    // 2. order IDs を収集して batch-retrieve
    const orderIds = [...new Set(allPayments.filter(p => p.order_id).map(p => p.order_id))];
    const ordersMap = {};
    if (orderIds.length > 0) {
      const od = await sq('/orders/batch-retrieve', 'POST', { order_ids: orderIds.slice(0, 100) }, token);
      for (const o of (od.orders || [])) ordersMap[o.id] = o;
    }

    // 3. 予祝会タグでフィルタして行データを構築
    const rows = allPayments
      .filter(p => {
        const order = ordersMap[p.order_id];
        return order?.line_items?.some(li => li.name?.includes(YOSYUKU_TAG));
      })
      .map(p => {
        const order     = ordersMap[p.order_id] || {};
        const lineItems = (order.line_items || []).filter(li => li.name?.includes(YOSYUKU_TAG));

        // 参加日: line_item 名から 0628 or 0725 を抽出
        const firstItem   = lineItems[0] || {};
        const dateMatch   = (firstItem.name || '').match(/0628|0725/);
        const ticketDate  = dateMatch ? dateMatch[0] : '';

        // 枚数: line_items の quantity を合計
        const qty = lineItems.reduce((s, li) => s + (parseInt(li.quantity, 10) || 1), 0);

        // 氏名
        const billing = p.billing_address || {};
        const name    = `${billing.last_name || ''}${billing.first_name || ''}`.trim() || '';

        // カード情報
        const card = p.card_details?.card
          ? { brand: p.card_details.card.card_brand || '', last4: p.card_details.card.last_4 || '' }
          : null;

        // 日時 JST 変換
        const created = new Date(p.created_at);
        const date    = created.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });

        return {
          id:         p.id,
          rawDate:    p.created_at,
          date,
          status:     p.status,
          ticketDate,
          qty,
          amt:        p.total_money?.amount || 0,
          email:      p.buyer_email_address || '',
          name,
          card,
        };
      });

    // 4. 手動エントリ（KV）を取得してマージ
    const manualEntries = await kvGetEntries(env);
    const manualRows = manualEntries
      .filter(e => !hide0628 || e.ticketDate !== '0628')  // 7/1以降は0628非表示
      .map(e => ({
        id:         e.id,
        rawDate:    e.createdAt,
        date:       new Date(e.createdAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
        status:     'MANUAL',
        ticketDate: e.ticketDate,
        qty:        e.qty,
        amt:        e.amt,
        email:      e.email,
        name:       e.name,
        phone:      e.phone,
        note:       e.note,
        card:       null,
        source:     'manual',
      }));

    const allRows = [...rows, ...manualRows];
    const updatedAt = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
    return new Response(renderHTML({ rows: allRows, updatedAt, sort, filter }), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });

  } catch (err) {
    return new Response(`エラー: ${err.message}\n${err.stack}`, {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

// ── メインハンドラー ──────────────────────────────────────────
export default {
  async fetch(request, env) {
    const url    = new URL(request.url);
    const path   = url.pathname;

    // OPTIONS プリフライト（CORS）
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin':  '*',
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    // 公開 API: /yosyuku/api/checkout（Basic Auth スキップ）
    if (path === '/yosyuku/api/checkout') {
      return handleCheckout(request, env);
    }

    // 手動エントリ API（Basic Auth 必須）
    if (path === '/yosyuku/api/manual') {
      if (!checkAuth(request)) return unauthorized();
      return handleManual(request, env);
    }

    // ダッシュボード: Basic Auth 必須
    if (path === '/yosyuku/dashboard' || path === '/yosyuku/dashboard/') {
      if (!checkAuth(request)) return unauthorized();
      return handleDashboard(request, env);
    }

    // その他のパスは 404
    return new Response('Not Found', { status: 404 });
  },
};
