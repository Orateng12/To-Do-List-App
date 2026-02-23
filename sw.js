/**
 * TaskMaster Service Worker
 * ==========================
 * Progressive Web App offline support
 * 
 * Features:
 * - Cache-first strategy for assets
 * - Network-first for API calls
 * - Background sync
 * - Push notifications
 * - Offline fallback
 */

const CACHE_NAME = 'taskmaster-v1';
const STATIC_CACHE = 'taskmaster-static-v1';
const DYNAMIC_CACHE = 'taskmaster-dynamic-v1';

// Assets to cache immediately
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/css/styles.css',
    '/js/app.js',
    '/offline.html',
    '/manifest.json',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('[SW] Installing service worker...');
    
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then(cache => {
                console.log('[SW] Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('[SW] Installation complete, skipping waiting');
                return self.skipWaiting();
            })
            .catch(err => {
                console.error('[SW] Installation error:', err);
            })
    );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating service worker...');
    
    event.waitUntil(
        caches.keys()
            .then(keys => {
                return Promise.all(
                    keys
                        .filter(key => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
                        .map(key => {
                            console.log('[SW] Deleting old cache:', key);
                            return caches.delete(key);
                        })
                );
            })
            .then(() => {
                console.log('[SW] Activation complete, claiming clients');
                return self.clients.claim();
            })
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }

    // Skip chrome-extension and other non-http(s) requests
    if (!url.protocol.startsWith('http')) {
        return;
    }

    // Determine caching strategy based on request type
    if (isStaticAsset(url)) {
        // Cache-first for static assets
        event.respondWith(cacheFirst(request));
    } else if (isAPIRequest(url)) {
        // Network-first for API requests
        event.respondWith(networkFirst(request));
    } else if (isImageRequest(request)) {
        // Cache-first for images
        event.respondWith(cacheFirst(request, true));
    } else if (isNavigationRequest(request)) {
        // Network-first for navigation, with offline fallback
        event.respondWith(networkFirstWithFallback(request));
    } else {
        // Default: stale-while-revalidate
        event.respondWith(staleWhileRevalidate(request));
    }
});

/**
 * Cache-first strategy
 * @param {Request} request
 * @param {boolean} isImage - Whether this is an image request
 */
async function cacheFirst(request, isImage = false) {
    const cache = await caches.open(STATIC_CACHE);
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
        return cachedResponse;
    }

    try {
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        // Return offline placeholder for images
        if (isImage) {
            return new Response('', {
                status: 404,
                statusText: 'Offline'
            });
        }
        
        throw error;
    }
}

/**
 * Network-first strategy
 * @param {Request} request
 */
async function networkFirst(request) {
    const cache = await caches.open(DYNAMIC_CACHE);

    try {
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        const cachedResponse = await cache.match(request);
        
        if (cachedResponse) {
            return cachedResponse;
        }
        
        throw error;
    }
}

/**
 * Network-first with offline fallback for navigation
 * @param {Request} request
 */
async function networkFirstWithFallback(request) {
    try {
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        const cache = await caches.open(STATIC_CACHE);
        const cachedResponse = await cache.match('/offline.html');
        
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Last resort: simple offline page
        return new Response(`
            <!DOCTYPE html>
            <html>
            <head><title>Offline - TaskMaster</title></head>
            <body style="font-family:system-ui;padding:2rem;text-align:center">
                <h1>📡 You're Offline</h1>
                <p>TaskMaster will work when you're back online.</p>
            </body>
            </html>
        `, {
            headers: { 'Content-Type': 'text/html' }
        });
    }
}

/**
 * Stale-while-revalidate strategy
 * @param {Request} request
 */
async function staleWhileRevalidate(request) {
    const cache = await caches.open(DYNAMIC_CACHE);
    const cachedResponse = await cache.match(request);

    const networkFetch = fetch(request)
        .then(networkResponse => {
            if (networkResponse.ok) {
                cache.put(request, networkResponse.clone());
            }
            return networkResponse;
        })
        .catch(() => null);

    return cachedResponse || await networkFetch;
}

/**
 * Check if URL is a static asset
 */
function isStaticAsset(url) {
    return STATIC_ASSETS.some(asset => {
        if (asset.startsWith('http')) {
            return url.href === asset;
        }
        return url.pathname === asset || url.pathname.endsWith(asset);
    });
}

/**
 * Check if URL is an API request
 */
function isAPIRequest(url) {
    return url.pathname.startsWith('/api/') || 
           url.pathname.endsWith('.json') ||
           url.hostname === 'api.taskmaster.com';
}

/**
 * Check if request is for an image
 */
function isImageRequest(request) {
    return request.destination === 'image' ||
           request.url.match(/\.(jpg|jpeg|png|gif|svg|webp|ico)$/i);
}

/**
 * Check if request is a navigation request
 */
function isNavigationRequest(request) {
    return request.mode === 'navigate';
}

// Background Sync
self.addEventListener('sync', (event) => {
    console.log('[SW] Sync event:', event.tag);

    if (event.tag === 'sync-tasks') {
        event.waitUntil(syncTasks());
    }
});

/**
 * Sync tasks with server
 */
async function syncTasks() {
    // Get pending tasks from IndexedDB
    // In production, this would sync with a real backend
    console.log('[SW] Syncing tasks...');
    
    // Notify clients of sync completion
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
        client.postMessage({
            type: 'SYNC_COMPLETE',
            timestamp: Date.now()
        });
    });
}

// Push Notifications
self.addEventListener('push', (event) => {
    console.log('[SW] Push received:', event);

    const options = {
        body: event.data ? event.data.text() : 'New notification',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        },
        actions: [
            { action: 'view', title: 'View' },
            { action: 'dismiss', title: 'Dismiss' }
        ]
    };

    event.waitUntil(
        self.registration.showNotification('TaskMaster', options)
    );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
    console.log('[SW] Notification click:', event.action);

    event.notification.close();

    if (event.action === 'view') {
        event.waitUntil(
            self.clients.matchAll({ type: 'window' })
                .then(clients => {
                    // Focus existing window or open new one
                    if (clients.length > 0) {
                        return clients[0].focus();
                    }
                    return self.clients.openWindow('/');
                })
        );
    }
});

// Message handler for communication with main thread
self.addEventListener('message', (event) => {
    console.log('[SW] Message received:', event.data);

    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    if (event.data && event.data.type === 'CACHE_URLS') {
        event.waitUntil(
            caches.open(DYNAMIC_CACHE)
                .then(cache => cache.addAll(event.data.urls))
        );
    }

    if (event.data && event.data.type === 'CLEAR_CACHE') {
        event.waitUntil(
            caches.keys()
                .then(keys => Promise.all(keys.map(k => caches.delete(k))))
        );
    }
});

// Periodic Background Sync (if supported)
self.addEventListener('periodicsync', (event) => {
    console.log('[SW] Periodic sync:', event.tag);

    if (event.tag === 'periodic-task-sync') {
        event.waitUntil(syncTasks());
    }
});

console.log('[SW] Service worker loaded');
