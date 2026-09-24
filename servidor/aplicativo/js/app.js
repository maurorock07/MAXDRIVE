/**
 * MAX DRIVE - Aplicação Frontend Principal
 * Lógica completa de fluxos: Passageiro, Motorista, Sons, Chat, Corridas e Autenticação
 */


const App = (function() {
  // Application State
  const state = {
    currentUser: null,
    userRole: 'passenger', // 'passenger' | 'driver'
    currentScreen: 'screen-splash',
    currentCity: null,
    soundEnabled: true,
    activeRide: null,
    currentChatRideId: null,
    selectedRating: 5,
    reportingRideId: null,
    reportingTargetName: null,
    registerRole: 'passenger',
    sessionToken: null,
    vehicleType: 'car',
    driverHasArrived: false,
    originCoords: null,
    destCoords: null,
    seenMessageIds: new Set(),
    globalPollInterval: null,
    adminChatPollInterval: null,
    lastAdminUnreadCount: 0,
    lastAdminCheckTime: 0
  };

  // Sound Effects Map
  const sounds = {
    click: new Audio('assets/sounds/click.wav'),
    newRide: new Audio('assets/sounds/maxdrive.mp3'),
    aCaminho: new Audio('assets/sounds/acaminho.mp3'),
    novaMensagem: new Audio('assets/sounds/novamensagem.mp3'),
    cheguei: new Audio('assets/sounds/cheguei.mp3'),
    seguranca: new Audio('assets/sounds/seguranca.mp3'),
    verificar: new Audio('assets/sounds/verificar.mp3'),
    online: new Audio('assets/sounds/online.wav'),
    offline: new Audio('assets/sounds/offline.wav'),
    success: new Audio('assets/sounds/success.wav'),
    cancel: new Audio('assets/sounds/cancel.wav')
  };

  function playSound(soundName) {
    if (!state.soundEnabled) return;
    try {
      const audio = sounds[soundName];
      if (audio) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      }
    } catch (e) {
      console.warn('Audio play prevented:', e);
    }
  }

  function updateSoundUI() {
    const btn = document.getElementById('btn-toggle-sound');
    if (btn) {
      btn.innerHTML = state.soundEnabled 
        ? '<img src="assets/icons/volume-2.svg" alt="" class="svg-icon-img sm"> Som: ON' 
        : '<img src="assets/icons/volume-x.svg" alt="" class="svg-icon-img sm"> Som: OFF';
      btn.style.borderColor = state.soundEnabled ? 'rgba(0, 208, 75, 0.4)' : 'rgba(255, 255, 255, 0.2)';
    }
    const chk = document.getElementById('toggle-sound-settings');
    if (chk) chk.checked = !!state.soundEnabled;
  }

  function toggleSound() {
    state.soundEnabled = !state.soundEnabled;
    try {
      localStorage.setItem('maxdrive_sound_enabled', state.soundEnabled ? '1' : '0');
    } catch (_) {}
    updateSoundUI();
    showToast(state.soundEnabled ? 'Efeitos sonoros ativados' : 'Efeitos sonoros desativados');
  }

  function handleSoundToggle(enabled) {
    state.soundEnabled = Boolean(enabled);
    try {
      localStorage.setItem('maxdrive_sound_enabled', state.soundEnabled ? '1' : '0');
    } catch (_) {}
    updateSoundUI();
    showToast(state.soundEnabled ? 'Efeitos sonoros ativados' : 'Efeitos sonoros desativados');
  }

  // Universal Avatar Rendering Helpers
  function getInitialsFromName(name, fallback = 'MD') {
    if (!name || typeof name !== 'string') return fallback;
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return fallback;
    return parts.slice(0, 2).map(p => p[0]).join('').toUpperCase() || fallback;
  }

  function renderAvatarCircle(avatarUrl, name, fallbackInitials = '') {
    const initials = fallbackInitials || getInitialsFromName(name);
    if (avatarUrl && typeof avatarUrl === 'string' && avatarUrl.trim() !== '' && !avatarUrl.includes('avatar.jpg') && !avatarUrl.includes('avatar.png') && !avatarUrl.includes('placeholder')) {
      return `<img src="${avatarUrl}" alt="${name || 'Avatar'}" class="avatar-img" onerror="this.style.display='none'; if (this.parentElement) this.parentElement.innerText='${initials}'">`;
    }
    return initials;
  }

  function setAvatarElement(el, avatarUrl, name, fallbackInitials = '') {
    if (!el) return;
    const initials = fallbackInitials || getInitialsFromName(name);
    if (avatarUrl && typeof avatarUrl === 'string' && avatarUrl.trim() !== '' && !avatarUrl.includes('avatar.jpg') && !avatarUrl.includes('avatar.png') && !avatarUrl.includes('placeholder')) {
      el.innerHTML = `<img src="${avatarUrl}" alt="${name || 'Avatar'}" class="avatar-img" onerror="this.style.display='none'; if (this.parentElement) this.parentElement.innerText='${initials}'">`;
    } else {
      el.innerText = initials;
    }
  }

  function showToast(msg, type = null, onClick = null) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    if (!type) {
      const lower = String(msg).toLowerCase();
      if (lower.includes('erro') || lower.includes('cancelad') || lower.includes('negad') || lower.includes('banid') || lower.includes('reprovad')) {
        type = 'error';
      } else if (lower.includes('sucesso') || lower.includes('aprovad') || lower.includes('aceita') || lower.includes('concluíd') || lower.includes('salvos') || lower.includes('bem-vindo')) {
        type = 'success';
      } else if (lower.includes('atenção') || lower.includes('aguardando') || lower.includes('aviso') || lower.includes('selecione')) {
        type = 'warning';
      } else {
        type = 'info';
      }
    }

    const icons = {
      success: '<img src="assets/icons/check-circle.svg" alt="" class="svg-icon-img md">',
      error: '<img src="assets/icons/x-circle.svg" alt="" class="svg-icon-img md">',
      warning: '<img src="assets/icons/alert-triangle.svg" alt="" class="svg-icon-img md">',
      info: '<img src="assets/icons/zap.svg" alt="" class="svg-icon-img md">'
    };

    const titles = {
      success: 'Sucesso',
      error: 'Atenção',
      warning: 'Notificação',
      info: 'MAX DRIVE'
    };

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    if (onClick) {
      toast.style.cursor = 'pointer';
      toast.title = 'Toque para abrir conversa';
      toast.onclick = (e) => {
        try { onClick(e); } catch(err) {}
        toast.remove();
      };
    }
    toast.innerHTML = `
      <div class="toast-icon-wrap">${icons[type] || icons.info}</div>
      <div class="toast-body">
        <div class="toast-title">${titles[type] || 'MAX DRIVE'}</div>
        <div class="toast-message">${msg}${onClick ? '<div style="margin-top: 3px; font-size: 10px; color: #00E5FF; font-weight: 700;">Toque para responder em Configurações &rarr;</div>' : ''}</div>
      </div>
      <div class="toast-progress"></div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-15px) scale(0.9)';
      setTimeout(() => toast.remove(), 260);
    }, onClick ? 5000 : 3200);
  }

  // Custom Dialog Modal Promise (Substitui alert, confirm e prompt nativos)
  function showDialog({ title = 'MAX DRIVE', message = '', type = 'alert', confirmText = 'OK', cancelText = 'CANCELAR', neutralText = null, placeholder = '', defaultValue = '', onConfirm = null, onCancel = null } = {}) {
    return new Promise((resolve) => {
      const modal = document.getElementById('modal-custom-dialog');
      if (!modal) {
        console.warn('MAX DRIVE Dialog:', message);
        showToast(message, type === 'confirm' ? 'warning' : 'info');
        if (type === 'confirm') return resolve(true);
        if (type === 'prompt') return resolve(defaultValue || '');
        return resolve(true);
      }

      const iconEl = document.getElementById('custom-dialog-icon');
      const titleEl = document.getElementById('custom-dialog-title');
      const msgEl = document.getElementById('custom-dialog-message');
      const inputWrap = document.getElementById('custom-dialog-input-wrap');
      const inputEl = document.getElementById('custom-dialog-input');
      const btnConfirm = document.getElementById('custom-dialog-btn-confirm');
      const btnCancel = document.getElementById('custom-dialog-btn-cancel');
      const btnNeutral = document.getElementById('custom-dialog-btn-neutral');

      if (titleEl) titleEl.innerText = title;
      if (msgEl) msgEl.innerText = message;

      if (iconEl) {
        iconEl.className = 'custom-dialog-icon';
        if (type === 'confirm' || message.toLowerCase().includes('cancelar') || message.toLowerCase().includes('ban')) {
          iconEl.classList.add('danger');
          iconEl.innerHTML = '<img src="assets/icons/alert-triangle.svg" alt="" class="svg-icon-img lg">';
        } else if (type === 'prompt') {
          iconEl.classList.add('info');
          iconEl.innerHTML = '<img src="assets/icons/edit.svg" alt="" class="svg-icon-img lg">';
        } else if (message.toLowerCase().includes('sucesso') || message.toLowerCase().includes('aprovado')) {
          iconEl.classList.add('success');
          iconEl.innerHTML = '<img src="assets/icons/check-circle.svg" alt="" class="svg-icon-img lg">';
        } else {
          iconEl.innerHTML = '<img src="assets/icons/zap.svg" alt="" class="svg-icon-img lg">';
        }
      }

      if (btnConfirm) {
        btnConfirm.innerText = confirmText;
        btnConfirm.className = (type === 'confirm' && (message.toLowerCase().includes('cancelar') || message.toLowerCase().includes('ban'))) ? 'btn-pill btn-red' : 'btn-pill btn-yellow';
      }

      if (btnCancel) {
        btnCancel.innerText = cancelText;
        btnCancel.style.display = (type === 'confirm' || type === 'prompt') ? 'inline-block' : 'none';
      }

      if (btnNeutral) {
        if (neutralText) {
          btnNeutral.innerText = neutralText;
          btnNeutral.style.display = 'inline-block';
        } else {
          btnNeutral.style.display = 'none';
        }
      }

      if (inputWrap && inputEl) {
        if (type === 'prompt') {
          inputWrap.style.display = 'block';
          inputEl.value = defaultValue || '';
          inputEl.placeholder = placeholder || '';
          setTimeout(() => inputEl.focus(), 150);
        } else {
          inputWrap.style.display = 'none';
        }
      }

      function cleanUp() {
        modal.style.display = 'none';
        if (btnConfirm) btnConfirm.onclick = null;
        if (btnCancel) btnCancel.onclick = null;
        if (btnNeutral) btnNeutral.onclick = null;
      }

      if (btnConfirm) {
        btnConfirm.onclick = () => {
          cleanUp();
          if (typeof onConfirm === 'function') {
            try { onConfirm(); } catch (e) { console.error('onConfirm error:', e); }
          }
          if (type === 'prompt') {
            resolve(inputEl ? inputEl.value.trim() : '');
          } else {
            resolve(neutralText ? 'confirm' : true);
          }
        };
      }

      if (btnCancel) {
        btnCancel.onclick = () => {
          cleanUp();
          if (typeof onCancel === 'function') {
            try { onCancel(); } catch (e) { console.error('onCancel error:', e); }
          }
          if (type === 'prompt') {
            resolve(null);
          } else {
            resolve(neutralText ? 'cancel' : false);
          }
        };
      }

      if (btnNeutral) {
        btnNeutral.onclick = () => {
          cleanUp();
          resolve(false);
        };
      }

      modal.style.display = 'flex';
    });
  }


  function handleLogoClick() {
    playSound('click');
    const isLogged = !!(state.currentUser || (typeof localStorage !== 'undefined' && localStorage.getItem('maxdrive_logged_user')));
    if (isLogged) {
      const activeRole = state.userRole || (typeof localStorage !== 'undefined' && localStorage.getItem('maxdrive_role')) || (state.currentUser && state.currentUser.role) || 'passenger';
      const homeScreen = activeRole === 'driver' ? 'screen-driver-home' : 'screen-passenger-home';
      goToScreen(homeScreen);
    } else {
      goToScreen('screen-login');
    }
  }

  // Screen Navigation
  function goToScreen(screenId) {
    playSound('click');

    // Bloqueia acesso de passageiro ao painel de finanças (exclusivo para motoristas)
    if (screenId === 'screen-finances' && state.userRole !== 'driver') {
      showToast('O painel financeiro é exclusivo para motoristas.');
      screenId = 'screen-passenger-home';
    }

    // Bug 1: Redireciona passageiro para tela de corrida ativa se tentar voltar pra home de solicitação
    if (screenId === 'screen-passenger-home' && state.userRole === 'passenger') {
      if (state.activeRide && ['accepted', 'arrived', 'in_progress'].includes(state.activeRide.status)) {
        screenId = 'screen-passenger-active-ride';
        showToast('Sua corrida está em andamento!');
      } else if (state.waitingRideId || (state.activeRide && state.activeRide.status === 'requested')) {
        screenId = 'screen-passenger-waiting';
        showToast('Aguardando motorista aceitar sua corrida!');
      }
    }

    // Bug 1: Redireciona motorista para tela de corrida ativa se tentar voltar pro radar
    if (screenId === 'screen-driver-home' && state.userRole === 'driver' && state.activeRide && ['accepted', 'arrived', 'in_progress'].includes(state.activeRide.status)) {
      screenId = 'screen-driver-active-ride';
      showToast('Você já possui uma corrida em andamento!');
    }

    updateRoleNavVisibility();

    const screens = document.querySelectorAll('.screen');
    screens.forEach(s => s.classList.remove('active'));

    const target = document.getElementById(screenId);
    if (target) {
      target.classList.add('active');
      state.currentScreen = screenId;
      window.scrollTo(0, 0);

      updateActiveRideBanner();

      // Trigger map resize if moving to passenger home
      if (screenId === 'screen-passenger-home') {
        if (!state.activeRide) {
          clearRouteInputs();
        }
        if (window.MaxMap) {
          setTimeout(() => {
            window.MaxMap.init('passenger-map-box');
            window.MaxMap.render();
          }, 120);
        }
      }
      if (screenId === 'screen-passenger-active-ride') {
        if (window.MaxMap) {
          setTimeout(() => {
            const activeBox = document.getElementById('active-ride-map-box');
            if (activeBox) {
              window.MaxMap.init('active-ride-map-box');
              if (state.activeRide) {
                window.MaxMap.setRoute(state.activeRide.origin, state.activeRide.destination);
                window.MaxMap.startTracking();
              }
            }
          }, 150);
        }
      }
      if (screenId === 'screen-driver-home') {
        refreshDriverRadar();
      }
      if (screenId === 'screen-history') {
        renderHistory();
      }
      if (screenId === 'screen-finances') {
        renderFinances();
      }
      if (screenId === 'screen-settings') {
        updateProfileView();
        updateDriverSettingsStats();
        loadDriverWeeklyPaymentStatus();
        loadUserReports();
        const curId = state.currentUser ? state.currentUser.id : (state.userRole === 'driver' ? 'usr-drv-1' : 'usr-pass-1');
        if (curId) checkAdminDirectMessages(curId, true);
      }
      if (screenId === 'screen-profile') {
        updateProfileView();
      }
    }
  }

  function handleSoundToggle(enabled) {
    state.soundEnabled = enabled;
    if (enabled) {
      playSound('online');
      showToast('Efeitos sonoros ativados');
    } else {
      showToast('Efeitos sonoros desativados');
    }
  }

    function updateRoleSwitcherVisibility() {
      const isDriver = state.userRole === 'driver';

      const inputs = document.querySelectorAll('.header-role-toggle-input');
      inputs.forEach(input => {
        input.checked = isDriver;
      });

      const labels = document.querySelectorAll('.header-role-label');
      labels.forEach(lbl => {
        if (isDriver) {
          lbl.innerText = 'MOTORISTA (LIGADO)';
          lbl.style.color = '#00D04B';
        } else {
          lbl.innerText = 'PASSAGEIRO';
          lbl.style.color = 'var(--text-secondary)';
        }
      });

      const settingsToggle = document.getElementById('toggle-account-status');
      if (settingsToggle) {
        settingsToggle.checked = isDriver;
      }
    }

    function toggleUserRole(forceChecked) {
      playSound('click');

      // Bloqueia alternar de modo se possuir corrida ativa
      const hasActive = !!(state.waitingRideId || (state.activeRide && ['requested', 'accepted', 'arrived', 'in_progress'].includes(state.activeRide.status)));
      if (hasActive) {
        showToast('Você não pode alternar de modo enquanto possui uma corrida em andamento!', 'warning');
        updateRoleSwitcherVisibility();
        return;
      }

      let targetRole;
      if (typeof forceChecked === 'boolean') {
        targetRole = forceChecked ? 'driver' : 'passenger';
      } else {
        targetRole = state.userRole === 'driver' ? 'passenger' : 'driver';
      }

      switchMode(targetRole);
      updateRoleSwitcherVisibility();
      showToast(targetRole === 'driver' ? 'Modo Motorista ativado (LIGADO)!' : 'Modo Passageiro ativado!');
    }

  // Switch between Passenger and Driver mode (Inside App only)
  function switchMode(mode) {
    state.userRole = mode;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('maxdrive_role', mode);
    }
    if (state.currentUser) {
      state.currentUser.role = mode;
      saveUserSession(state.currentUser);
    }
    if (window.MaxRealtime) {
      const vType = (state.currentUser && state.currentUser.vehicle && state.currentUser.vehicle.type) ? state.currentUser.vehicle.type : 'car';
      window.MaxRealtime.updateContext(state.currentUser ? state.currentUser.id : null, mode, state.currentCity, vType);
    }

    const btnSwitch = document.getElementById('btn-switch-role');
    if (btnSwitch) {
      btnSwitch.innerText = mode === 'driver' ? 'MUDAR PARA MODO PASSAGEIRO' : 'MUDAR PARA MODO MOTORISTA';
    }

    updateRoleNavVisibility();

    if (mode === 'passenger') {
      goToScreen('screen-passenger-home');
      showToast('Modo Passageiro Ativado');
    } else {
      goToScreen('screen-driver-home');
      showToast('Modo Motorista Ativado (Radar)');
      playSound('online');
    }
    if (state.currentScreen === 'screen-history') {
      renderHistory();
    }
    updateProfileView();
  }

  // Login Handler
  async function handleLogin(e) {
    if (e) e.preventDefault();
    playSound('click');

    const emailInput = document.getElementById('login-email');
    const passInput = document.getElementById('login-password');

    const email = emailInput ? emailInput.value.trim() : '';
    const password = passInput ? passInput.value.trim() : '';

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (!res.ok) {
        playSound('cancel');
        if (data.banned) {
          showDialog({
            title: 'CONTA SUSPENSA',
            message: `CONTA SUSPENSA / BANIDA\n\nMotivo: ${data.banReason || 'Violação dos termos de serviço'}\n\nEntre em contato com o suporte da MAX DRIVE.`,
            type: 'alert',
            confirmText: 'ENTENDI'
          });
        } else {
          showToast(data.message || 'Erro ao realizar login');
        }
        return;
      }

      state.currentUser = data.user;
      state.sessionToken = data.sessionToken || (data.user && data.user.sessionToken) || null;
      try {
        saveUserSession(data.user, state.sessionToken);
      } catch (storageErr) {
        console.warn('Non-blocking storage error:', storageErr);
      }
      playSound('newRide');

      showToast(`Bem-vindo(a), ${data.user.name}!`);

      updateAdminBadgeVisibility();

      if (data.user.role === 'driver') {
        switchMode('driver');
      } else {
        switchMode('passenger');
      }
      populateUserData(data.user);
    } catch (err) {
      console.error('Erro no login:', err);
      const isFailedFetch = String(err.message || err).toLowerCase().includes('failed to fetch');
      if (isFailedFetch) {
        showToast('Não foi possível conectar ao servidor na nuvem. Se o servidor estava em repouso, aguarde alguns instantes e tente novamente.', 'error');
      } else {
        showToast('Erro de conexão: ' + (err.message || String(err)), 'error');
      }
    }
  }

  // Register Role Selection
  function selectRegisterRole(role) {
    playSound('click');
    state.registerRole = role;
    const btnPass = document.getElementById('btn-role-passenger');
    const btnDrv = document.getElementById('btn-role-driver');
    const drvExtra = document.getElementById('reg-driver-extra-fields');
    if (btnPass && btnDrv) {
      btnPass.classList.toggle('active', role === 'passenger');
      btnDrv.classList.toggle('active', role === 'driver');
    }
    if (drvExtra) {
      drvExtra.style.display = role === 'driver' ? 'block' : 'none';
    }
  }

  function selectRegVehicleType(type) {
    playSound('click');
    state.regVehicleType = type;
    const btnCar = document.getElementById('btn-reg-veh-car');
    const btnMoto = document.getElementById('btn-reg-veh-moto');
    if (btnCar && btnMoto) {
      btnCar.className = type === 'car' ? 'btn-pill btn-cyan' : 'btn-pill btn-white';
      btnMoto.className = type === 'moto' ? 'btn-pill btn-cyan' : 'btn-pill btn-white';
    }
  }

  function handleRegAvatarSelect(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    // Validate file type (PNG, JPG, JPEG)
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    if (!allowedTypes.includes(file.type.toLowerCase())) {
      showToast('Formato de foto inválido. Permitido apenas PNG, JPG ou JPEG.', 'warning');
      e.target.value = '';
      return;
    }

    // Validate max size: 10MB (10 * 1024 * 1024 bytes)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      showToast('A foto ultrapassa o tamanho máximo permitido de 10MB.', 'warning');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = function(evt) {
      state.registerAvatar = evt.target.result;
      const img = document.getElementById('reg-photo-img');
      const txt = document.getElementById('reg-photo-text');
      if (img) {
        img.src = evt.target.result;
        img.style.display = 'block';
      }
      if (txt) txt.style.display = 'none';
      showToast('Foto de perfil anexada com sucesso!');
    };
    reader.readAsDataURL(file);
  }

  function getTermsHtmlForRole(role) {
    if (role === 'driver') {
      return `
        <h4 style="margin-bottom: 12px; font-weight: 900; color: var(--cyan-action); text-transform: uppercase; font-size: 13px;">TERMOS DE USO – MOTORISTAS</h4>

        <p style="margin-bottom: 12px;"><strong>Respeito e cordialidade:</strong> O motorista deve tratar o passageiro com respeito, educação e cordialidade durante toda a corrida.</p>

        <p style="margin-bottom: 12px;"><strong>Conduta adequada:</strong> É proibido qualquer comportamento ofensivo, discriminatório ou agressivo contra o passageiro.</p>

        <div class="terms-box-highlight">
          <strong style="text-transform: uppercase; display: block; margin-bottom: 4px;">Independência do motorista:</strong>
          O MOTORISTA DECLARA SER UM PROFISSIONAL AUTÔNOMO E INDEPENDENTE, SEM QUALQUER VÍNCULO EMPREGATÍCIO, SOCIETÁRIO OU DE SUBORDINAÇÃO COM A PLATAFORMA.
        </div>

        <div class="terms-box-highlight-cyan">
          <strong style="text-transform: uppercase; display: block; margin-bottom: 4px;">Responsabilidade da viagem:</strong>
          O MOTORISTA É O ÚNICO RESPONSÁVEL PELA EXECUÇÃO DA CORRIDA, INCLUINDO SEGURANÇA, CUMPRIMENTO DO TRAJETO E CONDIÇÕES DO VEÍCULO.
        </div>
      `;
    } else {
      return `
        <h4 style="margin-bottom: 12px; font-weight: 900; color: var(--cyan-action); text-transform: uppercase; font-size: 13px;">TERMOS DE USO – PASSAGEIROS</h4>

        <p style="margin-bottom: 12px;"><strong>Respeito e cordialidade:</strong> O passageiro deve tratar o motorista com respeito, educação e cordialidade durante toda a corrida.</p>

        <p style="margin-bottom: 12px;"><strong>Conduta adequada:</strong> É proibido qualquer comportamento ofensivo, discriminatório ou agressivo contra o motorista.</p>

        <div class="terms-box-highlight">
          <strong style="text-transform: uppercase; display: block; margin-bottom: 4px;">Independência do motorista:</strong>
          O PASSAGEIRO RECONHECE QUE O MOTORISTA É UM PROFISSIONAL AUTÔNOMO E INDEPENDENTE, NÃO POSSUINDO QUALQUER VÍNCULO EMPREGATÍCIO, SOCIETÁRIO OU DE SUBORDINAÇÃO COM A PLATAFORMA.
        </div>

        <div class="terms-box-highlight-cyan">
          <strong style="text-transform: uppercase; display: block; margin-bottom: 4px;">Responsabilidade da viagem:</strong>
          O PASSAGEIRO ENTENDE QUE A EXECUÇÃO DA CORRIDA É DE RESPONSABILIDADE EXCLUSIVA DO MOTORISTA, CABENDO À PLATAFORMA APENAS INTERMEDIAR O CONTATO ENTRE AS PARTES.
        </div>
      `;
    }
  }

  function openTermsModal() {
    playSound('click');
    const modal = document.getElementById('modal-terms-use');
    const body = document.getElementById('terms-modal-body');
    if (body) {
      body.innerHTML = getTermsHtmlForRole(state.registerRole || 'passenger');
    }
    if (modal) modal.style.display = 'flex';
  }

  function closeTermsModal() {
    playSound('click');
    const modal = document.getElementById('modal-terms-use');
    if (modal) modal.style.display = 'none';
  }

  function acceptTermsFromModal() {
    playSound('click');
    const check = document.getElementById('reg-terms-check');
    if (check) check.checked = true;
    closeTermsModal();
    showToast('Termos de Uso aceitos!');
  }

  // Security code auto-advance inputs
  function setupSecurityCodeInputs() {
    const inputs = document.querySelectorAll('.code-digit-input');
    inputs.forEach((input, index) => {
      input.addEventListener('input', (e) => {
        if (input.value.length === 1) {
          const next = inputs[index + 1];
          if (next) next.focus();
        }
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !input.value) {
          const prev = inputs[index - 1];
          if (prev) prev.focus();
        }
      });
    });
  }

  // Register Handler
  async function handleRegister(e) {
    if (e) e.preventDefault();
    playSound('click');

    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const phone = document.getElementById('reg-phone').value.trim();
    const cpf = document.getElementById('reg-cpf') ? document.getElementById('reg-cpf').value.trim() : '';
    const birthDate = document.getElementById('reg-birth') ? document.getElementById('reg-birth').value : '';
    const password = document.getElementById('reg-password').value;
    const termsChecked = document.getElementById('reg-terms-check') ? document.getElementById('reg-terms-check').checked : false;

    // 1. Mandatory Avatar Photo Check
    if (!state.registerAvatar) {
      showToast('A FOTO DE PERFIL É OBRIGATÓRIA no cadastro!', 'warning');
      return;
    }

    // 2. Full Name Validation (Nome + Sobrenome)
    const nameParts = name.split(/\s+/).filter(Boolean);
    if (nameParts.length < 2) {
      showToast('Informe seu NOME E SOBRENOME completos.', 'warning');
      return;
    }

    // 3. Email, Phone, CPF, BirthDate validation
    if (!email || !phone || !cpf || !birthDate) {
      showToast('Preencha todos os campos obrigatórios!', 'warning');
      return;
    }

    // 4. Security PIN Code Validation (Numbers Only, 6 digits)
    const codeInputs = document.querySelectorAll('#screen-register .code-digit-input');
    let securityCode = '';
    codeInputs.forEach(inp => { securityCode += inp.value; });

    if (!/^\d{6}$/.test(securityCode)) {
      showToast('O Código de Segurança (PIN) deve conter EXATAMENTE 6 NÚMEROS.', 'warning');
      return;
    }

    // 5. Password Length Validation (min 6, max 20)
    if (password.length < 6 || password.length > 20) {
      showToast('A senha deve conter entre 6 e 20 caracteres.', 'warning');
      return;
    }

    // 6. Driver Extra Fields Validation
    let vehicleData = null;
    let cnhVal = '';
    if (state.registerRole === 'driver') {
      cnhVal = document.getElementById('reg-cnh') ? document.getElementById('reg-cnh').value.trim() : '';
      const vehModel = document.getElementById('reg-veh-model') ? document.getElementById('reg-veh-model').value.trim() : '';
      const vehPlate = document.getElementById('reg-veh-plate') ? document.getElementById('reg-veh-plate').value.trim() : '';
      const vehColor = document.getElementById('reg-veh-color') ? document.getElementById('reg-veh-color').value.trim() : '';
      const vehYear = document.getElementById('reg-veh-year') ? document.getElementById('reg-veh-year').value.trim() : '';

      if (!cnhVal || !vehModel || !vehPlate || !vehColor || !vehYear) {
        showToast('Preencha a CNH e TODOS os dados do Veículo (Modelo, Placa, Cor e Ano)!', 'warning');
        return;
      }

      vehicleData = {
        type: state.regVehicleType || 'car',
        model: vehModel.toUpperCase(),
        plate: vehPlate.toUpperCase(),
        color: vehColor,
        year: vehYear
      };
    }

    // 7. Terms of Use Checkbox
    if (!termsChecked) {
      showToast('Você precisa aceitar os Termos de Uso para se cadastrar!', 'warning');
      return;
    }

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          phone,
          cpf,
          birthDate,
          cnh: cnhVal,
          securityCode,
          password,
          role: state.registerRole,
          avatar: state.registerAvatar,
          vehicle: vehicleData
        })
      });

      const data = await res.json();
      if (!res.ok) {
        showToast(data.message || 'Erro ao realizar cadastro');
        return;
      }

      playSound('success');
      showToast('Cadastro realizado com sucesso! Faça login.');
      goToScreen('screen-login');
    } catch (err) {
      showToast('Erro ao conectar com servidor');
    }
  }

  // -------------------------------------------------------------
  // WAITING COUNTDOWN & RIDE EXPIRATION (15 MINUTES)
  // -------------------------------------------------------------
  const RIDE_EXPIRATION_TIME_MS = 15 * 60 * 1000; // 15 minutos
  let waitingPollInterval = null;
  let waitingCountdownInterval = null;
  let isExpiringModalOpen = false;

  function stopWaitingPoll() {
    if (waitingPollInterval) {
      clearInterval(waitingPollInterval);
      waitingPollInterval = null;
    }
  }

  function stopWaitingCountdown() {
    if (waitingCountdownInterval) {
      clearInterval(waitingCountdownInterval);
      waitingCountdownInterval = null;
    }
  }

  function startWaitingCountdown(createdAt) {
    stopWaitingCountdown();
    const createdTime = createdAt ? new Date(createdAt).getTime() : Date.now();

    const updateTimerDisplay = () => {
      const elapsed = Date.now() - createdTime;
      const remainingMs = Math.max(0, RIDE_EXPIRATION_TIME_MS - elapsed);
      const remainingSec = Math.floor(remainingMs / 1000);
      const mins = Math.floor(remainingSec / 60);
      const secs = remainingSec % 60;
      const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

      const timerEl = document.getElementById('waiting-countdown-timer');
      const badgeBox = document.getElementById('waiting-countdown-box');
      if (timerEl) timerEl.innerText = formatted;
      if (badgeBox) {
        if (remainingSec <= 120) { // menos de 2 minutos restantes
          badgeBox.classList.add('warning');
        } else {
          badgeBox.classList.remove('warning');
        }
      }

      if (remainingMs <= 0) {
        stopWaitingCountdown();
        handleRideExpired(state.waitingRideId || (state.activeRide && state.activeRide.id));
      }
    };

    updateTimerDisplay();
    waitingCountdownInterval = setInterval(updateTimerDisplay, 1000);
  }

  async function handleRideExpired(rideId) {
    if (isExpiringModalOpen) return;
    isExpiringModalOpen = true;

    stopWaitingPoll();
    stopWaitingCountdown();

    const targetRideId = rideId || state.waitingRideId || (state.activeRide && state.activeRide.id);

    // Sync with backend to mark ride as expired
    if (targetRideId) {
      try {
        await fetch(`/api/rides/${targetRideId}/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'expired',
            cancellationReason: 'Tempo limite de 15 minutos atingido sem motorista',
            cancelledBy: 'system'
          })
        });
      } catch (e) {
        console.warn('Erro ao sincronizar expiração no servidor:', e);
      }
    }

    clearActiveRideState();
    state.activeRide = null;
    state.waitingRideId = null;
    state.driverHasArrived = false;
    populateDriverActiveCard(null);
    if (window.MaxMap) window.MaxMap.stopTracking();

    playSound('cancel');

    await showDialog({
      title: 'Tempo Esgotado (15 Minutos)',
      message: 'Nenhum motorista aceitou sua solicitação dentro do prazo de 15 minutos.\n\nA corrida expirou. Por favor, solicite uma nova corrida pelo aplicativo para tentar novamente.',
      type: 'alert',
      confirmText: 'SOLICITAR NOVA CORRIDA'
    });

    isExpiringModalOpen = false;
    goToScreen('screen-passenger-home');
  }

  function startWaitingPoll(rideId) {
    stopWaitingPoll();
    waitingPollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/rides/${rideId}`);
        if (!res.ok) return;
        const data = await res.json();
        const ride = data.ride;
        if (!ride) return;

        if (ride.status === 'accepted') {
          stopWaitingPoll();
          stopWaitingCountdown();
          onDriverAcceptedRide(ride);
        } else if (ride.status === 'expired') {
          stopWaitingPoll();
          stopWaitingCountdown();
          handleRideExpired(ride.id);
        } else if (ride.status === 'cancelled') {
          stopWaitingPoll();
          stopWaitingCountdown();
          state.activeRide = null;
          state.waitingRideId = null;
          showToast('Esta solicitação de corrida foi cancelada.');
          clearRouteInputs();
          goToScreen('screen-passenger-home');
        }
      } catch (err) {
        console.error('Erro no monitoramento da corrida:', err);
      }
    }, 2000);
  }

  function onDriverAcceptedRide(ride) {
    stopWaitingPoll();
    stopWaitingCountdown();
    state.activeRide = ride;
    state.waitingRideId = null;
    playSound('aCaminho');
    showToast(`Motorista ${ride.driverName} aceitou sua corrida!`);

    // Update active ride screen with real accepted driver info
    const drvNameEl = document.getElementById('active-driver-name');
    const drvRatingEl = document.getElementById('active-driver-rating');
    const drvVehEl = document.getElementById('active-driver-vehicle');
    const drvAvatarEl = document.getElementById('active-driver-avatar');

    if (drvNameEl) drvNameEl.innerText = ride.driverName || 'MOTORISTA CONFIRMADO';
    if (drvRatingEl) {
      const dRat = (ride.driverRating && Number(ride.driverRating) > 0) ? Number(ride.driverRating).toFixed(1) : 'Novo';
      const dCnt = (ride.driverRatingCount && Number(ride.driverRatingCount) > 0) ? ` (${ride.driverRatingCount})` : '';
      drvRatingEl.innerHTML = `<img src="assets/icons/star.svg" alt="" class="svg-icon-img sm" style="filter: brightness(0) saturate(100%); margin-right: 3px;"> ${dRat}${dCnt}`;
    }

    const v = ride.vehicle;
    if (drvVehEl) {
      if (v && v.model) {
        drvVehEl.innerText = `VEÍCULO: ${v.model} • ${v.plate || ''}`;
      } else {
        drvVehEl.innerText = ride.vehicleType === 'moto' ? 'VEÍCULO: MOTO TÁXI' : 'VEÍCULO: CARRO';
      }
    }

    if (drvAvatarEl && ride.driverName) {
      const dAvatar = ride.driverAvatar || null;
      setAvatarElement(drvAvatarEl, dAvatar, ride.driverName);
    }

    const origEl = document.getElementById('active-route-origin');
    const destEl = document.getElementById('active-route-dest');
    const priceEl = document.getElementById('active-route-price');
    const payEl = document.getElementById('active-route-payment');

    if (origEl) origEl.innerText = ride.origin;
    if (destEl) destEl.innerText = ride.destination;
    if (priceEl) priceEl.innerText = `R$ ${Number(ride.price).toFixed(2).replace('.', ',')}`;
    if (payEl) payEl.innerText = `Forma de pagamento: ${ride.paymentMethod || 'Dinheiro'}`;

    goToScreen('screen-passenger-active-ride');

    if (window.MaxMap) {
      window.MaxMap.setRoute(ride.origin, ride.destination);
      window.MaxMap.startTracking();

      // Load real road curve geometry from OSRM for smooth vehicle tracking
      const curCity = ride.city || state.currentCity || 'ituiutaba';
      fetch(`/api/route?city=${encodeURIComponent(curCity)}&orig=${encodeURIComponent(ride.origin || '')}&dest=${encodeURIComponent(ride.destination || '')}`)
        .then(r => r.json())
        .then(d => {
          if (d && d.success && Array.isArray(d.coordinates) && d.coordinates.length >= 2 && window.MaxMap) {
            window.MaxMap.setGeoJsonRoute(d.coordinates, ride.origin, ride.destination);
            window.MaxMap.startTracking();
          }
        })
        .catch(() => {});
    }
  }

  async function cancelWaitingRide() {
    playSound('cancel');
    const confirmed = await showDialog({
      title: 'Cancelar Solicitação',
      message: 'Deseja realmente cancelar esta solicitação de corrida?',
      type: 'confirm',
      confirmText: 'SIM, CANCELAR',
      cancelText: 'NÃO, VOLTAR'
    });
    if (!confirmed) {
      return;
    }

    stopWaitingPoll();
    stopWaitingCountdown();
    const rideId = state.waitingRideId;
    if (rideId) {
      try {
        await fetch(`/api/rides/${rideId}/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'cancelled' })
        });
      } catch (e) {
        console.error(e);
      }
    }

    state.waitingRideId = null;
    state.activeRide = null;
    showToast('Solicitação de corrida cancelada.');
    clearRouteInputs();
    goToScreen('screen-passenger-home');
  }

  async function simulateDriverAccept() {
    playSound('click');
    const rideId = state.waitingRideId;
    if (!rideId) {
      showToast('Nenhuma corrida aguardando aceite');
      return;
    }

    showToast('Simulando motorista aceitando a chamada...');
    try {
      const isMoto = state.activeRide && state.activeRide.vehicleType === 'moto';
      const simDriver = isMoto ? {
        driverId: 'drv-sim-moto',
        driverName: 'RODRIGO ALVES',
        driverRating: 4.95,
        vehicle: {
          type: 'moto',
          model: 'HONDA CG 160 FAN AZUL',
          plate: 'MTO-8899'
        }
      } : {
        driverId: 'drv-sim-car',
        driverName: 'LUCAS OLIVEIRA',
        driverRating: 4.98,
        vehicle: {
          type: 'car',
          model: 'CHEVROLET ONIX BRANCO',
          plate: 'MAX-2025'
        }
      };

      const res = await fetch(`/api/rides/${rideId}/accept`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(simDriver)
      });
      const data = await res.json();
      if (res.ok && data.ride) {
        stopWaitingPoll();
        onDriverAcceptedRide(data.ride);
      }
    } catch (err) {
      showToast('Erro ao simular aceite de motorista');
    }
  }

  // Request Ride (Passenger)
  async function requestRide(type) {
    playSound('click');
    if (!checkCityBeforeInput()) return;
    const origInput = document.getElementById('pass-origin');
    const origBairroInput = document.getElementById('pass-origin-bairro');
    const destInput = document.getElementById('pass-dest');
    const destBairroInput = document.getElementById('pass-dest-bairro');

    const origStreet = origInput ? origInput.value.trim() : '';
    const origBairro = origBairroInput ? origBairroInput.value.trim() : '';
    const destStreet = destInput ? destInput.value.trim() : '';
    const destBairro = destBairroInput ? destBairroInput.value.trim() : '';

    if (!origStreet || !destStreet) {
      playSound('cancel');
      showToast('Por favor, informe o local de partida e de chegada.');
      return;
    }

    const origin = origStreet + (origBairro ? ` - ${origBairro}` : '');
    const destination = destStreet + (destBairro ? ` - ${destBairro}` : '');
    const reference = document.getElementById('pass-ref') ? document.getElementById('pass-ref').value.trim() : '';

    const priceEl = document.getElementById(type === 'moto' ? 'card-moto-price' : 'card-car-price');
    const kmEl = document.getElementById(type === 'moto' ? 'card-moto-distance' : 'card-car-distance');
    const timeEl = document.getElementById(type === 'moto' ? 'card-moto-time' : 'card-car-time');

    const priceNum = priceEl ? parseFloat(priceEl.innerText.replace('R$', '').replace(',', '.').trim()) : (type === 'moto' ? 8.00 : 10.00);
    const price = isNaN(priceNum) ? (type === 'moto' ? 8.00 : 10.00) : priceNum;
    const distance = kmEl && kmEl.innerText !== '--' ? kmEl.innerText : '4 KM';
    const duration = timeEl && timeEl.innerText !== '--' ? timeEl.innerText : (type === 'moto' ? '7 MIN' : '10 MIN');

    try {
      const u = state.currentUser || JSON.parse(typeof localStorage !== 'undefined' ? (localStorage.getItem('maxdrive_logged_user') || '{}') : '{}');
      const pAvatar = (u && u.avatar) || null;
      const pId = (u && u.id) ? u.id : (typeof localStorage !== 'undefined' ? (localStorage.getItem('maxdrive_logged_user_id') || 'usr-pass-1') : 'usr-pass-1');
      const pName = (u && u.name) ? u.name : 'PASSAGEIRO MAX DRIVE';
      const pEmail = (u && u.email) ? u.email : null;
      const pPhone = (u && u.phone) ? u.phone : null;

      const res = await fetch('/api/rides', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': pId
        },
        body: JSON.stringify({
          passengerId: pId,
          passengerName: pName,
          passengerEmail: pEmail,
          passengerPhone: pPhone,
          passengerAvatar: pAvatar,
          origin,
          destination,
          originCoords: state.originCoords,
          destinationCoords: state.destCoords,
          reference,
          city: state.currentCity,
          vehicleType: type,
          distance,
          duration,
          price,
          paymentMethod: state.paymentMethod || 'Dinheiro'
        })
      });

      const data = await res.json();
      if (res.ok && data.ride) {
        state.waitingRideId = data.ride.id;
        state.activeRide = data.ride;

        try {
          if (typeof localStorage !== 'undefined') {
            const existingIds = JSON.parse(localStorage.getItem('maxdrive_device_ride_ids') || '[]');
            if (!existingIds.includes(data.ride.id)) {
              existingIds.push(data.ride.id);
              localStorage.setItem('maxdrive_device_ride_ids', JSON.stringify(existingIds.slice(-30)));
            }
          }
        } catch (_) {}
        playSound('click');
        showToast('Chamada enviada! Aguardando motorista aceitar...');

        // Populate Waiting Screen Card (Includes passenger avatar and ride details)
        populatePassengerWaitingCard(data.ride);

        // Start 15-minute countdown and ride status polling
        startWaitingCountdown(data.ride.createdAt);
        startWaitingPoll(data.ride.id);

        // Save active ride state for F5 reload
        saveActiveRideState();

        // Go to Waiting Screen (NO default driver!)
        goToScreen('screen-passenger-waiting');
      }
    } catch (err) {
      showToast('Erro ao solicitar corrida');
    }
  }

  // State persistence helpers
  function saveUserSession(user, sessionToken) {
    if (typeof localStorage === 'undefined') return;
    try {
      const activeToken = sessionToken || (user && user.sessionToken) || state.sessionToken;
      if (activeToken) {
        state.sessionToken = activeToken;
        localStorage.setItem('maxdrive_session_token', activeToken);
      }
      if (user) {
        // Strip heavy base64 images to prevent QuotaExceededError in localStorage (5MB limit)
        const sessionUser = { ...user };
        if (sessionUser.vehicle) {
          sessionUser.vehicle = { ...sessionUser.vehicle };
          if (sessionUser.vehicle.photos) {
            sessionUser.vehicle.photos = {}; // Images are loaded from server, not localStorage
          }
        }
        if (sessionUser.cnh && String(sessionUser.cnh).startsWith('data:')) {
          delete sessionUser.cnh;
        }
        if (sessionUser.doc && String(sessionUser.doc).startsWith('data:')) {
          delete sessionUser.doc;
        }
        if (sessionUser.avatar && String(sessionUser.avatar).startsWith('data:')) {
          delete sessionUser.avatar;
        }

        localStorage.setItem('maxdrive_logged_user', JSON.stringify(sessionUser));
      }
      if (state.userRole) {
        localStorage.setItem('maxdrive_role', state.userRole);
      } else if (user && user.role) {
        localStorage.setItem('maxdrive_role', user.role);
      }
      if (state.currentCity) {
        localStorage.setItem('maxdrive_city', state.currentCity);
      }
    } catch (e) {
      console.warn('Could not save to localStorage (storage quota):', e);
      try {
        if (user) {
          const minimal = { id: user.id, name: user.name, email: user.email, role: user.role, isAdmin: user.isAdmin };
          localStorage.setItem('maxdrive_logged_user', JSON.stringify(minimal));
        }
      } catch (_) {}
    }
  }

  // Single Session Verification & Termination Handler
  let sessionTerminatedHandled = false;
  function handleSessionTerminated(message) {
    if (sessionTerminatedHandled) return;
    sessionTerminatedHandled = true;

    playSound('cancel');
    stopWaitingPoll();
    clearActiveRideState();
    state.currentUser = null;
    state.sessionToken = null;
    clearUserSession();

    showDialog({
      title: 'SESSÃO FINALIZADA',
      message: message || 'Sua conta foi conectada em outro dispositivo ou local.\n\nEsta sessão anterior foi finalizada automaticamente por segurança.',
      type: 'alert',
      confirmText: 'FAZER LOGIN',
      onConfirm: () => {
        sessionTerminatedHandled = false;
        goToScreen('screen-login');
      }
    });

    goToScreen('screen-login');
    setTimeout(() => {
      sessionTerminatedHandled = false;
    }, 3000);
  }

  function updateAdminBadgeVisibility() {
    const isAdmin = !!(state.currentUser && (state.currentUser.isAdmin || state.currentUser.role === 'admin'));
    const adminRow = document.getElementById('admin-access-row');
    if (adminRow) adminRow.style.display = isAdmin ? 'block' : 'none';

    document.querySelectorAll('.header-admin-badge').forEach(el => {
      el.style.display = isAdmin ? 'inline-flex' : 'none';
    });
  }

  let isVerifyingSession = false;
  async function verifyActiveSession() {
    if (!state.currentUser || !state.currentUser.id || !state.sessionToken) return;
    if (isVerifyingSession) return;
    isVerifyingSession = true;
    try {
      const res = await fetch(`/api/auth/validate-session?userId=${encodeURIComponent(state.currentUser.id)}&sessionToken=${encodeURIComponent(state.sessionToken)}`, {
        headers: {
          'x-user-id': state.currentUser.id,
          'x-session-token': state.sessionToken
        }
      });
      const data = await res.json();
      if (data && data.sessionTerminated) {
        handleSessionTerminated(data.message);
        return;
      }
      if (data && data.valid) {
        const isAdmin = !!data.isAdmin;
        const currentIsAdmin = !!state.currentUser.isAdmin;
        if (isAdmin !== currentIsAdmin) {
          state.currentUser.isAdmin = isAdmin;
          if (data.role) state.currentUser.role = data.role;
          saveUserSession(state.currentUser);
          updateAdminBadgeVisibility();
          if (isAdmin && !currentIsAdmin) {
            showToast('Privilégios de Administrador ativados!', 'success');
          }
        }
      }
    } catch (err) {
      // Falha pontual de rede não encerra a sessão
    } finally {
      isVerifyingSession = false;
    }
  }

  function restoreUserSession() {
    if (typeof localStorage === 'undefined') return false;
    const savedUserJson = localStorage.getItem('maxdrive_logged_user');
    const savedRole = localStorage.getItem('maxdrive_role');
    const savedCity = localStorage.getItem('maxdrive_city');
    const savedToken = localStorage.getItem('maxdrive_session_token');

    if (savedToken) {
      state.sessionToken = savedToken;
    }

    let restored = false;
    if (savedUserJson) {
      try {
        const user = JSON.parse(savedUserJson);
        if (user && user.name) {
          state.currentUser = user;
          populateUserData(user);
          updateAdminBadgeVisibility();
          restored = true;

          // Validação imediata de sessão ativa
          if (state.sessionToken) {
            verifyActiveSession();
          }

          // Rehydrate complete user data and vehicle photos from server
          if (user.id) {
            fetch(`/api/users/${user.id}`)
              .then(res => res.json())
              .then(data => {
                if (data && data.user) {
                  const currentActiveRole = state.userRole;
                  state.currentUser = { ...state.currentUser, ...data.user };
                  if (currentActiveRole) {
                    state.userRole = currentActiveRole;
                    localStorage.setItem('maxdrive_role', currentActiveRole);
                  }
                  populateUserData(state.currentUser);
                }
              })
              .catch(err => console.warn('Could not rehydrate user profile:', err));
          }
        }
      } catch (e) {
        console.warn('Erro ao restaurar usuario:', e);
      }
    }

    if (savedRole) {
      state.userRole = savedRole;
      const btnSwitch = document.getElementById('btn-switch-role');
      if (btnSwitch) {
        btnSwitch.innerText = savedRole === 'driver' ? 'MUDAR PARA MODO PASSAGEIRO' : 'MUDAR PARA MODO MOTORISTA';
      }
    }

    if (savedCity) {
      selectCity(savedCity);
    }

    return restored;
  }

  function clearUserSession() {
    state.currentUser = null;
    state.sessionToken = null;
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('maxdrive_logged_user');
      localStorage.removeItem('maxdrive_role');
      localStorage.removeItem('maxdrive_session_token');
    }
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('maxdrive_logged_user');
      sessionStorage.removeItem('maxdrive_role');
      sessionStorage.removeItem('maxdrive_session_token');
    }
  }

  function saveActiveRideState() {
    if (typeof localStorage === 'undefined') return;
    if (state.activeRide && state.activeRide.id) {
      localStorage.setItem('maxdrive_active_ride_id', state.activeRide.id);
    } else {
      localStorage.removeItem('maxdrive_active_ride_id');
    }
    if (state.userRole) {
      localStorage.setItem('maxdrive_role', state.userRole);
    }
    if (state.currentCity) {
      localStorage.setItem('maxdrive_city', state.currentCity);
    }
  }

  function clearActiveRideState() {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem('maxdrive_active_ride_id');
  }

  function populatePassengerActiveCard(ride) {
    if (!ride) return;
    const dName = ride.driverName || 'MARCOS MARQUES';
    const avEl = document.getElementById('active-driver-avatar');
    const nameEl = document.getElementById('active-driver-name');
    const ratingEl = document.getElementById('active-driver-rating');
    const vehEl = document.getElementById('active-driver-vehicle');
    const origEl = document.getElementById('active-route-origin');
    const destEl = document.getElementById('active-route-dest');
    const priceEl = document.getElementById('active-route-price');
    const payEl = document.getElementById('active-route-payment');

    const dAvatar = ride.driverAvatar || null;
    setAvatarElement(avEl, dAvatar, dName);

    if (nameEl) nameEl.innerText = dName;
    if (ratingEl) {
      const dRat = (ride.driverRating && Number(ride.driverRating) > 0) ? Number(ride.driverRating).toFixed(1) : 'Novo';
      ratingEl.innerHTML = `<img src="assets/icons/star.svg" alt="" class="svg-icon-img sm" style="filter: brightness(0) saturate(100%); margin-right: 3px;"> ${dRat}`;
    }
    if (vehEl) {
      const v = ride.vehicle;
      if (v) {
        vehEl.innerText = `VEÍCULO: ${v.model || 'ONIX PRETO'} • ${v.plate || 'ABC-1234'}`;
      } else {
        vehEl.innerText = `VEÍCULO: ONIX PRETO • ABC-1234`;
      }
    }
    if (origEl) origEl.innerText = ride.origin || '';
    if (destEl) destEl.innerText = ride.destination || '';
    if (priceEl) priceEl.innerText = `R$ ${Number(ride.price || 10).toFixed(2).replace('.', ',')}`;
    if (payEl) payEl.innerText = `Forma de pagamento: ${ride.paymentMethod || 'Pix'}`;

    if (ride && ride.origin && ride.destination) {
      setTimeout(() => {
        if (window.MaxMap) {
          window.MaxMap.init('active-ride-map-box');
          window.MaxMap.setCity(ride.city || state.currentCity || 'ituiutaba');
          if (typeof window.MaxMap.setRouteWithCoords === 'function') {
            window.MaxMap.setRouteWithCoords(ride.origin, ride.originCoords, ride.destination, ride.destinationCoords);
          } else {
            window.MaxMap.setRoute(ride.origin, ride.destination);
          }
          window.MaxMap.startTracking();
        }
      }, 150);
    }
  }

  function populatePassengerWaitingCard(ride) {
    if (!ride) return;
    if (ride.createdAt) {
      startWaitingCountdown(ride.createdAt);
    }
    const type = ride.vehicleType || 'car';
    const waitVehTag = document.getElementById('waiting-vehicle-type-tag');
    const waitVehImg = document.getElementById('waiting-center-vehicle-img');
    const waitOrig = document.getElementById('waiting-route-origin');
    const waitDest = document.getElementById('waiting-route-dest');
    const waitPrice = document.getElementById('waiting-route-price');
    const waitDistTime = document.getElementById('waiting-route-dist-time');
    const waitPayment = document.getElementById('waiting-route-payment');
    const waitCity = document.getElementById('waiting-city-badge-name');
    const waitAvatar = document.getElementById('waiting-passenger-avatar');
    const waitName = document.getElementById('waiting-passenger-name');
    const waitRating = document.getElementById('waiting-passenger-rating');

    const pName = ride.passengerName || (state.currentUser ? state.currentUser.name : 'JULIANO MARTINS');
    const pAvatar = ride.passengerAvatar || (state.currentUser && state.currentUser.avatar) || null;

    if (waitName) waitName.innerText = pName;
    if (waitRating) {
      const pRat = (ride.passengerRating && Number(ride.passengerRating) > 0) ? Number(ride.passengerRating).toFixed(1) : 'Novo';
      waitRating.innerHTML = `<img src="assets/icons/star.svg" alt="" class="svg-icon-img sm" style="filter: brightness(0) saturate(100%); margin-right: 3px;"> ${pRat}`;
    }
    setAvatarElement(waitAvatar, pAvatar, pName);

    if (waitVehTag) waitVehTag.innerHTML = type === 'moto' ? '<img src="assets/icons/moto.svg" class="svg-icon-img sm" style="vertical-align: -2px; margin-right: 3px;"> MOTO TÁXI' : '<img src="assets/icons/car.svg" class="svg-icon-img sm" style="vertical-align: -2px; margin-right: 3px;"> CARRO COMUM';
    if (waitVehImg) waitVehImg.src = type === 'moto' ? 'assets/icons/mototaxi.svg' : 'assets/icons/car-front.svg';
    if (waitOrig) waitOrig.innerText = ride.origin || '';
    if (waitDest) waitDest.innerText = ride.destination || '';
    if (waitPrice) waitPrice.innerText = `R$ ${Number(ride.price || 10).toFixed(2).replace('.', ',')}`;
    if (waitDistTime) waitDistTime.innerText = `${ride.distance || '4 KM'} • ~${ride.duration || '10 MIN'}`;
    if (waitPayment) waitPayment.innerText = `Forma de pagamento: ${ride.paymentMethod || 'Dinheiro'}`;
    if (waitCity) waitCity.innerText = ride.city ? (ride.city.charAt(0).toUpperCase() + ride.city.slice(1)) : 'Ituiutaba';

    if (ride && ride.origin && ride.destination) {
      setTimeout(() => {
        if (window.MaxMap) {
          window.MaxMap.init('waiting-ride-map-box');
          window.MaxMap.setCity(ride.city || state.currentCity || 'ituiutaba');
          if (typeof window.MaxMap.setRouteWithCoords === 'function') {
            window.MaxMap.setRouteWithCoords(ride.origin, ride.originCoords, ride.destination, ride.destinationCoords);
          } else {
            window.MaxMap.setRoute(ride.origin, ride.destination);
          }
        }
      }, 150);
    }
  }

  // Driver accepts ride from radar
  async function driverAcceptRide(rideId) {
    playSound('click');

    const u = state.currentUser;
    const isApprovedDriver = u ? (u.isAdmin || u.role === 'admin' || u.driverApproved === true || (u.approved === true && u.role === 'driver')) : true;
    if (!isApprovedDriver) {
      playSound('cancel');
      showToast('Sua conta de motorista está pendente de aprovação pela administração. Complete seu cadastro no Perfil.', 'warning');
      goToScreen('screen-profile');
      return;
    }

    // Prevent driver or motoboy from accepting more than 1 ride at a time
    if (state.activeRide && ['accepted', 'arrived', 'in_progress'].includes(state.activeRide.status)) {
      playSound('cancel');
      showToast('Você já possui uma corrida em andamento! Finalize-a primeiro.');
      goToScreen('screen-driver-active-ride');
      return;
    }

    try {
      const user = state.currentUser || {};
      const vehicle = user.vehicle || {
        type: 'car',
        model: 'CHEVROLET ONIX PRETO',
        plate: 'ABC-1234'
      };

      const res = await fetch(`/api/rides/${rideId}/accept`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverId: user.id || 'usr-drv-1',
          driverName: user.name || 'MARCOS MARQUES',
          driverAvatar: (user && user.avatar) || null,
          driverRating: 4.95,
          vehicle
        })
      });

      const data = await res.json();
      if (res.ok && data.ride) {
        state.activeRide = data.ride;
        state.driverHasArrived = false;
        saveActiveRideState();
        populateDriverActiveCard(data.ride);
        playSound('aCaminho');
        showToast('Corrida aceita! Deslocando-se ao passageiro.');
        goToScreen('screen-driver-active-ride');
      } else {
        playSound('cancel');
        showToast(data.message || 'Esta corrida já foi aceita por outro motorista');
        refreshDriverRadar();
      }
    } catch (err) {
      showToast('Erro ao conectar com o servidor');
      refreshDriverRadar();
    }
  }

  async function refreshDriverRadar() {
    const listEl = document.getElementById('driver-radar-cards-list');
    if (!listEl) return;

    const radarText = document.querySelector('.radar-searching-text');

    // Check if user is approved as driver
    const u = state.currentUser;
    const isApprovedDriver = u ? (u.isAdmin || u.role === 'admin' || u.driverApproved === true || (u.approved === true && u.role === 'driver')) : true;

    if (!isApprovedDriver) {
      if (radarText) radarText.innerText = 'CADASTRO DE MOTORISTA PENDENTE DE APROVAÇÃO';
      listEl.innerHTML = `
        <div class="white-card" style="border: 2px solid #FFC107; text-align: center; padding: 24px 16px; background: rgba(255, 193, 7, 0.05);">
          <div style="margin-bottom: 12px;"><img src="assets/icons/shield.svg" alt="" class="svg-icon-img xxl" style="filter: invert(72%) sepia(85%) saturate(700%) hue-rotate(0deg) brightness(105%);"></div>
          <h3 style="color: #D97706; font-size: 15px; font-weight: 900; margin-bottom: 8px; letter-spacing: 0.5px;">
            CADASTRO DE MOTORISTA PENDENTE DE APROVAÇÃO
          </h3>
          <p style="color: #475569; font-size: 12px; margin-bottom: 16px; line-height: 1.5;">
            Sua conta de motorista ainda não foi liberada pela administração para aceitar corridas.<br>
            Para liberar seu perfil, preencha os dados do veículo e envie as fotos/documentos para análise.
          </p>
          <button type="button" class="btn-pill btn-yellow" style="font-size: 12px; font-weight: 800; height: 42px;" onclick="App.goToScreen('screen-profile')">
            COMPLETAR CADASTRO NO PERFIL
          </button>
        </div>
      `;
      return;
    }

    // If driver already has an active ride in progress, show active ride notice and block radar
    if (state.activeRide && ['accepted', 'arrived', 'in_progress'].includes(state.activeRide.status)) {
      if (radarText) {
        radarText.innerText = 'CORRIDA EM ANDAMENTO - RADAR EM PAUSA';
      }
      const pName = state.activeRide.passengerName || 'Passageiro';
      listEl.innerHTML = `
        <div class="white-card" style="border: 2px solid #00F0FF; text-align: center; padding: 20px 16px; background: rgba(2,8,53,0.03);">
          <div style="margin-bottom: 8px;"><img src="assets/icons/car.svg" alt="" class="svg-icon-img xxl"></div>
          <h3 style="color: #020835; font-size: 15px; font-weight: 900; margin-bottom: 6px; letter-spacing: 0.5px;">
            VOCÊ JÁ TEM UMA CORRIDA EM ANDAMENTO
          </h3>
          <p style="color: #555; font-size: 13px; margin-bottom: 14px; line-height: 1.4;">
            Você está atendendo <strong>${pName}</strong>.<br>
            Finalize esta corrida para poder receber e aceitar novas chamadas no radar.
          </p>
          <button type="button" class="btn-pill btn-cyan" style="font-size: 13px; font-weight: 800; height: 44px;" onclick="App.goToScreen('screen-driver-active-ride')">
            IR PARA A CORRIDA EM ANDAMENTO
          </button>
        </div>
      `;
      return;
    }

    if (radarText) {
      radarText.innerText = 'BUSCANDO PASSAGEIROS PRÓXIMOS...';
    }

    try {
      const u = state.currentUser;
      const vType = (u && u.vehicle && u.vehicle.type) ? u.vehicle.type : 'car';
      const uId = u ? u.id : '';
      const res = await fetch(`/api/rides?status=radar&city=${state.currentCity || 'ituiutaba'}&vehicleType=${vType}&driverId=${encodeURIComponent(uId)}`, {
        headers: {
          'x-user-id': uId,
          'x-session-token': state.sessionToken || ''
        }
      });
      const data = await res.json();
      if (res.ok && data.rides && data.rides.length > 0) {
        listEl.innerHTML = data.rides.map(r => {
          const isMoto = r.vehicleType === 'moto';
          const pName = r.passengerName || 'PASSAGEIRO';
          const pAvatar = r.passengerAvatar || null;
          const avatarHtml = renderAvatarCircle(pAvatar, pName);
          const priceStr = Number(r.price).toFixed(2).replace('.', ',');
          const pRating = r.passengerRating ? Number(r.passengerRating).toFixed(1) : 'Novo';
          const distanceStr = r.distance || (r.distanceKm ? `${r.distanceKm} km` : '-- km');
          const durationStr = r.duration || (r.durationMin ? `${r.durationMin} min` : '-- min');

          return `
            <div class="white-card">
              <div class="ride-driver-header">
                <div class="avatar-circle">${avatarHtml}</div>
                <div class="driver-info-meta">
                  <h4>${pName}</h4>
                  <div class="rating-tag"><img src="assets/icons/star.svg" alt="" class="svg-icon-img sm" style="filter: brightness(0) saturate(100%); margin-right: 3px;"> ${pRating}</div>
                </div>
                <div style="margin-left: auto;">
                  <span style="font-size: 11px; font-weight: 800; background: #020835; color: #00F0FF; padding: 4px 8px; border-radius: 12px; display: inline-flex; align-items: center; gap: 4px;">
                    ${isMoto ? '<img src="assets/icons/moto.svg" class="svg-icon-img sm" style="vertical-align: -2px; margin-right: 3px;"> MOTO' : '<img src="assets/icons/car.svg" class="svg-icon-img sm" style="vertical-align: -2px; margin-right: 3px;"> CARRO'}
                  </span>
                </div>
              </div>

              <div class="route-steps-box">
                <div class="route-step-row">
                  <span class="route-dot cyan"></span>
                  <span>${r.origin}</span>
                </div>
                <div class="route-step-row">
                  <span class="route-dot yellow"></span>
                  <span>${r.destination}</span>
                </div>
              </div>

              <!-- Distância em KM e Tempo Estimado -->
              <div style="display: flex; gap: 10px; margin: 10px 0; background: rgba(0, 229, 255, 0.05); padding: 8px 12px; border-radius: 10px; border: 1px solid rgba(0, 229, 255, 0.2); align-items: center; justify-content: space-between;">
                <div style="display: flex; align-items: center; gap: 6px;">
                  <img src="assets/icons/route.svg" class="svg-icon-img sm" alt="">
                  <span style="font-size: 11px; color: #94A3B8; font-weight: 700;">PERCURSO (KM):</span>
                  <strong style="font-size: 13px; color: #00E5FF; font-weight: 900;">${distanceStr}</strong>
                </div>
                <div style="display: flex; align-items: center; gap: 6px;">
                  <img src="assets/icons/clock.svg" class="svg-icon-img sm" alt="">
                  <span style="font-size: 11px; color: #94A3B8; font-weight: 700;">TEMPO ESTIMADO:</span>
                  <strong style="font-size: 13px; color: #FEE500; font-weight: 900;">${durationStr}</strong>
                </div>
              </div>

              <!-- Mapa e Trajeto no Card do Radar -->
              <div class="map-box" id="radar-map-${r.id}" style="height: 180px; width: 100%; border-radius: 12px; border: 1.5px solid rgba(0, 229, 255, 0.35); margin: 10px 0; overflow: hidden; position: relative;"></div>

              <div class="price-display-row">
                <div>
                  <div class="price-display-label">PREÇO:</div>
                  <div class="price-display-big">R$ ${priceStr}</div>
                </div>
                <div class="payment-method-badge">Forma de pagamento: ${r.paymentMethod || 'Pix'}</div>
              </div>
              <button type="button" class="btn-pill btn-green" onclick="App.driverAcceptRide('${r.id}')">
                ACEITAR CORRIDA
              </button>
            </div>
          `;
        }).join('');

        // Inicializar mapas interativos nos cards do radar do motorista
        data.rides.forEach(r => {
          setTimeout(() => {
            try {
              if (window.MaxMap) {
                const radarMapId = `radar-map-${r.id}`;
                const mapEl = document.getElementById(radarMapId);
                if (mapEl) {
                  window.MaxMap.init(radarMapId);
                  window.MaxMap.setCity(r.city || state.currentCity || 'ituiutaba');
                  if (typeof window.MaxMap.setRouteWithCoords === 'function') {
                    window.MaxMap.setRouteWithCoords(r.origin, r.originCoords, r.destination, r.destinationCoords);
                  } else {
                    window.MaxMap.setRoute(r.origin, r.destination);
                  }
                }
              }
            } catch (mapErr) {
              console.warn('Erro ao inicializar mapa do card do radar:', mapErr);
            }
          }, 150);
        });
      } else {
        listEl.innerHTML = `
          <div class="driver-radar-empty-box">
            <div class="driver-radar-empty-icon"><img src="assets/icons/radar.svg" alt="" class="svg-icon-img xxl"></div>
            <div class="driver-radar-empty-title">NENHUMA CORRIDA NO RADAR</div>
            <div class="driver-radar-empty-desc">Aguardando novos passageiros solicitarem corridas nesta cidade.<br>O radar está varrendo a área em tempo real.</div>
          </div>
        `;
      }
    } catch (err) {
      console.error('Erro ao atualizar radar do motorista:', err);
    }
  }

  function populateDriverActiveCard(ride) {
    state.driverHasArrived = false;

    const avEl = document.getElementById('driver-active-avatar');
    const nameEl = document.getElementById('driver-active-name');
    const origEl = document.getElementById('driver-active-origin');
    const destEl = document.getElementById('driver-active-dest');
    const priceEl = document.getElementById('driver-active-price');
    const payEl = document.getElementById('driver-active-payment');
    const arrivedBtn = document.getElementById('btn-driver-arrived');
    const wazeBtn = document.getElementById('btn-driver-waze');

    const pName = (ride && ride.passengerName) ? ride.passengerName : 'JULIANO MARTINS';
    const pAvatar = (ride && ride.passengerAvatar) || null;
    if (nameEl) nameEl.innerText = pName;
    setAvatarElement(avEl, pAvatar, pName);
    if (origEl) origEl.innerText = (ride && ride.origin) ? ride.origin : 'Rua 22, nº 450, Centro - Ituiutaba';
    if (destEl) destEl.innerText = (ride && ride.destination) ? ride.destination : 'Av. 17, nº 1800, Platina - Ituiutaba';
    if (priceEl) priceEl.innerText = `R$ ${Number((ride && ride.price) || 10).toFixed(2).replace('.', ',')}`;
    if (payEl) payEl.innerText = `Forma de pagamento: ${(ride && ride.paymentMethod) || 'Pix'}`;

    if (arrivedBtn) {
      arrivedBtn.innerText = 'CHEGUEI';
      arrivedBtn.style.background = '';
      arrivedBtn.style.color = '';
    }

    if (wazeBtn) {
      wazeBtn.innerHTML = `
        <svg style="width: 15px; height: 15px; flex-shrink: 0;" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
        </svg>
        IR COM WAZE
      `;
      wazeBtn.classList.remove('btn-green');
      wazeBtn.classList.add('btn-cyan');
    }

    if (ride && ride.origin && ride.destination) {
      setTimeout(() => {
        if (window.MaxMap) {
          window.MaxMap.init('driver-active-map-box');
          window.MaxMap.setCity(ride.city || state.currentCity || 'ituiutaba');
          if (typeof window.MaxMap.setRouteWithCoords === 'function') {
            window.MaxMap.setRouteWithCoords(ride.origin, ride.originCoords, ride.destination, ride.destinationCoords);
          } else {
            window.MaxMap.setRoute(ride.origin, ride.destination);
          }
          window.MaxMap.startTracking();
        }
      }, 150);
    }
  }

  function openWazeNavigation() {
    const isArrived = state.driverHasArrived || (state.activeRide && (state.activeRide.status === 'arrived' || state.activeRide.status === 'in_progress'));
    if (isArrived) {
      playSound('seguranca');
    } else {
      playSound('click');
    }

    if (state.activeRide) {
      targetAddress = isArrived ? state.activeRide.destination : state.activeRide.origin;
    }

    if (!targetAddress) {
      const origEl = document.getElementById('driver-active-origin');
      const destEl = document.getElementById('driver-active-dest');
      targetAddress = isArrived 
        ? (destEl ? destEl.innerText.trim() : '') 
        : (origEl ? origEl.innerText.trim() : '');
    }

    if (!targetAddress) {
      targetAddress = 'Ituiutaba, MG';
    }

    const city = state.currentCity ? (state.currentCity.charAt(0).toUpperCase() + state.currentCity.slice(1).replace('_', ' ')) : 'Ituiutaba';
    if (!targetAddress.toLowerCase().includes(city.toLowerCase())) {
      targetAddress += `, ${city}`;
    }

    const wazeUrl = `https://waze.com/ul?q=${encodeURIComponent(targetAddress)}&navigate=yes`;
    showToast(isArrived ? `Abrindo Waze até o destino: ${targetAddress}` : `Abrindo Waze até o embarque: ${targetAddress}`);
    window.open(wazeUrl, '_blank');
  }

  async function driverArrived() {
    playSound('click');
    state.driverHasArrived = true;

    const btn = document.getElementById('btn-driver-arrived');
    if (btn) {
      btn.innerHTML = 'NO PONTO DE EMBARQUE <img src="assets/icons/check-circle.svg" alt="" class="svg-icon-img sm" style="vertical-align: -2px;">';
      btn.style.background = '#00D04B';
      btn.style.color = '#FFFFFF';
    }

    // Automatically update Waze button to navigate to dropoff destination!
    const wazeBtn = document.getElementById('btn-driver-waze');
    if (wazeBtn) {
      wazeBtn.innerHTML = `
        <svg style="width: 15px; height: 15px; flex-shrink: 0;" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
        </svg>
        IR COM WAZE (DESTINO)
      `;
      wazeBtn.classList.remove('btn-cyan');
      wazeBtn.classList.add('btn-green');
    }

    playSound('success');
    showToast('Passageiro notificado! O botão "IR COM WAZE" agora levará ao destino final.');

    if (state.activeRide && state.activeRide.id) {
      try {
        await fetch(`/api/rides/${state.activeRide.id}/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'arrived' })
        });
        state.activeRide.status = 'arrived';
      } catch (err) {
        console.warn('Erro ao atualizar status de chegada:', err);
      }
    }
  }

  function contactPassengerWhatsApp() {
    playSound('click');
    const ride = state.activeRide;
    if (!ride) {
      showToast('Nenhuma corrida ativa');
      return;
    }
    let phone = ride.passengerPhone || '';
    if (!phone && ride.passengerId) {
      const u = cachedUsersData ? cachedUsersData.find(x => x.id === ride.passengerId) : null;
      if (u && u.phone) phone = u.phone;
    }
    const cleanPhone = (phone || '').replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      showToast('Passageiro não possui WhatsApp cadastrado. Use o chat interno.');
      return;
    }
    const fullPhone = cleanPhone.length <= 11 ? '55' + cleanPhone : cleanPhone;
    const greeting = encodeURIComponent(`Olá ${ride.passengerName || 'Passageiro'}, sou seu motorista MAX DRIVE! Estou a caminho do seu local.`);
    window.open(`https://wa.me/${fullPhone}?text=${greeting}`, '_blank');
  }

  async function driverFinishRide() {
    playSound('click');
    state.driverHasArrived = false;
    const finishedRide = state.activeRide;
    populateDriverActiveCard(null);

    if (finishedRide && finishedRide.id) {
      try {
        await fetch(`/api/rides/${finishedRide.id}/finish`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fare: finishedRide.price || 10.00 })
        });
      } catch (e) {
        console.warn('Erro ao finalizar corrida no servidor:', e);
      }
    }
    clearActiveRideState();
    state.activeRide = null;
    playSound('success');
    showToast('Corrida finalizada com sucesso! Pagamento processado.');
    updateDriverSettingsStats();
    goToScreen('screen-history');
    setTimeout(() => {
      openRatingModal(finishedRide ? finishedRide.id : 'active', finishedRide ? finishedRide.passengerName : 'PASSAGEIRO');
    }, 600);
  }

  async function executeDirectCancel(cancelledBy = 'driver', reason = 'Cancelamento de corrida') {
    const activeRideId = state.activeRide?.id || state.reportingRideId || state.waitingRideId;
    if (activeRideId) {
      try {
        await fetch(`/api/rides/${activeRideId}/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'cancelled',
            cancellationReason: reason,
            cancelledBy: cancelledBy
          })
        });
      } catch (e) {
        console.error('Erro ao cancelar corrida no backend:', e);
      }
    }

    clearActiveRideState();
    state.activeRide = null;
    state.waitingRideId = null;
    state.driverHasArrived = false;
    state.isCancellingActiveRide = false;
    populateDriverActiveCard(null);
    if (window.MaxMap) {
      window.MaxMap.stopTracking();
    }
    clearRouteInputs();
    playSound('cancel');

    const role = state.userRole;
    goToScreen(role === 'driver' ? 'screen-driver-home' : 'screen-passenger-home');
    if (role === 'driver') {
      updateDriverSettingsStats();
      refreshDriverRadar();
    }
  }

  async function cancelRide() {
    playSound('cancel');
    const confirmed = await showDialog({
      title: 'Cancelar Corrida',
      message: 'Deseja realmente cancelar esta corrida em andamento?',
      type: 'confirm',
      confirmText: 'SIM, CANCELAR',
      cancelText: 'NÃO, CONTINUAR'
    });
    if (confirmed) {
      await executeDirectCancel(state.userRole || 'passenger', 'Cancelamento confirmado pelo usuário');
      showToast('Corrida cancelada.');
    }
  }

  function callDriver() {
    playSound('click');
    showToast('Ligando para o motorista: (34) 99876-5432...');
  }

  // Custom City Dropdown Handlers
  function toggleCityDropdown(forceOpen) {
    playSound('click');
    const isDriver = state.userRole === 'driver' || state.currentScreen === 'screen-driver-home';
    const targetId = isDriver ? 'driver-custom-city-dropdown' : 'custom-city-dropdown';
    const activeDropdown = document.getElementById(targetId) || document.getElementById('custom-city-dropdown');

    const allDropdowns = document.querySelectorAll('.custom-city-dropdown');
    if (typeof forceOpen === 'boolean') {
      allDropdowns.forEach(d => d.style.display = forceOpen ? 'block' : 'none');
    } else {
      const isVisible = activeDropdown && activeDropdown.style.display === 'block';
      allDropdowns.forEach(d => d.style.display = 'none');
      if (activeDropdown) activeDropdown.style.display = isVisible ? 'none' : 'block';
    }
  }

  function checkCityBeforeInput(e) {
    if (!state.currentCity) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      playSound('cancel');
      showToast('Por favor, selecione sua cidade no topo primeiro!', 'warning');

      // Open dropdown and pulse button
      toggleCityDropdown(true);

      const cityBtn = document.getElementById('city-pill-button');
      if (cityBtn) {
        cityBtn.classList.remove('city-pill-pulse');
        void cityBtn.offsetWidth; // force browser repaint
        cityBtn.classList.add('city-pill-pulse');
      }
      return false;
    }
    return true;
  }

  function lockRouteInputs() {
    const origInput = document.getElementById('pass-origin');
    const origBairro = document.getElementById('pass-origin-bairro');
    const destInput = document.getElementById('pass-dest');
    const destBairro = document.getElementById('pass-dest-bairro');

    [origInput, origBairro, destInput, destBairro].forEach(inp => {
      if (inp) {
        inp.disabled = true;
        inp.classList.add('input-city-locked');
        inp.value = '';
      }
    });

    if (origInput) origInput.placeholder = 'Selecione sua cidade primeiro';
    if (origBairro) origBairro.placeholder = 'Bairro';
    if (destInput) destInput.placeholder = 'Selecione sua cidade primeiro';
    if (destBairro) destBairro.placeholder = 'Bairro';

    closeAllStreetSuggestions();
    updateEstimatedValues();
  }

  function unlockRouteInputs() {
    const origInput = document.getElementById('pass-origin');
    const origBairro = document.getElementById('pass-origin-bairro');
    const destInput = document.getElementById('pass-dest');
    const destBairro = document.getElementById('pass-dest-bairro');

    [origInput, origBairro, destInput, destBairro].forEach(inp => {
      if (inp) {
        inp.disabled = false;
        inp.classList.remove('input-city-locked');
      }
    });

    if (origInput) origInput.placeholder = 'Endereço de partida';
    if (origBairro) origBairro.placeholder = 'Bairro';
    if (destInput) destInput.placeholder = 'Endereço de chegada';
    if (destBairro) destBairro.placeholder = 'Bairro';
  }

  function selectCity(newCity) {
    playSound('click');
    state.currentCity = newCity;

    const cityNames = {
      araguari: 'Araguari - MG',
      araxa: 'Araxá - MG',
      canapolis: 'Canápolis - MG',
      capinopolis: 'Capinópolis - MG',
      centralina: 'Centralina - MG',
      frutal: 'Frutal - MG',
      ituiutaba: 'Ituiutaba - MG',
      itumbiara: 'Itumbiara - GO',
      iturama: 'Iturama - MG',
      monte_carmelo: 'Monte Carmelo - MG',
      patos_de_minas: 'Patos de Minas - MG',
      patrocinio: 'Patrocínio - MG',
      prata: 'Prata - MG',
      santa_vitoria: 'Santa Vitória - MG',
      tupaciguara: 'Tupaciguara - MG',
      uberaba: 'Uberaba - MG',
      uberlandia: 'Uberlândia - MG'
    };

    const displayName = cityNames[newCity] || newCity.toUpperCase();
    const cityText = document.getElementById('city-current-name');
    if (cityText) cityText.innerText = displayName;
    const drvCityText = document.getElementById('driver-city-current-name');
    if (drvCityText) drvCityText.innerText = displayName;

    // Update active class in dropdown
    const items = document.querySelectorAll('.city-dropdown-item');
    items.forEach(item => {
      const onclickAttr = item.getAttribute('onclick') || '';
      const isCurrent = onclickAttr.includes(`'${newCity}'`);
      item.classList.toggle('active', isCurrent);
      const check = item.querySelector('.city-check');
      if (isCurrent && !check) {
        item.insertAdjacentHTML('beforeend', '<span class="city-check"><img src="assets/icons/check.svg" alt="" class="svg-icon-img sm"></span>');
      } else if (!isCurrent && check) {
        check.remove();
      }
    });

    const allCityDropdowns = document.querySelectorAll('.custom-city-dropdown');
    allCityDropdowns.forEach(d => d.style.display = 'none');

    if (state.userRole === 'driver' && typeof refreshDriverRadar === 'function') {
      refreshDriverRadar();
    }

    if (window.MaxMap) {
      window.MaxMap.setCity(newCity);
    }

    const badge = document.getElementById('badge-active-city');
    if (badge) {
      const sp = badge.querySelector('span');
      if (sp) sp.innerText = displayName;
      else badge.innerText = displayName;
    }

    if (window.MaxRealtime) {
      const vType = (state.currentUser && state.currentUser.vehicle && state.currentUser.vehicle.type) ? state.currentUser.vehicle.type : 'car';
      window.MaxRealtime.updateContext(state.currentUser ? state.currentUser.id : null, state.userRole, newCity, vType);
    }

    // Unlock inputs now that city is chosen
    unlockRouteInputs();

    // Clear inputs and restore exact reference values
    const origInput = document.getElementById('pass-origin');
    const origBairro = document.getElementById('pass-origin-bairro');
    const destInput = document.getElementById('pass-dest');
    const destBairro = document.getElementById('pass-dest-bairro');
    if (origInput) origInput.value = '';
    if (origBairro) origBairro.value = '';
    if (destInput) destInput.value = '';
    if (destBairro) destBairro.value = '';
    updateEstimatedValues();

    closeAllStreetSuggestions();
    showToast(`Cidade selecionada: ${displayName}`);

    // Automatically focus on departure input
    if (origInput && typeof origInput.focus === 'function') {
      setTimeout(() => origInput.focus(), 150);
    }
  }

  // Payment Method Dropdown Handlers
  function togglePaymentDropdown() {
    playSound('click');
    const dropdown = document.getElementById('custom-payment-dropdown');
    if (dropdown) {
      const isVisible = dropdown.style.display === 'block';
      dropdown.style.display = isVisible ? 'none' : 'block';
    }
  }

  function selectPaymentMethod(method) {
    playSound('click');
    state.paymentMethod = method;

    const textEl = document.getElementById('payment-display-text');
    if (textEl) textEl.innerText = method;

    const pill = document.getElementById('payment-pill-trigger');
    if (pill) pill.classList.add('has-value');

    const dropdown = document.getElementById('custom-payment-dropdown');
    if (dropdown) dropdown.style.display = 'none';

    showToast(`Forma de pagamento: ${method}`);
  }

  // Dynamic Estimation Values - Only shown when BOTH departure and arrival are entered
  let cachedCitiesData = [];

  async function loadCitiesData() {
    try {
      const res = await fetch('/api/cities');
      if (res.ok) {
        const data = await res.json();
        cachedCitiesData = data.cities || [];
      }
    } catch (e) {
      console.warn('Erro ao carregar dados de cidades:', e);
    }
  }

  function normalizeTextForRouting(str) {
    if (!str) return '';
    return str.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[,\.\-\/]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function extractHouseNumber(str) {
    if (!str) return null;
    const m = str.match(/(?:n[ºo°]?\s*|,\s*|num\s*|\bno\b\s*|^)(\d+)/i);
    return m ? parseInt(m[1], 10) : null;
  }

  function extractStreetGrid(str) {
    const norm = normalizeTextForRouting(str);
    const ruaMatch = norm.match(/\b(?:rua|r)\s+(\d+)\b/);
    const avMatch = norm.match(/\b(?:avenida|av)\s+(\d+)\b/);
    return {
      rua: ruaMatch ? parseInt(ruaMatch[1], 10) : null,
      av: avMatch ? parseInt(avMatch[1], 10) : null
    };
  }

  function haversineDistKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  const KNOWN_BAIRRO_COORDS = {
    ituiutaba: {
      'centro': { lat: -18.9688, lng: -49.4642 },
      'platina': { lat: -18.9750, lng: -49.4520 },
      'universitario': { lat: -18.9850, lng: -49.4700 },
      'novo tempo': { lat: -18.9550, lng: -49.4800 },
      'rodoviaria': { lat: -18.9710, lng: -49.4600 },
      'alvorada': { lat: -18.9820, lng: -49.4850 },
      'progresso': { lat: -18.9790, lng: -49.4480 },
      'ipiranga': { lat: -18.9620, lng: -49.4550 },
      'natal': { lat: -18.9640, lng: -49.4750 },
      'pirapitinga': { lat: -18.9580, lng: -49.4620 }
    },
    araguari: {
      'centro': { lat: -18.6475, lng: -48.1872 },
      'bosque': { lat: -18.6390, lng: -48.1950 },
      'sibipiruna': { lat: -18.6520, lng: -48.1750 },
      'goias': { lat: -18.6600, lng: -48.1900 }
    },
    santa_vitoria: {
      'centro': { lat: -18.8436, lng: -50.1219 },
      'brasil': { lat: -18.8500, lng: -50.1150 },
      'chacaras': { lat: -18.8350, lng: -50.1300 }
    },
    capinopolis: {
      'centro': { lat: -18.6822, lng: -49.5694 },
      'semiramis': { lat: -18.6750, lng: -49.5750 },
      'sao joao': { lat: -18.6900, lng: -49.5620 }
    }
  };

  function calculateRealisticDistance(origStreet, origBairro, destStreet, destBairro, cityName) {
    const normOrig = normalizeTextForRouting(origStreet);
    const normDest = normalizeTextForRouting(destStreet);
    const normOrigB = normalizeTextForRouting(origBairro);
    const normDestB = normalizeTextForRouting(destBairro);

    const num1 = extractHouseNumber(origStreet);
    const num2 = extractHouseNumber(destStreet);

    // 1. Same street check
    const cleanOrig = normOrig.replace(/\b\d+\b/g, '').trim();
    const cleanDest = normDest.replace(/\b\d+\b/g, '').trim();
    const isSameStreet = cleanOrig && cleanDest && (cleanOrig === cleanDest || cleanOrig.includes(cleanDest) || cleanDest.includes(cleanOrig));

    if (isSameStreet) {
      if (num1 !== null && num2 !== null) {
        const diff = Math.abs(num1 - num2);
        // ~120m per 100 house numbers + 0.3km minimum
        const km = Math.max(0.6, (diff * 0.0012) + 0.3);
        return Math.min(km, 4.0);
      }
      return 0.8;
    }

    // 2. Grid numbered streets (e.g. Rua 20 to Rua 24 or Av 17 to Av 21)
    const gridOrig = extractStreetGrid(origStreet);
    const gridDest = extractStreetGrid(destStreet);

    if ((gridOrig.rua && gridDest.rua) || (gridOrig.av && gridDest.av)) {
      let diffBlocks = 0;
      if (gridOrig.rua && gridDest.rua) diffBlocks += Math.abs(gridOrig.rua - gridDest.rua) / 2;
      if (gridOrig.av && gridDest.av) diffBlocks += Math.abs(gridOrig.av - gridDest.av) / 2;
      if (diffBlocks > 0) {
        const km = Math.max(0.7, (diffBlocks * 0.12) + 0.4);
        return Math.min(km, 5.0);
      }
    }

    // 3. Known Bairros & Landmarks Coordinates
    const cityKey = (cityName || state.currentCity || 'ituiutaba').toLowerCase().replace(/\s+/g, '_');
    const cityCoords = KNOWN_BAIRRO_COORDS[cityKey] || KNOWN_BAIRRO_COORDS.ituiutaba;

    let origCoord = null;
    let destCoord = null;

    if (cityCoords) {
      for (const [bName, coord] of Object.entries(cityCoords)) {
        if ((normOrigB && normOrigB.includes(bName)) || normOrig.includes(bName)) origCoord = coord;
        if ((normDestB && normDestB.includes(bName)) || normDest.includes(bName)) destCoord = coord;
      }
    }

    // Also check dynamic cachedCitiesData locations
    const cityData = (Array.isArray(cachedCitiesData) ? cachedCitiesData : []).find(c => 
      (c.id && c.id.toLowerCase() === cityKey) || (c.name && c.name.toLowerCase() === cityKey)
    );
    if (cityData && Array.isArray(cityData.locations)) {
      for (const loc of cityData.locations) {
        const locNorm = normalizeTextForRouting(loc.name);
        if (!origCoord && ((normOrigB && locNorm.includes(normOrigB)) || normOrig.includes(locNorm) || locNorm.includes(normOrig))) {
          origCoord = { lat: loc.lat, lng: loc.lng };
        }
        if (!destCoord && ((normDestB && locNorm.includes(normDestB)) || normDest.includes(locNorm) || locNorm.includes(normDest))) {
          destCoord = { lat: loc.lat, lng: loc.lng };
        }
      }
    }

    if (origCoord && destCoord) {
      if (origCoord.lat === destCoord.lat && origCoord.lng === destCoord.lng) {
        // Both in same neighborhood
        if (num1 !== null && num2 !== null) {
          const diff = Math.abs(num1 - num2);
          return Math.max(0.6, Math.min(1.8, (diff * 0.001) + 0.5));
        }
        return 1.1;
      }
      const airDist = haversineDistKm(origCoord.lat, origCoord.lng, destCoord.lat, destCoord.lng);
      const roadDist = Math.max(0.9, airDist * 1.35);
      return Math.round(roadDist * 10) / 10;
    }

    // 4. Same Bairro entered by user
    if (normOrigB && normDestB && (normOrigB === normDestB || normOrigB.includes(normDestB) || normDestB.includes(normOrigB))) {
      return 1.2;
    }

    // 5. Fallback: Sensible urban trip distance (between 1.8km and 3.2km)
    let hash = 0;
    const combined = normOrig + normDest + normOrigB + normDestB;
    for (let i = 0; i < combined.length; i++) hash = ((hash << 5) - hash) + combined.charCodeAt(i);
    const pseudoVar = (Math.abs(hash) % 15) / 10;
    return Math.round((1.8 + pseudoVar) * 10) / 10;
  }

  let routeCalcTimeout = null;
  let selectedVehicleType = 'car';

  function selectVehicleCard(type) {
    selectedVehicleType = type;
    const carCard = document.getElementById('vcard-car');
    const motoCard = document.getElementById('vcard-moto');
    if (carCard && motoCard) {
      if (type === 'car') {
        carCard.classList.add('selected');
        motoCard.classList.remove('selected');
      } else {
        motoCard.classList.add('selected');
        carCard.classList.remove('selected');
      }
    }
  }

  function updateEstimatedValues() {
    const origInput = document.getElementById('pass-origin');
    const origBairroInput = document.getElementById('pass-origin-bairro');
    const destInput = document.getElementById('pass-dest');
    const destBairroInput = document.getElementById('pass-dest-bairro');

    const orig = origInput ? origInput.value.trim() : '';
    const origB = origBairroInput ? origBairroInput.value.trim() : '';
    const dest = destInput ? destInput.value.trim() : '';
    const destB = destBairroInput ? destBairroInput.value.trim() : '';

    const carPriceEl = document.getElementById('card-car-price');
    const carKmEl = document.getElementById('card-car-distance');
    const carTimeEl = document.getElementById('card-car-time');
    const motoPriceEl = document.getElementById('card-moto-price');
    const motoKmEl = document.getElementById('card-moto-distance');
    const motoTimeEl = document.getElementById('card-moto-time');

    const triggerPopAnim = (el) => {
      if (!el) return;
      el.classList.remove('val-pop');
      void el.offsetWidth;
      el.classList.add('val-pop');
    };

    if (routeCalcTimeout) {
      clearTimeout(routeCalcTimeout);
      routeCalcTimeout = null;
    }

    // If only one address is filled, update that single marker on the map immediately!
    const overlay = document.getElementById('passenger-map-overlay');
    if (!orig || !dest) {
      if (carPriceEl) carPriceEl.innerHTML = '<small>R$</small>--';
      if (carKmEl) carKmEl.innerText = '--';
      if (carTimeEl) carTimeEl.innerText = '--';
      if (motoPriceEl) motoPriceEl.innerHTML = '<small>R$</small>--';
      if (motoKmEl) motoKmEl.innerText = '--';
      if (motoTimeEl) motoTimeEl.innerText = '--';
      if (overlay) overlay.style.display = 'none';

      if (window.MaxMap) {
        if (typeof window.MaxMap.setRouteWithCoords === 'function') {
          window.MaxMap.setRouteWithCoords(orig, state.originCoords, dest, state.destCoords);
        } else {
          window.MaxMap.setRoute(orig, dest);
        }
      }
      return;
    }

    // 1. Instant calculation via Local Intelligent Urban Mesh (0ms latency)
    const kmNum = calculateRealisticDistance(orig, origB, dest, destB, state.currentCity);
    const kmVal = kmNum.toFixed(1);
    const carMin = Math.max(2, Math.round(kmNum * 2.2));
    const motoMin = Math.max(1, Math.round(kmNum * 1.5));

    // Lookup current city fare rates
    const curCityKey = (state.currentCity || 'ituiutaba').toLowerCase().replace(/\s+/g, '_');
    const cityCfg = cachedCitiesData.find(c => (c.id && c.id.toLowerCase() === curCityKey) || (c.name && c.name.toLowerCase() === curCityKey)) || {};

    const baseCar = Number(cityCfg.baseFareCar !== undefined ? cityCfg.baseFareCar : 7.00);
    const kmRateCar = Number(cityCfg.kmRateCar !== undefined ? cityCfg.kmRateCar : 1.00);
    const baseMoto = Number(cityCfg.baseFareMoto !== undefined ? cityCfg.baseFareMoto : 5.50);
    const kmRateMoto = Number(cityCfg.kmRateMoto !== undefined ? cityCfg.kmRateMoto : 0.85);

    const carPrice = (baseCar + kmNum * kmRateCar).toFixed(2);
    const motoPrice = (baseMoto + kmNum * kmRateMoto).toFixed(2);

    if (carPriceEl) {
      carPriceEl.innerHTML = `<small>R$</small>${carPrice.replace('.', ',')}`;
      triggerPopAnim(carPriceEl);
    }
    if (carKmEl) carKmEl.innerText = `${kmVal.replace('.', ',')} km`;
    if (carTimeEl) carTimeEl.innerText = `${carMin} min`;
    if (motoPriceEl) {
      motoPriceEl.innerHTML = `<small>R$</small>${motoPrice.replace('.', ',')}`;
      triggerPopAnim(motoPriceEl);
    }
    if (motoKmEl) motoKmEl.innerText = `${kmVal.replace('.', ',')} km`;
    if (motoTimeEl) motoTimeEl.innerText = `${motoMin} min`;

    // 2. High-Precision Turn-by-Turn OSRM Routing (Free OpenStreetMap Router)
    routeCalcTimeout = setTimeout(async () => {
      try {
        const city = state.currentCity || 'ituiutaba';
        const query = new URLSearchParams({
          city,
          orig,
          origBairro: origB,
          dest,
          destBairro: destB
        });

        if (state.originCoords && !isNaN(state.originCoords.lat) && !isNaN(state.originCoords.lng)) {
          query.set('origLat', state.originCoords.lat);
          query.set('origLng', state.originCoords.lng);
        }
        if (state.destCoords && !isNaN(state.destCoords.lat) && !isNaN(state.destCoords.lng)) {
          query.set('destLat', state.destCoords.lat);
          query.set('destLng', state.destCoords.lng);
        }

        const res = await fetch(`/api/route?${query.toString()}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!data || !data.success) return;

        // Verify that inputs haven't changed while request was in flight
        const curOrig = document.getElementById('pass-origin') ? document.getElementById('pass-origin').value.trim() : '';
        const curDest = document.getElementById('pass-dest') ? document.getElementById('pass-dest').value.trim() : '';
        if (curOrig !== orig || curDest !== dest) return;

        // Update exact coordinates from server resolution if we didn't have them
        if (data.c1 && !state.originCoords) {
          state.originCoords = { lat: data.c1.lat, lng: data.c1.lng };
        }
        if (data.c2 && !state.destCoords) {
          state.destCoords = { lat: data.c2.lat, lng: data.c2.lng };
        }

        const osrmKm = Number(data.distanceKm) || kmNum;
        const osrmKmVal = osrmKm.toFixed(1);
        const osrmCarMin = Number(data.durationMin) || carMin;
        const osrmMotoMin = Math.max(1, Math.round(osrmCarMin * 0.7));

        const osrmCarPrice = (baseCar + osrmKm * kmRateCar).toFixed(2);
        const osrmMotoPrice = (baseMoto + osrmKm * kmRateMoto).toFixed(2);

        if (carPriceEl) {
          carPriceEl.innerHTML = `<small>R$</small>${osrmCarPrice.replace('.', ',')}`;
          triggerPopAnim(carPriceEl);
        }
        if (carKmEl) carKmEl.innerText = `${osrmKmVal.replace('.', ',')} km`;
        if (carTimeEl) carTimeEl.innerText = `${osrmCarMin} min`;
        if (motoPriceEl) {
          motoPriceEl.innerHTML = `<small>R$</small>${osrmMotoPrice.replace('.', ',')}`;
          triggerPopAnim(motoPriceEl);
        }
        if (motoKmEl) motoKmEl.innerText = `${osrmKmVal.replace('.', ',')} km`;
        if (motoTimeEl) motoTimeEl.innerText = `${osrmMotoMin} min`;

        // Render real road geometry on interactive map & update floating overlay
        const overlay = document.getElementById('passenger-map-overlay');
        const overlayDistTime = document.getElementById('overlay-dist-time');
        const overlayPrice = document.getElementById('overlay-price-tag');
        if (overlay) {
          if (overlayDistTime) overlayDistTime.innerText = `🛣️ ${osrmKmVal.replace('.', ',')} km • ~${osrmCarMin} min`;
          if (overlayPrice) overlayPrice.innerText = `R$ ${osrmCarPrice.replace('.', ',')}`;
          overlay.style.display = 'flex';
        }

        if (window.MaxMap) {
          if (Array.isArray(data.coordinates) && data.coordinates.length >= 2) {
            window.MaxMap.setGeoJsonRoute(data.coordinates, orig, dest);
          } else {
            if (typeof window.MaxMap.setRouteWithCoords === 'function') {
              window.MaxMap.setRouteWithCoords(orig, state.originCoords, dest, state.destCoords);
            } else {
              window.MaxMap.setRoute(orig, dest);
            }
          }
        }
      } catch (err) {
        console.warn('Erro ao calcular rota OSRM:', err);
      }
    }, 200);
  }

  // Legacy city change handler (kept for compatibility)
  function handleCityChange(newCity) {
    selectCity(newCity);
  }

  // Street Suggestions Autocomplete Logic (OSM)
  let streetSearchTimeout = null;

  async function fetchStreetSuggestions(field, query) {
    if (!state.currentCity) return;
    try {
      const city = state.currentCity;
      const res = await fetch(`/api/streets?city=${encodeURIComponent(city)}&q=${encodeURIComponent(query || '')}&limit=12`);
      if (!res.ok) return;
      const data = await res.json();
      renderStreetSuggestions(field, data.items || data.streets || []);
    } catch (e) {
      console.warn('Erro ao buscar ruas:', e);
    }
  }

  function renderStreetSuggestions(field, streets) {
    const cleanField = field.replace('pass-', '');
    const dropdown = document.getElementById(`suggest-${cleanField}`) || document.getElementById(`suggest-${field}`);
    if (!dropdown) return;

    if (!streets || streets.length === 0) {
      dropdown.style.display = 'none';
      return;
    }

    dropdown.innerHTML = '';
    const cKey = state.currentCity || 'ituiutaba';
    const cityName = cKey.charAt(0).toUpperCase() + cKey.slice(1).replace('_', ' ');

    streets.forEach(streetItem => {
      let mainStreet = '';
      let district = cityName;
      let lat = null;
      let lng = null;

      if (typeof streetItem === 'object' && streetItem !== null) {
        mainStreet = streetItem.name || '';
        if (streetItem.bairro) district = `${streetItem.bairro} • ${cityName}`;
        lat = streetItem.lat;
        lng = streetItem.lng;
      } else {
        mainStreet = typeof streetItem === 'string' && streetItem.includes(' - ') ? streetItem.split(' - ')[0].trim() : String(streetItem);
      }

      const item = document.createElement('div');
      item.className = 'street-suggestion-item';
      item.innerHTML = `
        <img src="assets/icons/pin.svg" class="street-suggestion-icon" alt="Ponto">
        <div class="street-suggestion-info">
          <div class="street-suggestion-title">${mainStreet}</div>
          <div class="street-suggestion-district">${district}</div>
        </div>
      `;
      item.onmousedown = (e) => {
        e.preventDefault();
      };
      item.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        selectStreet(cleanField, mainStreet, lat, lng);
      };
      dropdown.appendChild(item);
    });

    dropdown.style.display = 'block';
  }

  function onStreetInput(field, query) {
    if (!checkCityBeforeInput()) return;
    if (streetSearchTimeout) clearTimeout(streetSearchTimeout);
    const q = (query || '').trim();
    if (q.length < 2) {
      closeAllStreetSuggestions();
      updateEstimatedValues();
      return;
    }
    streetSearchTimeout = setTimeout(() => {
      fetchStreetSuggestions(field, q);
    }, 150);
  }

  function onStreetFocus(field) {
    if (!checkCityBeforeInput()) return;
    const input = document.getElementById(field === 'origin' ? 'pass-origin' : 'pass-dest');
    const val = input ? input.value.trim() : '';
    // Only show suggestions if user has already typed at least 2 characters
    if (val.length >= 2) {
      fetchStreetSuggestions(field, val);
    } else {
      closeAllStreetSuggestions();
    }
  }

  function selectStreet(field, streetName, lat, lng) {
    playSound('click');
    const input = document.getElementById(field === 'origin' ? 'pass-origin' : 'pass-dest');
    if (input) {
      input.value = streetName;
    }

    if (field === 'origin') {
      state.originCoords = (lat && lng) ? { lat, lng } : null;
    } else {
      state.destCoords = (lat && lng) ? { lat, lng } : null;
    }

    closeAllStreetSuggestions();
    updateEstimatedValues();

    // Auto focus the separate bairro field next to it if empty
    const bairroInput = document.getElementById(field === 'origin' ? 'pass-origin-bairro' : 'pass-dest-bairro');
    if (bairroInput && !bairroInput.value.trim() && typeof bairroInput.focus === 'function') {
      setTimeout(() => bairroInput.focus(), 120);
    }

    // Update map with new route using precise coordinates
    const origVal = document.getElementById('pass-origin') ? document.getElementById('pass-origin').value : '';
    const destVal = document.getElementById('pass-dest') ? document.getElementById('pass-dest').value : '';
    if (window.MaxMap) {
      if (typeof window.MaxMap.setRouteWithCoords === 'function') {
        window.MaxMap.setRouteWithCoords(origVal, state.originCoords, destVal, state.destCoords);
      } else {
        window.MaxMap.setRoute(origVal, destVal);
      }
    }
  }

  // Use Native Device GPS for High-Precision Origin Location
  async function useCurrentLocationGPS() {
    playSound('click');
    if (!checkCityBeforeInput()) return;

    if (!('geolocation' in navigator)) {
      showToast('Geolocalização não suportada no seu navegador/aparelho.');
      return;
    }

    showToast('Obtendo sinal do GPS com alta precisão...');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        state.originCoords = { lat, lng };

        try {
          const curCity = state.currentCity || 'ituiutaba';
          const res = await fetch(`/api/reverse-geocode?lat=${lat}&lng=${lng}&city=${encodeURIComponent(curCity)}`);
          if (res.ok) {
            const data = await res.json();
            if (data && data.success) {
              const origInput = document.getElementById('pass-origin');
              const bairroInput = document.getElementById('pass-origin-bairro');
              if (origInput) origInput.value = data.address || 'Minha Localização';
              if (bairroInput && data.bairro) bairroInput.value = data.bairro;
              showToast(`Localização fixada: ${data.address}`);
              if (window.MaxMap) {
                window.MaxMap.setMarker('origin', { lat, lng, name: data.address || 'Minha Localização (GPS)' });
                const map = window.MaxMap.getMap();
                if (map) map.flyTo([lat, lng], 16, { duration: 1.2 });
              }
            }
          }
        } catch (e) {
          const origInput = document.getElementById('pass-origin');
          if (origInput) origInput.value = 'Minha Localização GPS';
          if (window.MaxMap) {
            window.MaxMap.setMarker('origin', { lat, lng, name: 'Minha Localização GPS' });
            const map = window.MaxMap.getMap();
            if (map) map.flyTo([lat, lng], 16, { duration: 1.2 });
          }
        }

        updateEstimatedValues();
      },
      (error) => {
        console.warn('Erro ao obter GPS:', error);
        let msg = 'Não foi possível obter o sinal de GPS.';
        if (error.code === 1) msg = 'Permissão de localização negada. Ative o GPS nas configurações do navegador.';
        else if (error.code === 2) msg = 'Sinal de GPS indisponível no momento.';
        else if (error.code === 3) msg = 'Tempo limite esgotado ao buscar GPS.';
        showToast(msg);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000
      }
    );
  }

  function closeAllStreetSuggestions() {
    const s1 = document.getElementById('suggest-origin');
    const s2 = document.getElementById('suggest-dest');
    if (s1) s1.style.display = 'none';
    if (s2) s2.style.display = 'none';
  }

  // Close suggestions and custom dropdowns on outside click
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.route-fields-split') && !e.target.closest('.route-pill-wrap')) {
      closeAllStreetSuggestions();
    }
    if (!e.target.closest('#city-selector-container') && !e.target.closest('#driver-city-selector-container') && !e.target.closest('.city-selector-container')) {
      document.querySelectorAll('.custom-city-dropdown').forEach(d => d.style.display = 'none');
    }
    if (!e.target.closest('#payment-selector-container')) {
      const payDropdown = document.getElementById('custom-payment-dropdown');
      if (payDropdown) payDropdown.style.display = 'none';
    }
  });

  // Helper: Resolve effective active ride ID for Chat
  function getEffectiveChatRideId() {
    if (state.activeRide && state.activeRide.id) {
      return state.activeRide.id;
    }
    if (state.currentChatRideId && state.currentChatRideId !== 'active') {
      return state.currentChatRideId;
    }
    if (typeof localStorage !== 'undefined') {
      const savedRideId = localStorage.getItem('maxdrive_active_ride_id');
      if (savedRideId && savedRideId !== 'active') {
        return savedRideId;
      }
    }
    return null;
  }

  // Web Audio Context Synthesizer for 100% Reliable Chimes
  let audioCtx = null;
  function getAudioContext() {
    try {
      if (!audioCtx && (window.AudioContext || window.webkitAudioContext)) {
        const AudioClass = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioClass();
      }
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }
      return audioCtx;
    } catch (e) {
      return null;
    }
  }

  // Unlock AudioContext on first user interaction
  window.addEventListener('click', () => { getAudioContext(); }, { once: false, passive: true });
  window.addEventListener('touchstart', () => { getAudioContext(); }, { once: false, passive: true });

  function playChatChime() {
    if (!state.soundEnabled) return;

    // 1. Play HTML5 Audio
    playSound('novaMensagem');

    // 2. Synthesize clear 2-tone melodic notification chime via Web Audio API (unaffected by file load delay)
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const t = ctx.currentTime;

      // Note 1: 880Hz (A5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, t);
      gain1.gain.setValueAtTime(0.35, t);
      gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(t);
      osc1.stop(t + 0.22);

      // Note 2: 1318.5Hz (E6) - higher chime
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1318.5, t + 0.12);
      gain2.gain.setValueAtTime(0.4, t + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(t + 0.12);
      osc2.stop(t + 0.45);
    } catch (e) {
      console.warn('Audio chime error:', e);
    }

    // 3. Haptic vibration on mobile devices
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate([120, 60, 180]); } catch (e) {}
    }
  }

  // Browser Tab Title Pulse Alert
  let originalDocTitle = document.title || 'MAX DRIVE';
  let titleAlertInterval = null;

  function setDocumentTitleAlert(senderName) {
    if (titleAlertInterval) clearInterval(titleAlertInterval);
    let toggle = false;
    titleAlertInterval = setInterval(() => {
      document.title = toggle ? `(1) Mensagem de ${senderName}! | MAX DRIVE` : `MAX DRIVE - Nova Mensagem`;
      toggle = !toggle;
    }, 1000);
  }

  function clearDocumentTitleAlert() {
    if (titleAlertInterval) {
      clearInterval(titleAlertInterval);
      titleAlertInterval = null;
    }
    document.title = originalDocTitle || 'MAX DRIVE';
  }

  // Chat Notification Helpers
  function setChatUnreadBadge(hasUnread) {
    const pBtn = document.getElementById('btn-passenger-chat');
    const dBtn = document.getElementById('btn-driver-chat');
    const pTxt = document.getElementById('txt-passenger-chat-btn');
    const dTxt = document.getElementById('txt-driver-chat-btn');

    if (hasUnread) {
      if (pBtn) pBtn.classList.add('btn-chat-unread');
      if (dBtn) dBtn.classList.add('btn-chat-unread');
      if (pTxt) pTxt.innerHTML = '<img src="assets/icons/chat.svg" class="svg-icon-img sm" style="vertical-align: -2px; margin-right: 4px;"> CONTATAR MOTORISTA <span style="background: #FF0044; color: #FFF; font-size: 10px; font-weight: 900; padding: 2px 8px; border-radius: 10px; margin-left: 6px; box-shadow: 0 0 10px rgba(255,0,68,0.8);">NOVA MENSAGEM</span>';
      if (dTxt) dTxt.innerHTML = '<img src="assets/icons/chat.svg" class="svg-icon-img sm" style="vertical-align: -2px; margin-right: 4px;"> CONTATAR PASSAGEIRO <span style="background: #FF0044; color: #FFF; font-size: 10px; font-weight: 900; padding: 2px 8px; border-radius: 10px; margin-left: 6px; box-shadow: 0 0 10px rgba(255,0,68,0.8);">NOVA MENSAGEM</span>';
    } else {
      if (pBtn) pBtn.classList.remove('btn-chat-unread');
      if (dBtn) dBtn.classList.remove('btn-chat-unread');
      if (pTxt) pTxt.innerText = 'CONTATAR MOTORISTA';
      if (dTxt) dTxt.innerText = 'CONTATAR PASSAGEIRO';
    }
  }

  function showChatNotificationBanner(senderName, text) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const existing = container.querySelectorAll('.chat-toast-banner');
    existing.forEach(e => e.remove());

    const toast = document.createElement('div');
    toast.className = 'toast chat-toast-banner';
    toast.style.pointerEvents = 'auto';
    toast.style.cursor = 'pointer';

    const preview = text.length > 42 ? text.substring(0, 39) + '...' : text;

    toast.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px; text-align: left; width: 100%;">
        <span style="flex-shrink: 0; filter: drop-shadow(0 0 6px rgba(254, 229, 0, 0.7));"><img src="assets/icons/chat.svg" alt="" class="svg-icon-img xl"></span>
        <div style="flex: 1; min-width: 0;">
          <div style="color: #FEE500; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px;">
            NOVA MENSAGEM • ${senderName}:
          </div>
          <div style="color: #FFFFFF; font-size: 13px; font-weight: 700; margin-top: 3px; word-break: break-word; line-height: 1.3;">
            "${preview}"
          </div>
          <div style="color: #00E5FF; font-size: 10px; font-weight: 800; margin-top: 5px; display: flex; align-items: center; gap: 4px;">
            TOQUE AQUI PARA ABRIR O CHAT <img src="assets/icons/arrow-right.svg" alt="" class="svg-icon-img sm" style="vertical-align: -2px;">
          </div>
        </div>
      </div>
    `;

    toast.onclick = function() {
      toast.remove();
      openChatModal();
    };

    container.appendChild(toast);

    setTimeout(() => {
      if (toast.parentNode) {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 350);
      }
    }, 8000);
  }

  // Chat System
  async function openChatModal() {
    playSound('click');
    const modal = document.getElementById('modal-chat');
    if (!modal) return;

    setChatUnreadBadge(false);
    clearDocumentTitleAlert();
    const container = document.getElementById('toast-container');
    if (container) {
      const banners = container.querySelectorAll('.chat-toast-banner');
      banners.forEach(b => b.remove());
    }

    state.currentChatRideId = getEffectiveChatRideId() || 'ride-current';

    // Update modal header with other party's real info
    const chatHeaderName = document.getElementById('chat-header-name');
    const chatHeaderAvatar = document.getElementById('chat-header-avatar');
    if (state.userRole === 'driver') {
      const pName = state.activeRide ? (state.activeRide.passengerName || 'PASSAGEIRO') : 'PASSAGEIRO';
      const pAvatar = state.activeRide ? (state.activeRide.passengerAvatar || null) : null;
      if (chatHeaderName) chatHeaderName.innerText = pName;
      setAvatarElement(chatHeaderAvatar, pAvatar, pName);
    } else {
      const dName = state.activeRide ? (state.activeRide.driverName || 'MOTORISTA') : 'MOTORISTA';
      const dAvatar = state.activeRide ? (state.activeRide.driverAvatar || null) : null;
      if (chatHeaderName) chatHeaderName.innerText = dName;
      setAvatarElement(chatHeaderAvatar, dAvatar, dName);
    }

    modal.classList.add('active');
    await checkChatMessages();

    // Focus input
    setTimeout(() => {
      const input = document.getElementById('chat-input-text');
      if (input) input.focus();
    }, 150);
  }

  function closeChatModal() {
    playSound('click');
    const modal = document.getElementById('modal-chat');
    if (modal) modal.classList.remove('active');
    clearDocumentTitleAlert();
  }

  async function checkChatMessages(overrideRideId = null) {
    const rideId = overrideRideId || getEffectiveChatRideId();
    if (!rideId || rideId === 'active') return;

    try {
      const res = await fetch(`/api/rides/${rideId}/chat`);
      const data = await res.json();
      if (res.ok && data.messages) {
        let newlyReceivedFromOther = false;
        let lastSenderName = '';
        let lastText = '';

        data.messages.forEach(msg => {
          if (!state.seenMessageIds.has(msg.id)) {
            state.seenMessageIds.add(msg.id);

            const currentUserId = state.currentUser ? state.currentUser.id : null;
            const isSelfById = currentUserId && msg.senderId && msg.senderId === currentUserId;
            const isSelfByRole = msg.senderRole === state.userRole;
            const isSelf = isSelfById || isSelfByRole;

            if (!isSelf) {
              newlyReceivedFromOther = true;
              lastSenderName = msg.senderName || (msg.senderRole === 'driver' ? 'MOTORISTA' : 'PASSAGEIRO');
              lastText = msg.text;
            }
          }
        });

        const modal = document.getElementById('modal-chat');
        const isModalOpen = modal && modal.classList.contains('active');
        const container = document.getElementById('chat-messages-container');

        if (newlyReceivedFromOther) {
          playChatChime();
          if (!isModalOpen) {
            setChatUnreadBadge(true);
            showChatNotificationBanner(lastSenderName, lastText);
            setDocumentTitleAlert(lastSenderName);
          }
        }

        if (container && (isModalOpen || newlyReceivedFromOther)) {
          renderChatBubbles(data.messages);
        }
      }
    } catch (e) {
      console.error('Erro ao verificar chat:', e);
    }
  }

  function renderChatBubbles(messages) {
    const container = document.getElementById('chat-messages-container');
    if (!container) return;
    container.innerHTML = '';

    // Deduplicate messages by ID to prevent repeated bubbles
    const uniqueMsgs = [];
    const seenMsgIds = new Set();
    (messages || []).forEach(msg => {
      if (msg && msg.id) {
        if (!seenMsgIds.has(msg.id)) {
          seenMsgIds.add(msg.id);
          uniqueMsgs.push(msg);
        }
      } else if (msg) {
        uniqueMsgs.push(msg);
      }
    });

    if (uniqueMsgs.length > 0) {
      uniqueMsgs.forEach(msg => {
        const bubble = document.createElement('div');
        const currentUserId = state.currentUser ? state.currentUser.id : null;
        const isSelfById = currentUserId && msg.senderId && msg.senderId === currentUserId;
        const isSelfByRole = msg.senderRole === state.userRole;
        const isSelf = isSelfById || isSelfByRole;

        bubble.className = `chat-bubble ${isSelf ? 'self' : 'other'}`;
        bubble.innerHTML = `
          <span>${msg.text}</span>
          <span class="chat-bubble-time">${msg.timestamp || ''}</span>
        `;
        container.appendChild(bubble);
      });
      container.scrollTop = container.scrollHeight;
    } else {
      const emptyState = document.createElement('div');
      emptyState.className = 'chat-empty-state';
      emptyState.innerHTML = '<span style="display: block; margin-bottom: 8px;"><img src="assets/icons/chat.svg" alt="" class="svg-icon-img xl"></span>Nenhuma mensagem ainda.<br><small style="color: #999;">Envie uma mensagem abaixo para iniciar a conversa.</small>';
      emptyState.style.textAlign = 'center';
      emptyState.style.color = '#777';
      emptyState.style.fontSize = '12px';
      emptyState.style.marginTop = '40px';
      emptyState.style.padding = '0 20px';
      emptyState.style.lineHeight = '1.5';
      container.appendChild(emptyState);
    }
  }

  async function handleSendChatMessage(e) {
    if (e) e.preventDefault();
    const input = document.getElementById('chat-input-text');
    if (!input || !input.value.trim()) return;

    const text = input.value.trim();
    input.value = '';
    playSound('click');

    const rideId = getEffectiveChatRideId() || 'ride-current';
    try {
      const res = await fetch(`/api/rides/${rideId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: state.currentUser ? state.currentUser.id : (state.userRole === 'driver' ? 'usr-drv-1' : 'usr-pass-1'),
          senderRole: state.userRole,
          senderName: state.currentUser ? state.currentUser.name : (state.userRole === 'driver' ? 'MOTORISTA' : 'PASSAGEIRO'),
          text
        })
      });
      if (res.ok) {
        await checkChatMessages();
      }
    } catch (err) {
      console.error(err);
      showToast('Erro ao enviar mensagem');
    }
  }

  // History Rendering (Dynamic for Passenger and Driver)
  async function renderHistory() {
    const container = document.getElementById('history-cards-container');
    if (!container) return;

    const isDriver = state.userRole === 'driver';
    const subTitle = document.querySelector('#screen-history .section-title-yellow');
    const badgeSpan = document.querySelector('#screen-history .city-badge span');

    if (subTitle) {
      subTitle.innerText = isDriver ? 'Histórico de corridas (Motorista):' : 'Histórico de corridas (Passageiro):';
    }
    if (badgeSpan) {
      badgeSpan.innerText = isDriver ? 'Minhas Corridas' : 'Minhas Viagens';
    }

    const curUser = state.currentUser || JSON.parse(typeof localStorage !== 'undefined' ? (localStorage.getItem('maxdrive_logged_user') || '{}') : '{}');
    if (!curUser || (!curUser.id && !curUser.email && !curUser.name)) {
      container.innerHTML = `
        <div class="driver-radar-empty-box" style="margin-top: 20px;">
          <div class="driver-radar-empty-icon"><img src="assets/icons/file-text.svg" alt="" class="svg-icon-img xxl"></div>
          <div class="driver-radar-empty-title">NENHUMA CORRIDA NO HISTÓRICO</div>
          <div class="driver-radar-empty-desc">Faça login no aplicativo para visualizar seu histórico de viagens.</div>
        </div>
      `;
      return;
    }

    try {
      let data = null;
      let res = null;
      const uParam = curUser ? (curUser.id || curUser.email || curUser.name) : '';

      if (uParam) {
        const queryParam = isDriver ? `driverId=${encodeURIComponent(uParam)}` : `passengerId=${encodeURIComponent(uParam)}`;
        res = await fetch(`/api/rides?${queryParam}&role=${isDriver ? 'driver' : 'passenger'}&userId=${encodeURIComponent(uParam)}`, {
          headers: {
            'x-user-id': curUser ? (curUser.id || '') : '',
            'x-session-token': state.sessionToken || ''
          }
        });
        if (res && res.ok) {
          data = await res.json();
        }
      }

      // Resilient Fallback: If query returned 0 rides or failed, fetch all rides and match!
      if (!data || !data.rides || data.rides.length === 0) {
        try {
          const allRes = await fetch('/api/rides');
          if (allRes && allRes.ok) {
            const allData = await allRes.json();
            if (allData && Array.isArray(allData.rides) && allData.rides.length > 0) {
              const uId = (curUser && curUser.id) ? String(curUser.id).toLowerCase() : '';
              const uEmail = (curUser && curUser.email) ? curUser.email.toLowerCase() : '';
              const uName = (curUser && curUser.name) ? curUser.name.toLowerCase() : '';

              // 1. Try matching by User ID, Email or Name
              let matched = allData.rides.filter(r => {
                if (!r) return false;
                if (isDriver) {
                  return (uId && r.driverId && String(r.driverId).toLowerCase() === uId) ||
                         (uEmail && r.driverEmail && r.driverEmail.toLowerCase() === uEmail) ||
                         (uName && r.driverName && r.driverName.toLowerCase() === uName);
                } else {
                  return (uId && r.passengerId && String(r.passengerId).toLowerCase() === uId) ||
                         (uEmail && r.passengerEmail && r.passengerEmail.toLowerCase() === uEmail) ||
                         (uName && r.passengerName && r.passengerName.toLowerCase() === uName);
                }
              });

              // 2. If 0 matched for passenger, check device ride IDs
              if (matched.length === 0 && !isDriver) {
                let deviceRideIds = [];
                try {
                  deviceRideIds = JSON.parse(typeof localStorage !== 'undefined' ? (localStorage.getItem('maxdrive_device_ride_ids') || '[]') : '[]');
                } catch (_) {}
                const deviceIdSet = new Set(deviceRideIds);

                matched = allData.rides.filter(r => {
                  if (!r) return false;
                  return deviceIdSet.has(r.id);
                });
              }

              // 3. Ultimate Fallback for Passenger: Show recent passenger rides in database
              if (matched.length === 0 && !isDriver) {
                matched = allData.rides.filter(r => r && (r.passengerId || r.passengerName || r.status !== 'requested'));
              }

              if (matched.length > 0) {
                data = { success: true, rides: matched };
              }
            }
          }
        } catch (_) {}
      }

      let list = (data && data.rides) ? data.rides : [];

      // Sort by newest created/completed date first
      list.sort((a, b) => new Date(b.completedAt || b.createdAt || 0) - new Date(a.completedAt || a.createdAt || 0));

      // DO NOT FALLBACK TO OTHER USERS' RIDES! If 0 rides, display empty state
      if (list.length === 0) {
        container.innerHTML = `
          <div class="driver-radar-empty-box" style="margin-top: 20px;">
            <div class="driver-radar-empty-icon"><img src="assets/icons/file-text.svg" alt="" class="svg-icon-img xxl"></div>
            <div class="driver-radar-empty-title">NENHUMA CORRIDA NO HISTÓRICO</div>
            <div class="driver-radar-empty-desc">Você ainda não realizou nenhuma corrida.<br>Suas viagens concluídas aparecerão aqui.</div>
          </div>
        `;
        return;
      }

      // Limit to 10 most recent rides to avoid overloading the app
      list = list.slice(0, 10);

      container.innerHTML = list.map(r => {
        if (!r) return '';
        const targetName = isDriver 
          ? (r.passengerName || 'PASSAGEIRO') 
          : (r.driverName || 'MOTORISTA MAX DRIVE');

        const cleanTarget = (targetName && typeof targetName === 'string') ? targetName.trim() : 'MAX DRIVE';
        const parts = cleanTarget.split(' ').filter(Boolean);
        const initials = ((parts[0] ? parts[0][0] : 'M') + (parts[1] ? parts[1][0] : '')).toUpperCase();
        
        const ratingVal = isDriver 
          ? ((r.passengerRating && Number(r.passengerRating) > 0) ? Number(r.passengerRating).toFixed(1) : 'Novo')
          : ((r.driverRating && Number(r.driverRating) > 0) ? Number(r.driverRating).toFixed(1) : 'Novo');

        const vehicleObj = (r.vehicle && typeof r.vehicle === 'object') ? r.vehicle : (r.vehicle && typeof r.vehicle === 'string' ? (function(){ try { return JSON.parse(r.vehicle); } catch(_){ return null; } })() : null);

        const detailTag = isDriver
          ? (r.vehicleType === 'moto' ? '<img src="assets/icons/moto.svg" class="svg-icon-img sm" style="vertical-align: -2px; margin-right: 3px;"> MOTO TÁXI' : '<img src="assets/icons/car.svg" class="svg-icon-img sm" style="vertical-align: -2px; margin-right: 3px;"> CARRO COMUM')
          : (vehicleObj ? `${vehicleObj.model || 'CARRO COMUM'} ${vehicleObj.plate ? '• ' + vehicleObj.plate : ''}` : (r.vehicleType === 'moto' ? 'MOTO TÁXI' : 'CARRO COMUM'));

        const priceStr = Number(r.finalFare || r.price || 10).toFixed(2).replace('.', ',');
        const payMethod = r.paymentMethod || 'Pix';
        const evalButtonLabel = isDriver ? 'AVALIAR PASSAGEIRO' : 'AVALIAR MOTORISTA';

        // Check if evaluated by the current role
        const isRated = isDriver ? r.ratedByDriver : (r.ratedByPassenger || r.rated);
        const givenRating = isDriver ? (r.driverRatingGiven || r.rating || 5) : (r.passengerRatingGiven || r.rating || 5);

        const targetAvatar = isDriver 
          ? (r.passengerAvatar || null)
          : (r.driverAvatar || null);
        const avatarHtml = renderAvatarCircle(targetAvatar, cleanTarget, initials);

        return `
          <div class="white-card">
            <div class="ride-driver-header">
              <div class="avatar-circle">${avatarHtml}</div>
              <div class="driver-info-meta">
                <h4>${cleanTarget}</h4>
                <div class="rating-tag"><img src="assets/icons/star.svg" alt="" class="svg-icon-img sm" style="filter: brightness(0) saturate(100%); margin-right: 3px;"> ${ratingVal}</div>
                <div class="vehicle-pill-tag" style="display: inline-flex; align-items: center;">${detailTag}</div>
              </div>
            </div>
            <div class="route-steps-box">
              <div class="route-step-row">
                <span class="route-dot green"></span>
                <span>${r.origin || 'Partida'}</span>
              </div>
              <div class="route-step-row">
                <span class="route-dot yellow"></span>
                <span>${r.destination || 'Destino'}</span>
              </div>
            </div>
            <div class="price-display-row">
              <div>
                <div class="price-display-label">PREÇO:</div>
                <div class="price-display-big">R$ ${priceStr}</div>
              </div>
              <div class="payment-method-badge">Forma de pagamento: ${payMethod}</div>
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 10px;">
              ${r.status === 'expired' ? `
                <div style="font-size: 11px; font-weight: 800; color: #E53935; background: rgba(229, 57, 53, 0.12); padding: 6px 12px; border-radius: 12px; display: inline-flex; align-items: center; gap: 4px;">
                  EXPIRADA (SEM MOTORISTA)
                </div>
              ` : r.status === 'cancelled' ? `
                <div style="font-size: 11px; font-weight: 800; color: #888; background: rgba(0, 0, 0, 0.06); padding: 6px 12px; border-radius: 12px;">
                  CANCELADA
                </div>
              ` : isRated ? `
                <div class="btn-pill btn-green" style="height: 36px; font-size: 11px; width: 60%; display: flex; align-items: center; justify-content: center; gap: 4px;">
                  <img src="assets/icons/check-circle.svg" class="svg-icon-img sm" alt="" style="vertical-align: -2px; margin-right: 3px;"> AVALIADO <img src="assets/icons/star.svg" class="svg-icon-img sm" alt="" style="filter: brightness(0) saturate(100%); margin: 0 3px;"> ${givenRating}
                </div>
              ` : `
                <button type="button" class="btn-pill btn-yellow" style="height: 36px; font-size: 11px; width: 60%;" onclick="App.openRatingModal('${r.id}', '${cleanTarget}')">
                  ${evalButtonLabel}
                </button>
              `}
              <a style="color: var(--red-danger); font-size: 11px; font-weight: 700; cursor: pointer;" onclick="App.openReportModal('${r.id}', '${cleanTarget}')">
                Reportar incidente
              </a>
            </div>
          </div>
        `;
      }).join('');
    } catch (err) {
      console.error('Erro ao renderizar histórico:', err);
    }
  }

  // ===================================================================
  // 8.1. PAINEL FINANCEIRO / FINANÇAS (Hoje, Semana, Mês, Total)
  // ===================================================================
  async function renderFinances() {
    const totalValEl = document.getElementById('finance-total-val');
    const totalRidesEl = document.getElementById('finance-total-rides');
    const ticketMedioEl = document.getElementById('finance-ticket-medio');
    const dayValEl = document.getElementById('finance-day-val');
    const dayRidesEl = document.getElementById('finance-day-rides');
    const weekValEl = document.getElementById('finance-week-val');
    const weekRidesEl = document.getElementById('finance-week-rides');
    const monthValEl = document.getElementById('finance-month-val');
    const monthRidesEl = document.getElementById('finance-month-rides');
    const transListEl = document.getElementById('finance-transactions-list');
    const transCountEl = document.getElementById('finance-transactions-count');
    const roleTitleEl = document.getElementById('finances-role-title');
    const feeStatusCard = document.getElementById('finance-fee-status-card');

    if (state.userRole !== 'driver') {
      showToast('O painel financeiro é exclusivo para motoristas.');
      goToScreen('screen-passenger-home');
      return;
    }

    const curUser = state.currentUser;
    const isDriver = true;

    if (roleTitleEl) {
      roleTitleEl.innerText = 'Faturamento do Motorista:';
    }

    if (feeStatusCard) {
      if (isDriver) {
        feeStatusCard.style.display = 'block';
        const feeBadge = document.getElementById('finance-fee-badge');
        const feeText = document.getElementById('finance-fee-text');
        const isMoto = curUser && curUser.vehicle && curUser.vehicle.type === 'moto';
        const feeAmount = isMoto ? '50,00' : '100,00';
        const vehName = isMoto ? 'Moto Táxi' : 'Carro';
        const isPending = curUser && (curUser.paymentBlocked || curUser.weeklyPaymentStatus === 'PENDENTE' || curUser.weeklyPaymentStatus === 'BLOQUEADO');
        if (feeText) feeText.innerText = `R$ ${feeAmount} (${vehName}) • Toda segunda a domingo`;
        if (feeBadge) {
          feeBadge.innerText = isPending ? 'PENDENTE' : 'EM DIA';
          feeBadge.className = isPending ? 'badge-status-red' : 'badge-status-green';
        }
      } else {
        feeStatusCard.style.display = 'none';
      }
    }

    if (!curUser) {
      if (transListEl) {
        transListEl.innerHTML = `<div style="text-align: center; color: #94A3B8; font-size: 12px; padding: 20px;">Faça login para visualizar seus dados financeiros.</div>`;
      }
      return;
    }

    try {
      if (transListEl) {
        transListEl.innerHTML = `<div style="text-align: center; color: #94A3B8; font-size: 12px; padding: 20px;">Carregando dados financeiros...</div>`;
      }

      // Try server financial aggregation first
      let finData = null;
      try {
        const fRes = await fetch(`/api/finances?userId=${encodeURIComponent(curUser.id)}&role=${state.userRole}`);
        if (fRes.ok) {
          finData = await fRes.json();
        }
      } catch (_) {}

      let dailyTotal = 0, dailyRides = 0;
      let weeklyTotal = 0, weeklyRides = 0;
      let monthlyTotal = 0, monthlyRides = 0;
      let totalEarnings = 0, totalRides = 0;
      let completedRidesList = [];

      if (finData && finData.success) {
        dailyTotal = Number(finData.dailyTotal || 0);
        dailyRides = Number(finData.dailyRides || 0);
        weeklyTotal = Number(finData.weeklyTotal || 0);
        weeklyRides = Number(finData.weeklyRides || 0);
        monthlyTotal = Number(finData.monthlyTotal || 0);
        monthlyRides = Number(finData.monthlyRides || 0);
        totalEarnings = Number(finData.totalEarnings || 0);
        totalRides = Number(finData.totalRides || 0);
        completedRidesList = finData.completedRides || [];
      } else {
        // Fallback: calculate client-side from rides API
        const res = await fetch(`/api/rides?userId=${encodeURIComponent(curUser.id)}&role=${state.userRole}`);
        const data = await res.json();
        if (!res.ok || !data.rides) {
          if (transListEl) transListEl.innerHTML = `<div style="text-align: center; color: #FF5252; font-size: 12px; padding: 20px;">Erro ao carregar dados financeiros.</div>`;
          return;
        }

        let myRides = data.rides.filter(r => r.status === 'completed');
        if (isDriver) {
          myRides = myRides.filter(r =>
            (r.driverId && r.driverId === curUser.id) ||
            (curUser.email && r.driverEmail && r.driverEmail.toLowerCase() === curUser.email.toLowerCase()) ||
            (r.driverName && curUser.name && r.driverName.toLowerCase() === curUser.name.toLowerCase())
          );
        } else {
          myRides = myRides.filter(r =>
            (r.passengerId && r.passengerId === curUser.id) ||
            (curUser.email && r.passengerEmail && r.passengerEmail.toLowerCase() === curUser.email.toLowerCase()) ||
            (r.passengerName && curUser.name && r.passengerName.toLowerCase() === curUser.name.toLowerCase())
          );
        }

        myRides.sort((a, b) => new Date(b.completedAt || b.createdAt) - new Date(a.completedAt || a.createdAt));
        completedRidesList = myRides;

        const now = new Date();
        const dayOfWeek = now.getDay();
        const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday, 0, 0, 0, 0);
        const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6, 23, 59, 59, 999);

        myRides.forEach(r => {
          const fare = Number(r.finalFare || r.price || 0);
          const rDate = new Date(r.completedAt || r.createdAt);

          totalEarnings += fare;
          totalRides++;

          if (rDate.getFullYear() === now.getFullYear() && rDate.getMonth() === now.getMonth() && rDate.getDate() === now.getDate()) {
            dailyTotal += fare;
            dailyRides++;
          }

          if (rDate >= monday && rDate <= sunday) {
            weeklyTotal += fare;
            weeklyRides++;
          }

          if (rDate.getFullYear() === now.getFullYear() && rDate.getMonth() === now.getMonth()) {
            monthlyTotal += fare;
            monthlyRides++;
          }
        });
      }

      const avgTicket = totalRides > 0 ? (totalEarnings / totalRides) : 0;

      // Update UI cards
      if (totalValEl) totalValEl.innerText = `R$ ${totalEarnings.toFixed(2).replace('.', ',')}`;
      if (totalRidesEl) totalRidesEl.innerText = totalRides;
      if (ticketMedioEl) ticketMedioEl.innerText = `Média: R$ ${avgTicket.toFixed(2).replace('.', ',')}/corrida`;

      if (dayValEl) dayValEl.innerText = `R$ ${dailyTotal.toFixed(2).replace('.', ',')}`;
      if (dayRidesEl) dayRidesEl.innerText = `${dailyRides} ${dailyRides === 1 ? 'corrida' : 'corridas'}`;

      if (weekValEl) weekValEl.innerText = `R$ ${weeklyTotal.toFixed(2).replace('.', ',')}`;
      if (weekRidesEl) weekRidesEl.innerText = `${weeklyRides} ${weeklyRides === 1 ? 'corrida' : 'corridas'}`;

      if (monthValEl) monthValEl.innerText = `R$ ${monthlyTotal.toFixed(2).replace('.', ',')}`;
      if (monthRidesEl) monthRidesEl.innerText = `${monthlyRides} ${monthlyRides === 1 ? 'corrida' : 'corridas'}`;

      if (transCountEl) transCountEl.innerText = `${completedRidesList.length} ${completedRidesList.length === 1 ? 'corrida' : 'corridas'}`;

      if (transListEl) {
        if (completedRidesList.length === 0) {
          transListEl.innerHTML = `
            <div class="driver-radar-empty-box" style="margin-top: 10px;">
              <div class="driver-radar-empty-icon"><img src="assets/icons/receipt.svg" alt="" class="svg-icon-img xxl"></div>
              <div class="driver-radar-empty-title">NENHUMA CORRIDA FINALIZADA</div>
              <div class="driver-radar-empty-desc">Seus ganhos por corrida aparecerão discriminados aqui assim que finalizar viagens.</div>
            </div>
          `;
        } else {
          transListEl.innerHTML = completedRidesList.map(r => {
            const fare = Number(r.finalFare || r.price || 0).toFixed(2).replace('.', ',');
            const dateObj = new Date(r.completedAt || r.createdAt);
            const dateStr = dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
            const timeStr = dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            const targetName = isDriver ? (r.passengerName || 'Passageiro') : (r.driverName || 'Motorista');
            const isMoto = r.vehicleType === 'moto';

            return `
              <div class="finance-transaction-card">
                <div style="display: flex; align-items: center; gap: 10px;">
                  <div style="width: 38px; height: 38px; border-radius: 50%; background: rgba(0, 208, 75, 0.12); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                    <img src="${isMoto ? 'assets/icons/moto.svg' : 'assets/icons/car.svg'}" alt="" class="svg-icon-img md" style="filter: brightness(0) invert(1);">
                  </div>
                  <div>
                    <div style="font-size: 13px; font-weight: 800; color: var(--text-main);">${targetName}</div>
                    <div style="font-size: 11px; color: var(--text-muted);">${dateStr} às ${timeStr} • ${r.paymentMethod || 'Pix'}</div>
                  </div>
                </div>
                <div style="text-align: right; flex-shrink: 0;">
                  <div style="font-size: 15px; font-weight: 900; color: #00D04B;">+ R$ ${fare}</div>
                  <div style="font-size: 10px; color: var(--text-muted);">${r.distance || 'Finalizada'}</div>
                </div>
              </div>
            `;
          }).join('');
        }
      }
    } catch (err) {
      console.warn('Erro ao renderizar finanças:', err);
      if (transListEl) {
        transListEl.innerHTML = `<div style="text-align: center; color: #FF5252; font-size: 12px; padding: 20px;">Falha ao calcular faturamento.</div>`;
      }
    }
  }

  // Rating Modal
  function openRatingModal(rideId, targetName) {
    playSound('click');
    state.ratingRideId = rideId || (state.activeRide ? state.activeRide.id : 'active');
    const modal = document.getElementById('modal-rating');
    const titleEl = document.getElementById('rating-modal-title');
    const nameEl = document.getElementById('rating-target-name');
    const feedbackInput = document.getElementById('rating-feedback-input');

    const isDriver = state.userRole === 'driver';
    if (titleEl) {
      titleEl.innerText = isDriver ? 'Avaliar Passageiro' : 'Avaliar Motorista';
    }
    if (nameEl) {
      nameEl.innerText = targetName || (isDriver ? 'Passageiro MAX DRIVE' : 'Motorista MAX DRIVE');
    }
    if (feedbackInput) {
      feedbackInput.placeholder = isDriver ? 'Comentário sobre o passageiro...' : 'Comentário sobre o motorista...';
    }
    if (modal) modal.classList.add('active');
    setRatingStars(5);
  }

  function closeRatingModal() {
    playSound('click');
    state.ratingRideId = null;
    const modal = document.getElementById('modal-rating');
    if (modal) modal.classList.remove('active');
  }

  const RATING_LABELS = {
    1: '⭐ 1 Estrela — Muito Ruim',
    2: '⭐⭐ 2 Estrelas — Ruim',
    3: '⭐⭐⭐ 3 Estrelas — Regular',
    4: '⭐⭐⭐⭐ 4 Estrelas — Muito Bom',
    5: '⭐⭐⭐⭐⭐ 5 Estrelas — Excelente!'
  };

  function setRatingStars(stars) {
    stars = Math.max(1, Math.min(5, parseInt(stars) || 5));
    state.selectedRating = stars;
    const starIcons = document.querySelectorAll('#star-rating-stars .star-icon');
    starIcons.forEach(s => {
      const val = parseInt(s.getAttribute('data-star'));
      const isActive = val <= stars;
      s.classList.toggle('active', isActive);
      if (val === stars) {
        s.classList.remove('pop');
        void s.offsetWidth;
        s.classList.add('pop');
      }
    });

    const labelEl = document.getElementById('rating-stars-label');
    if (labelEl) {
      labelEl.innerText = RATING_LABELS[stars] || `${stars} Estrelas`;
      if (stars >= 4) {
        labelEl.style.color = '#FFE600';
      } else if (stars === 3) {
        labelEl.style.color = '#00F0FF';
      } else if (stars === 2) {
        labelEl.style.color = '#FFA000';
      } else {
        labelEl.style.color = '#FF5252';
      }
    }
  }

  function highlightRatingStars(hoverStars) {
    const starIcons = document.querySelectorAll('#star-rating-stars .star-icon');
    starIcons.forEach(s => {
      const val = parseInt(s.getAttribute('data-star'));
      s.classList.toggle('hover-active', val <= hoverStars);
    });
    const labelEl = document.getElementById('rating-stars-label');
    if (labelEl && RATING_LABELS[hoverStars]) {
      labelEl.innerText = RATING_LABELS[hoverStars];
    }
  }

  function resetRatingStarsHover() {
    const starIcons = document.querySelectorAll('#star-rating-stars .star-icon');
    starIcons.forEach(s => s.classList.remove('hover-active'));
    const labelEl = document.getElementById('rating-stars-label');
    if (labelEl && RATING_LABELS[state.selectedRating]) {
      labelEl.innerText = RATING_LABELS[state.selectedRating];
      const stars = state.selectedRating;
      if (stars >= 4) {
        labelEl.style.color = '#FFE600';
      } else if (stars === 3) {
        labelEl.style.color = '#00F0FF';
      } else if (stars === 2) {
        labelEl.style.color = '#FFA000';
      } else {
        labelEl.style.color = '#FF5252';
      }
    }
  }

  async function submitRating() {
    playSound('success');
    const feedbackInput = document.getElementById('rating-feedback-input');
    const feedback = feedbackInput ? feedbackInput.value.trim() : '';
    if (feedbackInput) feedbackInput.value = '';

    const targetRide = state.activeRide;
    const rideId = state.ratingRideId || (targetRide ? targetRide.id : (state.currentChatRideId || 'active'));

    if (rideId && rideId !== 'active' && rideId !== 'ride-current') {
      try {
        await fetch(`/api/rides/${rideId}/rating`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stars: state.selectedRating,
            feedback,
            ratedBy: state.userRole
          })
        });
      } catch (err) {
        console.warn('Erro ao enviar avaliação ao servidor:', err);
      }
    }

    clearActiveRideState();
    state.activeRide = null;
    state.waitingRideId = null;
    state.ratingRideId = null;

    showToast(`Obrigado! Avaliação de ${state.selectedRating} estrelas registrada.`);
    const modal = document.getElementById('modal-rating');
    if (modal) modal.classList.remove('active');
    updateDriverSettingsStats();

    // Redirect passenger directly to History screen to show completed & rated ride!
    if (state.userRole === 'passenger') {
      goToScreen('screen-history');
    } else {
      goToScreen('screen-driver-home');
    }
  }

  // Quick Report Reason Tag Selector
  function setReportReason(text) {
    playSound('click');
    const input = document.getElementById('report-reason-text');
    if (input) {
      input.value = text;
      input.focus();
    }
  }

  // Report Modal
  function openReportModal(rideId, targetName, isCancellation = false) {
    playSound('click');
    const isDriver = state.userRole === 'driver';
    state.reportingRideId = rideId || (state.activeRide ? state.activeRide.id : '');
    state.reportingTargetName = targetName || (state.activeRide ? (isDriver ? state.activeRide.passengerName : state.activeRide.driverName) : 'Diretoria MAX DRIVE');
    state.isCancellingActiveRide = isCancellation || !!(state.activeRide && state.activeRide.id === state.reportingRideId);

    const titleEl = document.getElementById('report-modal-title');
    const subEl = document.getElementById('report-modal-subtitle');
    const btnSubmit = document.getElementById('btn-report-submit');
    const quickTags = document.getElementById('report-quick-tags');

    if (titleEl) {
      titleEl.innerHTML = state.isCancellingActiveRide ? '<img src="assets/icons/siren.svg" class="svg-icon-img md" style="vertical-align: -3px; margin-right: 6px;"> Cancelar e Reportar Corrida' : 'Reportar Incidente';
    }
    if (subEl) {
      subEl.innerText = state.isCancellingActiveRide
        ? 'Descreva o motivo do cancelamento para a diretoria. Ao enviar, a corrida será cancelada e finalizada imediatamente.'
        : 'Sua reclamação será enviada diretamente para a diretoria da MAX DRIVE.';
    }
    if (btnSubmit) {
      btnSubmit.innerText = state.isCancellingActiveRide ? 'CANCELAR E ENVIAR REPORTE' : 'ENVIAR REPORTE';
    }
    if (quickTags) {
      quickTags.style.display = state.isCancellingActiveRide ? 'flex' : 'none';
    }

    const reasonInput = document.getElementById('report-reason-text');
    if (reasonInput) reasonInput.value = '';

    const modal = document.getElementById('modal-report');
    if (modal) modal.classList.add('active');
  }

  function closeReportModal() {
    playSound('click');
    state.isCancellingActiveRide = false;
    const modal = document.getElementById('modal-report');
    if (modal) modal.classList.remove('active');
  }

  async function submitReport() {
    const reasonInput = document.getElementById('report-reason-text');
    if (!reasonInput || !reasonInput.value.trim()) {
      showToast('Por favor, descreva o incidente ou motivo do reporte');
      return;
    }

    const reasonText = reasonInput.value.trim();
    const shouldCancelRide = state.isCancellingActiveRide || !!(state.activeRide && (state.activeRide.id === state.reportingRideId || !state.reportingRideId));

    try {
      const isDriver = state.userRole === 'driver';
      const fallbackId = isDriver ? 'usr-drv-1' : 'usr-pass-1';
      const fallbackName = isDriver ? 'MARCOS MARQUES' : 'JULIANO MARTINS';

      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reporterId: state.currentUser ? state.currentUser.id : fallbackId,
          reporterName: state.currentUser ? state.currentUser.name : fallbackName,
          reporterRole: state.userRole,
          targetName: state.reportingTargetName || 'Diretoria MAX DRIVE',
          rideId: state.reportingRideId || '',
          category: shouldCancelRide ? 'Cancelamento de Corrida com Reporte' : (state.reportingRideId ? 'Incidente em Corrida' : 'Reclamação Geral'),
          reason: reasonText
        })
      });

      if (res.ok) {
        reasonInput.value = '';
        closeReportModal();

        if (shouldCancelRide) {
          // Finalize and cancel the active ride completely!
          await executeDirectCancel(state.userRole || 'driver', reasonText);
          showToast('Corrida cancelada e reporte enviado à diretoria com sucesso!');
        } else {
          playSound('success');
          showToast('Reporte enviado com sucesso para a central de reportes!');
        }
        loadUserReports();
      } else {
        showToast('Falha ao enviar reporte. Tente novamente.');
      }
    } catch (e) {
      showToast('Erro de conexão ao registrar reporte');
    }
  }

  // Driver Ride Actions: Cancel or Report Incident
  async function openDriverRideActions() {
    playSound('click');
    const passengerName = state.activeRide?.passengerName || 'Passageiro';
    const choice = await showDialog({
      title: 'Cancelar Corrida',
      message: `Como deseja prosseguir com o cancelamento da corrida com ${passengerName}?`,
      type: 'confirm',
      confirmText: 'CANCELAR E REPORTAR',
      cancelText: 'APENAS CANCELAR',
      neutralText: 'NÃO CANCELAR'
    });

    if (choice === 'confirm' || choice === true) {
      openReportModal(state.activeRide?.id, passengerName, true);
    } else if (choice === 'cancel') {
      await executeDirectCancel('driver', 'Cancelado diretamente pelo motorista');
      showToast('Corrida cancelada.');
    }
    // If choice is false (neutralText), user backed out, keep ride running
  }

  // =========================================================
  // CANAL DIRETO COM A DIRETORIA / ADMINISTRAÇÃO (CHAT OFICIAL)
  // =========================================================
  async function checkAdminDirectMessages(userId, force = false) {
    if (!userId) return;
    const now = Date.now();
    if (!force && state.lastAdminCheckTime && (now - state.lastAdminCheckTime < 2400)) return;
    state.lastAdminCheckTime = now;

    try {
      const res = await fetch(`/api/admin-messages/unread-count?userId=${encodeURIComponent(userId)}`);
      if (!res.ok) return;
      const data = await res.json();
      const count = data.unreadCount || 0;

      // Update bottom nav dots
      const dots = document.querySelectorAll('.nav-notification-dot');
      dots.forEach(d => {
        d.style.display = count > 0 ? 'block' : 'none';
      });

      // Update settings card badge & preview
      const pill = document.getElementById('settings-admin-unread-pill');
      const badgeCount = document.getElementById('settings-chat-badge-count');
      const previewEl = document.getElementById('settings-admin-preview-text');
      const card = document.getElementById('settings-admin-chat-card');

      if (pill) {
        pill.style.display = count > 0 ? 'inline-block' : 'none';
        pill.innerText = count === 1 ? '1 NOVA MENSAGEM' : `${count} NOVAS MENSAGENS`;
      }
      if (badgeCount) {
        badgeCount.style.display = count > 0 ? 'inline-block' : 'none';
        badgeCount.innerText = count;
      }
      if (card) {
        if (count > 0) card.classList.add('has-unread');
        else card.classList.remove('has-unread');
      }

      if (data.latestMessage) {
        if (previewEl) {
          const isDir = data.latestMessage.senderRole === 'admin';
          const sender = isDir ? 'Diretoria' : 'Você';
          previewEl.innerHTML = `<strong>${sender}:</strong> "${escapeHtmlReports(data.latestMessage.text)}"`;
        }
      }

      // If new unread messages arrived from admin, notify with audio chime & clickable toast!
      if (count > (state.lastAdminUnreadCount || 0) && count > 0) {
        playSound('newRide');
        const snippet = data.latestMessage && data.latestMessage.text 
          ? (data.latestMessage.text.length > 55 ? data.latestMessage.text.substring(0, 52) + '...' : data.latestMessage.text)
          : 'Nova mensagem da diretoria.';
        showToast(`🔔 Diretoria MAX DRIVE: "${snippet}"`, 'info', () => {
          openAdminChatModal();
        });
      }

      state.lastAdminUnreadCount = count;
    } catch (err) {
      // Non-blocking poll
    }
  }

  async function openAdminChatModal() {
    playSound('click');
    const modal = document.getElementById('modal-admin-chat');
    if (!modal) return;
    modal.classList.add('active');

    const user = state.currentUser || {};
    const isDriver = state.userRole === 'driver';
    const userId = user.id || (isDriver ? 'usr-drv-1' : 'usr-pass-1');

    // Mark messages as read immediately
    try {
      await fetch('/api/admin-messages/read', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: state.userRole })
      });
      state.lastAdminUnreadCount = 0;
      document.querySelectorAll('.nav-notification-dot').forEach(d => { d.style.display = 'none'; });
      const pill = document.getElementById('settings-admin-unread-pill');
      if (pill) pill.style.display = 'none';
      const badgeCount = document.getElementById('settings-chat-badge-count');
      if (badgeCount) badgeCount.style.display = 'none';
      const card = document.getElementById('settings-admin-chat-card');
      if (card) card.classList.remove('has-unread');
    } catch (e) {}

    loadAdminChatMessages();

    if (state.adminChatPollInterval) clearInterval(state.adminChatPollInterval);
    state.adminChatPollInterval = setInterval(() => {
      if (modal.classList.contains('active')) {
        loadAdminChatMessages(true);
      } else {
        clearInterval(state.adminChatPollInterval);
        state.adminChatPollInterval = null;
      }
    }, 2500);

    const input = document.getElementById('admin-chat-input-text');
    if (input) setTimeout(() => input.focus(), 150);
  }

  function closeAdminChatModal() {
    playSound('click');
    const modal = document.getElementById('modal-admin-chat');
    if (modal) modal.classList.remove('active');
    if (state.adminChatPollInterval) {
      clearInterval(state.adminChatPollInterval);
      state.adminChatPollInterval = null;
    }
  }

  function fillAdminQuickMessage(text) {
    playSound('click');
    const input = document.getElementById('admin-chat-input-text');
    if (input) {
      input.value = text;
      input.focus();
    }
  }

  async function handleSendAdminChatMessage(e) {
    if (e) e.preventDefault();
    const input = document.getElementById('admin-chat-input-text');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;

    const user = state.currentUser || {};
    const isDriver = state.userRole === 'driver';
    const fallbackId = isDriver ? 'usr-drv-1' : 'usr-pass-1';
    const fallbackName = isDriver ? 'MARCOS MARQUES' : 'JULIANO MARTINS';

    const senderId = user.id || fallbackId;
    const senderName = user.name || fallbackName;
    const senderRole = state.userRole;

    input.value = '';

    try {
      const res = await fetch('/api/admin-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId,
          senderRole,
          senderName,
          recipientId: 'admin',
          recipientRole: 'admin',
          recipientName: 'Diretoria MAX DRIVE',
          text
        })
      });

      if (res.ok) {
        playSound('click');
        loadAdminChatMessages(true);
        const previewEl = document.getElementById('settings-admin-preview-text');
        if (previewEl) {
          previewEl.innerHTML = `<strong>Você:</strong> "${escapeHtmlReports(text)}"`;
        }
      } else {
        showToast('Erro ao enviar mensagem à diretoria', 'error');
      }
    } catch (err) {
      showToast('Erro de conexão ao enviar mensagem', 'error');
    }
  }

  async function loadAdminChatMessages(silent = false) {
    const container = document.getElementById('admin-chat-messages-container');
    if (!container) return;

    const user = state.currentUser || {};
    const isDriver = state.userRole === 'driver';
    const userId = user.id || (isDriver ? 'usr-drv-1' : 'usr-pass-1');

    try {
      const res = await fetch(`/api/admin-messages?userId=${encodeURIComponent(userId)}`);
      if (!res.ok) throw new Error('Falha ao carregar');
      const data = await res.json();
      const messages = data.messages || [];

      if (messages.length === 0) {
        container.innerHTML = `
          <div style="text-align: center; color: #94A3B8; font-size: 11px; padding: 25px 10px;">
            <img src="assets/icons/shield.svg" alt="" class="svg-icon-img lg" style="display: block; margin: 0 auto 8px auto; opacity: 0.4;">
            Nenhuma mensagem ainda. Inicie sua conversa com a diretoria da MAX DRIVE ou relate qualquer problema abaixo.
          </div>
        `;
        return;
      }

      const html = messages.map(msg => {
        const isAdmin = msg.senderRole === 'admin';
        const bubbleClass = isAdmin ? 'chat-bubble admin-msg' : 'chat-bubble user-msg';
        const senderLabel = isAdmin ? 'DIRETORIA MAX DRIVE' : 'VOCÊ';
        const timeStr = msg.timestamp || (msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '');

        return `
          <div class="${bubbleClass}">
            <div class="chat-bubble-sender" style="${!isAdmin ? 'color: #000; opacity: 0.75;' : ''}">
              ${isAdmin ? '<img src="assets/icons/shield.svg" alt="" style="width: 10px; height: 10px; filter: brightness(0) invert(1);">' : ''}
              ${senderLabel}
            </div>
            <div style="word-break: break-word;">${escapeHtmlReports(msg.text)}</div>
            <div class="chat-bubble-time" style="${!isAdmin ? 'color: #000; opacity: 0.6;' : ''}">${timeStr}</div>
          </div>
        `;
      }).join('');

      const wasScrolledBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 60;
      container.innerHTML = html;
      if (!silent || wasScrolledBottom) {
        container.scrollTop = container.scrollHeight;
      }
    } catch (err) {
      if (!silent) {
        container.innerHTML = `<div style="text-align: center; color: #EF4444; font-size: 11px; padding: 20px;">Erro ao carregar mensagens. Tente novamente.</div>`;
      }
    }
  }

  function openContactAdminModal() {
    openAdminChatModal();
  }

  function closeContactAdminModal() {
    closeAdminChatModal();
  }

  async function submitContactAdmin() {
    const msgInput = document.getElementById('contact-admin-message');
    if (!msgInput || !msgInput.value.trim()) {
      showToast('Por favor, digite sua mensagem para a diretoria');
      return;
    }

    try {
      const isDriver = state.userRole === 'driver';
      const fallbackId = isDriver ? 'usr-drv-1' : 'usr-pass-1';
      const fallbackName = isDriver ? 'MARCOS MARQUES' : 'JULIANO MARTINS';

      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reporterId: state.currentUser ? state.currentUser.id : fallbackId,
          reporterName: state.currentUser ? state.currentUser.name : fallbackName,
          reporterRole: state.userRole,
          targetName: 'Diretoria MAX DRIVE',
          rideId: '',
          category: 'Mensagem à Diretoria',
          reason: msgInput.value.trim()
        })
      });

      if (res.ok) {
        playSound('success');
        showToast('Mensagem enviada com sucesso à diretoria MAX DRIVE!');
        msgInput.value = '';
        closeContactAdminModal();
        loadUserReports();
      } else {
        showToast('Erro ao enviar mensagem à diretoria');
      }
    } catch (e) {
      showToast('Erro de conexão ao enviar mensagem');
    }
  }

  // =========================================================
  // USER SOLICITATIONS & REPORTS MODULE (PARECER DA DIRETORIA)
  // =========================================================
  function formatReportDate(isoString) {
    if (!isoString) return '--';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');
      return `${day}/${month}/${year} às ${hours}:${mins}`;
    } catch (e) {
      return isoString;
    }
  }

  function escapeHtmlReports(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  async function loadUserReports(showFeedback = false) {
    const listEl = document.getElementById('user-reports-list');
    if (!listEl) return;

    try {
      const user = state.currentUser || {};
      const fallbackId = state.userRole === 'driver' ? 'usr-drv-1' : 'usr-pass-1';
      const userId = user.id || fallbackId;
      const userName = user.name || (state.userRole === 'driver' ? 'MARCOS MARQUES' : 'JULIANO MARTINS');

      const url = `/api/reports?reporterId=${encodeURIComponent(userId)}&reporterName=${encodeURIComponent(userName)}&role=${encodeURIComponent(state.userRole)}`;
      const res = await fetch(url, {
        headers: {
          'x-user-id': userId,
          'x-user-role': state.userRole
        }
      });

      if (res.ok) {
        const data = await res.json();
        const prevReports = state.userReports || [];
        const newReports = data.reports || [];
        state.userReports = newReports;

        // Check if any report received a new admin response
        const prevResolved = prevReports.filter(r => r.status === 'Resolvido' || (r.adminResponse && r.adminResponse.trim().length > 0)).length;
        const newResolved = newReports.filter(r => r.status === 'Resolvido' || (r.adminResponse && r.adminResponse.trim().length > 0)).length;

        if (newResolved > prevResolved && prevReports.length > 0 && !showFeedback) {
          playSound('success');
          showToast('A diretoria analisou sua solicitação! Acesse Configurações para ver o parecer.', 'info');
        }

        updateReportsBadges();
        renderUserReportsList();

        if (showFeedback) {
          playSound('success');
          showToast('Solicitações e pareceres atualizados com sucesso!');
        }
      } else {
        listEl.innerHTML = '<div class="user-reports-empty"><img src="assets/icons/alert-triangle.svg" class="svg-icon-img sm" style="vertical-align: -2px; margin-right: 4px;"> Não foi possível carregar as solicitações no momento.</div>';
      }
    } catch (err) {
      console.warn('Erro ao carregar solicitações do usuário:', err);
      if (listEl) {
        listEl.innerHTML = '<div class="user-reports-empty"><img src="assets/icons/alert-triangle.svg" class="svg-icon-img sm" style="vertical-align: -2px; margin-right: 4px;"> Erro de conexão ao buscar solicitações.</div>';
      }
    }
  }

  function updateReportsBadges() {
    const reports = state.userReports || [];
    const totalCount = reports.length;
    const resolvedCount = reports.filter(r => r.status === 'Resolvido' || (r.adminResponse && r.adminResponse.trim().length > 0)).length;
    const pendingCount = reports.filter(r => r.status !== 'Resolvido' && (!r.adminResponse || !r.adminResponse.trim().length)).length;

    const countAllEl = document.getElementById('count-rep-all');
    const countResolvedEl = document.getElementById('count-rep-resolved');
    const countPendingEl = document.getElementById('count-rep-pending');
    const badgeEl = document.getElementById('user-reports-badge');

    if (countAllEl) countAllEl.innerText = totalCount;
    if (countResolvedEl) countResolvedEl.innerText = resolvedCount;
    if (countPendingEl) countPendingEl.innerText = pendingCount;

    if (badgeEl) {
      badgeEl.innerText = totalCount;
      if (resolvedCount > 0) {
        badgeEl.classList.add('has-resolved');
        badgeEl.title = `${resolvedCount} solicitações com parecer oficial da diretoria!`;
      } else {
        badgeEl.classList.remove('has-resolved');
      }
    }
  }

  function filterUserReports(filter) {
    playSound('click');
    state.currentReportsFilter = filter;

    document.querySelectorAll('.solicitation-tab').forEach(t => t.classList.remove('active'));
    const activeTab = document.getElementById('tab-rep-' + filter);
    if (activeTab) activeTab.classList.add('active');

    renderUserReportsList();
  }

  function renderUserReportsList() {
    const listEl = document.getElementById('user-reports-list');
    if (!listEl) return;

    const allReports = state.userReports || [];
    const filter = state.currentReportsFilter || 'all';

    let filtered = allReports;
    if (filter === 'resolved') {
      filtered = allReports.filter(r => r.status === 'Resolvido' || (r.adminResponse && r.adminResponse.trim().length > 0));
    } else if (filter === 'pending') {
      filtered = allReports.filter(r => r.status !== 'Resolvido' && (!r.adminResponse || !r.adminResponse.trim().length));
    }

    if (filtered.length === 0) {
      const msg = filter === 'resolved' 
        ? 'Nenhuma solicitação com parecer oficial ainda.' 
        : (filter === 'pending' ? 'Nenhuma solicitação em análise no momento.' : 'Nenhuma solicitação enviada ainda. Suas mensagens e reportes à diretoria aparecerão aqui com o parecer oficial.');
      listEl.innerHTML = `<div class="user-reports-empty"><span style="display: block; margin-bottom: 8px;"><img src="assets/icons/file-text.svg" alt="" class="svg-icon-img xl"></span>${msg}</div>`;
      return;
    }

    let html = '';
    filtered.forEach(rep => {
      const hasResponse = !!(rep.adminResponse && rep.adminResponse.trim().length > 0);
      const isResolved = rep.status === 'Resolvido' || hasResponse;
      const statusClass = isResolved ? 'resolved' : 'pending';
      const statusText = isResolved ? '<img src="assets/icons/check-circle.svg" class="svg-icon-img sm" style="vertical-align: -2px; margin-right: 3px;"> RESPONDIDO' : '<img src="assets/icons/clock.svg" class="svg-icon-img sm" style="vertical-align: -2px; margin-right: 3px;"> EM ANÁLISE';
      const protocol = rep.id ? rep.id.toUpperCase() : 'REP-MAX';
      const formattedDate = formatReportDate(rep.createdAt);
      const category = rep.category || 'Incidente / Mensagem';

      html += `
        <div class="user-report-card ${statusClass}">
          <div class="report-card-top">
            <div>
              <span class="report-category-tag">${escapeHtmlReports(category)}</span>
              <div class="report-date-tag">Protocolo #${protocol} • ${formattedDate}</div>
            </div>
            <span class="report-status-pill ${statusClass}" style="display: inline-flex; align-items: center;">${statusText}</span>
          </div>

          <div class="report-user-reason-box">
            <div class="report-reason-label">Sua Mensagem / Ocorrido:</div>
            <div class="report-reason-content">${escapeHtmlReports(rep.reason)}</div>
            ${rep.rideId ? `<div style="font-size: 10px; color: #00E5FF; margin-top: 4px; font-weight: 700; display: inline-flex; align-items: center;"><img src="assets/icons/car.svg" class="svg-icon-img sm" style="vertical-align: -2px; margin-right: 3px;"> Corrida Ref: ${escapeHtmlReports(rep.rideId)}</div>` : ''}
          </div>

          ${hasResponse ? `
            <div class="report-admin-response-box has-response">
              <div class="report-admin-header" style="display: flex; align-items: center;">
                <span><img src="assets/icons/shield.svg" class="svg-icon-img sm" style="vertical-align: -2px; margin-right: 4px;"></span> PARECER OFICIAL DA DIRETORIA MAX DRIVE:
              </div>
              <div class="report-admin-text">${escapeHtmlReports(rep.adminResponse)}</div>
              <div class="report-admin-meta">
                ${rep.resolvedAt ? 'Análise concluída em: ' + formatReportDate(rep.resolvedAt) : 'Analisado e finalizado pela administração'}
              </div>
            </div>
          ` : `
            <div class="report-admin-response-box waiting-response">
              <div class="report-admin-header" style="color: #FEE500; display: flex; align-items: center;">
                <span><img src="assets/icons/clock.svg" class="svg-icon-img sm" style="vertical-align: -2px; margin-right: 4px;"></span> AGUARDANDO ANÁLISE DA DIRETORIA:
              </div>
              <div style="font-size: 11px; color: #e2e8f0; line-height: 1.4;">
                Sua solicitação está sendo avaliada pelo time administrativo. O resultado e as providências tomadas serão publicados diretamente aqui.
              </div>
            </div>
          `}
        </div>
      `;
    });

    listEl.innerHTML = html;
  }

  // Driver Weekly Payment: Copy Pix Key
  function copyPixKey() {
    playSound('click');
    const pixKey = '34999994077';
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(pixKey).then(() => {
        playSound('success');
        showToast('Chave Pix copiada com sucesso! Cole no aplicativo do seu banco.');
      }).catch(() => fallbackCopy(pixKey));
    } else {
      fallbackCopy(pixKey);
    }
  }

  function fallbackCopy(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      playSound('success');
      showToast('Chave Pix copiada com sucesso! Cole no aplicativo do seu banco.');
    } catch (err) {
      showToast('Chave Pix: 3499999-4077');
    }
    document.body.removeChild(textArea);
  }

  // Automatic Input Masks (CPF, Phone, Vehicle Plate)
  function formatPhone(val) {
    const digits = (val || '').replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits.length ? `(${digits}` : '';
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  }

  function formatCPF(val) {
    const digits = (val || '').replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
  }

  function formatPlate(val) {
    let clean = (val || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);
    if (clean.length > 3) {
      // Check if 5th char is number (Traditional ABC-1234) or letter (Mercosul ABC1D23)
      const isMercosul = clean.length >= 5 && isNaN(clean[4]);
      if (isMercosul) {
        return clean;
      } else {
        return `${clean.slice(0, 3)}-${clean.slice(3)}`;
      }
    }
    return clean;
  }

  function setupInputMasks() {
    ['reg-phone', 'prof-phone'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', (e) => {
          e.target.value = formatPhone(e.target.value);
        });
      }
    });

    ['reg-cpf', 'prof-cpf'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', (e) => {
          e.target.value = formatCPF(e.target.value);
        });
      }
    });

    ['prof-veh-plate'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', (e) => {
          e.target.value = formatPlate(e.target.value);
        });
      }
    });
  }

  // Driver Weekly Payment: WhatsApp Comprovante
  function sendPaymentReceiptWhatsApp() {
    playSound('click');
    const user = state.currentUser || {};
    const driverName = user.name || 'Marcos Marques';
    const isMoto = (user.vehicle && user.vehicle.type === 'moto') || state.vehicleType === 'moto';
    const vehicleType = isMoto ? 'Moto' : 'Carro';
    const plate = user.vehicle ? (user.vehicle.plate || 'ABC-1234') : 'ABC-1234';
    const feeStr = isMoto ? 'R$ 50,00' : 'R$ 100,00';

    // Calculate current week sunday
    const d = new Date();
    const day = d.getDay();
    const diffToSunday = day === 0 ? 0 : 7 - day;
    const sunday = new Date(d);
    sunday.setDate(d.getDate() + diffToSunday);
    const pad = n => String(n).padStart(2, '0');
    const sundayStr = `${pad(sunday.getDate())}/${pad(sunday.getMonth() + 1)}/${sunday.getFullYear()}`;

    const text = `Olá! Sou o motorista ${driverName} (${vehicleType} - Placa ${plate}). Segue meu comprovante de pagamento semanal da MAX DRIVE no valor de ${feeStr}, válido para a semana até domingo ${sundayStr}.`;

    const url = `https://wa.me/5534999994077?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  }

  // Load Weekly Payment Status for Driver
  async function loadDriverWeeklyPaymentStatus() {
    try {
      const driverId = state.currentUser ? state.currentUser.id : 'usr-drv-1';
      const res = await fetch(`/api/payments/my-status?driverId=${driverId}`);
      if (!res.ok) return;
      const data = await res.json();
      if (!data.success) return;

      const banner = document.getElementById('driver-payment-weekly-row');
      const statusDisplay = document.getElementById('driver-weekly-status-display');
      if (banner) {
        banner.style.display = state.userRole === 'driver' ? 'block' : 'none';
      }

      if (statusDisplay) {
        statusDisplay.innerText = data.statusText;
        statusDisplay.className = 'pw-status-value';
        if (data.status === 'REGULAR') {
          statusDisplay.classList.add('regular');
        } else if (data.status === 'PASSE_GRATIS') {
          statusDisplay.classList.add('free');
        } else if (data.status === 'BLOQUEADO') {
          statusDisplay.classList.add('blocked');
        } else {
          statusDisplay.classList.add('pending');
        }
      }

      const statusBox = document.getElementById('settings-status-box');
      if (statusBox) {
        if (data.isBlocked || data.status === 'PENDENTE' || data.status === 'BLOQUEADO') {
          statusBox.innerHTML = `<span style="color: #FF3B30; font-weight: 800;"><img src="assets/icons/alert-triangle.svg" class="svg-icon-img sm" style="vertical-align: -2px; margin-right: 3px;"> ATENÇÃO:</span> Acesso suspenso por pendência no pagamento semanal. O ciclo semanal inicia na segunda-feira e encerra no domingo. Realize o Pix de R$ ${data.weeklyAmount.toFixed(2).replace('.', ',')} para a chave <b>3499999-4077</b> e clique em "ENVIAR COMPROVANTE" para liberação imediata.`;
          statusBox.style.borderColor = 'rgba(255, 59, 48, 0.5)';
        } else {
          statusBox.innerText = 'Conta em situação regular. Nenhuma infração ou restrição ativa no momento. Todas as permissões habilitadas pela administração da MAX DRIVE.';
          statusBox.style.borderColor = 'rgba(0, 229, 255, 0.2)';
        }
      }
    } catch (e) {
      console.warn('Erro ao carregar status de pagamento semanal:', e);
    }
  }

  // Status Toggle
  async function handleStatusToggle(isActive) {
    if (isActive) {
      if (state.userRole === 'driver') {
        try {
          const driverId = state.currentUser ? state.currentUser.id : 'usr-drv-1';
          const res = await fetch(`/api/payments/my-status?driverId=${driverId}`);
          const data = await res.json();
          if (data && data.isBlocked) {
            playSound('offline');
            showToast('Acesso bloqueado por falta de pagamento semanal. Regularize via Pix para ficar online.', 'warning');
            const toggle = document.getElementById('toggle-account-status');
            if (toggle) toggle.checked = false;
            return;
          }
        } catch (e) {}
      }
      playSound('online');
      showToast('Conta Ativa / Online');
    } else {
      playSound('offline');
      showToast('Conta Inativa / Modo Offline');
    }
  }

  // Image Compression & Processing via Canvas
  function processImageFile(file, maxWidth = 900, maxHeight = 900, quality = 0.75) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith('image/')) {
        return reject(new Error('Arquivo não é uma imagem válida'));
      }
      const reader = new FileReader();
      reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
          let width = img.width;
          let height = img.height;

          if (width > maxWidth || height > maxHeight) {
            if (width > height) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            } else {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedDataUrl);
        };
        img.onerror = () => reject(new Error('Erro ao carregar imagem'));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
      reader.readAsDataURL(file);
    });
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
      reader.readAsDataURL(file);
    });
  }

  async function handleAvatarFileSelect(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      showToast('Processando foto de perfil...');
      const dataUrl = await processImageFile(file, 400, 400, 0.8);
      renderAvatarPreview(dataUrl, state.currentUser ? state.currentUser.name : '');
      if (state.currentUser) {
        state.currentUser.avatar = dataUrl;
        saveUserSession(state.currentUser);
      }
      playSound('success');
      showToast('Foto de perfil atualizada! Clique em "Salvar Dados" para sincronizar.', 'success');
    } catch (err) {
      showToast('Erro ao carregar foto: ' + err.message, 'error');
    }
  }

  function renderAvatarPreview(dataUrl, name = '') {
    const imgEl = document.getElementById('profile-photo-img');
    const txtEl = document.getElementById('profile-photo-text');
    if (imgEl && dataUrl && typeof dataUrl === 'string' && dataUrl.trim() !== '' && !dataUrl.includes('avatar.jpg') && !dataUrl.includes('avatar.png')) {
      imgEl.src = dataUrl;
      imgEl.style.display = 'block';
      if (txtEl) txtEl.style.display = 'none';
    } else {
      if (imgEl) {
        imgEl.src = '';
        imgEl.style.display = 'none';
      }
      if (txtEl) {
        txtEl.style.display = 'block';
        const initials = name ? getInitialsFromName(name, 'FOTO') : 'FOTO';
        txtEl.innerText = initials;
      }
    }
  }

  async function handleVehiclePhotoSelect(e, photoKey) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      let dataUrl;
      if (isPdf) {
        showToast('Processando documento PDF...');
        dataUrl = await readFileAsDataUrl(file);
      } else {
        showToast('Processando foto do documento/veículo...');
        dataUrl = await processImageFile(file, 1000, 1000, 0.75);
      }
      renderVehiclePhotoPreview(photoKey, dataUrl, file.name);

      if (state.currentUser) {
        state.currentUser.vehicle = state.currentUser.vehicle || {};
        state.currentUser.vehicle.photos = state.currentUser.vehicle.photos || {};
        state.currentUser.vehicle.photos[photoKey] = dataUrl;
        saveUserSession(state.currentUser);
      }
      playSound('success');
      showToast(isPdf ? 'Documento PDF anexado! Clique em "Salvar Dados" para enviar.' : 'Foto anexada! Clique em "Salvar Dados" para enviar à administração.', 'success');
    } catch (err) {
      showToast('Erro ao carregar arquivo: ' + err.message, 'error');
    }
  }

  function renderVehiclePhotoPreview(photoKey, dataUrl, originalName) {
    const previewEl = document.getElementById(`preview-veh-photo-${photoKey}`);
    const placeholderEl = document.getElementById(`placeholder-veh-photo-${photoKey}`);
    const badgeEl = document.getElementById(`badge-veh-photo-${photoKey}`);
    const pdfBadgeEl = document.getElementById(`pdf-badge-veh-photo-${photoKey}`);
    const pdfNameEl = document.getElementById(`pdf-name-${photoKey}`);

    const isPdf = dataUrl && (dataUrl.startsWith('data:application/pdf') || (originalName && originalName.toLowerCase().endsWith('.pdf')));

    if (isPdf) {
      if (previewEl) previewEl.style.display = 'none';
      if (placeholderEl) placeholderEl.style.display = 'none';
      if (pdfBadgeEl) {
        pdfBadgeEl.style.display = 'flex';
        if (pdfNameEl && originalName) {
          pdfNameEl.innerText = originalName.length > 18 ? originalName.substring(0, 15) + '...' : originalName;
        }
      }
      if (badgeEl) {
        badgeEl.className = 'driver-photo-badge uploaded';
        badgeEl.innerHTML = '<img src="assets/icons/check-circle.svg" class="svg-icon-img sm" style="vertical-align: -2px; margin-right: 3px;"> PDF Anexado';
      }
    } else if (previewEl && dataUrl) {
      if (pdfBadgeEl) pdfBadgeEl.style.display = 'none';
      previewEl.src = dataUrl;
      previewEl.style.display = 'block';
      if (placeholderEl) placeholderEl.style.display = 'none';
      if (badgeEl) {
        badgeEl.className = 'driver-photo-badge uploaded';
        badgeEl.innerHTML = '<img src="assets/icons/check-circle.svg" class="svg-icon-img sm" style="vertical-align: -2px; margin-right: 3px;"> Enviada';
      }
    } else {
      if (previewEl) previewEl.style.display = 'none';
      if (pdfBadgeEl) pdfBadgeEl.style.display = 'none';
      if (placeholderEl) placeholderEl.style.display = 'flex';
      if (badgeEl) {
        badgeEl.className = 'driver-photo-badge pending';
        badgeEl.innerText = 'Pendente';
      }
    }
  }

  // Profile Save
  async function handleProfileSave(e) {
    if (e) e.preventDefault();
    playSound('success');
    const nameInput = document.getElementById('prof-name');
    const birthInput = document.getElementById('prof-birth');
    const cpfInput = document.getElementById('prof-cpf');
    const phoneInput = document.getElementById('prof-phone');
    const emailInput = document.getElementById('prof-email');
    const cnhInput = document.getElementById('prof-cnh');
    const cnhMsgInput = document.getElementById('prof-cnh-message');
    const docMsgInput = document.getElementById('prof-doc-message');
    const modelInput = document.getElementById('prof-veh-model');
    const plateInput = document.getElementById('prof-veh-plate');
    const colorInput = document.getElementById('prof-veh-color');
    const yearInput = document.getElementById('prof-veh-year');

    if (state.currentUser) {
      if (nameInput && nameInput.value.trim()) state.currentUser.name = nameInput.value.trim().toUpperCase();
      if (birthInput && birthInput.value.trim()) state.currentUser.birthDate = birthInput.value.trim();
      if (cpfInput && cpfInput.value.trim()) state.currentUser.cpf = cpfInput.value.trim();
      if (phoneInput && phoneInput.value.trim()) state.currentUser.phone = phoneInput.value.trim();
      if (emailInput && emailInput.value.trim()) state.currentUser.email = emailInput.value.trim().toLowerCase();
      if (cnhInput && cnhInput.value.trim()) state.currentUser.cnh = cnhInput.value.trim();
      if (cnhMsgInput) state.currentUser.cnhMessage = cnhMsgInput.value.trim();
      if (docMsgInput) state.currentUser.docMessage = docMsgInput.value.trim();

      if (state.userRole === 'driver') {
        state.currentUser.vehicle = state.currentUser.vehicle || {};
        state.currentUser.vehicle.type = state.vehicleType || 'car';
        if (modelInput && modelInput.value.trim()) state.currentUser.vehicle.model = modelInput.value.trim().toUpperCase();
        if (plateInput && plateInput.value.trim()) state.currentUser.vehicle.plate = plateInput.value.trim().toUpperCase();
        if (colorInput && colorInput.value.trim()) state.currentUser.vehicle.color = colorInput.value.trim();
        if (yearInput && yearInput.value.trim()) state.currentUser.vehicle.year = yearInput.value.trim();
        if (cnhMsgInput) state.currentUser.vehicle.cnhMessage = cnhMsgInput.value.trim();
        if (docMsgInput) state.currentUser.vehicle.docMessage = docMsgInput.value.trim();
      }

      saveUserSession(state.currentUser);

      try {
        await fetch('/api/auth/profile', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-User-Id': state.currentUser.id
          },
          body: JSON.stringify({
            id: state.currentUser.id,
            name: state.currentUser.name,
            birthDate: state.currentUser.birthDate,
            cpf: state.currentUser.cpf,
            phone: state.currentUser.phone,
            email: state.currentUser.email,
            cnh: state.currentUser.cnh,
            cnhMessage: state.currentUser.cnhMessage || '',
            docMessage: state.currentUser.docMessage || '',
            avatar: state.currentUser.avatar || '',
            vehicle: state.currentUser.vehicle || {}
          })
        });
      } catch (err) {
        console.warn('Erro ao sincronizar perfil no servidor:', err);
      }
    }
    updateDriverSettingsStats();
    showToast('Dados e documentos salvos com sucesso! A administração avaliará seu cadastro.');
  }

  function selectVehicleType(type) {
    state.vehicleType = type;
    const btnCar = document.getElementById('btn-veh-car');
    const btnMoto = document.getElementById('btn-veh-moto');
    if (btnCar && btnMoto) {
      btnCar.className = type === 'car' ? 'btn-pill btn-cyan' : 'btn-pill btn-white';
      btnMoto.className = type === 'moto' ? 'btn-pill btn-cyan' : 'btn-pill btn-white';
    }
    if (state.currentUser) {
      state.currentUser.vehicle = state.currentUser.vehicle || {};
      state.currentUser.vehicle.type = type;
      saveUserSession(state.currentUser);
    }
    updateDriverSettingsStats();
  }

  function changePhoto() {
    const input = document.getElementById('input-driver-avatar');
    if (input) input.click();
  }

  function openForgotPasswordModal() {
    playSound('click');
    const modal = document.getElementById('modal-forgot-password');
    if (!modal) return;
    const loginEmail = document.getElementById('login-email');
    const forgotEmail = document.getElementById('forgot-email');
    if (loginEmail && forgotEmail && loginEmail.value) {
      forgotEmail.value = loginEmail.value.trim();
    }
    const forgotCode = document.getElementById('forgot-code');
    if (forgotCode) forgotCode.value = '';
    const newPass = document.getElementById('forgot-new-password');
    if (newPass) newPass.value = '';
    const confPass = document.getElementById('forgot-confirm-password');
    if (confPass) confPass.value = '';
    modal.classList.add('active');
    modal.style.display = 'flex';
  }

  function closeForgotPasswordModal() {
    playSound('click');
    const modal = document.getElementById('modal-forgot-password');
    if (modal) {
      modal.classList.remove('active');
      modal.style.display = 'none';
    }
  }

  function forgotPassword() {
    openForgotPasswordModal();
  }

  async function handleResetPassword(e) {
    if (e) e.preventDefault();
    playSound('click');

    const email = document.getElementById('forgot-email').value.trim();
    const securityCode = document.getElementById('forgot-code').value.trim();
    const newPassword = document.getElementById('forgot-new-password').value;
    const confirmPassword = document.getElementById('forgot-confirm-password').value;

    if (!email || !securityCode || !newPassword) {
      showToast('Preencha todos os campos obrigatórios');
      return;
    }

    if (securityCode.length !== 6) {
      showToast('O código de segurança deve conter exatamente 6 dígitos');
      return;
    }

    if (newPassword.length < 4) {
      showToast('A nova senha deve ter no mínimo 4 caracteres');
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast('As senhas digitadas não coincidem');
      return;
    }

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, securityCode, newPassword })
      });

      const data = await res.json();
      if (!res.ok) {
        playSound('cancel');
        showToast(data.message || 'Erro ao redefinir senha');
        return;
      }

      playSound('success');
      closeForgotPasswordModal();

      // Pre-fill login credentials so user can log in immediately
      const loginEmail = document.getElementById('login-email');
      const loginPassword = document.getElementById('login-password');
      if (loginEmail) loginEmail.value = email;
      if (loginPassword) {
        loginPassword.value = newPassword;
        loginPassword.focus();
      }

      showDialog({
        title: 'SENHA REDEFINIDA',
        message: 'Sua senha foi redefinida com sucesso!\n\nSeus dados de acesso foram preenchidos na tela de login.',
        type: 'alert',
        confirmText: 'ENTRAR AGORA',
        onConfirm: () => {
          goToScreen('screen-login');
        }
      });
    } catch (err) {
      console.error(err);
      showToast('Erro ao conectar ao servidor');
    }
  }

  function openAdminPanel() {
    if (state.currentUser && (state.currentUser.isAdmin || state.currentUser.role === 'admin')) {
      try {
        localStorage.setItem('maxdrive_admin_email', state.currentUser.email);
      } catch (_) {}
    }
    const isCapacitorNative = !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform()) ||
                             window.location.protocol === 'file:' ||
                             window.location.protocol === 'capacitor:';

    let adminBase = (window.MAXDRIVE_CONFIG && window.MAXDRIVE_CONFIG.API_BASE) || '';
    if (!adminBase || isCapacitorNative) {
      adminBase = (window.MAXDRIVE_CONFIG && window.MAXDRIVE_CONFIG.API_BASE) || 'https://maxdrive-9us2.onrender.com';
    }
    adminBase = adminBase.replace(/\/+$/, '');
    const adminUrl = adminBase ? `${adminBase}/admin.html` : '/admin.html';

    if (isCapacitorNative) {
      try {
        window.open(adminUrl, '_system');
        return;
      } catch (_) {}
    }
    window.open(adminUrl, '_blank');
  }

  async function logout(force = false) {
    if (force === true) {
      executeLogout();
      return;
    }
    const confirmed = await showDialog({
      title: 'SAIR DA CONTA',
      message: 'Deseja realmente desconectar e sair da sua conta?',
      type: 'confirm',
      confirmText: 'SAIR',
      cancelText: 'CANCELAR'
    });
    if (confirmed) {
      executeLogout();
    }
  }

  function executeLogout() {
    playSound('offline');
    try {
      if (state.currentUser && state.currentUser.id && state.sessionToken) {
        fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': state.currentUser.id,
            'x-session-token': state.sessionToken
          },
          body: JSON.stringify({
            userId: state.currentUser.id,
            sessionToken: state.sessionToken
          })
        }).catch(() => {});
      }
    } catch (_) {}

    state.currentUser = null;
    state.sessionToken = null;
    clearUserSession();
    clearActiveRideState();
    stopWaitingPoll();

    const loginPass = document.getElementById('login-password');
    if (loginPass) loginPass.value = '';

    updateAdminBadgeVisibility();
    showToast('Você saiu da sua conta com sucesso', 'info');
    goToScreen('screen-login');
  }

  function toggleMapView() {
    openWazeNavigation();
  }

  function focusRadarRide(rideId) {
    playSound('click');
    showToast(`Chamada selecionada: ${rideId}. Toque em "ACEITAR CORRIDA" para iniciar.`);
  }

  function updateRoleNavVisibility() {
    const isDriver = state.userRole === 'driver';
    const drvNavItems = document.querySelectorAll('.driver-only-nav, .nav-item-finances');
    drvNavItems.forEach(el => {
      el.style.display = isDriver ? 'flex' : 'none';
    });
    if (document.body) {
      document.body.classList.toggle('role-driver', isDriver);
      document.body.classList.toggle('role-passenger', !isDriver);
    }
  }

  function updateProfileView() {
    updateRoleNavVisibility();
    const drvExtra = document.getElementById('driver-profile-extra-fields');
    const drvStats = document.getElementById('driver-settings-stats');
    const drvPayment = document.getElementById('driver-payment-weekly-row');
    const isDriver = state.userRole === 'driver';

    if (drvExtra) drvExtra.style.display = isDriver ? 'block' : 'none';
    if (drvStats) drvStats.style.display = isDriver ? 'grid' : 'none';
    if (drvPayment) drvPayment.style.display = isDriver ? 'block' : 'none';

    if (isDriver) {
      updateDriverSettingsStats();
    }
  }

  function populateUserData(user) {
    if (!user) return;
    const nameInput = document.getElementById('prof-name');
    const birthInput = document.getElementById('prof-birth');
    const cpfInput = document.getElementById('prof-cpf');
    const phoneInput = document.getElementById('prof-phone');
    const emailInput = document.getElementById('prof-email');
    const cnhInput = document.getElementById('prof-cnh');

    if (nameInput && user.name) nameInput.value = user.name;
    if (birthInput && user.birthDate) birthInput.value = user.birthDate;
    if (cpfInput && user.cpf) cpfInput.value = user.cpf;
    if (phoneInput && user.phone) phoneInput.value = user.phone;
    if (emailInput && user.email) emailInput.value = user.email;
    if (cnhInput && user.cnh) cnhInput.value = user.cnh;

    renderAvatarPreview(user.avatar, user.name);

    if (user.vehicle) {
      const modelInput = document.getElementById('prof-veh-model');
      const plateInput = document.getElementById('prof-veh-plate');
      const colorInput = document.getElementById('prof-veh-color');
      const yearInput = document.getElementById('prof-veh-year');
      if (modelInput && user.vehicle.model) modelInput.value = user.vehicle.model;
      if (plateInput && user.vehicle.plate) plateInput.value = user.vehicle.plate;
      if (colorInput && user.vehicle.color) colorInput.value = user.vehicle.color;
      if (yearInput && user.vehicle.year) yearInput.value = user.vehicle.year;
      if (user.vehicle.type) {
        selectVehicleType(user.vehicle.type);
      }

      // Restore vehicle and document photos
      const photos = user.vehicle.photos || {};
      ['front', 'side', 'rear', 'seats', 'cnh', 'doc'].forEach(key => {
        renderVehiclePhotoPreview(key, photos[key] || null);
      });

      const cnhMsgInput = document.getElementById('prof-cnh-message');
      const docMsgInput = document.getElementById('prof-doc-message');
      if (cnhMsgInput) {
        cnhMsgInput.value = user.cnhMessage || (user.vehicle && user.vehicle.cnhMessage) || '';
      }
      if (docMsgInput) {
        docMsgInput.value = user.docMessage || (user.vehicle && user.vehicle.docMessage) || '';
      }
    }
    updateDriverSettingsStats();
  }


  // Dynamic Driver Settings Stats (CORRIDAS, AVALIAÇÃO, REGISTRO, CONDUÇÃO)
  async function updateDriverSettingsStats() {
    const ridesEl = document.getElementById('stat-total-rides');
    const ratingEl = document.getElementById('stat-driver-rating');
    const regEl = document.getElementById('stat-reg-years');
    const vehEl = document.getElementById('stat-veh-type');
    const paymentEl = document.getElementById('stat-weekly-payment');
    const statusBox = document.getElementById('settings-status-box');

    // 1. Identify active driver user
    let driver = state.currentUser;
    if (!driver || driver.role !== 'driver') {
      try {
        const stored = localStorage.getItem('maxdrive_session');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && parsed.role === 'driver') driver = parsed;
        }
      } catch (e) {}
    }

    const driverId = (driver && driver.id) ? driver.id : 'usr-drv-1';

    // Helper: Fast render into DOM
    function renderStats(currentDriver, completedCount, activePassengerRatings) {
      const baseTotal = (currentDriver && typeof currentDriver.totalRides === 'number') ? currentDriver.totalRides : 2021;
      const baseRat = (currentDriver && typeof currentDriver.rating === 'number') ? currentDriver.rating : 4.9;
      const created = (currentDriver && currentDriver.createdAt) ? currentDriver.createdAt : '2024-03-01T08:00:00.000Z';
      const fallbackY = (currentDriver && currentDriver.registeredYears) ? currentDriver.registeredYears : 2;

      // 1. Corridas
      const totalRidesVal = Math.max(baseTotal, completedCount || 0);
      if (ridesEl) ridesEl.innerText = String(totalRidesVal);

      // 2. Avaliação
      let displayRat = Number(baseRat).toFixed(1);
      if (activePassengerRatings && activePassengerRatings.length > 0) {
        const sum = activePassengerRatings.reduce((a, b) => a + b, 0);
        const avg = sum / activePassengerRatings.length;
        if (currentDriver && currentDriver.ratingCount && currentDriver.ratingCount > 10) {
          displayRat = Number(currentDriver.rating || baseRat).toFixed(1);
        } else {
          displayRat = avg.toFixed(1);
        }
      }
      if (ratingEl) ratingEl.innerText = displayRat;

      // 3. Registro (dias / meses / anos registrado na plataforma)
      let regTxt = `${fallbackY} ${fallbackY === 1 ? 'ANO' : 'ANOS'}`;
      if (created) {
        const createdDate = new Date(created);
        if (!isNaN(createdDate.getTime())) {
          const now = new Date();
          const diffMs = Math.max(0, now.getTime() - createdDate.getTime());
          const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

          if (diffDays < 30) {
            const d = Math.max(1, diffDays);
            regTxt = `${d} ${d === 1 ? 'DIA' : 'DIAS'}`;
          } else if (diffDays < 365) {
            const months = Math.max(1, Math.floor(diffDays / 30.4375));
            regTxt = `${months} ${months === 1 ? 'MÊS' : 'MESES'}`;
          } else {
            const years = Math.max(1, Math.floor(diffDays / 365.25));
            regTxt = `${years} ${years === 1 ? 'ANO' : 'ANOS'}`;
          }
        }
      }
      if (regEl) regEl.innerText = regTxt;

      // 4. Condução (Tipo de condução: CARRO ou MOTO TÁXI)
      let isMoto = false;
      if (state.vehicleType === 'moto') {
        isMoto = true;
      } else if (currentDriver && currentDriver.vehicle && (currentDriver.vehicle.type === 'moto' || currentDriver.vehicle.type === 'moto táxi')) {
        isMoto = true;
      } else if (currentDriver && (currentDriver.vehicleType === 'moto' || currentDriver.vehicleType === 'moto táxi')) {
        isMoto = true;
      }
      if (vehEl) vehEl.innerText = isMoto ? 'MOTO TÁXI' : 'CARRO';

      // 5. Pagamento Semanal
      if (paymentEl && currentDriver) {
        const st = currentDriver.weeklyPaymentStatus || 'REGULAR';
        paymentEl.innerText = st === 'PASSE_GRATIS' ? '1 SEMANA GRÁTIS' : st;
        if (st === 'REGULAR' || st === 'PASSE_GRATIS') {
          paymentEl.style.color = '#00D04B';
        } else if (st === 'PENDENTE') {
          paymentEl.style.color = '#FFCC00';
        } else {
          paymentEl.style.color = '#FF3B30';
        }
      }

      // 6. Ban notice
      if (statusBox && currentDriver) {
        if (currentDriver.status === 'banned') {
          statusBox.innerText = `CONTA SUSPENSA: ${currentDriver.banReason || 'Violação das diretrizes da comunidade.'}`;
          statusBox.style.color = '#FF3B30';
        } else {
          statusBox.innerText = 'Conta em situação regular. Nenhuma infração ou restrição ativa no momento. Todas as permissões habilitadas pela administração da MAX DRIVE.';
          statusBox.style.color = '#1a1a1a';
        }
      }
    }

    // Step A: Fast immediate synchronous render
    renderStats(driver, 0, []);

    // Step B: Synchronize with server in background
    try {
      const userRes = await fetch(`/api/users/${driverId}`);
      if (userRes.ok) {
        const userData = await userRes.json();
        if (userData && userData.user) {
          driver = { ...(driver || {}), ...userData.user };
          if (state.currentUser && state.currentUser.id === driverId) {
            state.currentUser = driver;
            saveUserSession(driver);
          }
        }
      }
    } catch (err) {}

    let completedDriverRides = [];
    let passengerRatings = [];
    try {
      const ridesRes = await fetch('/api/rides');
      if (ridesRes.ok) {
        const ridesData = await ridesRes.json();
        const allRides = ridesData.rides || [];
        const driverName = (driver && driver.name) ? driver.name.toUpperCase() : 'MARCOS MARQUES';

        completedDriverRides = allRides.filter(r =>
          (r.status === 'completed' || r.status === 'finished') &&
          (r.driverId === driverId || (r.driverName && r.driverName.toUpperCase() === driverName))
        );

        completedDriverRides.forEach(r => {
          if (typeof r.passengerRatingGiven === 'number') {
            passengerRatings.push(r.passengerRatingGiven);
          } else if (r.ratedByPassenger && typeof r.rating === 'number') {
            passengerRatings.push(r.rating);
          }
        });
      }
    } catch (e) {}

    // Step C: Update with confirmed server & ride data
    renderStats(driver, completedDriverRides.length, passengerRatings);
  }

  function clearRouteInputs() {
    const origInput = document.getElementById('pass-origin');
    const origBairro = document.getElementById('pass-origin-bairro');
    const destInput = document.getElementById('pass-dest');
    const destBairro = document.getElementById('pass-dest-bairro');
    if (origInput) origInput.value = '';
    if (origBairro) origBairro.value = '';
    if (destInput) destInput.value = '';
    if (destBairro) destBairro.value = '';
    const refInput = document.getElementById('pass-ref');
    if (refInput) refInput.value = '';
    state.originCoords = null;
    state.destCoords = null;
    if (!state.currentCity) {
      lockRouteInputs();
    }
    closeAllStreetSuggestions();
    updateEstimatedValues();
    if (window.MaxMap) {
      window.MaxMap.setRoute('', '');
    }
  }

  // Real-time Global Polling
  let globalPollTick = 0;
  function startGlobalPolling() {
    if (state.globalPollInterval) return;
    state.globalPollInterval = setInterval(async () => {
      globalPollTick++;

      // 0. Single Session Check (Enforce single active session every ~2.4s)
      if (globalPollTick % 2 === 0 && state.currentUser && state.sessionToken) {
        verifyActiveSession();
      }

      const isWsConnected = window.MaxRealtime && window.MaxRealtime.isConnected;
      // Otimização para alta escala: com WebSocket conectado, polling atua como batimento a cada 12s
      const shouldPoll = !isWsConnected || (globalPollTick % 10 === 0);

      // 1. Radar update for active driver on radar screen
      if (shouldPoll && state.userRole === 'driver' && state.currentScreen === 'screen-driver-home') {
        refreshDriverRadar();
      }

      // 2. Active ride status check & chat update
      if (shouldPoll && state.activeRide && state.activeRide.id) {
        try {
          const res = await fetch(`/api/rides/${state.activeRide.id}`);
          const data = await res.json();
          if (res.ok && data.ride) {
            const r = data.ride;
            const prevStatus = state.activeRide.status;

            // Handle Passenger transitioning from requested to accepted
            if (state.userRole === 'passenger' && prevStatus === 'requested' && r.status === 'accepted') {
              state.activeRide = r;
              saveActiveRideState();
              populatePassengerActiveCard(r);
              playSound('success');
              showToast('Motorista aceitou sua corrida! Deslocando-se...', 'success');
              goToScreen('screen-passenger-active-ride');
            } else if (prevStatus !== 'arrived' && r.status === 'arrived') {
              state.activeRide = r;
              saveActiveRideState();
              playSound('cheguei');
              showToast('Motorista chegou ao local de embarque!', 'info');
            } else if (r.status === 'completed' || r.status === 'finished') {
              clearActiveRideState();
              state.activeRide = null;
              playSound('verificar');
              showToast('Corrida finalizada!');
              if (state.userRole === 'passenger') {
                goToScreen('screen-history');
                openRatingModal('active', r.driverName || 'MOTORISTA');
              } else {
                goToScreen('screen-driver-home');
              }
            } else if (r.status === 'expired') {
              handleRideExpired(r.id);
            } else if (r.status === 'cancelled') {
              clearActiveRideState();
              state.activeRide = null;
              state.waitingRideId = null;
              state.driverHasArrived = false;
              populateDriverActiveCard(null);
              if (window.MaxMap) window.MaxMap.stopTracking();
              clearRouteInputs();
              playSound('cancel');
              const cancelMsg = r.cancelledBy === 'driver'
                ? (state.userRole === 'passenger' ? 'O motorista cancelou esta corrida.' : 'Corrida cancelada.')
                : (state.userRole === 'driver' ? 'O passageiro cancelou a solicitação de corrida.' : 'Corrida cancelada.');
              showToast(cancelMsg);
              goToScreen(state.userRole === 'driver' ? 'screen-driver-home' : 'screen-passenger-home');
              if (state.userRole === 'driver') refreshDriverRadar();
            } else if (state.userRole === 'passenger' && r.status === 'requested') {
              const createdTime = r.createdAt ? new Date(r.createdAt).getTime() : 0;
              if (createdTime > 0 && (Date.now() - createdTime >= RIDE_EXPIRATION_TIME_MS)) {
                handleRideExpired(r.id);
              } else {
                state.activeRide = r;
                saveActiveRideState();
              }
            } else {
              state.activeRide = r;
              saveActiveRideState();
            }
          }
        } catch (err) {
          console.warn('Erro ao atualizar status da corrida:', err);
        }
        if (shouldPoll) checkChatMessages();
      } else {
        const effectiveId = getEffectiveChatRideId();
        const modal = document.getElementById('modal-chat');
        if (effectiveId || (modal && modal.classList.contains('active'))) {
          if (shouldPoll) checkChatMessages(effectiveId);
        }
      }

      // 3. Admin direct message check (polls unread messages from admin)
      const currentUserId = state.currentUser ? state.currentUser.id : (state.userRole === 'driver' ? 'usr-drv-1' : 'usr-pass-1');
      if (currentUserId && state.currentScreen !== 'screen-splash' && state.currentScreen !== 'screen-login') {
        checkAdminDirectMessages(currentUserId);
      }
    }, 1200);
  }

  async function restoreActiveRideIfAny() {
    if (typeof localStorage === 'undefined') return false;
    const savedRideId = localStorage.getItem('maxdrive_active_ride_id');
    const savedRole = localStorage.getItem('maxdrive_role');
    const savedCity = localStorage.getItem('maxdrive_city');

    if (savedRole) {
      state.userRole = savedRole;
      const btnSwitch = document.getElementById('btn-switch-role');
      if (btnSwitch) {
        btnSwitch.innerText = savedRole === 'driver' ? 'MUDAR PARA MODO PASSAGEIRO' : 'MUDAR PARA MODO MOTORISTA';
      }
    }
    if (savedCity) {
      selectCity(savedCity);
    }

    if (savedRideId) {
      try {
        const res = await fetch(`/api/rides/${savedRideId}`);
        const data = await res.json();
        if (res.ok && data.ride) {
          const r = data.ride;
          if (r.status === 'requested' || r.status === 'accepted' || r.status === 'arrived' || r.status === 'in_progress') {
            state.activeRide = r;
            if (r.city) selectCity(r.city);

            if (state.userRole === 'passenger') {
              if (r.status === 'requested') {
                const createdTime = r.createdAt ? new Date(r.createdAt).getTime() : 0;
                if (createdTime > 0 && (Date.now() - createdTime >= RIDE_EXPIRATION_TIME_MS)) {
                  handleRideExpired(r.id);
                  return false;
                }
                state.waitingRideId = r.id;
                populatePassengerWaitingCard(r);
                startWaitingCountdown(r.createdAt);
                startWaitingPoll(r.id);
                goToScreen('screen-passenger-waiting');
              } else {
                populatePassengerActiveCard(r);
                goToScreen('screen-passenger-active-ride');
              }
            } else if (state.userRole === 'driver') {
              state.driverHasArrived = (r.status === 'arrived' || r.status === 'in_progress');
              populateDriverActiveCard(r);
              if (state.driverHasArrived) {
                const btn = document.getElementById('btn-driver-arrived');
                if (btn) {
                  btn.innerHTML = 'NO PONTO DE EMBARQUE <img src="assets/icons/check-circle.svg" alt="" class="svg-icon-img sm" style="vertical-align: -2px;">';
                  btn.style.background = '#00D04B';
                  btn.style.color = '#FFFFFF';
                }
                const wazeBtn = document.getElementById('btn-driver-waze');
                if (wazeBtn) {
                  wazeBtn.innerHTML = `
                    <svg style="width: 15px; height: 15px; flex-shrink: 0;" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                    </svg>
                    IR COM WAZE (DESTINO)
                  `;
                  wazeBtn.classList.remove('btn-cyan');
                  wazeBtn.classList.add('btn-green');
                }
              }
              goToScreen('screen-driver-active-ride');
            }
            saveActiveRideState();
            return true;
          }
        }
      } catch (e) {
        console.warn('Erro ao restaurar corrida ativa:', e);
      }
      clearActiveRideState();
    }
    return false;
  }

  // Initialization
      // --- Theme Management ---
    function applyTheme(theme) {
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('maxdrive_theme', theme);
      const toggle = document.getElementById('theme-toggle');
      if (toggle) toggle.checked = (theme === 'dark');
      const themeIcons = document.querySelectorAll('.header-theme-icon, #theme-floating-icon');
      themeIcons.forEach(icon => {
        icon.textContent = (theme === 'dark' ? '☀️' : '🌙');
      });
      const metaTheme = document.querySelector('meta[name="theme-color"]');
      if (metaTheme) metaTheme.setAttribute('content', theme === 'dark' ? '#080A0F' : '#F1F5F9');

      // Update logo image sources for light vs dark theme
      const logoImgs = document.querySelectorAll('.splash-logo-img, .home-logo-large, .app-logo-small, .login-logo-img, img[src*="MAXDRIVET.svg"], img[src*="maxfundoclaro.svg"]');
      logoImgs.forEach(img => {
        if (theme === 'light') {
          img.src = 'assets/icons/maxfundoclaro.svg';
        } else {
          img.src = 'assets/icons/MAXDRIVET.svg';
        }
      });
    }

    function initTheme() {
      const savedTheme = localStorage.getItem('maxdrive_theme') || 'dark';
      applyTheme(savedTheme);
    }

    function toggleTheme(e) {
      let theme;
      if (e && e.target && typeof e.target.checked === 'boolean') {
        theme = e.target.checked ? 'dark' : 'light';
      } else {
        const current = document.documentElement.getAttribute('data-theme') || 'dark';
        theme = current === 'dark' ? 'light' : 'dark';
      }
      applyTheme(theme);
    }

    function initRealtimeListeners() {
      if (!window.MaxRealtime) return;

      // 1. Novo pedido de corrida no radar (Com filtro estrito do tipo de veículo)
      window.MaxRealtime.on('ride:created', (data) => {
        const r = data && (data.ride || data);
        if (!r) return;
        if (state.userRole === 'driver' && state.currentScreen === 'screen-driver-home') {
          const u = state.currentUser;
          const drvVehType = (u && u.vehicle && u.vehicle.type) ? u.vehicle.type : 'car';
          const isMotoDrv = drvVehType === 'moto';
          const isMotoRide = r.vehicleType === 'moto';

          if ((isMotoDrv && isMotoRide) || (!isMotoDrv && !isMotoRide)) {
            playSound('newRide');
            showToast(isMotoRide ? '🏍️ Nova corrida de Moto Táxi no radar!' : '🚗 Nova corrida de Carro no radar!', 'info');
            refreshDriverRadar();
          }
        }
      });

      // 2. Corrida atualizada / aceita por outro motorista
      window.MaxRealtime.on('ride:updated', (data) => {
        if (state.userRole === 'driver' && state.currentScreen === 'screen-driver-home') {
          refreshDriverRadar();
        }
      });

      // 3. Passageiro: motorista aceitou corrida
      window.MaxRealtime.on('ride:accepted', (data) => {
        const r = data && (data.ride || data);
        if (!r) return;
        if (state.userRole === 'passenger') {
          stopWaitingPoll();
          stopWaitingCountdown();
          onDriverAcceptedRide(r);
        }
      });

      // 4. Mudança de status da corrida
      window.MaxRealtime.on('ride:status_changed', (data) => {
        const r = data && (data.ride || data);
        if (!r) return;
        if (state.activeRide && state.activeRide.id === r.id) {
          state.activeRide = r;
          saveActiveRideState();
          if (r.status === 'arrived') {
            playSound('cheguei');
            showToast('📍 Motorista chegou ao local de embarque!', 'info');
          } else if (r.status === 'in_progress') {
            playSound('seguranca');
            showToast('Corrida em andamento!', 'info');
          }
        }
      });

      // 5. Corrida cancelada
      window.MaxRealtime.on('ride:cancelled', (data) => {
        const r = data && (data.ride || data);
        if (r && state.activeRide && state.activeRide.id === r.id) {
          clearActiveRideState();
          state.activeRide = null;
          state.waitingRideId = null;
          state.driverHasArrived = false;
          populateDriverActiveCard(null);
          if (window.MaxMap) window.MaxMap.stopTracking();
          clearRouteInputs();
          playSound('cancel');
          const reason = data.reason || r.cancellationReason || '';
          showToast(reason ? `Corrida cancelada: ${reason}` : 'A corrida foi cancelada.');
          goToScreen(state.userRole === 'driver' ? 'screen-driver-home' : 'screen-passenger-home');
          if (state.userRole === 'driver') refreshDriverRadar();
        }
      });

      // 6. Corrida finalizada
      window.MaxRealtime.on('ride:finished', (data) => {
        const r = data && (data.ride || data);
        if (r && state.activeRide && state.activeRide.id === r.id) {
          clearActiveRideState();
          state.activeRide = null;
          playSound('verificar');
          showToast('Corrida finalizada com sucesso!');
          if (state.userRole === 'passenger') {
            goToScreen('screen-history');
            openRatingModal('active', r.driverName || 'MOTORISTA');
          } else {
            goToScreen('screen-driver-home');
          }
        }
      });

      // 7. Mensagem no chat em tempo real
      window.MaxRealtime.on('chat:message', (data) => {
        const msg = data && data.message;
        if (!msg) return;
        const effectiveId = state.activeRide ? state.activeRide.id : getEffectiveChatRideId();
        if (!effectiveId || effectiveId === data.rideId) {
          checkChatMessages(data.rideId);
        }
      });

      // 8. Mensagem de suporte do admin
      window.MaxRealtime.on('admin:message', (data) => {
        const currentUserId = state.currentUser ? state.currentUser.id : null;
        if (currentUserId) {
          checkAdminDirectMessages(currentUserId);
          showToast('Nova mensagem do suporte MAX DRIVE!', 'info');
          playSound('success');
        }
      });

      // 9. Rastreamento GPS do motorista em tempo real
      window.MaxRealtime.on('driver:location', (data) => {
        if (state.userRole === 'passenger' && window.MaxMap && data.lat && data.lng) {
          window.MaxMap.updateDriverMarker(data.lat, data.lng, data.bearing);
        }
      });

      // 10. Notificações gerais
      window.MaxRealtime.on('notification', (data) => {
        if (data && data.title) {
          const nType = (data.data && data.data.type) || data.type || '';
          showToast(`${data.title}: ${data.body || ''}`, 'info');
          if (!['driver_arrived', 'ride_finished', 'ride_cancelled', 'ride_accepted'].includes(nType)) {
            playSound('newRide');
          }
        }
      });
    }

    async function init() {
    // 0. Load cities configuration for fares
    await loadCitiesData();

    // 1. Restore saved user session if available
    initTheme();
    const hasUserSession = restoreUserSession();
    updateRoleSwitcherVisibility();

    if (!state.currentCity) {
      lockRouteInputs();
      const cityText = document.getElementById('city-current-name');
      if (cityText) cityText.innerText = 'SELECIONE SUA CIDADE';
    } else {
      unlockRouteInputs();
    }
    clearRouteInputs();
    setupSecurityCodeInputs();
    setupInputMasks();
    updateRoleNavVisibility();
    updateProfileView();
    updateEstimatedValues();

    // 2. Restore active ride state on reload (F5) if available
    const restoredRide = await restoreActiveRideIfAny();

    // Start real-time background polling
    startGlobalPolling();

    // Iniciar escuta WebSocket em tempo real e atualizar contexto
    initRealtimeListeners();
    if (window.MaxRealtime) {
      const vType = (state.currentUser && state.currentUser.vehicle && state.currentUser.vehicle.type) ? state.currentUser.vehicle.type : 'car';
      window.MaxRealtime.updateContext(state.currentUser ? state.currentUser.id : null, state.userRole, state.currentCity, vType);
    }

    // Init interactive map in passenger view with bidirectional address sync
    if (window.MaxMap) {
      window.MaxMap.init('passenger-map-box', function(route) {
        if (route.source === 'map_origin_click') {
          const origInput = document.getElementById('pass-origin');
          const origBairroInput = document.getElementById('pass-origin-bairro');
          if (origInput) origInput.value = route.origin || '';
          if (origBairroInput && route.originBairro) origBairroInput.value = route.originBairro;
          state.originCoords = { lat: route.originLat, lng: route.originLng };
          updateEstimatedValues();
        } else if (route.source === 'map_dest_click') {
          const destInput = document.getElementById('pass-dest');
          const destBairroInput = document.getElementById('pass-dest-bairro');
          if (destInput) destInput.value = route.destination || '';
          if (destBairroInput && route.destBairro) destBairroInput.value = route.destBairro;
          state.destCoords = { lat: route.destLat, lng: route.destLng };
          updateEstimatedValues();
        } else {
          updateEstimatedValues();
        }
      });
    }

    // Auto-advance screen on startup:
    if (!restoredRide) {
      if (hasUserSession && state.currentUser) {
        const activeRole = state.userRole || (typeof localStorage !== 'undefined' && localStorage.getItem('maxdrive_role')) || (state.currentUser && state.currentUser.role) || 'passenger';
        const homeScreen = activeRole === 'driver' ? 'screen-driver-home' : 'screen-passenger-home';
        goToScreen(homeScreen);
      } else {
        setTimeout(() => {
          if (state.currentScreen === 'screen-splash') {
            goToScreen('screen-login');
          }
        }, 2500);
      }
    }
  }

  window.addEventListener('DOMContentLoaded', init);
  window.addEventListener('load', clearRouteInputs);
  window.addEventListener('pageshow', clearRouteInputs);

  function returnToActiveRide() {
    if (state.userRole === 'passenger') {
      if (state.activeRide && ['accepted', 'arrived', 'in_progress'].includes(state.activeRide.status)) {
        goToScreen('screen-passenger-active-ride');
      } else if (state.waitingRideId || (state.activeRide && state.activeRide.status === 'requested')) {
        goToScreen('screen-passenger-waiting');
      }
    } else if (state.userRole === 'driver') {
      if (state.activeRide && ['accepted', 'arrived', 'in_progress'].includes(state.activeRide.status)) {
        goToScreen('screen-driver-active-ride');
      }
    }
  }

  function updateActiveRideBanner() {
    const banner = document.getElementById('active-ride-persistent-banner');
    const label = document.getElementById('active-ride-banner-label');
    if (!banner) return;

    const activeScreens = ['screen-passenger-active-ride', 'screen-passenger-waiting', 'screen-driver-active-ride', 'screen-splash', 'screen-login'];
    const hasActiveRide = !!(state.activeRide || state.waitingRideId);
    const isMainActiveScreen = activeScreens.includes(state.currentScreen);

    if (hasActiveRide && !isMainActiveScreen) {
      if (label) {
        if (state.userRole === 'passenger') {
          label.innerText = state.activeRide ? '🚗 CORRIDA EM ANDAMENTO — TOQUE PARA VOLTAR' : '⏳ BUSCANDO MOTORISTA — TOQUE PARA ACOMPANHAR';
        } else {
          label.innerText = '🚕 CORRIDA EM ANDAMENTO — TOQUE PARA VOLTAR';
        }
      }
      banner.style.display = 'flex';
    } else {
      banner.style.display = 'none';
    }
  }

  return {
    handleLogoClick,
    returnToActiveRide,
    updateActiveRideBanner,
    state,
    goToScreen,
    switchMode,
    toggleSound,
    handleLogin,
    selectRegisterRole,
    handleRegister,
    requestRide,
    driverAcceptRide,
    driverArrived,
    driverFinishRide,
    cancelRide,
    callDriver,
    handleCityChange,
    openChatModal,
    closeChatModal,
    handleSendChatMessage,
    openRatingModal,
    closeRatingModal,
    setRatingStars,
    highlightRatingStars,
    resetRatingStarsHover,
    submitRating,
    openReportModal,
    closeReportModal,
    submitReport,
    openContactAdminModal,
    closeContactAdminModal,
    submitContactAdmin,
    openAdminChatModal,
    closeAdminChatModal,
    handleSendAdminChatMessage,
    fillAdminQuickMessage,
    checkAdminDirectMessages,
    loadAdminChatMessages,
    handleStatusToggle,
    handleProfileSave,
    handleAvatarFileSelect,
    handleVehiclePhotoSelect,
    selectVehicleType,
    changePhoto,
    forgotPassword,
    openForgotPasswordModal,
    closeForgotPasswordModal,
    handleResetPassword,
    updateAdminBadgeVisibility,
    openAdminPanel,
    logout,
    executeLogout,
    openWazeNavigation,
    contactPassengerWhatsApp,
    toggleMapView,
    focusRadarRide,
    onStreetInput,
    onStreetFocus,
    selectStreet,
    handleSoundToggle,
    toggleTheme,
    toggleUserRole,
    toggleCityDropdown,
    selectCity,
    checkCityBeforeInput,
    lockRouteInputs,
    unlockRouteInputs,
    togglePaymentDropdown,
    selectPaymentMethod,
    updateEstimatedValues,
    selectVehicleCard,
    cancelWaitingRide,
    simulateDriverAccept,
    startWaitingCountdown,
    stopWaitingCountdown,
    handleRideExpired,
    updateRoleNavVisibility,
    init,
    saveUserSession,
    restoreUserSession,
    clearUserSession,
    renderHistory,
    renderFinances,
    refreshDriverRadar,
    updateDriverSettingsStats,
    openDriverRideActions,
    executeDirectCancel,
    setReportReason,
    sendPaymentReceiptWhatsApp,
    copyPixKey,
    loadDriverWeeklyPaymentStatus,
    loadUserReports,
    filterUserReports,
    renderAvatarCircle,
    setAvatarElement,
    handleRegAvatarSelect,
    selectRegVehicleType,
    openTermsModal,
    closeTermsModal,
    acceptTermsFromModal,
    calculateRealisticDistance,
    useCurrentLocationGPS
  };
})();

window.App = App;
