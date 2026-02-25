import { getUser } from "./auth.js";
import { initRouter } from "./router.js";

async function initApp() {
  const user = await getUser();

  renderUser(user);
  initRouter(user);
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