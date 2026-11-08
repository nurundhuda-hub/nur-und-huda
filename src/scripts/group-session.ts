/** First-party session stays HttpOnly; client JS never receives the access code or cookie. */
export function initGroupSession() {
  if (document.body.dataset.groupSite !== 'true') return;
  const check = async () => {
    if (document.hidden) return;
    try {
      const response = await fetch('/access/status', {
        credentials: 'same-origin',
        cache: 'no-store',
      });
      if (response.status === 401)
        location.replace(
          '/access?next=' +
            encodeURIComponent(location.pathname + location.hash),
        );
    } catch {
      /* Offline reading of an already open page is not a new server authorization. */
    }
  };
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) location.reload();
  });
  document.addEventListener('visibilitychange', () => {
    void check();
  });
}
