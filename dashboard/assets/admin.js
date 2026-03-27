let USERS = [];
let CURRENT_SENDER_ID = null;
let CURRENT_DAYS = 30;
let RAW_DATA = null;

(async function init() {
  bindControls();
  const ok = await loadUsers();
  if (!ok) return showError('无法读取后台用户列表');
  showDashboard();
})();

function bindControls() {
  document.getElementById('refresh-btn').addEventListener('click', async () => {
    await refreshCurrentUser(true);
  });

  document.getElementById('user-select').addEventListener('change', async event => {
    CURRENT_SENDER_ID = event.target.value;
    syncUrl();
    await refreshCurrentUser();
  });

  document.getElementById('days-select').addEventListener('change', async event => {
    CURRENT_DAYS = parseInt(event.target.value, 10);
    syncUrl();
    await refreshCurrentUser();
  });
}

async function loadUsers() {
  try {
    const res = await fetch(`/api/admin/users?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return false;
    const data = await res.json();
    USERS = data.users || [];
    if (!USERS.length) return false;

    const params = new URLSearchParams(location.search);
    CURRENT_DAYS = parseInt(params.get('days') || '30', 10);
    CURRENT_SENDER_ID = params.get('sender_id') || USERS[0].sender_id;

    document.getElementById('days-select').value = String(CURRENT_DAYS);
    renderUserOptions();
    await refreshCurrentUser();
    return true;
  } catch {
    return false;
  }
}

async function refreshCurrentUser(manual = false) {
  const btn = document.getElementById('refresh-btn');
  btn.disabled = true;
  btn.textContent = manual ? '刷新中...' : '加载中...';
  updateTimestamp(manual ? '正在读取原始文件' : '正在加载');

  try {
    const res = await fetch(`/api/admin/raw?sender_id=${encodeURIComponent(CURRENT_SENDER_ID)}&days=${CURRENT_DAYS}&t=${Date.now()}`, {
      cache: 'no-store',
    });
    if (!res.ok) throw new Error('fetch failed');
    RAW_DATA = await res.json();
    renderAll();
    updateTimestamp(manual ? '刚刚刷新' : '读取完成');
  } catch {
    showError('原始数据读取失败，请确认本地服务和数据目录可用');
    return;
  } finally {
    window.setTimeout(() => {
      btn.disabled = false;
      btn.textContent = '刷新原始数据';
      updateTimestamp();
    }, manual ? 1000 : 0);
  }
}

function renderUserOptions() {
  const select = document.getElementById('user-select');
  select.innerHTML = USERS.map(user => {
    const selected = user.sender_id === CURRENT_SENDER_ID ? ' selected' : '';
    return `<option value="${escapeHtml(user.sender_id)}"${selected}>${escapeHtml(user.name || user.sender_id)}</option>`;
  }).join('');
}

function renderAll() {
  renderCards();
  renderUserMeta();
  renderWeights();
  renderRawList('diet-list', RAW_DATA.diets, '暂无饮食记录');
  renderRawList('workout-list', RAW_DATA.workouts, '暂无训练记录');
  renderUserLink();
  syncUrl();
}

function renderCards() {
  const stats = RAW_DATA.quick_stats || {};
  document.getElementById('card-latest-weight').textContent = stats.latest_weight_kg != null ? `${stats.latest_weight_kg} kg` : '暂无';
  document.getElementById('card-latest-weight-sub').textContent = stats.latest_weight_time || '尚无体重记录';
  document.getElementById('card-today-calories').textContent = `${stats.today_calories || 0} kcal`;
  document.getElementById('card-today-calories-sub').textContent = stats.latest_diet_date ? `最新饮食：${stats.latest_diet_date}` : '今日暂无饮食';
  document.getElementById('card-today-protein').textContent = `${stats.today_protein_g || 0} g`;
  document.getElementById('card-today-protein-sub').textContent = `目标 ${(RAW_DATA.profile || {}).protein_target_g || 120} g`;
  document.getElementById('card-workout-days').textContent = `${stats.workout_days_last_7d || 0} 天`;
  document.getElementById('card-workout-days-sub').textContent = '最近 7 天有训练记录';
}

function renderUserMeta() {
  const user = RAW_DATA.user || {};
  const profile = RAW_DATA.profile || {};
  const items = [
    ['用户名称', user.name || '-'],
    ['sender_id', user.sender_id || '-'],
    ['角色', user.role || '-'],
    ['日报目标', user.daily_report_target || '-'],
    ['热量目标', `${profile.daily_calorie_target || 2000} kcal`],
    ['蛋白质目标', `${profile.protein_target_g || 120} g`],
    ['碳水目标', `${profile.carb_target_g || 250} g`],
    ['脂肪目标', `${profile.fat_target_g || 65} g`],
  ];
  document.getElementById('user-meta').innerHTML = items.map(([label, value]) => `
    <div class="admin-meta-item">
      <div class="admin-meta-label">${escapeHtml(label)}</div>
      <div class="admin-meta-value">${escapeHtml(String(value))}</div>
    </div>
  `).join('');
}

function renderWeights() {
  const rows = RAW_DATA.weights || [];
  if (!rows.length) {
    document.getElementById('weights-table').innerHTML = '<div class="admin-empty">暂无体重记录</div>';
    return;
  }
  document.getElementById('weights-table').innerHTML = `
    <table class="admin-table">
      <thead>
        <tr><th>日期</th><th>时间</th><th>体重</th><th>来源</th><th>文件</th></tr>
      </thead>
      <tbody>
        ${rows.map(row => `
          <tr>
            <td>${escapeHtml(row.date || '-')}</td>
            <td>${escapeHtml(row.time || '-')}</td>
            <td>${row.weight_kg != null ? `${row.weight_kg} kg` : '-'}</td>
            <td>${escapeHtml(row.source || '-')}</td>
            <td>${escapeHtml(row.file || '-')}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderRawList(targetId, records, emptyText) {
  const el = document.getElementById(targetId);
  if (!records || !records.length) {
    el.innerHTML = `<div class="admin-empty">${escapeHtml(emptyText)}</div>`;
    return;
  }
  el.innerHTML = records.map(record => {
    const summary = buildSummary(record);
    return `
      <details class="admin-record" open>
        <summary>
          <span>${escapeHtml(record.date || record.file || 'record')}</span>
          <span class="admin-record-sub">${escapeHtml(summary)}</span>
        </summary>
        <pre>${escapeHtml(JSON.stringify(record, null, 2))}</pre>
      </details>
    `;
  }).join('');
}

function buildSummary(record) {
  if (record.total_calories != null) {
    return `${record.total_calories} kcal · ${record.meals?.length || 0} 餐`;
  }
  if (Array.isArray(record.exercises)) {
    return `${record.exercises.length} 个动作`;
  }
  return record.file || '-';
}

function renderUserLink() {
  const link = document.getElementById('user-dashboard-link');
  const token = RAW_DATA.user?.dashboard_token;
  if (!token) {
    link.classList.add('disabled');
    link.removeAttribute('href');
    return;
  }
  link.classList.remove('disabled');
  link.href = `/?token=${encodeURIComponent(token)}`;
}

function updateTimestamp(extraText = '') {
  const el = document.getElementById('updated-at');
  const base = RAW_DATA?.generated_at
    ? `读取于 ${new Date(RAW_DATA.generated_at).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
    : '等待读取';
  el.textContent = extraText ? `${base} · ${extraText}` : base;
}

function syncUrl() {
  const params = new URLSearchParams();
  if (CURRENT_SENDER_ID) params.set('sender_id', CURRENT_SENDER_ID);
  if (CURRENT_DAYS) params.set('days', String(CURRENT_DAYS));
  history.replaceState({}, '', `${location.pathname}?${params.toString()}`);
}

function showDashboard() {
  document.getElementById('loading').classList.add('hidden');
  document.getElementById('error').classList.add('hidden');
  document.getElementById('dashboard').classList.remove('hidden');
}

function showError(text) {
  document.getElementById('loading').classList.add('hidden');
  document.getElementById('dashboard').classList.add('hidden');
  document.getElementById('error').classList.remove('hidden');
  document.getElementById('error-text').textContent = text;
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
