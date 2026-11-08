/* Push-only worker: never caches or serves private pages, assets or credentials. */
self.addEventListener('install', (event) =>
  event.waitUntil(self.skipWaiting()),
);
self.addEventListener('activate', (event) =>
  event.waitUntil(self.clients.claim()),
);
function claim(id, expiresAt) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open('nur-push-receipts-v1', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('seen');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result,
        tx = db.transaction('seen', 'readwrite'),
        store = tx.objectStore('seen');
      let fresh = false;
      const cursor = store.openCursor();
      cursor.onsuccess = () => {
        const row = cursor.result;
        if (row) {
          if (row.value <= Date.now()) row.delete();
          row.continue();
        }
      };
      const get = store.get(id);
      get.onsuccess = () => {
        if (get.result === undefined) {
          store.put(expiresAt, id);
          fresh = true;
        }
      };
      tx.oncomplete = () => {
        db.close();
        resolve(fresh);
      };
      tx.onabort = () => {
        db.close();
        reject(tx.error);
      };
    };
  });
}
self.addEventListener('push', (event) => {
  event.waitUntil(
    (async () => {
      let data;
      try {
        data = event.data?.json();
      } catch {
        return;
      }
      if (
        !data ||
        !/^[a-f0-9]{64}$/.test(data.gathering) ||
        !Number.isFinite(data.expiresAt)
      )
        return;
      try {
        // Recheck cancellation, expiry and the HttpOnly private session at receipt.
        // Offline/revoked sessions fail closed, never displaying private material.
        const response = await fetch(
          '/nur-und-huda/api/push/check/' + data.gathering,
          {
            credentials: 'same-origin',
            cache: 'no-store',
            signal: AbortSignal.timeout(8000),
          },
        );
        if (!response.ok || !(await response.json()).active) return;
        if (!(await claim(data.gathering, data.expiresAt))) return;
        const tag = 'gathering-' + data.gathering;
        const existing = await self.registration.getNotifications({ tag });
        if (existing.length) return;
        // No participant names, notes, prayer selections or access secrets on lockscreens.
        await self.registration.showNotification('جماعة جديدة', {
          body: 'هناك جماعة جديدة في نور وهدى. اضغط لفتحها والانضمام.',
          lang: 'ar',
          dir: 'rtl',
          tag,
          renotify: false,
          data: { gathering: data.gathering },
        });
      } catch {
        /* Do not reveal stale information when validation is unavailable. */
      }
    })(),
  );
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const id = event.notification.data?.gathering;
  if (!/^[a-f0-9]{64}$/.test(id ?? '')) return;
  const target = '/nur-und-huda/together.html#gathering-' + id;
  event.waitUntil(
    self.clients.openWindow('/access?next=' + encodeURIComponent(target)),
  );
});
// Browser token rotation is reconciled on next authenticated app opening.
// Never persist a group session token in this worker or browser-readable storage.
