export async function mountScrollytelling(container) {
  container.innerHTML = `
    <div class="scrollytelling-page">
      <div class="chart-loading" id="scrollyStatus">Loading report&hellip;</div>
      <iframe
        class="scrollytelling-frame"
        id="scrollyFrame"
        title="Ippy People Report 2026"
        style="display:none;"
      ></iframe>
    </div>
  `;

  const statusEl = container.querySelector('#scrollyStatus');
  const frame    = container.querySelector('#scrollyFrame');

  try {
    const res = await fetch('/api/reports/scrollytelling');

    if (!res.ok) {
      statusEl.textContent = res.status === 403
        ? "You don't have access to this report."
        : 'Could not load this report.';
      return;
    }

    const { url } = await res.json();
    frame.src = url;
    frame.style.display = '';
    statusEl.style.display = 'none';
  } catch {
    statusEl.textContent = 'Could not load this report.';
  }
}
