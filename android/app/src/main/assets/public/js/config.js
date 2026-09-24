/**
 * MAX DRIVE - Configuração do Aplicativo Cliente (APK & Web)
 * 
 * Este arquivo define a URL do servidor backend para que o aplicativo
 * funcione tanto diretamente no navegador quanto empacotado como APK Android.
 */

(function () {
  // 1. Detectar se está rodando em ambiente Web padrão ou embutido em APK Android / Capacitor
  const isWebHttp = window.location.protocol === 'http:' || window.location.protocol === 'https:';
  
  // Detectar ambiente Nativo APK (Capacitor / WebView / file: / capacitor:)
  const isCapacitorNative = !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform()) ||
                           window.location.protocol === 'file:' ||
                           window.location.protocol === 'capacitor:' ||
                           window.location.protocol === 'https:' && window.location.hostname === 'localhost' ||
                           (window.location.hostname === 'localhost' && window.location.port !== '3000' && window.location.port !== '3001');

  // 2. Servidor de Produção Oficial Render
  const RENDER_SERVER_URL = 'https://maxdrive-9us2.onrender.com';

  // No APK Android, limpamos qualquer URL de rede local antiga salva no celular (ex: 192.168... ou 10.x... ou :10000)
  if (isCapacitorNative) {
    try {
      const saved = localStorage.getItem('maxdrive_api_server') || '';
      if (saved && (!saved.includes('onrender.com') || saved.startsWith('http:'))) {
        localStorage.removeItem('maxdrive_api_server');
      }
    } catch (_) {}
  }

  let savedApiServer = '';
  try {
    savedApiServer = localStorage.getItem('maxdrive_api_server') || '';
  } catch (_) {}

  let userConfigured = (typeof window.SERVIDOR_MAXDRIVE === 'string' && window.SERVIDOR_MAXDRIVE.trim())
    ? window.SERVIDOR_MAXDRIVE.trim()
    : '';

  if (userConfigured.includes('onrender.com')) {
    userConfigured = userConfigured.replace(/^http:/i, 'https:').replace(/:3000\/?$/i, '').replace(/:10000\/?$/i, '').replace(/\/+$/, '');
  }

  let defaultApiBase = '';
  if (isCapacitorNative) {
    // Modo APK (Capacitor / Android WebView) -> Sempre utiliza o servidor oficial Render
    defaultApiBase = RENDER_SERVER_URL;
  } else if (!isWebHttp) {
    defaultApiBase = RENDER_SERVER_URL;
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
      defaultApiBase = RENDER_SERVER_URL;
    }
  }

  if (defaultApiBase && defaultApiBase.includes('onrender.com')) {
    defaultApiBase = defaultApiBase.replace(/^http:/i, 'https:').replace(/:3000\/?$/i, '').replace(/:10000\/?$/i, '').replace(/\/+$/, '');
  }

  if (!defaultApiBase && isCapacitorNative) {
    defaultApiBase = RENDER_SERVER_URL;
  }

  window.MAXDRIVE_CONFIG = {
    // URL Base da API do Servidor (Produção Render)
    API_BASE: defaultApiBase || RENDER_SERVER_URL,
    
    // Metadados do App
    APP_NAME: 'MAX DRIVE',
    APP_VERSION: '1.0.25',
    BUILD_TYPE: isCapacitorNative ? 'APK' : 'WEB',
    
    // Função utilitária para definir novo servidor backend em tempo de execução
    setServerUrl: function (newUrl) {
      if (!newUrl) return;
      let cleanUrl = newUrl.trim().replace(/^http:/i, 'https:').replace(/:3000\/?$/i, '').replace(/:10000\/?$/i, '').replace(/\/+$/, '');
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
    if (url && (url.startsWith('/api/') || url.startsWith('api/'))) {
      let base = (window.MAXDRIVE_CONFIG && window.MAXDRIVE_CONFIG.API_BASE) || RENDER_SERVER_URL;
      if (base.includes('onrender.com')) {
        base = base.replace(/^http:/i, 'https:').replace(/:3000\/?$/i, '').replace(/:10000\/?$/i, '').replace(/\/+$/, '');
      }
      const cleanPath = url.startsWith('/') ? url : '/' + url;
      if (typeof input === 'string') {
        input = base + cleanPath;
      } else if (input && input.url) {
        input = new Request(base + cleanPath, init || input);
      }
    }
    return _originalFetch.call(this, input, init).catch(err => {
      console.error(`[MAX DRIVE Fetch Error] URL: ${typeof input === 'string' ? input : (input && input.url ? input.url : '')} |`, err.message || err);
      throw err;
    });
  };

  console.log(`🚀 [MAX DRIVE] Config carregado | Modo: ${window.MAXDRIVE_CONFIG.BUILD_TYPE} | API_BASE: "${window.MAXDRIVE_CONFIG.API_BASE}"`);
})();
