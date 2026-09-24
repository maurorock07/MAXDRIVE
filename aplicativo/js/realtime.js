/**
 * MAX DRIVE - Módulo em Tempo Real (WebSockets & Push Notifications)
 * 
 * Fornece comunicação bidirecional de altíssima velocidade (<50ms)
 * e integração com Capacitor Push Notifications (FCM no Android)
 * com fallback transparente para Web Notifications no navegador.
 */

(function () {
  'use strict';

  // ==========================================================================
  // 1. GERENCIADOR DE WEBSOCKETS (MaxRealtime)
  // ==========================================================================
  const listeners = new Map();
  let ws = null;
  let isConnected = false;
  let reconnectAttempts = 0;
  let reconnectTimer = null;
  let currentContext = {
    userId: null,
    role: 'passenger',
    city: 'ituiutaba'
  };

  function getWebSocketUrl() {
    const apiBase = (window.MAXDRIVE_CONFIG && window.MAXDRIVE_CONFIG.API_BASE) || '';
    if (apiBase) {
      return apiBase.replace(/^http:/i, 'ws:').replace(/^https:/i, 'wss:');
    }
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host || 'localhost:3000';
    return `${proto}//${host}`;
  }

  function connect() {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const wsUrl = getWebSocketUrl();
    console.log(`🔌 [MaxRealtime] Conectando WebSocket em: ${wsUrl}`);

    try {
      ws = new WebSocket(wsUrl);

      ws.onopen = function () {
        console.log('✅ [MaxRealtime] WebSocket Conectado com sucesso!');
        isConnected = true;
        reconnectAttempts = 0;
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }

        // Autenticar com o contexto atual
        send('auth', currentContext);
        emitLocal('connected', { url: wsUrl });
      };

      ws.onmessage = function (event) {
        try {
          const packet = JSON.parse(event.data);
          if (packet.type) {
            emitLocal(packet.type, packet.data || packet);
          }
        } catch (e) {
          console.warn('[MaxRealtime] Mensagem não-JSON recebida:', event.data);
        }
      };

      ws.onclose = function (event) {
        isConnected = false;
        console.warn(`⚠️ [MaxRealtime] Conexão encerrada (código: ${event.code}). Tentando reconectar...`);
        emitLocal('disconnected', { code: event.code });
        scheduleReconnect();
      };

      ws.onerror = function (err) {
        console.warn('[MaxRealtime] Erro no socket:', err);
      };
    } catch (err) {
      console.warn('[MaxRealtime] Falha ao instanciar WebSocket:', err.message);
      scheduleReconnect();
    }
  }

  function scheduleReconnect() {
    if (reconnectTimer) return;
    reconnectAttempts++;
    // Backoff exponencial: 1.5s, 3s, 6s, max 15s
    const delay = Math.min(1500 * Math.pow(1.5, reconnectAttempts - 1), 15000);
    console.log(`⏱️ [MaxRealtime] Nova tentativa em ${Math.round(delay / 1000)}s (Tentativa ${reconnectAttempts})`);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delay);
  }

  function send(type, data = {}) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type, ...data }));
      return true;
    }
    return false;
  }

  function on(event, callback) {
    if (!listeners.has(event)) {
      listeners.set(event, new Set());
    }
    listeners.get(event).add(callback);
    return () => off(event, callback);
  }

  function off(event, callback) {
    if (listeners.has(event)) {
      listeners.get(event).delete(callback);
    }
  }

  function emitLocal(event, data) {
    if (listeners.has(event)) {
      listeners.get(event).forEach(cb => {
        try { cb(data); } catch (e) { console.error(`Erro no listener [${event}]:`, e); }
      });
    }
    // Wildcard '*' listener
    if (listeners.has('*')) {
      listeners.get('*').forEach(cb => {
        try { cb(event, data); } catch (e) { console.error(`Erro no listener [*]:`, e); }
      });
    }
  }

  function updateContext(userId, role, city, vehicleType) {
    if (userId) currentContext.userId = userId;
    if (role) currentContext.role = role;
    if (city) currentContext.city = city.toLowerCase();
    if (vehicleType) currentContext.vehicleType = vehicleType.toLowerCase();
    send('update_context', currentContext);

    // Também re-sincroniza o token de push se existir
    if (window.MaxPush && typeof window.MaxPush.syncTokenWithContext === 'function') {
      window.MaxPush.syncTokenWithContext(currentContext);
    }
  }

  window.MaxRealtime = {
    connect,
    send,
    on,
    off,
    updateContext,
    get isConnected() { return isConnected; }
  };

  // ==========================================================================
  // 2. GERENCIADOR DE PUSH NOTIFICATIONS (MaxPush - FCM & Web)
  // ==========================================================================
  let registeredToken = null;

  async function registerDeviceTokenOnServer(token, platform = 'android') {
    if (!token) return;
    registeredToken = token;
    try {
      const res = await fetch('/api/push/register-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          userId: currentContext.userId,
          role: currentContext.role,
          city: currentContext.city,
          platform
        })
      });
      const data = await res.json();
      if (res.ok) {
        console.log('✅ [MaxPush] Token registrado com sucesso no backend:', token.substring(0, 20) + '...');
      }
    } catch (e) {
      console.warn('⚠️ [MaxPush] Erro ao registrar token no servidor:', e.message);
    }
  }

  async function initPush() {
    const isCapacitorNative = window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform();

    if (isCapacitorNative && window.Capacitor.Plugins && window.Capacitor.Plugins.PushNotifications) {
      const PushNotifications = window.Capacitor.Plugins.PushNotifications;
      try {
        console.log('📱 [MaxPush] Inicializando Capacitor Push Notifications nativo...');
        let permStatus = await PushNotifications.checkPermissions();

        if (permStatus.receive === 'prompt' || permStatus.receive === 'prompt-with-rationale') {
          permStatus = await PushNotifications.requestPermissions();
        }

        if (permStatus.receive === 'granted') {
          await PushNotifications.register();
        } else {
          console.warn('⚠️ [MaxPush] Permissão de notificação negada pelo usuário.');
        }

        // Listener: Token recebido do FCM
        PushNotifications.addListener('registration', (token) => {
          console.log('📲 [MaxPush] Token FCM obtido do Google Play Services:', token.value ? token.value.substring(0, 25) + '...' : token);
          registerDeviceTokenOnServer(token.value || token, 'android');
        });

        PushNotifications.addListener('registrationError', (err) => {
          console.warn('⚠️ [MaxPush] Erro no registro FCM:', err);
        });

        // Listener: Notificação recebida com app aberto (Foreground)
        PushNotifications.addListener('pushNotificationReceived', (notification) => {
          console.log('🔔 [MaxPush] Push em primeiro plano:', notification);
          if (window.App && typeof window.App.showToast === 'function') {
            window.App.showToast(`${notification.title || 'MAX DRIVE'}: ${notification.body || ''}`, 'info');
          }
          if (window.App && typeof window.App.playSound === 'function') {
            window.App.playSound('newRide');
          }
        });

        // Listener: Usuário tocou na notificação na barra de status
        PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
          console.log('👆 [MaxPush] Toque na notificação:', action);
          const data = action.notification?.data || {};
          if (data.rideId && window.App) {
            // Se for nova corrida e motorista, vai pro radar
            if (data.type === 'new_ride') {
              window.App.goToScreen('screen-driver-home');
            }
          }
        });
      } catch (err) {
        console.warn('⚠️ [MaxPush] Erro na inicialização do Push Nativo:', err.message);
      }
    } else if ('Notification' in window) {
      // Fallback para Web / PWA no navegador Desktop ou Mobile
      console.log('🌐 [MaxPush] Ambiente Web detectado. Suporte a Web Notifications disponível.');
      if (Notification.permission === 'default') {
        // Pede permissão discretamente após primeira interação
        setTimeout(() => {
          Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
              console.log('✅ [MaxPush] Permissão para Web Notifications concedida.');
              // Gera token simulado web para receber avisos do servidor
              const webToken = 'web-' + (localStorage.getItem('maxdrive_web_token') || ('tok_' + Math.random().toString(36).substring(2, 12)));
              localStorage.setItem('maxdrive_web_token', webToken);
              registerDeviceTokenOnServer(webToken, 'web');
            }
          });
        }, 3000);
      } else if (Notification.permission === 'granted') {
        const webToken = 'web-' + (localStorage.getItem('maxdrive_web_token') || ('tok_' + Math.random().toString(36).substring(2, 12)));
        localStorage.setItem('maxdrive_web_token', webToken);
        registerDeviceTokenOnServer(webToken, 'web');
      }
    }
  }

  function showLocalNotification(title, body, options = {}) {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body,
          icon: 'assets/icons/MAXDRIVET.svg',
          badge: 'assets/icons/MAXDRIVET.svg',
          ...options
        });
      } catch (_) {}
    }
  }

  function syncTokenWithContext(ctx) {
    if (registeredToken) {
      registerDeviceTokenOnServer(registeredToken, (window.Capacitor?.isNativePlatform?.()) ? 'android' : 'web');
    }
  }

  window.MaxPush = {
    init: initPush,
    showLocalNotification,
    syncTokenWithContext
  };

  // Inicialização automática ao carregar o script
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      MaxRealtime.connect();
      MaxPush.init();
    });
  } else {
    MaxRealtime.connect();
    MaxPush.init();
  }
})();
