export async function getUser() {
  const isLocal =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";

  // 🔹 Local development simulation
  if (isLocal) {
    return {
      userDetails: "local.user@company.com",
      pages: ["hierarchy"],
      datasets: ["data1.csv"]
    };
  }

  // 🔹 Azure production auth
  const res = await fetch("/.auth/me");
  const data = await res.json();

  return data.clientPrincipal;
}

export function login() {
  window.location.href = "/.auth/login/aad";
}

export function logout() {
  window.location.href = "/.auth/logout";
}