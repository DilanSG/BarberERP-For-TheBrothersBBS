// Service Worker para The Brothers Barber Shop
// Versión 1.2.0 - Navegación offline y caché inteligente

const CACHE_NAME = 'tbb-v1.2.0';
const OFFLINE_URL = '/offline.html';

// Rutas críticas para cachear
const CRITICAL_ROUTES = [
  '/',
  '/services',
  '/barbers', 
  '/appointment'
];

// Estrategias de caché por tipo de recurso
const CACHE_STRATEGIES = {
  // Páginas principales - Network First con fallback
  pages: 'networkFirst',
  // API calls - Network First con caché corto
  api: 'networkFirst',
  // Assets estáticos - Cache First
  assets: 'cacheFirst',
  // Imágenes - Cache First con fallback
  images: 'cacheFirst'
};

// Instalación del Service Worker
self.addEventListener('install', (event) => {
  console.log('🔧 SW: Installing Service Worker v1.2.0');
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('📦 SW: Caching critical resources');
      
      // Cachear recursos críticos básicos
      const criticalResources = [
        ...CRITICAL_ROUTES,
        OFFLINE_URL
      ];
      
      return cache.addAll(criticalResources).catch(error => {
        console.warn('⚠️ SW: Some resources failed to cache:', error);
        // Continuar aunque algunos recursos fallen
      });
    }).then(() => {
      // Forzar la activación inmediata
      self.skipWaiting();
    }).catch((error) => {
      console.error('❌ SW: Installation failed:', error);
    })
  );
});

// Activación del Service Worker
self.addEventListener('activate', (event) => {
  console.log('✅ SW: Activating Service Worker v1.2.0');
  
  event.waitUntil(
    Promise.all([
      // Limpiar cachés antiguos
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('🗑️ SW: Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Tomar control inmediato de todos los clientes
      self.clients.claim()
    ])
  );
});

// Interceptar solicitudes de red
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Solo manejar solicitudes HTTP/HTTPS
  if (!url.protocol.startsWith('http')) return;
  
  // Determinar estrategia de caché
  const strategy = getStrategy(request);
  
  event.respondWith(
    handleRequest(request, strategy)
  );
});

// Determinar estrategia basada en el tipo de solicitud
function getStrategy(request) {
  const url = new URL(request.url);
  
  // API calls
  if (url.pathname.startsWith('/api/')) {
    return 'networkFirst';
  }
  
  // Páginas HTML
  if (request.destination === 'document') {
    return 'networkFirst';
  }
  
  // Imágenes
  if (request.destination === 'image') {
    return 'cacheFirst';
  }
  
  // Assets CSS/JS
  if (request.destination === 'style' || request.destination === 'script') {
    return 'cacheFirst';
  }
  
  // Por defecto
  return 'networkFirst';
}

// Manejar solicitud según la estrategia
async function handleRequest(request, strategy) {
  const url = new URL(request.url);
  
  try {
    switch (strategy) {
      case 'networkFirst':
        return await networkFirst(request);
      
      case 'cacheFirst':
        return await cacheFirst(request);
      
      case 'staleWhileRevalidate':
        return await staleWhileRevalidate(request);
      
      default:
        return await networkFirst(request);
    }
  } catch (error) {
    console.error('❌ SW: Error handling request:', error);
    return await handleFallback(request);
  }
}

// Estrategia Network First
async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  
  try {
    // Intentar red primero
    const networkResponse = await fetch(request);
    
    // Solo cachear requests GET exitosas (Cache API no soporta POST/PUT/DELETE)
    if (networkResponse.ok && request.method === 'GET') {
      // Clonar antes de cachear (las respuestas se pueden leer solo una vez)
      const responseToCache = networkResponse.clone();
      cache.put(request, responseToCache);
    }
    
    return networkResponse;
  } catch (error) {
    // Si falla la red, usar caché (solo para GET)
    if (request.method === 'GET') {
      console.log('🔄 SW: Network failed, trying cache for:', request.url);
      const cachedResponse = await cache.match(request);
      
      if (cachedResponse) {
        return cachedResponse;
      }
    }
    
    // Si no hay caché o no es GET, manejar fallback
    throw error;
  }
}

// Estrategia Cache First
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  // Si no está en caché, buscar en red
  try {
    const networkResponse = await fetch(request);
    
    // Solo cachear GET requests
    if (networkResponse.ok && request.method === 'GET') {
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    throw error;
  }
}

// Estrategia Stale While Revalidate
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  
  // Buscar en caché y red en paralelo
  const cachedResponse = cache.match(request);
  const networkResponsePromise = fetch(request).then((response) => {
    // Solo cachear GET requests
    if (response.ok && request.method === 'GET') {
      cache.put(request, response.clone());
    }
    return response;
  });
  
  // Devolver caché si está disponible, sino esperar red
  return (await cachedResponse) || networkResponsePromise;
}

// Manejar fallbacks para solicitudes fallidas
async function handleFallback(request) {
  const url = new URL(request.url);
  
  // Para navegación (documentos HTML)
  if (request.destination === 'document') {
    // Si es una ruta de la SPA, devolver index.html desde caché
    if (isSPARoute(url.pathname)) {
      const cache = await caches.open(CACHE_NAME);
      const indexResponse = await cache.match('/');
      if (indexResponse) {
        return indexResponse;
      }
    }
    
    // Sino, página offline
    const cache = await caches.open(CACHE_NAME);
    return await cache.match(OFFLINE_URL) || new Response('Página no disponible offline', { status: 503 });
  }
  
  // Para imágenes, devolver placeholder
  if (request.destination === 'image') {
    return new Response('', { status: 404 });
  }
  
  // Para API calls, devolver respuesta offline
  if (url.pathname.startsWith('/api/')) {
    return new Response(JSON.stringify({ 
      success: false, 
      message: 'Sin conexión. Datos no disponibles offline.',
      offline: true 
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Fallback genérico
  return new Response('Recurso no disponible', { status: 503 });
}

// Verificar si es una ruta de SPA
function isSPARoute(pathname) {
  const spaRoutes = [
    '/',
    '/services',
    '/barbers',
    '/appointment',
    '/profile',
    '/login',
    '/register',
    '/admin'
  ];
  
  return spaRoutes.some(route => 
    pathname === route || 
    pathname.startsWith(route + '/') ||
    (route === '/' && pathname === '')
  );
}

// Manejar mensajes del cliente
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_CACHE_INFO') {
    caches.open(CACHE_NAME).then(cache => {
      cache.keys().then(requests => {
        event.ports[0].postMessage({
          type: 'CACHE_INFO',
          data: {
            cacheName: CACHE_NAME,
            cachedUrls: requests.map(req => req.url),
            totalItems: requests.length
          }
        });
      });
    });
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME).then(success => {
      event.ports[0].postMessage({
        type: 'CACHE_CLEARED',
        success
      });
    });
  }
});

// Manejar actualizaciones en background
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(
      // Aquí podrías sincronizar datos pendientes
      console.log('🔄 SW: Background sync triggered')
    );
  }
});

// Notificaciones push (para futuras mejoras)
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'Nueva notificación de The Brothers Barber Shop',
    icon: '/images/logo.png',
    badge: '/images/logo.png',
    vibrate: [200, 100, 200],
    tag: 'tbb-notification',
    actions: [
      { action: 'open', title: 'Ver', icon: '/images/icon-open.png' },
      { action: 'close', title: 'Cerrar', icon: '/images/icon-close.png' }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('The Brothers Barber Shop', options)
  );
});

// Log de versión
console.log('🚀 SW: Service Worker v1.2.0 loaded successfully');
