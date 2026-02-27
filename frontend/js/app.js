import { getUser } from "./auth.js";
import { initRouter } from "./router.js";

async function initApp() {
  const user = await getUser();

  if (!user) {
      renderLogin();
      return;
  }

  renderApp(user);
}

function renderLogin() {
  document.body.innerHTML = `
      <h2>Please sign in</h2>
      <button onclick="window.location.href='/.auth/login/aad'">
          Sign In
      </button>
  `;
}

function renderUser(user) {
  const el = document.getElementById("user-info");

  if (!user) {
    el.innerHTML = `<a href="/.auth/login/aad">Sign in</a>`;
    return;
  }

  el.innerHTML = `
    ${user.email}
    <a href="/.auth/logout">Logout</a>
  `;
}

initApp();