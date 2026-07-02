export function mountScrollytelling(container) {
  container.innerHTML = `
    <div class="scrollytelling-page">
      <div class="scrollytelling-bar">
        <button type="button" id="backHome" class="btn-secondary">&larr; Back home</button>
      </div>
      <iframe
        class="scrollytelling-frame"
        src="/reports/ippy-scrollytelling-report.html"
        title="Ippy People Report 2026"
      ></iframe>
    </div>
  `;

  container.querySelector('#backHome').addEventListener('click', () => {
    window.location.hash = "/";
  });
}
