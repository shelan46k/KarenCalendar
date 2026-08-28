const ICON = `${import.meta.env.BASE_URL}icons/icon-192.png`

export function notificationSupported() {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function notificationPermission() {
  if (!notificationSupported()) return 'unsupported'
  return Notification.permission
}

export async function ensureNotificationPermission() {
  if (!notificationSupported()) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const result = await Notification.requestPermission()
  return result === 'granted'
}

/**
 * 透過 Service Worker 推播（PWA 加到主畫面後，縮小 App 仍較容易收到）
 * 不阻塞主流程；serviceWorker.ready 加逾時避免第二次卡住。
 */
export function showAppNotification(title, body, tag = 'karen-calendar') {
  if (!notificationSupported() || Notification.permission !== 'granted') return Promise.resolve(false)

  const options = {
    body,
    tag,
    icon: ICON,
    badge: ICON,
    renotify: true
  }

  const show = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const reg = await Promise.race([
          navigator.serviceWorker.ready,
          new Promise((_, reject) => setTimeout(() => reject(new Error('sw timeout')), 2500))
        ])
        await reg.showNotification(title, options)
        return true
      }
      new Notification(title, options)
      return true
    } catch {
      try {
        new Notification(title, options)
        return true
      } catch {
        return false
      }
    }
  }

  return show()
}
