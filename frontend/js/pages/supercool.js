export function mountSuperCool(container) {
  container.innerHTML = `
    <div class="supercool-page">
      <div class="supercool-emoji" aria-hidden="true">😎</div>
      <h1 class="supercool-title">Super cool thing</h1>
      <a href="#/" class="btn-secondary supercool-back">Back home</a>
    </div>
  `;
}
