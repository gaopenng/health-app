/* ── 全局状态 ──────────────────────────────────────────────────────── */
let DATA = null;         // 原始 JSON 数据
let DAYS = 7;            // 当前时间维度（7 或 30）
let charts = {};         // Chart.js 实例缓存
let TOKEN = null;        // 当前 dashboard token

/* ── 入口 ─────────────────────────────────────────────────────────── */
(async function init() {
  TOKEN = new URLSearchParams(location.search).get('token');
  if (!TOKEN) return showError();

  const ok = await loadDashboardData();
  if (!ok) return showError();

  showDashboard();
  bindRangeToggle();
  bindRefreshButton();
  render();
})();

/* ── 状态切换 ─────────────────────────────────────────────────────── */
function showError() {
  document.getElementById('loading').classList.add('hidden');
  document.getElementById('error').classList.remove('hidden');
}

function showDashboard() {
  document.getElementById('loading').classList.add('hidden');
  document.getElementById('dashboard').classList.remove('hidden');
  updateTimestamp();
}

function updateTimestamp(extraText = '') {
  const el = document.getElementById('updated-at');
  if (!el) return;
  if (!DATA?.generated_at) {
    el.textContent = extraText;
    return;
  }
  const d = new Date(DATA.generated_at);
  const base = `更新于 ${d.toLocaleString('zh-CN', { month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit' })}`;
  el.textContent = extraText ? `${base} · ${extraText}` : base;
}

