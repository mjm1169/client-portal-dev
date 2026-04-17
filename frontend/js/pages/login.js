import { login } from "../auth.js";

export function mountLogin(container) {
  container.innerHTML = `
    <div class="login-page">
      <div class="login-card">
        <img class="login-logo" src="/assets/logo.svg" alt="Logo" />
        <h1 class="login-title">Client Portal</h1>
        <p class="login-subtitle">Sign in with your Microsoft account to access your dashboard.</p>
        <button id="loginBtn" class="login-btn">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 21 21" aria-hidden="true">
            <rect x="1"  y="1"  width="9" height="9" fill="#f25022"/>
            <rect x="11" y="1"  width="9" height="9" fill="#7fba00"/>
            <rect x="1"  y="11" width="9" height="9" fill="#00a4ef"/>
            <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
          </svg>
          Sign in with Microsoft
        </button>
      </div>
    </div>
  `;

  document
    .getElementById("loginBtn")
    .addEventListener("click", login);
}