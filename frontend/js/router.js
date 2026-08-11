import { getUser } from "./auth.js";
import { mountHome } from "./pages/home.js";
import { mountLogin } from "./pages/login.js";
import { mountRadial } from "./pages/radial.js";
import { mountUserRadial } from "./pages/userRadial.js";
import { mountScrollytelling } from "./pages/scrollytelling.js";
import { mountIndustryAnalytics } from "./pages/industryAnalytics.js";
import { mountSegmentation } from "./pages/segmentation.js";
import { mountSuperCool } from "./pages/supercool.js";

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

  // Show a loading state in the app container immediately, before any awaits
  app.innerHTML = `<div class="chart-loading">Loading…</div>`;

  const user = await getUser();

  if ((!user || !user.userDetails) && path !== "/login") {
    window.location.hash = "/login";
    return;
  }

  renderNav(user);

  if (path === "/radial") {
    mountRadial(app, user);
  } else if (path === "/userradial") {
    mountUserRadial(app, user);
  } else if (path === "/scrollytelling") {
    mountScrollytelling(app);
  } else if (path === "/industryanalytics") {
    mountIndustryAnalytics(app);
  } else if (path === "/segmentation") {
    mountSegmentation(app);
  } else if (path === "/supercool") {
    mountSuperCool(app);
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