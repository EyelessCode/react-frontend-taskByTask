const FALLBACK_TITLE = 'Task by Task — Aviso de vencimiento';
const FALLBACK_BODY = 'Tienes una nueva notificación de tarea pendiente.';

function isSafeRelativeUrl(value) {
  if (typeof value !== 'string') {
    return false;
  }
  const trimmed = value.trim();
  return (
    trimmed.startsWith('/') &&
    !trimmed.startsWith('//') &&
    !trimmed.startsWith('/\\') &&
    !/[\r\n]/.test(trimmed)
  );
}

function parsePushPayload(rawText) {
  const trimmed = typeof rawText === 'string' ? rawText.trim() : '';
  if (!trimmed) {
    return { title: FALLBACK_TITLE, body: FALLBACK_BODY, url: '/' };
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const title =
        typeof parsed.title === 'string' && parsed.title.trim().length > 0
          ? parsed.title.trim()
          : FALLBACK_TITLE;
      const bodyCandidate = [parsed.body, parsed.content, parsed.message].find(
        (candidate) => typeof candidate === 'string' && candidate.trim().length > 0,
      );
      const body = bodyCandidate ? bodyCandidate.trim() : FALLBACK_BODY;
      const url = isSafeRelativeUrl(parsed.url) ? parsed.url.trim() : '/';
      return { title, body, url };
    }
  } catch {
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      return { title: FALLBACK_TITLE, body: FALLBACK_BODY, url: '/' };
    }
  }

  return { title: FALLBACK_TITLE, body: trimmed, url: '/' };
}

self.addEventListener('push', (event) => {
  let rawText = '';
  try {
    rawText = event.data ? event.data.text() : '';
  } catch {
    rawText = '';
  }

  const payload = parsePushPayload(rawText);
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      data: { url: payload.url },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const rawUrl = event.notification && event.notification.data ? event.notification.data.url : '/';
  const targetUrl = isSafeRelativeUrl(rawUrl) ? rawUrl.trim() : '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        try {
          if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
            return client.focus();
          }
        } catch {
          // Ignore invalid client URL and continue searching
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return undefined;
    }),
  );
});
