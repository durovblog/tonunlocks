async function fetchTonMetrics() {
  const priceUrl = "https://tonapi.io/v2/rates?tokens=ton&currencies=usd";
  try {
    const priceResp = await fetch(priceUrl);
    const data = await priceResp.json();
    const ton = data?.rates?.TON;
    const price = ton?.prices?.USD;
    document.getElementById('ton-metrics-loading').style.display = 'none';
    document.getElementById('ton-metrics-content').style.display = '';
    document.getElementById('ton-price').textContent = price
      ? `$${price.toFixed(3)}`
      : '—';
    document.getElementById('ton-price-updated').textContent =
      `Обновлено: ${new Date().toLocaleTimeString('ru-RU')}`;
  } catch (e) {
    document.getElementById('ton-metrics-loading').textContent =
      'Ошибка загрузки данных TON';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  fetchTonMetrics();
});