async function loadDashboardData() {
  try {
    const res = await fetch(`data/${TOKEN}.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return false;
    DATA = await res.json();
    return true;
  } catch {
    return false;
  }
}

/* ── 时间维度切换 ─────────────────────────────────────────────────── */
function bindRangeToggle() {
  document.querySelectorAll('.range-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      DAYS = parseInt(btn.dataset.days, 10);
      render();
    });
  });
}

function bindRefreshButton() {
  const btn = document.getElementById('refresh-btn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.textContent = '刷新中...';
    updateTimestamp('正在拉取最新数据');

    const ok = await loadDashboardData();
    if (ok) {
      render();
      updateTimestamp('刚刚刷新');
    } else {
      updateTimestamp('刷新失败，请重试');
    }

    window.setTimeout(() => {
      btn.disabled = false;
      btn.textContent = '刷新数据';
      updateTimestamp();
    }, ok ? 1200 : 1800);
  });
}

/* ── 主渲染入口 ───────────────────────────────────────────────────── */
function render() {
  const sliced = sliceStats(DAYS);
  renderCards(sliced);
  renderWeightChart(sliceWeight(DAYS));
  renderCaloriesChart(sliced);
  renderMacroDonut(sliced);
  renderHeatmap();   // 热力图固定显示近 30 天
  document.getElementById('day-detail').classList.add('hidden');
}

/* ── 数据切片工具 ─────────────────────────────────────────────────── */
function sliceStats(days) {
  const stats = DATA.daily_stats || [];
  return stats.slice(-days);
}

function sliceWeight(days) {
  const wh = DATA.weight_history || [];
  // weight_history 只存有记录的日期，按日期截取近 N 天范围
  const cutoff = daysAgo(days);
  return wh.filter(w => w.date >= cutoff);
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n + 1);
  return d.toISOString().slice(0, 10);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

/* ── 摘要卡片 ─────────────────────────────────────────────────────── */
function renderCards(sliced) {
  const profile = DATA.profile || {};
  const todayStr = today();
  const todayData = (DATA.daily_stats || []).find(d => d.date === todayStr) || null;

  // 热量
  const cal      = todayData ? todayData.calories : null;
  const calGoal  = profile.daily_calorie_target || 2000;
  const calPct   = cal != null ? Math.min(cal / calGoal, 1) : 0;
  const calOver  = cal != null && cal > calGoal;
  document.getElementById('card-calories').textContent = cal != null ? `${cal} kcal` : '暂无';
  document.getElementById('card-calories-sub').textContent =
    cal != null ? `目标 ${calGoal} kcal · ${Math.round(calPct * 100)}%` : '今日尚未记录';
  setBar('card-calories-bar', calPct, calOver ? 'over' : calPct > 0.85 ? 'warn' : '');

  // 蛋白质
  const prot     = todayData ? todayData.protein_g : null;
  const protGoal = profile.protein_target_g || 120;
  const protPct  = prot != null ? Math.min(prot / protGoal, 1) : 0;
  document.getElementById('card-protein').textContent = prot != null ? `${prot} g` : '暂无';
  document.getElementById('card-protein-sub').textContent =
    prot != null ? `目标 ${protGoal} g · ${Math.round(protPct * 100)}%` : '今日尚未记录';
  setBar('card-protein-bar', protPct, '');

  // 体重
  const wh   = DATA.weight_history || [];
  const last = wh.length ? wh[wh.length - 1] : null;
  const prev = wh.length > 1 ? wh[wh.length - 2] : null;
  document.getElementById('card-weight').textContent = last ? `${last.weight_kg} kg` : '暂无';
  if (last && prev) {
    const diff = (last.weight_kg - prev.weight_kg).toFixed(1);
    document.getElementById('card-weight-sub').textContent =
      `较上次 ${diff > 0 ? '↑' : '↓'} ${Math.abs(diff)} kg`;
  } else {
    document.getElementById('card-weight-sub').textContent = last ? last.date : '';
  }

  // 训练
  const trainedDays = sliced.filter(d => d.trained).length;
  const wkTarget    = profile.weekly_workout_target || 3;
  document.getElementById('card-workouts').textContent = `${trainedDays} 天`;
  document.getElementById('card-workouts-sub').textContent =
    DAYS === 7 ? `本周目标 ${wkTarget} 天` : `近 30 天`;
}

function setBar(id, pct, extra) {
  const el = document.getElementById(id);
  el.style.width = `${Math.round(pct * 100)}%`;
  el.className = 'card-bar' + (extra ? ' ' + extra : '');
}

/* ── 体重趋势折线图 ───────────────────────────────────────────────── */
function renderWeightChart(weightData) {
  const labels = weightData.map(w => fmtDate(w.date));
  const values = weightData.map(w => w.weight_kg);

  const cfg = {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: '体重 (kg)',
        data: values,
        borderColor: '#5b8dee',
        backgroundColor: 'rgba(91,141,238,.12)',
        pointRadius: 4,
        pointHoverRadius: 6,
        tension: 0.35,
        fill: true,
      }]
    },
    options: commonLineOpts({ unit: ' kg', suggestRangeFromData: true }),
  };
  rebuildChart('chart-weight', cfg);
}

/* ── 每日热量柱状图 ───────────────────────────────────────────────── */
function renderCaloriesChart(sliced) {
  const calGoal = (DATA.profile || {}).daily_calorie_target || 2000;
  const labels  = sliced.map(d => fmtDate(d.date));
  const values  = sliced.map(d => d.calories || 0);

  const cfg = {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: '摄入热量',
          data: values,
          backgroundColor: values.map(v =>
            v > calGoal * 1.1 ? 'rgba(224,92,92,.75)' :
            v > calGoal * 0.85 ? 'rgba(240,168,67,.75)' :
            'rgba(91,141,238,.75)'
          ),
          borderRadius: 4,
          borderSkipped: false,
        },
        {
          label: '目标',
          data: sliced.map(() => calGoal),
          type: 'line',
          borderColor: 'rgba(255,255,255,.25)',
          borderDash: [4, 4],
          pointRadius: 0,
          borderWidth: 1.5,
          fill: false,
        }
      ]
    },
    options: {
      ...commonOpts(),
      onClick: (evt, elements) => {
        if (!elements.length) return;
        const idx = elements[0].index;
        showDayDetail(sliced[idx]);
      },
    }
  };
  rebuildChart('chart-calories', cfg);
}

/* ── 宏量营养素环形图 ─────────────────────────────────────────────── */
function renderMacroDonut(sliced) {
  const nonZero = sliced.filter(d => d.calories > 0);
  const avg = key => nonZero.length
    ? Math.round(nonZero.reduce((s, d) => s + (d[key] || 0), 0) / nonZero.length)
    : 0;

  const prot = avg('protein_g');
  const carb = avg('carb_g');
  const fat  = avg('fat_g');

  // 卡路里换算（用于环图占比）
  const protKcal = prot * 4;
  const carbKcal = carb * 4;
  const fatKcal  = fat  * 9;
  const total    = protKcal + carbKcal + fatKcal || 1;

  const COLORS = ['#43c98a', '#5b8dee', '#f0a843'];
  const labels  = ['蛋白质', '碳水', '脂肪'];
  const grams   = [prot, carb, fat];
  const kcals   = [protKcal, carbKcal, fatKcal];

  const cfg = {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: kcals,
        backgroundColor: COLORS,
        borderWidth: 0,
        hoverOffset: 6,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${Math.round(ctx.parsed / total * 100)}%`
          }
        }
      }
    }
  };
  rebuildChart('chart-macro', cfg);

  // 自定义图例
  const legendEl = document.getElementById('macro-legend');
  legendEl.innerHTML = labels.map((lbl, i) => `
    <div class="macro-item">
      <span class="macro-dot" style="background:${COLORS[i]}"></span>
      <span>${lbl}</span>
      <span class="macro-item-val">${grams[i]}g</span>
    </div>
  `).join('');
}

