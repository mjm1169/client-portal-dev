export function mountLogin(container) {
    container.innerHTML = `
      <div class="login-container">
        <h1>Client Portal</h1>
        <p>Please sign in with your Microsoft account.</p>
        <button id="loginBtn" class="login-btn">
          Sign in with Microsoft
        </button>
      </div>
    `;
  
    document.getElementById("loginBtn").addEventListener("click", () => {
      window.location.href = "/.auth/login/aad";
    });
  }