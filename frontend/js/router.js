import { mountHome } from "./pages/home.js";
import { mountRadial } from "./pages/radial.js";

export function initRouter(user) {
  window.addEventListener("hashchange", () => handleRoute(user));
  handleRoute(user);
}

function handleRoute(user) {
  const route = window.location.hash || "#home";

  const container = document.getElementById("main-content");
  container.innerHTML = "";

  if (route.startsWith("#radial")) {
    mountRadial(container, user);
  } else {
    mountHome(container);
  }
}