/* app.js: TON Unlocks Tracker logic - Final version with fixed pagination */

// ---------------- Helper classes & functions ----------------
class VestingWallet {
  constructor(data) {
    this.address = data.address;
    this.start_time = data.start_time; // unix timestamp (seconds)
    this.total_duration = data.total_duration; // seconds
    this.unlock_period = data.unlock_period; // seconds
    this.cliff_duration = data.cliff_duration; // seconds
    this.total_amount = data.total_amount; // nanoTON (1e9)
    this.sender_address = data.sender_address;
    this.owner_address = data.owner_address;
    this.whitelist = data.whitelist;
  }

  // Заблокированное количество токенов на момент ts (unix seconds)
  get_locked_amount(ts) {
    if (typeof ts === 'string') {
      ts = Math.floor(new Date(ts).getTime() / 1000);
    }

    if (ts > this.start_time + this.total_duration) {
      return 0;
    }

    if (ts < this.start_time + this.cliff_duration) {
      return this.total_amount;
    }

    const periods_passed = Math.floor((ts - this.start_time) / this.unlock_period);
    const total_periods = Math.floor(this.total_duration / this.unlock_period);

    return this.total_amount - (this.total_amount * periods_passed) / total_periods;
  }

  // Разблокированное количество TON на момент ts (unix seconds) в TON (не nano)
  get_unlocked_ton(ts) {
    const locked = this.get_locked_amount(ts);
    return (this.total_amount - locked) / 1e9;
  }
}

// Mock data for demonstration (fallback if API fails)
function generateMockData() {
  const mockWallets = [];
  const baseTime = Math.floor(Date.parse('2024-06-01T09:00:00Z') / 1000);
  
  for (let i = 0; i < 25; i++) {
    mockWallets.push({
      address: `EQA${Math.random().toString(36).substring(2, 45)}`,
      start_time: baseTime + i * 86400 * 30, // Staggered starts
      total_duration: 86400 * 365 * 2, // 2 years
      unlock_period: 86400 * 30, // Monthly unlocks
      cliff_duration: 86400 * 90, // 3 month cliff
      total_amount: Math.floor(Math.random() * 50000000) * 1e9, // Random amounts in nanoTON
      sender_address: `EQB${Math.random().toString(36).substring(2, 45)}`,
      owner_address: `EQC${Math.random().toString(36).substring(2, 45)}`,
      whitelist: null
    });
  }
  
  return mockWallets.map(w => new VestingWallet(w));
}

// Fetch vesting-wallets.json with fallback
async function loadVestingData() {
  const urls = [
    'https://unlocks.gosunov.ru/vesting-wallets.json',
    // CORS proxy as fallback
    'https://api.allorigins.win/raw?url=https://unlocks.gosunov.ru/vesting-wallets.json'
  ];
  
  for (const url of urls) {
    try {
      console.log(`Trying to fetch from: ${url}`);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (Array.isArray(json) && json.length > 0) {
        console.log(`Successfully loaded ${json.length} wallets from API`);
        return json.map((w) => new VestingWallet(w));
      }
    } catch (err) {
      console.warn(`Failed to load from ${url}:`, err);
    }
  }
  
  // Fallback to mock data
  console.log('Using mock data as fallback');
  return generateMockData();
}

