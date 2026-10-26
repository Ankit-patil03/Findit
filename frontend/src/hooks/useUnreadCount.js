import { useEffect, useState } from 'react';
import { api } from '../api';

const CHANGED_EVENT = 'notifications:changed';
const REFRESH_EVERY = 30 * 1000; // 30 seconds

// Call this after marking notifications as read, so the bell updates straight away
export function notificationsChanged() {
  window.dispatchEvent(new Event(CHANGED_EVENT));
}

// The number on the navbar bell. It refreshes:
//  - every 30 seconds (so new notifications show up without reloading the page)
//  - when you come back to this browser tab
//  - when notificationsChanged() is called
// When we move to AWS, SNS adds email/SMS on top; this in-app count stays the same.
export function useUnreadCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let ignore = false;
    const load = () =>
      api('/api/notifications/unread-count')
        .then((data) => !ignore && setCount(data.count))
        .catch(() => {}); // a missed refresh isn't worth an error message; the next one will retry

    const onTabVisible = () => document.visibilityState === 'visible' && load();

    load();
    const timer = setInterval(load, REFRESH_EVERY);
    document.addEventListener('visibilitychange', onTabVisible);
    window.addEventListener(CHANGED_EVENT, load);

    // Clean up when the navbar goes away (e.g. on logout)
    return () => {
      ignore = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onTabVisible);
      window.removeEventListener(CHANGED_EVENT, load);
    };
  }, []);

  return count;
}
