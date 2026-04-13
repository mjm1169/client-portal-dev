export function mountHome(container, user) {
  container.innerHTML = `
    <div class="home">

      <h1 class="home-title">Welcome</h1>

      <div class="feature-card" id="goRadial">

        <div class="feature-card__image">
          <img src="assets/RadialExCard.png" alt="Radial chart preview">
        </div>

        <div class="feature-card__content">
          <h2>Explore Radial Chart</h2>
          <p>
            Visualise your data with an interactive radial hierarchy chart.
            Explore patterns, drill into regions, and uncover insights.
          </p>

        </div>

      </div>

    </div>
  `;

  // Navigation
  container.querySelector('#goRadial').addEventListener('click', () => {
    window.location.hash = "/radial";
  });
}