// Utility: date range array (Date objects, inclusive)
function dateRange(start, end) {
  const out = [];
  const cur = new Date(start);
  while (cur <= end) {
    out.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

// Sum locked amount for all wallets at ts
function getTotalLocked(wallets, ts) {
  let sum = 0;
  for (const w of wallets) {
    sum += w.get_locked_amount(ts);
  }
  return sum; // nanoTON
}

// Cum unlock dataset
function calculateCumulativeUnlocks(wallets) {
  if (!wallets.length) return [];
  
  // Find earliest start time
  const earliestStart = wallets.reduce((min, w) => Math.min(min, w.start_time), wallets[0].start_time);
  
  // Create date range from earliest start to 1 year from now
  const start = new Date(earliestStart * 1000);
  const today = new Date();
  const end = new Date(today.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year from now

  const dates = dateRange(start, end);
  const totalLockedInitially = getTotalLocked(wallets, earliestStart);

  return dates.map((d) => {
    const ts = Math.floor(d.getTime() / 1000);
    const locked = getTotalLocked(wallets, ts);
    const unlockedNano = totalLockedInitially - locked;
    return {
      date: d,
      unlockedTon: Math.max(0, unlockedNano / 1e9),
    };
  });
}

// Format number with separators, max 2 decimals
const formatTon = (num) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(num);

// Shorten address (workchain:hash > first 6 ... last 4)
function shortAddr(addr) {
  if (!addr || addr.length < 10) return addr;
  return addr.slice(0, 6) + '...' + addr.slice(-4);
}

// Convert unix seconds to YYYY-MM-DD
function tsToDate(ts) {
  return new Date(ts * 1000).toISOString().slice(0, 10);
}

// Determine wallet status for nowTs
function walletStatus(wallet, nowTs) {
  const locked = wallet.get_locked_amount(nowTs);
  if (locked === 0) return 'unlocked';
  if (locked === wallet.total_amount) return 'locked';
  return 'partial';
}

// ---------------- UI Logic ----------------

const elements = {
  dataStatus: document.getElementById('data-status'),
  dataDate: document.getElementById('data-date'),
  chartCanvas: document.getElementById('unlocks-chart'),
  totalUnlockedEl: document.getElementById('total-unlocked'),
  currentDateEl: document.getElementById('current-date'),
  tbody: document.getElementById('wallets-tbody'),
  pagination: {
    info: document.getElementById('pagination-info'),
    prev: document.getElementById('prev-page'),
    next: document.getElementById('next-page'),
  },
  searchInput: document.getElementById('search-input'),
  statusFilter: document.getElementById('status-filter'),
};

let wallets = [];
let unlockData = [];
let chartInstance = null;

// Pagination state
let currentPage = 1;
const rowsPerPage = 10;
let filteredWallets = [];

function renderChart() {
  if (chartInstance) {
    chartInstance.destroy();
  }
  
  if (!unlockData.length) {
    console.warn('No unlock data to render chart');
    return;
  }
  
  const labels = unlockData.map((d) => d.date.toISOString().slice(0, 10));
  const dataValues = unlockData.map((d) => d.unlockedTon);

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayIdx = labels.indexOf(todayStr);
  const unlockedToday = todayIdx >= 0 ? dataValues[todayIdx] : dataValues[dataValues.length - 1] || 0;

  const redDotData = labels.map(() => null);
  if (todayIdx >= 0) redDotData[todayIdx] = unlockedToday;

  chartInstance = new Chart(elements.chartCanvas.getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Разблокировано TON',
          data: dataValues,
          borderColor: '#1F77F0',
          backgroundColor: 'rgba(31,119,240,0.15)',
          fill: true,
          tension: 0.2,
          pointRadius: 0,
        },
        {
          label: 'Сегодня',
          data: redDotData,
          borderColor: 'red',
          backgroundColor: 'red',
          pointRadius: 5,
          showLine: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Разблокировано TON',
          },
        },
        x: {
          ticks: {
            maxRotation: 45,
            minRotation: 45,
          },
        },
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          callbacks: {
            label: (ctx) => `${formatTon(ctx.parsed.y)} TON`,
          },
        },
      },
    },
  });

  // Update stats
  elements.totalUnlockedEl.textContent = `${formatTon(unlockedToday)} TON`;
  elements.currentDateEl.textContent = todayStr;
}

function applyFilters() {
  const query = elements.searchInput.value.trim().toLowerCase();
  const status = elements.statusFilter.value;
  const nowTs = Math.floor(Date.now() / 1000);

  filteredWallets = wallets.filter((w) => {
    const addrMatch = w.address.toLowerCase().includes(query);
    let statusMatch = true;
    if (status !== 'all') {
      statusMatch = walletStatus(w, nowTs) === status;
    }
    return addrMatch && statusMatch;
  });
  currentPage = 1;
  renderTable();
}

