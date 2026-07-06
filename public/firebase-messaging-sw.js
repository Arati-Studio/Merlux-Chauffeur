// firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// Fetch the client configuration dynamically
fetch('/api/firebase-config')
  .then(response => response.json())
  .then(config => {
    firebase.initializeApp(config);
    const messaging = firebase.messaging();

    // Background messaging handler
    messaging.onBackgroundMessage((payload) => {
      console.log('[firebase-messaging-sw.js] Background message payload:', payload);

      const title = payload.notification?.title || payload.data?.title || 'Merlux Chauffeurs';
      const body = payload.notification?.body || payload.data?.body || 'New luxury service update!';
      const image = payload.notification?.image || payload.data?.image || undefined;
      const url = payload.data?.url || '/dashboard';

      const options = {
        body,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        image: image,
        data: {
          url
        }
      };

      // Call our server-side API to sync this externally sent campaign with histories
      fetch('/api/campaigns/sync-external', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title,
          message: body,
          image: image || null,
          url
        })
      }).catch(err => {
        console.warn('[firebase-messaging-sw.js] Failed to sync background message to database:', err);
      });

      self.registration.showNotification(title, options);
    });
  })
  .catch(err => {
    console.error('Failed to load dynamic Firebase configuration in Service Worker:', err);
  });

// Handle background notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
