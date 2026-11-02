let historyChart = null;

function initChart() {
  const ctx = document.getElementById('historyChart').getContext('2d');
  historyChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: 'Soil Moisture (%)',
        data: [],
        borderColor: '#28a745',
        backgroundColor: 'rgba(40, 167, 69, 0.1)',
        borderWidth: 2.5,
        fill: true,
        tension: 0.35,
        pointRadius: 3,
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          min: 0,
          max: 100,
          ticks: {
            callback: value => value + '%'
          },
          grid: {
            color: '#edf2ed'
          }
        },
        x: {
          grid: {
            display: false
          },
          ticks: {
            maxTicksLimit: 8
          }
        }
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: context => `Moisture: ${context.parsed.y}%`
          }
        }
      }
    }
  });
}

async function fetchLatest() {
  try {
    const res = await fetch('/api/iot/latest', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();

    if (body.status === 'no_data' || !body.data) {
      document.getElementById('percent').textContent = '--';
      document.getElementById('raw').textContent = '--';
      document.getElementById('status').textContent = 'Awaiting Data';
      document.getElementById('fill').style.width = '0%';
      document.getElementById('updated').textContent = 'No sensor readings received yet.';
      return;
    }

    const data = body.data;
    document.getElementById('percent').textContent = data.moisture;
    document.getElementById('raw').textContent = data.raw;
    document.getElementById('status').textContent = data.status;
    document.getElementById('deviceId').textContent = data.device_id || 'esp32-soil-01';

    const fillEl = document.getElementById('fill');
    fillEl.style.width = data.moisture + '%';

    if (data.status === 'Dry') {
      fillEl.style.backgroundColor = '#dc3545';
    } else if (data.status === 'Moderate') {
      fillEl.style.backgroundColor = '#ffc107';
    } else {
      fillEl.style.backgroundColor = '#28a745';
    }

    const dateStr = new Date(data.created_at).toLocaleTimeString();
    document.getElementById('updated').textContent = `Last reading recorded at: ${dateStr}`;
  } catch (err) {
    console.error('Error fetching latest reading:', err);
    document.getElementById('status').textContent = 'Network Disruption';
  }
}

async function fetchStatus() {
  try {
    const res = await fetch('/api/iot/status', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const badge = document.getElementById('deviceBadge');
    const lastSeenEl = document.getElementById('lastSeen');

    if (data.connection_status === 'online') {
      badge.className = 'badge badge-online';
      badge.textContent = 'ESP32 Online';
      lastSeenEl.textContent = `Active telemetry (${data.seconds_ago}s ago)`;
    } else if (data.connection_status === 'stale') {
      badge.className = 'badge badge-stale';
      badge.textContent = 'ESP32 Idle';
      lastSeenEl.textContent = `Last seen ${Math.floor(data.seconds_ago / 60)}m ago`;
    } else if (data.connection_status === 'offline') {
      badge.className = 'badge badge-offline';
      badge.textContent = 'ESP32 Offline';
      lastSeenEl.textContent = data.seconds_ago ? `Offline for ${Math.floor(data.seconds_ago / 60)}m` : 'Never connected';
    } else {
      badge.className = 'badge badge-offline';
      badge.textContent = 'No Device Linked';
      lastSeenEl.textContent = 'Awaiting initial transmission';
    }
  } catch (err) {
    console.error('Error fetching device status:', err);
  }
}

async function fetchHistory() {
  try {
    const res = await fetch('/api/iot/history?limit=25', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();

    if (body.data && historyChart) {
      const labels = body.data.map(r => {
        const d = new Date(r.created_at);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      });
      const values = body.data.map(r => r.moisture);

      historyChart.data.labels = labels;
      historyChart.data.datasets[0].data = values;
      historyChart.update();
    }
  } catch (err) {
    console.error('Error fetching history:', err);
  }
}

async function refreshAll() {
  await Promise.all([fetchLatest(), fetchStatus(), fetchHistory()]);
}

document.addEventListener('DOMContentLoaded', () => {
  initChart();
  refreshAll();
  setInterval(refreshAll, 5000);
});