function renderTable() {
  const tbody = elements.tbody;
  tbody.innerHTML = '';
  
  if (!filteredWallets.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 6;
    td.className = 'loading-cell';
    td.textContent = 'Нет данных';
    tr.appendChild(td);
    tbody.appendChild(tr);
    updatePaginationControls();
    return;
  }

  const startIdx = (currentPage - 1) * rowsPerPage;
  const pageWallets = filteredWallets.slice(startIdx, startIdx + rowsPerPage);
  const nowTs = Math.floor(Date.now() / 1000);

  for (const w of pageWallets) {
    const tr = document.createElement('tr');
    const totalTon = w.total_amount / 1e9;
    const lockedNow = w.get_locked_amount(nowTs);
    const unlockedTon = (w.total_amount - lockedNow) / 1e9;
    const progressPct = totalTon > 0 ? (unlockedTon / totalTon) * 100 : 0;
    const status = walletStatus(w, nowTs);

    const statusText = status === 'locked' ? 'Заблокировано' : 
                     status === 'unlocked' ? 'Разблокировано' : 'Частично';

    tr.innerHTML = `
      <td><a href="https://tonviewer.com/${w.address}" target="_blank">${shortAddr(w.address)}</a></td>
      <td>${formatTon(totalTon)}</td>
      <td>${tsToDate(w.start_time)}</td>
      <td>${tsToDate(w.start_time + w.total_duration)}</td>
      <td><span class="status status--${status === 'unlocked' ? 'success' : status === 'locked' ? 'error' : 'warning'}">${statusText}</span></td>
      <td>${progressPct.toFixed(1)}%</td>
    `;
    tbody.appendChild(tr);
  }

  updatePaginationControls();
}

function updatePaginationControls() {
  const totalPages = Math.max(1, Math.ceil(filteredWallets.length / rowsPerPage));
  elements.pagination.info.textContent = `Страница ${currentPage} из ${totalPages}`;
  elements.pagination.prev.disabled = currentPage === 1;
  elements.pagination.next.disabled = currentPage === totalPages;
}

function goToPage(pageNum) {
  const totalPages = Math.ceil(filteredWallets.length / rowsPerPage);
  if (pageNum >= 1 && pageNum <= totalPages) {
    currentPage = pageNum;
    renderTable();
  }
}

// ---------------- Initialization ----------------
async function init() {
  try {
    elements.dataStatus.textContent = 'Загрузка данных...';
    elements.dataStatus.className = 'status status--info';
    
    // Load wallets
    wallets = await loadVestingData();
    console.log(`Loaded ${wallets.length} wallets`);

    if (!wallets.length) {
      throw new Error('No wallets loaded');
    }

    // Set data date as now
    const now = new Date();
    elements.dataDate.textContent = `Данные на ${now.toISOString().slice(0, 10)}`;

    // Compute unlock data & chart
    unlockData = calculateCumulativeUnlocks(wallets);
    console.log(`Generated ${unlockData.length} data points for chart`);
    
    if (unlockData.length > 0) {
      renderChart();
    }

    // Prepare table
    filteredWallets = [...wallets];
    renderTable();

    elements.dataStatus.textContent = 'Данные загружены';
    elements.dataStatus.className = 'status status--success';
    
  } catch (err) {
    console.error('Init error:', err);
    elements.dataStatus.textContent = 'Ошибка загрузки данных';
    elements.dataStatus.className = 'status status--error';
    
    // Show error details in table
    const tbody = elements.tbody;
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="loading-cell">
          Ошибка загрузки: ${err.message}<br>
          <small>Проверьте консоль для подробностей</small>
        </td>
      </tr>
    `;
  }
}

// Event listeners with proper pagination handling
elements.pagination.prev.addEventListener('click', (e) => {
  e.preventDefault();
  if (currentPage > 1) {
    goToPage(currentPage - 1);
  }
});

elements.pagination.next.addEventListener('click', (e) => {
  e.preventDefault();
  const totalPages = Math.ceil(filteredWallets.length / rowsPerPage);
  if (currentPage < totalPages) {
    goToPage(currentPage + 1);
  }
});

elements.searchInput.addEventListener('input', applyFilters);
elements.statusFilter.addEventListener('change', applyFilters);

// Run init when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}