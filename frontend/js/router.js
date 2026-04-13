import { getUser } from "./auth.js";
import { mountHome } from "./pages/home.js";
import { mountLogin } from "./pages/login.js";
import { mountRadial } from "./pages/radial.js";

const app = document.getElementById("app");

function getPath() {
  return window.location.hash.replace("#", "") || "/";
}

function renderNav(user) {
  if (!user) {
    document.getElementById("user-info").innerHTML = "";
    return;
  }

  document.getElementById("user-info").innerHTML = `
    <span>Logged in as: ${user.userDetails}</span>
    <a href="/.auth/logout" class="logout-link">Logout</a>
  `;
}

async function router() {
  const path = getPath();
  const user = await getUser();

  // Protect entire app
  if (!user && path !== "/login") {
    window.location.hash = "/login";
    return;
  }

  renderNav(user);

  if (path === "/radial") {
    mountRadial(app, user);
  } else if (path === "/login") {
    mountLogin(app);
  } else {
    mountHome(app, user);
  }
}

export function initRouter() {
  window.addEventListener("hashchange", router);
  router();
}