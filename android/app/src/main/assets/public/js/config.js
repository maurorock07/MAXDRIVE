/**
 * MAX DRIVE - Configuração do Aplicativo Cliente (APK & Web)
 * 
 * Este arquivo define a URL do servidor backend para que o aplicativo
 * funcione tanto diretamente no navegador quanto empacotado como APK Android
 * (via Capacitor, Cordova, WebView ou Website 2 APK).
 */

(function () {
  // 1. Detectar se está rodando em ambiente Web padrão ou embutido em APK Android / Capacitor
  const isWebHttp = window.location.protocol === 'http:' || window.location.protocol === 'https:';
  
  // Detectar ambiente Nativo APK (Capacitor / WebView / file: / capacitor:)
  const isCapacitorNative = !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform()) ||
                           window.location.protocol === 'file:' ||
                           window.location.protocol === 'capacitor:' ||
                           (window.location.hostname === 'localhost' && window.location.port !== '3000' && window.location.port !== '3001');

  // 2. Permitir sobrescrever via localStorage (útil para testes em rede local no celular)
  const savedApiServer = localStorage.getItem('maxdrive_api_server');

  // 3. Definir URL padrão do servidor
  let userConfigured = (typeof window.SERVIDOR_MAXDRIVE === 'string' && window.SERVIDOR_MAXDRIVE.trim())
    ? window.SERVIDOR_MAXDRIVE.trim().replace(/\/+$/, '') 
    : '';

  let defaultApiBase = '';
  if (isCapacitorNative) {
    // Modo APK (Capacitor / Android WebView)
    defaultApiBase = userConfigured || savedApiServer || 'http://localhost:3000';
  } else if (!isWebHttp) {
    defaultApiBase = userConfigured || savedApiServer || 'http://localhost:3000';
  } else {
    // Modo Web (Navegador)
    const currentOrigin = (window.location.origin || '').replace(/\/+$/, '');
    const isServedByBackend = window.location.port === '3000' || (userConfigured && userConfigured === currentOrigin);

    if (isServedByBackend) {
      defaultApiBase = '';
    } else if (userConfigured) {
      defaultApiBase = userConfigured;
    } else if (savedApiServer) {
      defaultApiBase = savedApiServer;
    } else {
      defaultApiBase = `http://${window.location.hostname || 'localhost'}:3000`;
    }
  }

  window.MAXDRIVE_CONFIG = {
    // URL Base da API do Servidor (ex: "http://192.168.1.100:3000" ou "https://api.maxdrive.com.br")
    API_BASE: defaultApiBase,
    
    // Metadados do App
    APP_NAME: 'MAX DRIVE',
    APP_VERSION: '1.0.21',
    BUILD_TYPE: isCapacitorNative ? 'APK' : 'WEB',
    
    // Função utilitária para definir novo servidor backend em tempo de execução
    setServerUrl: function (newUrl) {
      if (!newUrl) return;
      let cleanUrl = newUrl.trim().replace(/\/+$/, '');
      localStorage.setItem('maxdrive_api_server', cleanUrl);
      window.MAXDRIVE_CONFIG.API_BASE = cleanUrl;
      console.log('📡 [MAX DRIVE] Servidor API atualizado para:', cleanUrl);
    }
  };

  // 4. Interceptor transparente do fetch
  // Garante que todas as chamadas /api/... do app utilizem o API_BASE configurado automaticamente
  const _originalFetch = window.fetch;
  window.fetch = function (input, init) {
    let url = typeof input === 'string' ? input : (input && input.url ? input.url : '');
    if (url && url.startsWith('/api/')) {
      const base = (window.MAXDRIVE_CONFIG && window.MAXDRIVE_CONFIG.API_BASE) || '';
      if (typeof input === 'string') {
        input = base + input;
      } else if (input && input.url) {
        input = new Request(base + input.url, init || input);
      }
    }
    return _originalFetch.call(this, input, init);
  };

  console.log(`🚀 [MAX DRIVE] Config carregado | Modo: ${window.MAXDRIVE_CONFIG.BUILD_TYPE} | API_BASE: "${window.MAXDRIVE_CONFIG.API_BASE}"`);
})();
