// TON Unlocks Tracker - Main Application Logic

class TONUnlocksTracker {
    constructor() {
        this.wallets = [];
        this.metadata = {};
        this.marketData = {};
        this.countdownInterval = null;
        this.charts = {};
        this.currentWallets = [];
        
        this.init();
    }

    async init() {
        try {
            this.showLoading();
            await this.loadData();
            this.setupEventListeners();
            this.renderDashboard();
            this.renderWallets();
            this.renderSchedule();
            this.renderStats();
            this.startCountdown();
            this.hideLoading();
        } catch (error) {
            console.error('Initialization error:', error);
            this.showError('Failed to initialize the application. Please refresh the page.');
        }
    }

    async loadData() {
        try {
            // Use embedded data for demo purposes
            const data = {
                "wallets": [
                    {
                        "address": "0:1234567890abcdef1234567890abcdef12345678",
                        "label": "Team Vesting Wallet #1",
                        "category": "team",
                        "vesting_total_amount": 10000000000000000,
                        "vesting_start_time": 1704067200,
                        "vesting_total_duration": 31536000,
                        "unlock_period": 2592000,
                        "cliff_duration": 7776000,
                        "unlocked_amount": 2500000000000000,
                        "locked_amount": 7500000000000000
                    },
                    {
                        "address": "0:abcdef1234567890abcdef1234567890abcdef12",
                        "label": "Investor Series A",
                        "category": "investors",
                        "vesting_total_amount": 50000000000000000,
                        "vesting_start_time": 1706745600,
                        "vesting_total_duration": 63072000,
                        "unlock_period": 2592000,
                        "cliff_duration": 15552000,
                        "unlocked_amount": 12500000000000000,
                        "locked_amount": 37500000000000000
                    },
                    {
                        "address": "0:fedcba0987654321fedcba0987654321fedcba09",
                        "label": "Foundation Reserve",
                        "category": "foundation",
                        "vesting_total_amount": 100000000000000000,
                        "vesting_start_time": 1698796800,
                        "vesting_total_duration": 126144000,
                        "unlock_period": 7776000,
                        "cliff_duration": 31536000,
                        "unlocked_amount": 25000000000000000,
                        "locked_amount": 75000000000000000
                    },
                    {
                        "address": "0:9876543210fedcba9876543210fedcba98765432",
                        "label": "Ecosystem Development",
                        "category": "ecosystem",
                        "vesting_total_amount": 30000000000000000,
                        "vesting_start_time": 1709424000,
                        "vesting_total_duration": 94608000,
                        "unlock_period": 2592000,
                        "cliff_duration": 0,
                        "unlocked_amount": 10000000000000000,
                        "locked_amount": 20000000000000000
                    },
                    {
                        "address": "0:5555aaaa5555aaaa5555aaaa5555aaaa5555aaaa",
                        "label": "Community Rewards",
                        "category": "community",
                        "vesting_total_amount": 75000000000000000,
                        "vesting_start_time": 1719792000,
                        "vesting_total_duration": 157680000,
                        "unlock_period": 7776000,
                        "cliff_duration": 23328000,
                        "unlocked_amount": 5000000000000000,
                        "locked_amount": 70000000000000000
                    },
                    {
                        "address": "0:bbbbccccbbbbccccbbbbccccbbbbccccbbbbcccc",
                        "label": "Strategic Partners",
                        "category": "partners",
                        "vesting_total_amount": 25000000000000000,
                        "vesting_start_time": 1711843200,
                        "vesting_total_duration": 47304000,
                        "unlock_period": 2592000,
                        "cliff_duration": 10368000,
                        "unlocked_amount": 8000000000000000,
                        "locked_amount": 17000000000000000
                    }
                ],
                "metadata": {
                    "last_updated": "2024-11-08T00:00:00Z",
                    "total_wallets": 6,
                    "total_locked": 205000000000000000,
                    "total_unlocked": 63000000000000000,
                    "data_source": "DTON GraphQL API"
                },
                "ton_market_data": {
                    "price_usd": 2.96,
                    "price_change_24h": 1.6,
                    "market_cap": 7308995880,
                    "volume_24h": 341957941,
                    "tvl": 148830000,
                    "stablecoins_mcap": 616150000
                }
            };

            this.wallets = data.wallets;
            this.currentWallets = [...this.wallets];
            this.metadata = data.metadata;
            this.marketData = data.ton_market_data;
            
            this.updateTonPrice();
        } catch (error) {
            console.error('Data loading error:', error);
            throw new Error('Failed to load data');
        }
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const section = e.target.dataset.section;
                this.showSection(section);
            });
        });

        // Filters
        const searchInput = document.getElementById('wallet-search');
        const categoryFilter = document.getElementById('category-filter');
        
        if (searchInput) {
            searchInput.addEventListener('input', () => this.filterWallets());
        }
        
        if (categoryFilter) {
            categoryFilter.addEventListener('change', () => this.filterWallets());
        }

        // View toggles
        document.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.renderSchedule(e.target.dataset.view);
            });
        });

        // Wallet address clicks
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('wallet-address')) {
                e.preventDefault();
                const address = e.target.textContent;
                window.open(`https://tonviewer.com/${address}`, '_blank');
            }
        });
    }

    showSection(sectionName) {
        // Update navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        const activeBtn = document.querySelector(`[data-section="${sectionName}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }

        // Update sections
        document.querySelectorAll('.section').forEach(section => {
            section.classList.remove('active');
        });
        const activeSection = document.getElementById(sectionName);
        if (activeSection) {
            activeSection.classList.add('active');
        }

        // Render section-specific content
        if (sectionName === 'wallets') {
            this.renderWallets();
        } else if (sectionName === 'schedule') {
            this.renderSchedule();
        } else if (sectionName === 'stats') {
            this.renderStats();
        }
    }

    nanotonToTon(nanoton) {
        return nanoton / 1000000000;
    }

    formatNumber(num) {
        if (num >= 1000000000) {
            return (num / 1000000000).toFixed(1) + 'B';
        } else if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toLocaleString();
    }

    formatTonAmount(nanoton) {
        const ton = this.nanotonToTon(nanoton);
        return this.formatNumber(ton) + ' TON';
    }

    formatDate(timestamp) {
        const date = new Date(timestamp * 1000);
        return date.toLocaleDateString('en-US', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    }

    calculateUnlockProgress(wallet) {
        const now = Math.floor(Date.now() / 1000);
        const startTime = wallet.vesting_start_time;
        const cliffEnd = startTime + wallet.cliff_duration;
        const totalDuration = wallet.vesting_total_duration;
        const endTime = startTime + totalDuration;
        
        if (now < cliffEnd) {
            return 0;
        } else if (now >= endTime) {
            return 100;
        } else {
            const vestedTime = now - cliffEnd;
            const vestingDuration = totalDuration - wallet.cliff_duration;
            return (vestedTime / vestingDuration) * 100;
        }
    }

    getNextUnlockEvent() {
        const now = Math.floor(Date.now() / 1000);
        let nextUnlock = null;
        let minTime = Infinity;

        this.wallets.forEach(wallet => {
            const startTime = wallet.vesting_start_time;
            const cliffEnd = startTime + wallet.cliff_duration;
            const endTime = startTime + wallet.vesting_total_duration;
            
            if (now >= endTime) return;
            
            let nextUnlockTime;
            if (now < cliffEnd) {
                nextUnlockTime = cliffEnd;
            } else {
                const timeSinceCliff = now - cliffEnd;
                const periodsPassed = Math.floor(timeSinceCliff / wallet.unlock_period);
                nextUnlockTime = cliffEnd + (periodsPassed + 1) * wallet.unlock_period;
            }
            
            if (nextUnlockTime < minTime && nextUnlockTime > now) {
                minTime = nextUnlockTime;
                nextUnlock = {
                    wallet: wallet,
                    time: nextUnlockTime,
                    amount: wallet.vesting_total_amount / (wallet.vesting_total_duration / wallet.unlock_period)
                };
            }
        });

        return nextUnlock;
    }

    updateTonPrice() {
        const priceElement = document.getElementById('ton-price');
        if (priceElement) {
            const priceValue = priceElement.querySelector('.price-value');
            const priceChange = priceElement.querySelector('.price-change');
            
            if (priceValue) {
                priceValue.textContent = `$${this.marketData.price_usd.toFixed(2)}`;
            }
            
            if (priceChange) {
                const changeText = this.marketData.price_change_24h > 0 ? 
                    `+${this.marketData.price_change_24h.toFixed(2)}%` : 
                    `${this.marketData.price_change_24h.toFixed(2)}%`;
                
                priceChange.textContent = changeText;
                priceChange.className = `price-change ${this.marketData.price_change_24h > 0 ? 'positive' : 'negative'}`;
            }
        }
    }

    renderDashboard() {
        // Update stats
        const totalLocked = this.wallets.reduce((sum, w) => sum + w.locked_amount, 0);
        const totalUnlocked = this.wallets.reduce((sum, w) => sum + w.unlocked_amount, 0);
        
        const totalLockedEl = document.getElementById('total-locked');
        const totalUnlockedEl = document.getElementById('total-unlocked');
        const totalWalletsEl = document.getElementById('total-wallets');
        const marketCapEl = document.getElementById('market-cap');
        
        if (totalLockedEl) totalLockedEl.textContent = this.formatTonAmount(totalLocked);
        if (totalUnlockedEl) totalUnlockedEl.textContent = this.formatTonAmount(totalUnlocked);
        if (totalWalletsEl) totalWalletsEl.textContent = this.wallets.length;
        if (marketCapEl) marketCapEl.textContent = `$${this.formatNumber(this.marketData.market_cap)}`;

        // Render charts
        setTimeout(() => this.renderCharts(), 100);
    }

    renderCharts() {
        this.renderUnlockScheduleChart();
        this.renderWalletDistributionChart();
        this.renderCategoryProgressChart();
    }

    renderUnlockScheduleChart() {
        const ctx = document.getElementById('unlock-schedule-chart');
        if (!ctx) return;

        const monthlyData = this.getMonthlyUnlockData();
        
        if (this.charts.unlockSchedule) {
            this.charts.unlockSchedule.destroy();
        }

        this.charts.unlockSchedule = new Chart(ctx, {
            type: 'line',
            data: {
                labels: monthlyData.map(d => d.month),
                datasets: [{
                    label: 'Monthly Unlocks (TON)',
                    data: monthlyData.map(d => this.nanotonToTon(d.amount)),
                    borderColor: '#0088cc',
                    backgroundColor: 'rgba(0, 136, 204, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: '#ffffff'
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            color: '#e8e8e8'
                        },
                        grid: {
                            color: 'rgba(0, 136, 204, 0.1)'
                        }
                    },
                    y: {
                        ticks: {
                            color: '#e8e8e8'
                        },
                        grid: {
                            color: 'rgba(0, 136, 204, 0.1)'
                        }
                    }
                }
            }
        });
    }

    renderWalletDistributionChart() {
        const ctx = document.getElementById('wallet-distribution-chart');
        if (!ctx) return;

        const categoryData = this.getCategoryDistribution();
        
        if (this.charts.walletDistribution) {
            this.charts.walletDistribution.destroy();
        }

        this.charts.walletDistribution = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: categoryData.map(d => d.category),
                datasets: [{
                    data: categoryData.map(d => this.nanotonToTon(d.amount)),
                    backgroundColor: [
                        '#1FB8CD',
                        '#FFC185',
                        '#B4413C',
                        '#ECEBD5',
                        '#5D878F',
                        '#DB4545'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#ffffff',
                            padding: 20
                        }
                    }
                }
            }
        });
    }

    renderCategoryProgressChart() {
        const ctx = document.getElementById('category-progress-chart');
        if (!ctx) return;

        const categoryProgress = this.getCategoryProgress();
        
        if (this.charts.categoryProgress) {
            this.charts.categoryProgress.destroy();
        }

        this.charts.categoryProgress = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: categoryProgress.map(d => d.category),
                datasets: [{
                    label: 'Progress (%)',
                    data: categoryProgress.map(d => d.progress),
                    backgroundColor: '#0088cc',
                    borderColor: '#00b4ff',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: '#ffffff'
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            color: '#e8e8e8'
                        },
                        grid: {
                            color: 'rgba(0, 136, 204, 0.1)'
                        }
                    },
                    y: {
                        ticks: {
                            color: '#e8e8e8'
                        },
                        grid: {
                            color: 'rgba(0, 136, 204, 0.1)'
                        },
                        min: 0,
                        max: 100
                    }
                }
            }
        });
    }

    getMonthlyUnlockData() {
        const now = new Date();
        const monthlyData = [];
        
        for (let i = 0; i < 12; i++) {
            const month = new Date(now.getFullYear(), now.getMonth() + i, 1);
            const monthStart = Math.floor(month.getTime() / 1000);
            const monthEnd = Math.floor(new Date(month.getFullYear(), month.getMonth() + 1, 0).getTime() / 1000);
            
            let monthlyAmount = 0;
            
            this.wallets.forEach(wallet => {
                const unlockEvents = this.getUnlockEvents(wallet, monthStart, monthEnd);
                monthlyAmount += unlockEvents.reduce((sum, event) => sum + event.amount, 0);
            });
            
            monthlyData.push({
                month: month.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
                amount: monthlyAmount
            });
        }
        
        return monthlyData;
    }

    getCategoryDistribution() {
        const categories = {};
        
        this.wallets.forEach(wallet => {
            if (!categories[wallet.category]) {
                categories[wallet.category] = 0;
            }
            categories[wallet.category] += wallet.vesting_total_amount;
        });
        
        return Object.entries(categories).map(([category, amount]) => ({
            category: category.charAt(0).toUpperCase() + category.slice(1),
            amount
        }));
    }

    getCategoryProgress() {
        const categories = {};
        
        this.wallets.forEach(wallet => {
            if (!categories[wallet.category]) {
                categories[wallet.category] = { total: 0, unlocked: 0 };
            }
            categories[wallet.category].total += wallet.vesting_total_amount;
            categories[wallet.category].unlocked += wallet.unlocked_amount;
        });
        
        return Object.entries(categories).map(([category, data]) => ({
            category: category.charAt(0).toUpperCase() + category.slice(1),
            progress: (data.unlocked / data.total) * 100
        }));
    }

    getUnlockEvents(wallet, startTime, endTime) {
        const events = [];
        const cliffEnd = wallet.vesting_start_time + wallet.cliff_duration;
        const vestingEnd = wallet.vesting_start_time + wallet.vesting_total_duration;
        
        if (endTime <= cliffEnd || startTime >= vestingEnd) {
            return events;
        }
        
        const effectiveStart = Math.max(startTime, cliffEnd);
        const effectiveEnd = Math.min(endTime, vestingEnd);
        
        const periodsPassed = Math.floor((effectiveStart - cliffEnd) / wallet.unlock_period);
        let currentTime = cliffEnd + periodsPassed * wallet.unlock_period;
        
        while (currentTime < effectiveEnd) {
            currentTime += wallet.unlock_period;
            if (currentTime <= effectiveEnd) {
                events.push({
                    time: currentTime,
                    amount: wallet.vesting_total_amount / (wallet.vesting_total_duration / wallet.unlock_period)
                });
            }
        }
        
        return events;
    }

    renderWallets() {
        const walletsGrid = document.getElementById('wallets-grid');
        if (!walletsGrid) return;

        walletsGrid.innerHTML = this.currentWallets.map(wallet => {
            const progress = this.calculateUnlockProgress(wallet);
            const progressPercentage = Math.round(progress);
            
            return `
                <div class="wallet-card">
                    <div class="wallet-header">
                        <div>
                            <div class="wallet-label">${wallet.label}</div>
                            <div class="wallet-category category-${wallet.category}">${wallet.category}</div>
                        </div>
                    </div>
                    <div class="wallet-address">${wallet.address}</div>
                    <div class="wallet-stats">
                        <div class="wallet-stat">
                            <div class="wallet-stat-label">Total Amount</div>
                            <div class="wallet-stat-value">${this.formatTonAmount(wallet.vesting_total_amount)}</div>
                        </div>
                        <div class="wallet-stat">
                            <div class="wallet-stat-label">Unlocked</div>
                            <div class="wallet-stat-value">${this.formatTonAmount(wallet.unlocked_amount)}</div>
                        </div>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progressPercentage}%"></div>
                    </div>
                    <div class="progress-text">${progressPercentage}% unlocked</div>
                </div>
            `;
        }).join('');
    }

    filterWallets() {
        const searchInput = document.getElementById('wallet-search');
        const categoryFilter = document.getElementById('category-filter');
        
        if (!searchInput || !categoryFilter) return;
        
        const search = searchInput.value.toLowerCase();
        const category = categoryFilter.value;
        
        this.currentWallets = this.wallets.filter(wallet => {
            const matchesSearch = wallet.label.toLowerCase().includes(search) || 
                                wallet.address.toLowerCase().includes(search);
            const matchesCategory = !category || wallet.category === category;
            
            return matchesSearch && matchesCategory;
        });
        
        this.renderWallets();
    }

    renderSchedule(view = 'monthly') {
        const tbody = document.getElementById('schedule-tbody');
        if (!tbody) return;

        let scheduleData = this.getScheduleData(view);
        
        tbody.innerHTML = scheduleData.map(item => `
            <tr>
                <td>${this.formatDate(item.date)}</td>
                <td>${item.wallet.label}</td>
                <td>
                    <span class="category-badge category-${item.wallet.category}">
                        ${item.wallet.category}
                    </span>
                </td>
                <td>${this.formatTonAmount(item.amount)}</td>
                <td>${Math.round(this.calculateUnlockProgress(item.wallet))}%</td>
            </tr>
        `).join('');
    }

    getScheduleData(view) {
        const now = Math.floor(Date.now() / 1000);
        const scheduleData = [];
        
        this.wallets.forEach(wallet => {
            const events = this.getUpcomingUnlockEvents(wallet, view);
            scheduleData.push(...events);
        });
        
        return scheduleData.sort((a, b) => a.date - b.date);
    }

    getUpcomingUnlockEvents(wallet, view) {
        const now = Math.floor(Date.now() / 1000);
        const events = [];
        
        const cliffEnd = wallet.vesting_start_time + wallet.cliff_duration;
        const vestingEnd = wallet.vesting_start_time + wallet.vesting_total_duration;
        
        if (now >= vestingEnd) return events;
        
        const startTime = Math.max(now, cliffEnd);
        const endTime = view === 'monthly' ? now + (30 * 24 * 60 * 60) : // 30 days
                       view === 'yearly' ? now + (365 * 24 * 60 * 60) : // 1 year
                       vestingEnd; // full
        
        const periodsPassed = Math.floor((startTime - cliffEnd) / wallet.unlock_period);
        let currentTime = cliffEnd + periodsPassed * wallet.unlock_period;
        
        while (currentTime < Math.min(endTime, vestingEnd)) {
            currentTime += wallet.unlock_period;
            if (currentTime <= Math.min(endTime, vestingEnd)) {
                events.push({
                    date: currentTime,
                    wallet: wallet,
                    amount: wallet.vesting_total_amount / (wallet.vesting_total_duration / wallet.unlock_period)
                });
            }
        }
        
        return events;
    }

    renderStats() {
        this.renderTopWallets();
        this.renderMarketStats();
        setTimeout(() => this.renderCategoryProgressChart(), 100);
    }

    renderTopWallets() {
        const topWalletsList = document.getElementById('top-wallets-list');
        if (!topWalletsList) return;

        const sortedWallets = [...this.wallets].sort((a, b) => b.vesting_total_amount - a.vesting_total_amount);
        const topWallets = sortedWallets.slice(0, 5);

        topWalletsList.innerHTML = topWallets.map(wallet => `
            <div class="top-wallet-item">
                <div class="top-wallet-info">
                    <div class="top-wallet-label">${wallet.label}</div>
                    <div class="top-wallet-category">${wallet.category}</div>
                </div>
                <div class="top-wallet-amount">${this.formatTonAmount(wallet.vesting_total_amount)}</div>
            </div>
        `).join('');
    }

    renderMarketStats() {
        const marketStats = document.getElementById('market-stats');
        if (!marketStats) return;

        marketStats.innerHTML = `
            <div class="market-stat">
                <span class="market-stat-label">TON Price</span>
                <span class="market-stat-value">$${this.marketData.price_usd.toFixed(2)}</span>
            </div>
            <div class="market-stat">
                <span class="market-stat-label">24h Volume</span>
                <span class="market-stat-value">$${this.formatNumber(this.marketData.volume_24h)}</span>
            </div>
            <div class="market-stat">
                <span class="market-stat-label">TVL</span>
                <span class="market-stat-value">$${this.formatNumber(this.marketData.tvl)}</span>
            </div>
            <div class="market-stat">
                <span class="market-stat-label">Stablecoins</span>
                <span class="market-stat-value">$${this.formatNumber(this.marketData.stablecoins_mcap)}</span>
            </div>
        `;
    }

    startCountdown() {
        const updateCountdown = () => {
            const nextUnlock = this.getNextUnlockEvent();
            
            if (!nextUnlock) {
                const countdownCard = document.getElementById('countdown-card');
                if (countdownCard) {
                    countdownCard.innerHTML = `
                        <div class="countdown-info">
                            <h3>No upcoming unlocks</h3>
                            <p class="unlock-amount">All tokens unlocked</p>
                        </div>
                    `;
                }
                return;
            }

            const now = Math.floor(Date.now() / 1000);
            const timeLeft = nextUnlock.time - now;
            
            if (timeLeft <= 0) {
                this.loadData(); // Refresh data
                return;
            }

            const days = Math.floor(timeLeft / (24 * 60 * 60));
            const hours = Math.floor((timeLeft % (24 * 60 * 60)) / (60 * 60));
            const minutes = Math.floor((timeLeft % (60 * 60)) / 60);
            const seconds = timeLeft % 60;

            const labelEl = document.getElementById('next-unlock-label');
            const amountEl = document.getElementById('next-unlock-amount');
            const daysEl = document.getElementById('days');
            const hoursEl = document.getElementById('hours');
            const minutesEl = document.getElementById('minutes');
            const secondsEl = document.getElementById('seconds');

            if (labelEl) labelEl.textContent = nextUnlock.wallet.label;
            if (amountEl) amountEl.textContent = this.formatTonAmount(nextUnlock.amount);
            if (daysEl) daysEl.textContent = days.toString().padStart(2, '0');
            if (hoursEl) hoursEl.textContent = hours.toString().padStart(2, '0');
            if (minutesEl) minutesEl.textContent = minutes.toString().padStart(2, '0');
            if (secondsEl) secondsEl.textContent = seconds.toString().padStart(2, '0');
        };

        updateCountdown();
        this.countdownInterval = setInterval(updateCountdown, 1000);
    }

    showLoading() {
        const loader = document.getElementById('loading-spinner');
        if (loader) {
            loader.classList.remove('hidden');
        }
    }

    hideLoading() {
        const loader = document.getElementById('loading-spinner');
        if (loader) {
            loader.classList.add('hidden');
        }
    }

    showError(message) {
        const modal = document.getElementById('error-modal');
        const messageElement = document.getElementById('error-message');
        
        if (modal && messageElement) {
            messageElement.textContent = message;
            modal.classList.remove('hidden');
        }
        
        this.hideLoading();
    }
}

// Global function to close error modal
function closeErrorModal() {
    const modal = document.getElementById('error-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new TONUnlocksTracker();
});

// Handle responsive navigation
window.addEventListener('resize', () => {
    const nav = document.querySelector('.nav');
    if (nav) {
        if (window.innerWidth <= 768) {
            nav.classList.add('mobile');
        } else {
            nav.classList.remove('mobile');
        }
    }
});

// Add keyboard navigation support
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeErrorModal();
    }
});

// Add smooth scrolling for internal links
document.addEventListener('click', (e) => {
    if (e.target.tagName === 'A' && e.target.getAttribute('href')?.startsWith('#')) {
        e.preventDefault();
        const target = document.querySelector(e.target.getAttribute('href'));
        if (target) {
            target.scrollIntoView({ behavior: 'smooth' });
        }
    }
});