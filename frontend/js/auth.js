/* export async function getUser() {
    try {
      const res = await fetch("/api/me");
  
      if (!res.ok) return null;
  
      return await res.json();
    } catch {
      return null;
    }
  } */

function getUser(req) {
  const header = req.headers["x-ms-client-principal"];

  // Running in Azure (real auth)
  if (header) {
      const decoded = JSON.parse(
          Buffer.from(header, "base64").toString("ascii")
      );
      return decoded.userDetails;
  }

  // Running locally (no header)
  if (process.env.NODE_ENV === "development") {
      return "matthew.test@local.dev";
  }

  return null;
}