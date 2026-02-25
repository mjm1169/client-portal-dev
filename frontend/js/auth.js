export async function getUser() {
    try {
      const res = await fetch("/api/me");
  
      if (!res.ok) return null;
  
      return await res.json();
    } catch {
      return null;
    }
  }