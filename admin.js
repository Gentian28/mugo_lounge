// Simple client-side admin for editing the menu JSON
// WARNING: This is client-side protection only. Do not use for sensitive deployments.

(function () {
  // Simple login-only admin script: validate credentials and redirect to dashboard
  const CREDENTIALS = { username: 'admin', password: 'mugo1234kf' };
  const loginBtn = document.getElementById('login-btn');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');

  function checkAuth(u, p) {
    return u === CREDENTIALS.username && p === CREDENTIALS.password;
  }
  loginBtn.addEventListener('click', () => {
    const u = usernameInput.value.trim();
    const p = passwordInput.value;
    if (checkAuth(u, p)) {
      // store auth marker and a base64 token for server requests
      localStorage.setItem('mugo-admin-auth', '1');
      try {
        const token = btoa(u + ':' + p);
        localStorage.setItem('mugo-admin-token', token);
      } catch (e) {
        console.warn('Token not stored', e);
      }
      location.href = 'dashboard.html';
    } else {
      alert('Credenziali non valide');
    }
  });
})();
