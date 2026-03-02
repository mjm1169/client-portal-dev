export function mountHome(container, user) {
  container.innerHTML = `
    <h2>Welcome</h2>
    <p>Hello ${user.userDetails}</p>
    <p>Select "Radial" from the menu.</p>
  `;
}