/* ── 训练热力图 ───────────────────────────────────────────────────── */
function renderHeatmap() {
  const stats  = DATA.daily_stats || [];
  const map    = Object.fromEntries(stats.map(d => [d.date, d]));
  const el     = document.getElementById('heatmap');
  const days   = 30;
  const cells  = [];

  for (let i = days - 1; i >= 0; i--) {
    const d   = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const s   = map[key];
    cells.push({ key, trained: s ? !!s.trained : false, data: s || null });
  }

  el.innerHTML = cells.map(c => `
    <span
      class="heatmap-cell ${c.trained ? 'heatmap-trained' : 'heatmap-rest'}"
      data-date="${c.key}"
      title="${c.key}${c.trained ? ' · 已训练' : ''}"
    ></span>
  `).join('');

  // 点击日期格子 → 日详情
  el.querySelectorAll('.heatmap-cell').forEach(span => {
    span.addEventListener('click', () => {
      const key = span.dataset.date;
      const s   = map[key];
      if (s) showDayDetail(s);
    });
  });
}

/* ── 日详情面板 ───────────────────────────────────────────────────── */
function showDayDetail(dayData) {
  if (!dayData) return;
  const profile = DATA.profile || {};

  document.getElementById('day-detail-date').textContent = `📅 ${dayData.date}`;

  const calGoal  = profile.daily_calorie_target || 2000;
  const protGoal = profile.protein_target_g || 120;
  const calPct   = Math.round((dayData.calories || 0) / calGoal * 100);
  const protPct  = Math.round((dayData.protein_g || 0) / protGoal * 100);
  const protWarn = (dayData.protein_g || 0) < protGoal * 0.8 ? ' ⚠️ 偏低' : '';

  // 训练动作列表
  const workouts = (DATA.recent_workouts || []).find(w => w.date === dayData.date);
  const exList   = workouts && workouts.exercises.length
    ? workouts.exercises.join('、')
    : '今日未训练';

  document.getElementById('day-detail-body').innerHTML = `
    <strong>🥗 热量</strong>：${dayData.calories || 0} / ${calGoal} kcal（${calPct}%）<br>
    <strong>💪 蛋白质</strong>：${dayData.protein_g || 0} / ${protGoal} g（${protPct}%）${protWarn}<br>
    <strong>🍞 碳水</strong>：${dayData.carb_g || 0} g
    <strong>🧈 脂肪</strong>：${dayData.fat_g || 0} g<br>
    <strong>🏋️ 训练</strong>：${exList}
  `;

  document.getElementById('day-detail').classList.remove('hidden');
  document.getElementById('day-detail').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

document.getElementById('day-detail-close').addEventListener('click', () => {
  document.getElementById('day-detail').classList.add('hidden');
});

/* ── Chart.js 工具 ────────────────────────────────────────────────── */
function rebuildChart(id, cfg) {
  if (charts[id]) {
    charts[id].destroy();
    delete charts[id];
  }
  charts[id] = new Chart(document.getElementById(id), cfg);
}

function commonOpts() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1a1d27',
        borderColor: '#2e3147',
        borderWidth: 1,
        titleColor: '#e8eaf0',
        bodyColor: '#7c8099',
        padding: 10,
      }
    },
    scales: {
      x: {
        grid:  { color: 'rgba(255,255,255,.05)' },
        ticks: { color: '#7c8099', maxRotation: 0 },
      },
      y: {
        grid:  { color: 'rgba(255,255,255,.05)' },
        ticks: { color: '#7c8099' },
      }
    }
  };
}

function commonLineOpts({ unit = '', suggestRangeFromData = false } = {}) {
  const opts = commonOpts();
  opts.plugins.tooltip.callbacks = {
    label: ctx => ` ${ctx.parsed.y}${unit}`
  };
  if (suggestRangeFromData) {
    opts.scales.y.suggestedMin = undefined;  // Chart.js 自动推断
  }
  return opts;
}

/* ── 日期格式化 ───────────────────────────────────────────────────── */
function fmtDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
