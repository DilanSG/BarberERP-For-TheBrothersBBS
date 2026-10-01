// Punto de entrada del frontend (Vite + React 18).
// Monta la aplicación en #root dentro del árbol de providers globales
// (tema, autenticación y notificaciones) y configura los servicios de Vercel
// (Speed Insights, Analytics) y el error tracking con Sentry.
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { Analytics } from '@vercel/analytics/react';
import * as Sentry from "@sentry/react";
import App from './app.jsx';
import './index.css';
import { AuthProvider } from './shared/contexts/AuthContext.jsx';
import { NotificationProvider } from './shared/contexts/NotificationContext.jsx';
import { ThemeProvider } from './shared/contexts/ThemeContext.jsx';

// 🐛 Configurar Sentry para error tracking (Vercel)
const sentryDsn = import.meta.env.VITE_SENTRY_DSN_FRONTEND;
// Validar que el DSN sea real (evita inicializar con placeholders tipo "your-sentry-dsn")
const isRealSentryDsn = Boolean(sentryDsn) && /^https:\/\/[0-9a-f]+@[^/]+\/\d+$/i.test(sentryDsn);

// Inicialización condicional: solo si hay un DSN válido configurado
if (isRealSentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE || 'development',
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],
    // Performance Monitoring
    tracesSampleRate: import.meta.env.MODE === 'production' ? 0.1 : 1.0,
    // Session Replay
    replaysSessionSampleRate: 0.1, // 10% de sesiones
    replaysOnErrorSampleRate: 1.0, // 100% cuando hay error
    
    // Filtrar errores sensibles
    beforeSend(event) {
      // No enviar errores de desarrollo
      if (import.meta.env.MODE === 'development') {
        console.error('Sentry (dev mode):', event);
        return null;
      }
      return event;
    },
  });
  console.log('✅ Sentry inicializado en frontend (Vercel)');
} else {
  console.log('ℹ️  Sentry deshabilitado (VITE_SENTRY_DSN_FRONTEND no configurado o es placeholder)');
}

// Obtener la base URL del entorno o usar un valor por defecto
const baseUrl = import.meta.env.BASE_URL || '/';

// Montaje de la app: BrowserRouter (con basename del entorno) envuelve a los
// providers globales; App y los servicios de Vercel comparten el árbol.
ReactDOM.createRoot(document.getElementById('root')).render(
	<BrowserRouter 
		basename={baseUrl}
		future={{
			v7_startTransition: true,
			v7_relativeSplatPath: true
		}}
	>
		<ThemeProvider>
			<AuthProvider>
				<NotificationProvider>
					<App />
					<SpeedInsights />
					<Analytics />
				</NotificationProvider>
			</AuthProvider>
		</ThemeProvider>
	</BrowserRouter>
);
