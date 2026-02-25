export function mountHome(container, user) {

    container.innerHTML = `
      <section class="hero">
        <h1 class="hero__title">EMPLOYEE EXPERIENCE HUB</h1>
        <p class="hero__subtitle">
          Welcome, <strong>${user?.email?.split("@")[0] ?? ""}</strong>
        </p>
      </section>
  
      <section class="grid">
  
        <div class="card" id="radial-card">
          <h2 class="card__title">Radial Hierarchy Charts</h2>
          <p class="card__desc">
            View your organisation in a radial view, allowing you to navigate through multiple layers of hierarchy across various metrics.
          </p>
          <div class="card__cta">Open →</div>
        </div>
  
        <div class="card card--disabled">
          <h2 class="card__title">Organisational Network Map</h2>
          <p class="card__desc">
            Coming soon.
          </p>
          <div class="card__cta card__cta--muted">Coming soon</div>
        </div>
  
      </section>
    `;
  
    document.getElementById("radial-card").onclick = () => {
      window.location.hash = "#radial";
    };
  }