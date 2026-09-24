/**
 * MAX DRIVE - Lógica do Painel Administrativo
 * Gestão de Usuários, Banimento, Aprovação de Motoristas, Reportes e Pagamentos
 */

// Auto-detect backend host (handles file:///, localhost:3000, 127.0.0.1:5500, Render, etc.)
(function() {
  if (typeof window === 'undefined') return;
  const isDirectFile = window.location.protocol === 'file:' || window.location.protocol === 'capacitor:';
  const isHttps = window.location.protocol === 'https:';
  
  // Se for https: (ex: Render), chamadas relativas /api/... funcionam diretamente no próprio servidor sem forçar porta 3000
  if (!isDirectFile && isHttps && (!window.location.port || window.location.port === '443')) {
    return;
  }

  const isDifferentPort = window.location.port && window.location.port !== '3000' && window.location.port !== '80' && window.location.port !== '443';
  if (isDirectFile || (isDifferentPort && !isHttps)) {
    const originalFetch = window.fetch;
    const backendOrigin = window.SERVIDOR_MAXDRIVE || (isDirectFile ? 'http://localhost:3000' : `http://${window.location.hostname || 'localhost'}:3000`);
    window.fetch = function(resource, init) {
      if (typeof resource === 'string' && resource.startsWith('/api/')) {
        resource = backendOrigin + resource;
      }
      return originalFetch.call(this, resource, init);
    };
  }
})();

const AdminApp = (function() {
  let adminEmail = localStorage.getItem('maxdrive_admin_email') || '';
  let allUsers = [];
  let currentRespondingReportId = null;
  let currentAuditingDriverId = null;

  function getHeaders() {
    return {
      'Content-Type': 'application/json',
      'X-User-Email': adminEmail || 'admin@maxdrive.com',
      'X-Admin-Request': 'true'
    };
  }

  // Toast Notifications
  function showToast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    if (!type || type === 'info') {
      const lower = String(msg).toLowerCase();
      if (lower.includes('erro') || lower.includes('falha') || lower.includes('negad') || lower.includes('inválid')) {
        type = 'error';
      } else if (lower.includes('sucesso') || lower.includes('aprovad') || lower.includes('salvo') || lower.includes('desbanido')) {
        type = 'success';
      } else if (lower.includes('atenção') || lower.includes('aviso') || lower.includes('pendente') || lower.includes('reprovad') || lower.includes('banid')) {
        type = 'warning';
      } else {
        type = 'info';
      }
    }

    const icons = {
      success: '<img src="/assets/icons/check-circle.svg" alt="" class="svg-icon-img md">',
      error: '<img src="/assets/icons/x-circle.svg" alt="" class="svg-icon-img md">',
      warning: '<img src="/assets/icons/alert-triangle.svg" alt="" class="svg-icon-img md">',
      info: '<img src="/assets/icons/zap.svg" alt="" class="svg-icon-img md">'
    };

    const titles = {
      success: 'Sucesso',
      error: 'Atenção',
      warning: 'Administração',
      info: 'MAX DRIVE'
    };

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <div class="toast-icon-wrap">${icons[type] || icons.info}</div>
      <div class="toast-body">
        <div class="toast-title">${titles[type] || 'MAX DRIVE'}</div>
        <div class="toast-message">${msg}</div>
      </div>
      <div class="toast-progress"></div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-15px) scale(0.9)';
      setTimeout(() => toast.remove(), 260);
    }, 3200);
  }

  // Custom Dialog Modal Promise (Substitui alert, confirm e prompt nativos)
  function showDialog({ title = 'Administração MAX DRIVE', message = '', type = 'alert', confirmText = 'CONFIRMAR', cancelText = 'CANCELAR', placeholder = '', defaultValue = '', onConfirm = null, onCancel = null } = {}) {
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

      if (titleEl) titleEl.innerText = title;
      if (msgEl) msgEl.innerText = message;

      if (iconEl) {
        iconEl.className = 'custom-dialog-icon';
        if (type === 'confirm' || message.toLowerCase().includes('ban') || message.toLowerCase().includes('reprov')) {
          iconEl.classList.add('danger');
          iconEl.innerHTML = '<img src="/assets/icons/alert-triangle.svg" alt="" class="svg-icon-img lg">';
        } else if (type === 'prompt') {
          iconEl.classList.add('info');
          iconEl.innerHTML = '<img src="/assets/icons/edit.svg" alt="" class="svg-icon-img lg">';
        } else if (message.toLowerCase().includes('sucesso') || message.toLowerCase().includes('aprovado')) {
          iconEl.classList.add('success');
          iconEl.innerHTML = '<img src="/assets/icons/check-circle.svg" alt="" class="svg-icon-img lg">';
        } else {
          iconEl.innerHTML = '<img src="/assets/icons/zap.svg" alt="" class="svg-icon-img lg">';
        }
      }

      if (btnConfirm) {
        btnConfirm.innerText = confirmText;
        btnConfirm.className = (type === 'confirm' && (message.toLowerCase().includes('ban') || message.toLowerCase().includes('reprov'))) ? 'btn-pill btn-red' : 'btn-pill btn-yellow';
      }

      if (btnCancel) {
        btnCancel.innerText = cancelText;
        btnCancel.style.display = (type === 'confirm' || type === 'prompt') ? 'inline-block' : 'none';
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
            resolve(true);
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
            resolve(false);
          }
        };
      }

      modal.style.display = 'flex';
    });
  }

  // Tab Switching
  function switchTab(tabId) {
    const tabs = document.querySelectorAll('.table-card');
    tabs.forEach(t => t.style.display = 'none');

    const btns = document.querySelectorAll('.tab-btn');
    btns.forEach(b => b.classList.remove('active'));

    const target = document.getElementById(tabId);
    if (target) target.style.display = 'block';

    const clickedBtn = Array.from(btns).find(b => b.getAttribute('onclick') && b.getAttribute('onclick').includes(tabId));
    if (clickedBtn) clickedBtn.classList.add('active');

    if (tabId === 'tab-admin-messages') {
      loadConversationsList();
    }
  }

  // Check auth
  function checkAuth() {
    const emailTag = document.getElementById('current-admin-email');
    if (emailTag) emailTag.innerText = adminEmail;

    if (!adminEmail) {
      document.getElementById('admin-gate-overlay').style.display = 'flex';
    } else {
      document.getElementById('admin-gate-overlay').style.display = 'none';
      loadAllData();
    }
  }

  async function authenticate(e) {
    if (e) e.preventDefault();
    const email = document.getElementById('admin-gate-email').value.trim();
    const password = document.getElementById('admin-gate-password').value.trim();

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (res.ok && data.user && data.user.isAdmin) {
        adminEmail = data.user.email;
        localStorage.setItem('maxdrive_admin_email', adminEmail);
        document.getElementById('admin-gate-overlay').style.display = 'none';
        checkAuth();
      } else {
        showDialog({
          title: 'Acesso Negado',
          message: 'Acesso negado: apenas o e-mail cadastrado como Administrador pode acessar este painel.',
          type: 'alert'
        });
      }
    } catch (err) {
      showToast('Erro ao conectar com o servidor', 'error');
    }
  }

  async function logout() {
    const confirmed = await showDialog({
      title: 'ENCERRAR SESSÃO',
      message: 'Deseja realmente desconectar e sair do painel administrativo?',
      type: 'confirm',
      confirmText: 'SAIR',
      cancelText: 'CANCELAR'
    });
    if (!confirmed) return;

    if (adminPollInterval) {
      clearInterval(adminPollInterval);
      adminPollInterval = null;
    }
    localStorage.removeItem('maxdrive_admin_email');
    sessionStorage.removeItem('maxdrive_admin_email');
    adminEmail = '';
    const gate = document.getElementById('admin-gate-overlay');
    if (gate) {
      gate.style.display = 'flex';
      const emailInput = document.getElementById('admin-gate-email');
      const passInput = document.getElementById('admin-gate-password');
      if (emailInput) emailInput.value = '';
      if (passInput) passInput.value = '';
    }
    const emailTag = document.getElementById('current-admin-email');
    if (emailTag) emailTag.innerText = 'Desconectado';
    showToast('Sessão administrativa encerrada com sucesso', 'info');
  }

  let adminPollInterval = null;

  // Load KPI Stats and Data
  async function loadAllData() {
    loadStats();
    loadUsers();
    loadReports();
    loadPayments();
    loadCities();
    loadConversationsList();
    checkAdminUnreadMessages();

    if (!adminPollInterval) {
      adminPollInterval = setInterval(() => {
        checkAdminUnreadMessages();
        if (currentChatUserId) {
          loadDirectMessages(true);
        }
      }, 3500);
    }
  }

  async function loadStats() {
    try {
      const res = await fetch('/api/admin/stats', { headers: getHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      const stats = data.stats;

      document.getElementById('kpi-total-users').innerText = stats.totalUsers || 0;
      document.getElementById('kpi-total-drivers').innerText = stats.totalDrivers || 0;
      document.getElementById('kpi-completed-rides').innerText = stats.completedRides || 0;
      const rev = Number(stats.totalRevenue) || 0;
      document.getElementById('kpi-total-revenue').innerText = `R$ ${rev.toFixed(2).replace('.', ',')}`;
      document.getElementById('kpi-pending-reports').innerText = stats.pendingReports || 0;
    } catch (e) {
      console.error(e);
    }
  }

  // Load Users and Drivers
  async function loadUsers() {
    try {
      const res = await fetch('/api/admin/users', { headers: getHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      allUsers = data.users || [];
      renderUsersTable(allUsers);
      renderDriversTable(allUsers.filter(u => u.role === 'driver'));
    } catch (e) {
      console.error(e);
    }
  }

  function renderUsersTable(users) {
    const tbody = document.getElementById('table-users-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    users.forEach(u => {
      const tr = document.createElement('tr');
      const isBanned = u.status === 'banned';
      tr.innerHTML = `
        <td><b>${u.name || '--'}</b></td>
        <td>${u.email}</td>
        <td><span class="badge-status ${u.role === 'driver' ? 'approved' : 'pending'}">${u.role === 'driver' ? 'Motorista' : (u.role === 'admin' ? 'Admin' : 'Passageiro')}</span></td>
        <td>${u.city || 'Ituiutaba'}</td>
        <td><img src="/assets/icons/star.svg" class="svg-icon-img sm" alt="" style="filter: brightness(0) saturate(100%); margin-right: 3px;"> ${(u.rating && Number(u.rating) > 0 && Number(u.ratingCount) > 0) ? Number(u.rating).toFixed(1) : 'Novo'}</td>
        <td>
          <span class="badge-status ${isBanned ? 'banned' : 'active'}">
            ${isBanned ? 'Banido' : 'Ativo'}
          </span>
          ${isBanned && u.banReason ? `<div style="font-size: 10px; color: #FF3B30; margin-top: 2px;">Motivo: ${u.banReason}</div>` : ''}
        </td>
        <td>
          <div style="display: flex; gap: 4px; align-items: center;">
            <button class="btn-action-small btn-msg" style="background: rgba(0,229,255,0.15); color: #00E5FF; border: 1px solid rgba(0,229,255,0.35); padding: 5px 10px;" onclick="event.stopPropagation(); AdminApp.openDirectMessageModal('${u.id}', '${(u.name || u.email).replace(/'/g, "\\'")}', '${u.role}')" title="Conversar diretamente com este usuário">
              <img src="/assets/icons/chat.svg" class="svg-icon-img sm" alt="" style="vertical-align: -2px; margin-right: 3px;"> Mensagem
            </button>
            ${u.role !== 'admin' ? `
              <button class="btn-action-small ${isBanned ? 'btn-unban' : 'btn-ban'}" onclick="AdminApp.toggleBan('${u.id}', ${isBanned})">
                ${isBanned ? 'Desbanir' : 'Banir'}
              </button>
              <button class="btn-action-small" style="background: rgba(239, 68, 68, 0.15); color: #EF4444; border: 1px solid rgba(239, 68, 68, 0.4); padding: 5px 8px;" onclick="event.stopPropagation(); AdminApp.deleteUser('${u.id}', '${(u.name || u.email).replace(/'/g, "\\'")}')" title="Excluir usuário permanentemente do banco de dados">
                <img src="/assets/icons/trash.svg" class="svg-icon-img sm" alt="" style="vertical-align: -2px; margin-right: 3px;"> Excluir
              </button>
            ` : '<span style="color: #64748b; font-size: 11px;">Admin</span>'}
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  function filterUsers(query) {
    const q = query.toLowerCase();
    const filtered = allUsers.filter(u =>
      (u.name && u.name.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.city && u.city.toLowerCase().includes(q))
    );
    renderUsersTable(filtered);
  }

  function filterDrivers(query) {
    const q = (query || '').toLowerCase().trim();
    const drivers = allUsers.filter(u => u.role === 'driver');
    if (!q) {
      renderDriversTable(drivers);
      return;
    }
    const filtered = drivers.filter(d => {
      const veh = d.vehicle || {};
      return (
        (d.name && d.name.toLowerCase().includes(q)) ||
        (d.email && d.email.toLowerCase().includes(q)) ||
        (d.phone && d.phone.toLowerCase().includes(q)) ||
        (d.cpf && d.cpf.toLowerCase().includes(q)) ||
        (d.cnh && d.cnh.toLowerCase().includes(q)) ||
        (veh.plate && veh.plate.toLowerCase().includes(q)) ||
        (veh.model && veh.model.toLowerCase().includes(q)) ||
        (veh.color && veh.color.toLowerCase().includes(q))
      );
    });
    renderDriversTable(filtered);
  }

  function exportUsersCSV() {
    if (!allUsers || allUsers.length === 0) {
      showToast('Nenhum usuário cadastrado para exportação.', 'warning');
      return;
    }
    const headers = ['ID', 'Nome', 'E-mail', 'Telefone', 'CPF', 'Tipo', 'Cidade', 'Avaliação', 'Status'];
    const rows = allUsers.map(u => [
      `"${(u.id || '').replace(/"/g, '""')}"`,
      `"${(u.name || '').replace(/"/g, '""')}"`,
      `"${(u.email || '').replace(/"/g, '""')}"`,
      `"${(u.phone || '').replace(/"/g, '""')}"`,
      `"${(u.cpf || '').replace(/"/g, '""')}"`,
      `"${u.role === 'driver' ? 'Motorista' : (u.role === 'admin' ? 'Admin' : 'Passageiro')}"`,
      `"${(u.city || 'Ituiutaba').replace(/"/g, '""')}"`,
      `"${(u.rating && Number(u.rating) > 0 && Number(u.ratingCount) > 0) ? Number(u.rating).toFixed(1) : 'Novo'}"`,
      `"${u.status === 'banned' ? 'Banido' : 'Ativo'}"`
    ]);
    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `maxdrive_usuarios_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Planilha de usuários exportada com sucesso!', 'success');
  }

  async function toggleBan(userId, isCurrentlyBanned) {
    let reason = '';
    if (!isCurrentlyBanned) {
      reason = await showDialog({
        title: 'Banir Usuário',
        message: 'Informe o motivo do banimento do usuário:',
        type: 'prompt',
        placeholder: 'Motivo do banimento...'
      });
      if (reason === null || !reason.trim()) return;
    }

    try {
      const res = await fetch(`/api/admin/users/${userId}/ban`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ reason })
      });
      if (res.ok) {
        showToast(isCurrentlyBanned ? 'Usuário desbanido com sucesso!' : 'Usuário banido com sucesso!', 'success');
        loadUsers();
        loadStats();
      }
    } catch (e) {
      showToast('Erro ao alterar status de banimento', 'error');
    }
  }

  let currentlyEvaluatedDriver = null;

  // Drivers Table
  function renderDriversTable(drivers) {
    const tbody = document.getElementById('table-drivers-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    drivers.forEach(d => {
      const tr = document.createElement('tr');
      tr.style.cursor = 'pointer';
      const veh = d.vehicle || {};
      const photos = veh.photos || {};
      const isBanned = d.status === 'banned';
      const isApproved = d.approved !== false && !isBanned;

      // Calculate photo completion
      const photoKeys = ['front', 'side', 'cnh', 'doc'];
      const uploadedCount = photoKeys.filter(k => !!photos[k]).length;
      const allPhotosUploaded = uploadedCount >= 4;

      const initials = (d.name || 'M').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
      const avatarHtml = d.avatar 
        ? `<img src="${d.avatar}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; border: 1px solid var(--yellow-primary);" alt="Avatar">`
        : `<div style="width: 32px; height: 32px; border-radius: 50%; background: rgba(255, 230, 0, 0.1); border: 1px solid rgba(255, 230, 0, 0.35); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 11px; color: var(--yellow-primary);">${initials}</div>`;

      tr.innerHTML = `
        <td>
          <div style="display: flex; align-items: center; gap: 10px;">
            ${avatarHtml}
            <div>
              <b>${d.name || '--'}</b><br>
              <span style="font-size: 11px; color: #94a3b8;">${d.email}</span>
            </div>
          </div>
        </td>
        <td>
          <div style="font-size: 12px;"><b>CNH:</b> ${d.cnh || '<span style="color:#f59e0b;">Pendente</span>'}</div>
          <div style="font-size: 11px; color: #94a3b8;"><b>CPF:</b> ${d.cpf || '--'}</div>
        </td>
        <td>
          <span style="font-size: 11px; font-weight: 800; color: ${veh.type === 'moto' ? '#00E5FF' : '#FEE500'}; display: inline-flex; align-items: center;">
            ${veh.type === 'moto' ? '<img src="/assets/icons/moto.svg" class="svg-icon-img sm" style="vertical-align: -2px; margin-right: 3px;"> MOTO' : '<img src="/assets/icons/car.svg" class="svg-icon-img sm" style="vertical-align: -2px; margin-right: 3px;"> CARRO'}
          </span>
          <div style="font-size: 12px; font-weight: 700;">${veh.model || 'Padrão'}</div>
        </td>
        <td>
          <b>${veh.plate || '--'}</b><br>
          <span style="font-size: 11px; color: #94a3b8;">${veh.color || '--'} • ${veh.year || '--'}</span>
        </td>
        <td>
          <span class="badge-status ${allPhotosUploaded ? 'active' : 'pending'}" style="font-size: 11px; display: inline-flex; align-items: center; gap: 4px;">
            <img src="/assets/icons/camera.svg" class="svg-icon-img sm" alt="" style="vertical-align: -2px; margin-right: 3px;"> ${uploadedCount}/4 Fotos
          </span>
        </td>
        <td>
          ${isBanned ? `
            <span class="badge-status banned">BANIDO</span>
            ${d.banReason ? `<div style="font-size: 10px; color: #FF3B30; margin-top: 2px;">${d.banReason}</div>` : ''}
          ` : (isApproved ? `
            <span class="badge-status approved">APROVADO</span>
          ` : `
            <span class="badge-status pending">PENDENTE DE AVALIAÇÃO</span>
          `)}
        </td>
        <td>
          <div style="display: flex; gap: 6px; align-items: center;">
            <button class="btn-action-small btn-msg" style="background: rgba(0,229,255,0.15); color: #00E5FF; border: 1px solid rgba(0,229,255,0.35); padding: 5px 10px;" onclick="event.stopPropagation(); AdminApp.openDirectMessageModal('${d.id}', '${(d.name || d.email).replace(/'/g, "\\'")}', 'driver')" title="Conversar diretamente com este motorista">
              <img src="/assets/icons/chat.svg" class="svg-icon-img sm" alt="" style="vertical-align: -2px; margin-right: 3px;"> Mensagem
            </button>
            <button class="btn-action-small btn-resolve" onclick="event.stopPropagation(); AdminApp.openDriverEvalModal('${d.id}')" title="Ver fotos, dados e avaliar">
              AVALIAR <img src="/assets/icons/eye.svg" class="svg-icon-img sm" alt="" style="vertical-align: -2px; margin-left: 3px;">
            </button>
            <button class="btn-action-small ${isApproved ? 'btn-reject' : 'btn-approve'}" onclick="event.stopPropagation(); AdminApp.toggleApproveDriver('${d.id}', ${isApproved})">
              ${isApproved ? 'Reprovar' : 'Aprovar'}
            </button>
            <button class="btn-action-small" style="background: rgba(239, 68, 68, 0.15); color: #EF4444; border: 1px solid rgba(239, 68, 68, 0.4); padding: 5px 8px;" onclick="event.stopPropagation(); AdminApp.deleteUser('${d.id}', '${(d.name || d.email).replace(/'/g, "\\'")}')" title="Excluir motorista permanentemente do banco de dados">
              <img src="/assets/icons/trash.svg" class="svg-icon-img sm" alt="" style="vertical-align: -2px; margin-right: 3px;"> Excluir
            </button>
          </div>
        </td>
      `;

      tr.onclick = (e) => {
        if (!e.target.closest('button')) {
          openDriverEvalModal(d.id);
        }
      };

      tbody.appendChild(tr);
    });
  }

  // Driver Evaluation Modal Logic
  function openDriverEvalModal(driverId) {
    const driver = allUsers.find(u => u.id === driverId);
    if (!driver) {
      showToast('Motorista não encontrado', 'warning');
      return;
    }

    currentlyEvaluatedDriver = driver;

    // Header info
    document.getElementById('eval-header-title').innerText = `Avaliação: ${driver.name}`;
    const badgeEl = document.getElementById('eval-header-badge');
    const isBanned = driver.status === 'banned';
    const isApproved = driver.approved !== false && !isBanned;

    if (isBanned) {
      badgeEl.className = 'badge-status banned';
      badgeEl.innerText = 'CONTA BANIDA';
    } else if (isApproved) {
      badgeEl.className = 'badge-status approved';
      badgeEl.innerText = 'CADASTRADO & APROVADO';
    } else {
      badgeEl.className = 'badge-status pending';
      badgeEl.innerText = 'PENDENTE DE APROVAÇÃO';
    }

    // Profile Details
    const avatarImg = document.getElementById('eval-driver-avatar-img');
    const avatarFallback = document.getElementById('eval-driver-avatar-fallback');
    if (driver.avatar) {
      avatarImg.src = driver.avatar;
      avatarImg.style.display = 'block';
      avatarFallback.style.display = 'none';
    } else {
      avatarImg.style.display = 'none';
      avatarFallback.style.display = 'block';
      avatarFallback.innerText = (driver.name || 'M').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
    }

    document.getElementById('eval-driver-name').innerText = driver.name || '--';
    document.getElementById('eval-driver-email').innerText = driver.email || '--';
    document.getElementById('eval-driver-cpf').innerText = driver.cpf || 'Não informado';
    document.getElementById('eval-driver-birth').innerText = driver.birthDate ? formatDate(driver.birthDate) : 'Não informada';
    document.getElementById('eval-driver-phone').innerText = driver.phone || 'Não informado';
    document.getElementById('eval-driver-cnh').innerText = driver.cnh || 'Não cadastrada';
    document.getElementById('eval-driver-city').innerText = driver.city ? (driver.city.charAt(0).toUpperCase() + driver.city.slice(1)) : 'Ituiutaba';
    document.getElementById('eval-driver-rating').innerHTML = `<img src="/assets/icons/star.svg" class="svg-icon-img sm" alt="" style="filter: brightness(0) saturate(100%); margin-right: 3px;"> ${(driver.rating && Number(driver.rating) > 0 && Number(driver.ratingCount) > 0) ? Number(driver.rating).toFixed(1) : 'Novo'}`;
    document.getElementById('eval-driver-rides').innerText = String(driver.totalRides || 0);
    document.getElementById('eval-driver-created').innerText = driver.createdAt ? formatDate(driver.createdAt) : '--';

    const banReasonRow = document.getElementById('eval-ban-reason-row');
    const banReasonVal = document.getElementById('eval-driver-ban-reason');
    if (isBanned && driver.banReason) {
      banReasonRow.style.display = 'flex';
      banReasonVal.innerText = driver.banReason;
    } else {
      banReasonRow.style.display = 'none';
    }

    // Vehicle Details
    const veh = driver.vehicle || {};
    document.getElementById('eval-veh-type').innerHTML = veh.type === 'moto' ? '<img src="/assets/icons/moto.svg" class="svg-icon-img sm" style="vertical-align: -2px; margin-right: 3px;"> MOTO TÁXI' : '<img src="/assets/icons/car.svg" class="svg-icon-img sm" style="vertical-align: -2px; margin-right: 3px;"> CARRO COMUM';
    document.getElementById('eval-veh-model').innerText = veh.model || 'Padrão MAX DRIVE';
    document.getElementById('eval-veh-plate').innerText = veh.plate || '--';
    document.getElementById('eval-veh-color-year').innerText = `${veh.color || '--'} (${veh.year || '--'})`;

    // Photos & Documents Inspection
    const photos = veh.photos || {};
    setupEvalPhotoSlot('front', photos.front);
    setupEvalPhotoSlot('side', photos.side);
    setupEvalPhotoSlot('rear', photos.rear);
    setupEvalPhotoSlot('seats', photos.seats);
    setupEvalPhotoSlot('cnh', photos.cnh);
    setupEvalPhotoSlot('doc', photos.doc);

    // Messages or Validation Codes
    const msgContainer = document.getElementById('eval-driver-messages-container');
    const cnhBox = document.getElementById('eval-cnh-msg-box');
    const docBox = document.getElementById('eval-doc-msg-box');
    const cnhTxt = document.getElementById('eval-cnh-msg-text');
    const docTxt = document.getElementById('eval-doc-msg-text');

    const cnhMessage = driver.cnhMessage || (driver.vehicle && driver.vehicle.cnhMessage);
    const docMessage = driver.docMessage || (driver.vehicle && driver.vehicle.docMessage);

    let hasMessages = false;
    if (cnhMessage) {
      if (cnhTxt) cnhTxt.innerText = cnhMessage;
      if (cnhBox) cnhBox.style.display = 'block';
      hasMessages = true;
    } else if (cnhBox) {
      cnhBox.style.display = 'none';
    }

    if (docMessage) {
      if (docTxt) docTxt.innerText = docMessage;
      if (docBox) docBox.style.display = 'block';
      hasMessages = true;
    } else if (docBox) {
      docBox.style.display = 'none';
    }

    if (msgContainer) {
      msgContainer.style.display = hasMessages ? 'block' : 'none';
    }

    // Decision Action Buttons
    const btnBan = document.getElementById('btn-eval-ban');
    const btnReject = document.getElementById('btn-eval-reject');
    const btnApprove = document.getElementById('btn-eval-approve');

    if (btnBan) {
      if (isBanned) {
        btnBan.className = 'btn-pill btn-green';
        btnBan.style.background = '#00D04B';
        btnBan.innerHTML = '<img src="/assets/icons/unlock.svg" class="svg-icon-img sm" style="vertical-align: -2px; margin-right: 4px;"> DESBANIR MOTORISTA';
      } else {
        btnBan.className = 'btn-pill btn-red';
        btnBan.style.background = '#FF3B30';
        btnBan.innerHTML = '<img src="/assets/icons/ban.svg" class="svg-icon-img sm" style="vertical-align: -2px; margin-right: 4px;"> BANIR MOTORISTA';
      }
    }

    if (btnReject) {
      btnReject.style.display = isApproved ? 'inline-block' : 'inline-block';
      btnReject.innerHTML = isApproved ? '<img src="/assets/icons/close.svg" class="svg-icon-img sm" style="vertical-align: -2px; margin-right: 4px;"> REPROVAR CADASTRO' : '<img src="/assets/icons/close.svg" class="svg-icon-img sm" style="vertical-align: -2px; margin-right: 4px;"> REJEITAR / PEDIR REVISÃO';
    }

    if (btnApprove) {
      btnApprove.style.display = 'inline-block';
      btnApprove.innerHTML = isApproved ? '<img src="/assets/icons/check-circle.svg" class="svg-icon-img sm" style="vertical-align: -2px; margin-right: 4px;"> MANTER APROVADO' : '<img src="/assets/icons/check-circle.svg" class="svg-icon-img sm" style="vertical-align: -2px; margin-right: 4px;"> APROVAR MOTORISTA';
    }

    // Open Modal
    const modal = document.getElementById('admin-modal-driver-eval');
    if (modal) modal.style.display = 'flex';
  }

  function setupEvalPhotoSlot(key, photoSrc) {
    const imgEl = document.getElementById(`eval-photo-${key}`);
    const emptyEl = document.getElementById(`eval-photo-${key}-empty`);
    const pdfEl = document.getElementById(`eval-photo-${key}-pdf`);

    const isPdf = photoSrc && (photoSrc.startsWith('data:application/pdf') || photoSrc.includes('.pdf'));

    if (isPdf) {
      if (imgEl) { imgEl.src = ''; imgEl.style.display = 'none'; }
      if (emptyEl) emptyEl.style.display = 'none';
      if (pdfEl) pdfEl.style.display = 'flex';
    } else if (photoSrc) {
      if (pdfEl) pdfEl.style.display = 'none';
      if (imgEl) { imgEl.src = photoSrc; imgEl.style.display = 'block'; }
      if (emptyEl) emptyEl.style.display = 'none';
    } else {
      if (imgEl) { imgEl.src = ''; imgEl.style.display = 'none'; }
      if (pdfEl) pdfEl.style.display = 'none';
      if (emptyEl) emptyEl.style.display = 'block';
    }
  }

  function openPdfViewer(slotKey) {
    if (!currentlyEvaluatedDriver || !currentlyEvaluatedDriver.vehicle || !currentlyEvaluatedDriver.vehicle.photos) {
      showToast('Documento não disponível.', 'warning');
      return;
    }
    const src = currentlyEvaluatedDriver.vehicle.photos[slotKey];
    if (!src) {
      showToast('Nenhum documento PDF enviado para este item.', 'warning');
      return;
    }

    try {
      if (src.startsWith('data:application/pdf')) {
        const parts = src.split(',');
        const byteCharacters = atob(parts[1]);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, '_blank');
      } else {
        window.open(src, '_blank');
      }
    } catch (e) {
      window.open(src, '_blank');
    }
  }

  function closeDriverEvalModal() {
    const modal = document.getElementById('admin-modal-driver-eval');
    if (modal) modal.style.display = 'none';
    currentlyEvaluatedDriver = null;
  }

  // Decision Handlers from Eval Modal
  async function approveCurrentEvaluatedDriver() {
    if (!currentlyEvaluatedDriver) return;
    try {
      const res = await fetch(`/api/admin/drivers/${currentlyEvaluatedDriver.id}/approve`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ approved: true })
      });
      if (res.ok) {
        showToast(`Motorista ${currentlyEvaluatedDriver.name} aprovado com sucesso!`, 'success');
        await loadUsers();
        await loadStats();
        // Update modal state
        openDriverEvalModal(currentlyEvaluatedDriver.id);
      } else {
        showToast('Erro ao aprovar motorista', 'error');
      }
    } catch (e) {
      showToast('Erro de conexão com o servidor', 'error');
    }
  }

  async function rejectCurrentEvaluatedDriver() {
    if (!currentlyEvaluatedDriver) return;
    const reason = await showDialog({
      title: 'Reprovar Cadastro',
      message: 'Informe o motivo da reprovação ou pendência cadastral (ex: Foto da CNH ilegível, veículo fora do ano permitido, etc.):',
      type: 'prompt',
      placeholder: 'Motivo da reprovação...'
    });
    if (reason === null) return; // user cancelled

    try {
      const res = await fetch(`/api/admin/drivers/${currentlyEvaluatedDriver.id}/approve`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ approved: false, notes: reason })
      });
      if (res.ok) {
        showToast(`Cadastro do motorista ${currentlyEvaluatedDriver.name} reprovado / pendente.`, 'warning');
        await loadUsers();
        await loadStats();
        // Update modal state
        openDriverEvalModal(currentlyEvaluatedDriver.id);
      } else {
        showToast('Erro ao reprovar cadastro', 'error');
      }
    } catch (e) {
      showToast('Erro de conexão', 'error');
    }
  }

  async function toggleBanCurrentEvaluatedDriver() {
    if (!currentlyEvaluatedDriver) return;
    const isCurrentlyBanned = currentlyEvaluatedDriver.status === 'banned';

    let reason = '';
    if (!isCurrentlyBanned) {
      reason = await showDialog({
        title: 'Banir Motorista',
        message: `Informe o motivo do banimento de ${currentlyEvaluatedDriver.name}:`,
        type: 'prompt',
        placeholder: 'Motivo do banimento...'
      });
      if (reason === null || !reason.trim()) return;
    }

    try {
      const res = await fetch(`/api/admin/users/${currentlyEvaluatedDriver.id}/ban`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ action: isCurrentlyBanned ? 'unban' : 'ban', reason })
      });
      if (res.ok) {
        showToast(isCurrentlyBanned ? 'Motorista desbanido com sucesso!' : 'Motorista banido da plataforma!', 'success');
        await loadUsers();
        await loadStats();
        // Update modal state
        openDriverEvalModal(currentlyEvaluatedDriver.id);
      } else {
        showToast('Erro ao alterar status de banimento', 'error');
      }
    } catch (e) {
      showToast('Erro ao comunicar com o servidor', 'error');
    }
  }

  // Quick Table Toggle
  async function toggleApproveDriver(driverId, isApproved) {
    try {
      const res = await fetch(`/api/admin/drivers/${driverId}/approve`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ approved: !isApproved })
      });
      if (res.ok) {
        showToast(isApproved ? 'Cadastro de motorista reprovado' : 'Cadastro de motorista aprovado com sucesso!', 'info');
        loadUsers();
        loadStats();
      }
    } catch (e) {
      showToast('Erro ao processar aprovação', 'error');
    }
  }

  // Lightbox Photo Viewers
  function openPhotoLightbox(src, title) {
    if (!src || src.endsWith('alt=Motorista') || src === location.href) {
      showToast('Foto não disponível ou não enviada pelo motorista.', 'warning');
      return;
    }
    const overlay = document.getElementById('admin-modal-lightbox');
    const img = document.getElementById('lightbox-img');
    const titleEl = document.getElementById('lightbox-title');
    if (overlay && img) {
      img.src = src;
      if (titleEl) titleEl.innerText = title || 'Visualização da Foto';
      overlay.style.display = 'flex';
    }
  }

  function openLightboxFromSlot(slotKey) {
    if (!currentlyEvaluatedDriver || !currentlyEvaluatedDriver.vehicle || !currentlyEvaluatedDriver.vehicle.photos) {
      showToast('Nenhuma foto enviada para este documento.', 'warning');
      return;
    }
    const src = currentlyEvaluatedDriver.vehicle.photos[slotKey];
    if (!src) {
      showToast('O motorista ainda não enviou esta foto/documento.', 'warning');
      return;
    }
    if (src.startsWith('data:application/pdf') || src.includes('.pdf')) {
      return openPdfViewer(slotKey);
    }
    const titles = {
      front: 'Foto da Frente do Veículo (Placa visível)',
      side: 'Foto da Lateral do Veículo (Conservação e lataria)',
      rear: 'Foto da Traseira do Veículo (Placa traseira e lanternas)',
      seats: 'Foto dos Bancos e Interior do Veículo (Higiene e estofamento)',
      cnh: 'Documento CNH (Habilitação do Motorista)',
      doc: 'Documento CRLV (Documento do Veículo)'
    };
    openPhotoLightbox(src, titles[slotKey] || 'Documento do Motorista');
  }

  function closePhotoLightbox() {
    const overlay = document.getElementById('admin-modal-lightbox');
    if (overlay) overlay.style.display = 'none';
  }

  function formatDate(isoStr) {
    if (!isoStr) return '--';
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      return d.toLocaleDateString('pt-BR');
    } catch (e) {
      return isoStr;
    }
  }


  // Load Reports
  async function loadReports() {
    try {
      const res = await fetch('/api/reports', { headers: getHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      const tbody = document.getElementById('table-reports-body');
      if (!tbody) return;
      tbody.innerHTML = '';

      const reports = data.reports || [];
      if (reports.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #94a3b8; padding: 24px;">Nenhum reporte ou reclamação registrada até o momento.</td></tr>`;
        return;
      }

      reports.forEach(r => {
        const tr = document.createElement('tr');
        const isResolved = r.status === 'Resolvido';
        const roleLabel = r.reporterRole === 'driver' ? '<img src="/assets/icons/car.svg" class="svg-icon-img sm" style="vertical-align: -2px; margin-right: 3px;"> Motorista' : '<img src="/assets/icons/user.svg" class="svg-icon-img sm" style="vertical-align: -2px; margin-right: 3px;"> Passageiro';
        const dateStr = r.createdAt ? formatDate(r.createdAt) : '--';
        const categoryBadge = r.category ? `<span style="font-size: 10px; color: #00E5FF; font-weight: 700;">[${r.category}]</span> ` : '';

        tr.innerHTML = `
          <td><code>${r.id}</code><br><small style="color: #94a3b8;">${dateStr}</small></td>
          <td><b>${r.reporterName}</b><br><small style="color: #cbd5e1;">${roleLabel}</small></td>
          <td>${categoryBadge}<b>${r.targetName || '--'}</b></td>
          <td style="max-width: 280px; word-break: break-word;">${r.reason}</td>
          <td><span class="badge-status ${isResolved ? 'active' : 'banned'}">${r.status}</span></td>
          <td style="font-size: 11px; color: #cbd5e1; max-width: 220px;">${r.adminResponse || '<i style="color: #94a3b8;">Aguardando parecer oficial</i>'}</td>
          <td>
            <div style="display: flex; gap: 6px; align-items: center;">
              <button class="btn-action-small btn-resolve" onclick="AdminApp.openReportModal('${r.id}', '${r.reporterName}: ${(r.reason || '').replace(/'/g, "\\'")}')">
                ${isResolved ? 'Editar Parecer' : 'Responder'}
              </button>
              <button class="btn-action-small" style="background: rgba(239, 68, 68, 0.15); color: #EF4444; border: 1px solid rgba(239, 68, 68, 0.4); padding: 5px 8px;" onclick="AdminApp.deleteReport('${r.id}')" title="Excluir reporte do banco de dados">
                <img src="/assets/icons/trash.svg" class="svg-icon-img sm" alt="" style="vertical-align: -2px; margin-right: 3px;"> Excluir
              </button>
            </div>
          </td>
        `;
        tbody.appendChild(tr);
      });
    } catch (e) {
      console.error('Erro ao carregar reportes:', e);
    }
  }

  function openReportModal(reportId, detail) {
    currentRespondingReportId = reportId;
    document.getElementById('admin-rep-detail').innerText = detail;
    document.getElementById('admin-modal-report').classList.add('active');
  }

  function closeReportModal() {
    document.getElementById('admin-modal-report').classList.remove('active');
  }

  async function submitReportResponse() {
    const response = document.getElementById('admin-rep-response').value.trim();
    if (!response) {
      showToast('Digite uma resposta oficial para o usuário', 'warning');
      return;
    }

    try {
      const res = await fetch(`/api/reports/${currentRespondingReportId}/respond`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ response, status: 'Resolvido' })
      });
      if (res.ok) {
        showToast('Parecer registrado e enviado com sucesso! Reporte marcado como Resolvido.', 'success');
        closeReportModal();
        loadReports();
        loadStats();
      }
    } catch (e) {
      showToast('Erro ao responder reporte', 'error');
    }
  }

  // Load Weekly Financial Module (Painel Financeiro & Repasses Semanais)
  let loadedPaymentsData = null;

  async function loadPayments() {
    try {
      const res = await fetch('/api/payments', { headers: getHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      loadedPaymentsData = data;
      const tbody = document.getElementById('table-payments-body');
      if (!tbody) return;
      tbody.innerHTML = '';

      // 1. Update Financial KPIs
      if (data.stats) {
        const revEl = document.getElementById('fin-kpi-total-revenue');
        const paidEl = document.getElementById('fin-kpi-paid-drivers');
        const carsMotosEl = document.getElementById('fin-kpi-cars-motos');
        const freeEl = document.getElementById('fin-kpi-free-pass');
        const pendingEl = document.getElementById('fin-kpi-pending-drivers');
        const cycleDatesEl = document.getElementById('finance-cycle-dates');

        if (revEl) revEl.innerText = `R$ ${data.stats.totalRevenue.toFixed(2).replace('.', ',')}`;
        if (paidEl) paidEl.innerText = String(data.stats.totalPaidDrivers);
        if (carsMotosEl) carsMotosEl.innerText = `${data.stats.totalCarPaid} Carros / ${data.stats.totalMotoPaid} Motos`;
        if (freeEl) freeEl.innerText = String(data.stats.totalFreePass);
        if (pendingEl) pendingEl.innerText = String(data.stats.totalPending);
        if (cycleDatesEl && data.currentCycle) {
          cycleDatesEl.innerText = `${data.currentCycle.mondayStr} até ${data.currentCycle.sundayStr}`;
        }
      }

      // 2. Populate Drivers Payment Table
      const drivers = data.drivers || [];
      if (drivers.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #94a3b8; padding: 24px;">Nenhum motorista cadastrado no momento.</td></tr>`;
        return;
      }

      drivers.forEach(d => {
        const tr = document.createElement('tr');
        const isMoto = d.vehicle && d.vehicle.type === 'moto';
        const feeAmount = isMoto ? 'R$ 50,00' : 'R$ 100,00';
        const vehCategory = isMoto ? '<img src="/assets/icons/moto.svg" class="svg-icon-img sm" style="vertical-align: -2px; margin-right: 3px;"> Motoboy' : '<img src="/assets/icons/car.svg" class="svg-icon-img sm" style="vertical-align: -2px; margin-right: 3px;"> Carro Comum';
        const vehPlate = d.vehicle ? (d.vehicle.plate || 'ABC-1234') : 'ABC-1234';

        const status = d.weeklyPaymentStatus || 'REGULAR';
        let statusBadgeClass = 'regular';
        let statusLabel = 'REGULAR';

        if (status === 'PASSE_GRATIS') {
          statusBadgeClass = 'free';
          statusLabel = '1 SEMANA GRÁTIS';
        } else if (status === 'BLOQUEADO' || d.paymentBlocked) {
          statusBadgeClass = 'blocked';
          statusLabel = 'BLOQUEADO';
        } else if (status === 'PENDENTE') {
          statusBadgeClass = 'pending';
          statusLabel = 'PENDENTE';
        }

        const cycleText = data.currentCycle ? `${data.currentCycle.mondayStr} a ${data.currentCycle.sundayStr}` : 'Semana Vigente';
        const approvedBy = d.lastApprovedBy || 'admin@maxdrive.com';
        const approvedAt = d.lastApprovedAt ? formatDate(d.lastApprovedAt) : '--';

        tr.innerHTML = `
          <td>
            <b>${d.name}</b><br>
            <small style="color: #94a3b8;">${d.phone || '--'} • Placa: ${vehPlate}</small>
          </td>
          <td>
            <span style="font-weight: 800; color: ${isMoto ? '#00E5FF' : '#FEE500'}; display: inline-flex; align-items: center;">${vehCategory}</span><br>
            <b style="font-size: 14px; color: #FFFFFF;">${feeAmount}</b> / sem.
          </td>
          <td>
            <span style="color: #cbd5e1; font-weight: 700;">${cycleText}</span><br>
            <small style="color: #94a3b8;">Expira no Domingo 23:59</small>
          </td>
          <td>
            <span class="badge-status ${statusBadgeClass}">${statusLabel}</span>
          </td>
          <td>
            <div style="font-size: 11px;">
              <span style="color: #94a3b8;">Admin:</span> <b>${approvedBy}</b><br>
              <small style="color: #94a3b8;">Data: ${approvedAt}</small>
            </div>
            <button class="btn-action-small btn-audit-pay" style="margin-top: 4px;" onclick="AdminApp.openAuditModal('${d.id}')">
              <img src="/assets/icons/file-text.svg" class="svg-icon-img sm" style="vertical-align: -2px; margin-right: 4px;"> Auditoria / Comprovante
            </button>
          </td>
          <td>
            <div style="display: flex; gap: 6px; flex-wrap: wrap;">
              <button class="btn-action-small btn-pay-confirm" title="Confirmar pagamento semanal e registrar no financeiro" onclick="AdminApp.confirmDriverPayment('${d.id}')">
                <img src="/assets/icons/check-circle.svg" class="svg-icon-img sm" style="vertical-align: -2px; margin-right: 3px;"> Pago
              </button>
              <button class="btn-action-small btn-free-pass" title="Conceder 1 semana grátis de cortesia" onclick="AdminApp.grantFreePass('${d.id}')">
                <img src="/assets/icons/gift.svg" class="svg-icon-img sm" style="vertical-align: -2px; margin-right: 3px;"> 1 Sem. Grátis
              </button>
              ${(d.paymentBlocked || status === 'BLOQUEADO') ? `
                <button class="btn-action-small btn-unblock-pay" title="Liberar acesso do motorista" onclick="AdminApp.unblockDriverPayment('${d.id}')">
                  <img src="/assets/icons/unlock.svg" class="svg-icon-img sm" style="vertical-align: -2px; margin-right: 3px;"> Liberar
                </button>
              ` : `
                <button class="btn-action-small btn-block-pay" title="Bloquear conta por falta de pagamento" onclick="AdminApp.blockDriverPayment('${d.id}')">
                  <img src="/assets/icons/lock.svg" class="svg-icon-img sm" style="vertical-align: -2px; margin-right: 3px;"> Bloquear
                </button>
              `}
            </div>
          </td>
        `;
        tbody.appendChild(tr);
      });
    } catch (e) {
      console.error('Erro ao carregar pagamentos semanais:', e);
    }
  }

  // Confirm Payment (Aprovar / Debitar no Financeiro)
  async function confirmDriverPayment(driverId) {
    const confirmed = await showDialog({
      title: 'Confirmar Pagamento Semanal',
      message: 'Confirmar recebimento do Pix desta semana para o motorista? O valor será debitado/registrado no financeiro e o acesso estendido até domingo.',
      type: 'confirm',
      confirmText: 'CONFIRMAR PAGAMENTO',
      cancelText: 'CANCELAR'
    });

    if (!confirmed) return;

    try {
      const res = await fetch('/api/payments/confirm', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ driverId })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(data.message || 'Pagamento confirmado com sucesso!', 'success');
        loadPayments();
        loadStats();
      } else {
        showToast(data.message || 'Erro ao confirmar pagamento', 'error');
      }
    } catch (e) {
      showToast('Erro de conexão ao confirmar pagamento', 'error');
    }
  }

  // Grant 1 Week Free Pass (Passe Cortesia)
  async function grantFreePass(driverId) {
    const confirmed = await showDialog({
      title: 'Conceder 1 Semana Grátis',
      message: 'Deseja conceder 1 semana de passe livre gratuito (cortesia da diretoria) para este motorista até o próximo domingo?',
      type: 'confirm',
      confirmText: 'CONCEDER PASSE GRÁTIS',
      cancelText: 'CANCELAR'
    });

    if (!confirmed) return;

    try {
      const res = await fetch('/api/payments/free-pass', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ driverId })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(data.message || '1 Semana Grátis concedida com sucesso!', 'success');
        loadPayments();
        loadStats();
      } else {
        showToast(data.message || 'Erro ao conceder passe grátis', 'error');
      }
    } catch (e) {
      showToast('Erro de conexão ao conceder passe grátis', 'error');
    }
  }

  // Block Driver by Payment
  async function blockDriverPayment(driverId) {
    const confirmed = await showDialog({
      title: 'Bloquear por Falta de Pagamento',
      message: 'Tem certeza que deseja bloquear a conta deste motorista por falta de pagamento semanal? Ele ficará impedido de aceitar corridas até o acerto.',
      type: 'confirm',
      confirmText: 'BLOQUEAR CONTA',
      cancelText: 'CANCELAR'
    });

    if (!confirmed) return;

    try {
      const res = await fetch(`/api/payments/${driverId}/block`, {
        method: 'PUT',
        headers: getHeaders()
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(data.message || 'Motorista bloqueado com sucesso!', 'warning');
        loadPayments();
        loadStats();
      }
    } catch (e) {
      showToast('Erro ao bloquear motorista', 'error');
    }
  }

  // Unblock Driver
  async function unblockDriverPayment(driverId) {
    try {
      const res = await fetch(`/api/payments/${driverId}/unblock`, {
        method: 'PUT',
        headers: getHeaders()
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(data.message || 'Acesso do motorista liberado com sucesso!', 'success');
        loadPayments();
        loadStats();
      }
    } catch (e) {
      showToast('Erro ao liberar motorista', 'error');
    }
  }

  // Export Financial CSV (Excel format with UTF-8 BOM)
  function exportFinancialCSV() {
    if (!loadedPaymentsData || !loadedPaymentsData.drivers || loadedPaymentsData.drivers.length === 0) {
      showToast('Nenhum dado financeiro disponível para exportação.', 'warning');
      return;
    }

    const cycle = loadedPaymentsData.currentCycle;
    const cycleStr = cycle ? `${cycle.mondayStr} a ${cycle.sundayStr}` : 'Semana Vigente';

    const headers = [
      'Motorista',
      'Telefone',
      'Placa',
      'Categoria',
      'Taxa Semanal (R$)',
      'Status de Pagamento',
      'Ciclo Vigente',
      'Valido Ate',
      'Aprovado Por',
      'Data Aprovacao'
    ];

    const rows = loadedPaymentsData.drivers.map(d => {
      const isMoto = d.vehicle && d.vehicle.type === 'moto';
      const vehCategory = isMoto ? 'Moto' : 'Carro';
      const feeAmount = isMoto ? '50.00' : '100.00';
      const status = d.weeklyPaymentStatus || 'REGULAR';
      const vehPlate = d.vehicle ? (d.vehicle.plate || '--') : '--';
      const validUntil = d.paidUntil ? new Date(d.paidUntil).toLocaleDateString('pt-BR') : (cycle ? cycle.sundayStr : '--');
      const approvedBy = d.lastApprovedBy || 'admin@maxdrive.com';
      const approvedAt = d.lastApprovedAt ? formatDate(d.lastApprovedAt) : '--';

      return [
        `"${(d.name || '').replace(/"/g, '""')}"`,
        `"${(d.phone || '').replace(/"/g, '""')}"`,
        `"${vehPlate}"`,
        `"${vehCategory}"`,
        `"${feeAmount}"`,
        `"${status}"`,
        `"${cycleStr}"`,
        `"${validUntil}"`,
        `"${approvedBy}"`,
        `"${approvedAt}"`
      ].join(';');
    });

    const stats = loadedPaymentsData.stats || {};
    const summaryRows = [
      '',
      `"RESUMO FINANCEIRO DA DIRETORIA"`,
      `"Faturamento Total Arrecadado";"R$ ${(stats.totalRevenue || 0).toFixed(2)}"`,
      `"Motoristas Regulares (Pagos)";"${stats.totalPaidDrivers || 0}"`,
      `"Carros Pagos (R$ 100)";"${stats.totalCarPaid || 0}"`,
      `"Motos Pagas (R$ 50)";"${stats.totalMotoPaid || 0}"`,
      `"Cortesias (1 Sem. Gratis)";"${stats.totalFreePass || 0}"`,
      `"Inadimplentes / Pendentes";"${stats.totalPending || 0}"`
    ];

    const csvContent = '\uFEFF' + headers.join(';') + '\n' + rows.join('\n') + '\n' + summaryRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    const dateStr = new Date().toISOString().slice(0, 10);
    link.setAttribute('download', `maxdrive_relatorio_financeiro_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Relatório financeiro exportado com sucesso!', 'success');
  }

  // Audit Modal Methods
  async function openAuditModal(driverId) {
    currentAuditingDriverId = driverId;
    const metaEl = document.getElementById('audit-driver-meta');
    const imgEl = document.getElementById('audit-receipt-img');
    const emptyEl = document.getElementById('audit-receipt-empty');

    try {
      const res = await fetch(`/api/users/${driverId}`);
      const data = await res.json();
      const driver = data.user || {};

      const isMoto = driver.vehicle?.type === 'moto';
      const feeStr = isMoto ? 'R$ 50,00 (Moto)' : 'R$ 100,00 (Carro)';

      metaEl.innerHTML = `
        <div><b>Motorista:</b> ${driver.name || 'Marcos Marques'}</div>
        <div><b>Categoria:</b> ${feeStr} • <b>Placa:</b> ${driver.vehicle?.plate || 'ABC-1234'}</div>
        <div><b>Status:</b> ${driver.weeklyPaymentStatus || 'REGULAR'}</div>
        <div><b>Última Aprovação:</b> ${driver.lastApprovedBy || 'admin@maxdrive.com'} (${driver.lastApprovedAt ? formatDate(driver.lastApprovedAt) : '--'})</div>
      `;

      if (driver.latestReceiptUrl) {
        imgEl.src = driver.latestReceiptUrl;
        imgEl.style.display = 'block';
        emptyEl.style.display = 'none';
      } else {
        imgEl.style.display = 'none';
        emptyEl.style.display = 'block';
      }

      document.getElementById('admin-modal-audit').classList.add('active');
    } catch (e) {
      showToast('Erro ao abrir auditoria', 'error');
    }
  }

  function closeAuditModal() {
    document.getElementById('admin-modal-audit').classList.remove('active');
  }

  async function handleAuditFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.onload = async function(evt) {
        const dataUrl = evt.target.result;
        const res = await fetch('/api/payments/audit-receipt', {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({
            driverId: currentAuditingDriverId,
            receiptUrl: dataUrl
          })
        });

        if (res.ok) {
          showToast('Comprovante arquivado com sucesso para auditoria!', 'success');
          const imgEl = document.getElementById('audit-receipt-img');
          const emptyEl = document.getElementById('audit-receipt-empty');
          imgEl.src = dataUrl;
          imgEl.style.display = 'block';
          emptyEl.style.display = 'none';
          loadPayments();
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      showToast('Erro ao carregar arquivo do comprovante', 'error');
    }
  }

  // Loaded cities cache
  let loadedCities = [];

  // Load and Add Cities
  async function loadCities() {
    try {
      const res = await fetch('/api/cities');
      if (!res.ok) return;
      const data = await res.json();
      const container = document.getElementById('cities-chips-container');
      if (!container) return;
      container.innerHTML = '';
      loadedCities = data.cities || [];

      if (loadedCities.length === 0) {
        container.innerHTML = '<div style="padding: 16px; color: #94a3b8; font-size: 12px; text-align: center;">Nenhuma cidade cadastrada ainda.</div>';
        return;
      }

      loadedCities.forEach(c => {
        const div = document.createElement('div');
        div.style.cssText = 'background: rgba(255,255,255,0.025); border: 1px solid var(--border-subtle); padding: 12px 14px; border-radius: var(--radius-sm); display: flex; flex-direction: column; gap: 8px; transition: all 0.15s ease;';
        
        const isActive = c.active !== false;
        const carBase = Number(c.baseFareCar || 6.00).toFixed(2);
        const carKm = Number(c.kmRateCar !== undefined ? c.kmRateCar : 1.00).toFixed(2);
        const motoBase = Number(c.baseFareMoto || 4.50).toFixed(2);
        const motoKm = Number(c.kmRateMoto !== undefined ? c.kmRateMoto : 0.85).toFixed(2);

        div.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <img src="/assets/icons/pin.svg" class="svg-icon-img sm" alt="" style="vertical-align: -2px;">
              <b style="font-size: 13px; color: #FFFFFF;">${c.name} (${c.state || 'MG'})</b>
            </div>
            <span class="badge-status ${isActive ? 'active' : 'pending'}">${isActive ? 'Ativa' : 'Inativa'}</span>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 11px; background: rgba(0,0,0,0.3); padding: 7px 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.03);">
            <div style="color: var(--cyan-action); display: flex; align-items: center;">
              <b><img src="/assets/icons/car.svg" class="svg-icon-img sm" style="vertical-align: -2px; margin-right: 3px;"> Carro:</b>&nbsp;R$ ${carBase} <span style="color: #64748b; margin: 0 4px;">base</span> • R$ ${carKm}/km
            </div>
            <div style="color: var(--yellow-primary); display: flex; align-items: center;">
              <b><img src="/assets/icons/moto.svg" class="svg-icon-img sm" style="vertical-align: -2px; margin-right: 3px;"> Moto:</b>&nbsp;R$ ${motoBase} <span style="color: #64748b; margin: 0 4px;">base</span> • R$ ${motoKm}/km
            </div>
          </div>

          <div style="display: flex; gap: 6px; justify-content: flex-end; align-items: center; margin-top: 2px;">
            <button type="button" class="btn-action-small btn-resolve" onclick="AdminApp.openEditCityModal('${c.id}')" style="display: flex; align-items: center; gap: 4px; padding: 5px 12px; font-size: 11px;">
              <img src="/assets/icons/edit.svg" class="svg-icon-img sm" style="vertical-align: -2px;"> Editar Tarifas
            </button>
            <button type="button" class="btn-action-small" onclick="AdminApp.deleteCity('${c.id}', '${c.name}')" style="background: rgba(239, 68, 68, 0.12); color: #EF4444; border: 1px solid rgba(239, 68, 68, 0.3); padding: 5px 8px; font-size: 11px;" title="Remover Cidade">
              <img src="/assets/icons/trash.svg" class="svg-icon-img sm" style="vertical-align: -2px;">
            </button>
          </div>
        `;
        container.appendChild(div);
      });
    } catch (e) {
      console.error('Erro ao carregar cidades:', e);
    }
  }

  function openEditCityModal(cityId) {
    const city = loadedCities.find(c => String(c.id).toLowerCase() === String(cityId).toLowerCase());
    if (!city) {
      showToast('Cidade não encontrada', 'error');
      return;
    }

    document.getElementById('edit-city-id').value = city.id;
    document.getElementById('edit-city-title').innerText = `Ajustar Tarifas: ${city.name} (${city.state || 'MG'})`;
    document.getElementById('edit-city-name').value = city.name;
    document.getElementById('edit-city-state').value = city.state || 'MG';
    document.getElementById('edit-city-base-car').value = Number(city.baseFareCar || 6.00);
    document.getElementById('edit-city-km-car').value = Number(city.kmRateCar !== undefined ? city.kmRateCar : 1.00);
    document.getElementById('edit-city-base-moto').value = Number(city.baseFareMoto || 4.50);
    document.getElementById('edit-city-km-moto').value = Number(city.kmRateMoto !== undefined ? city.kmRateMoto : 0.85);
    document.getElementById('edit-city-active').value = city.active !== false ? 'true' : 'false';

    const modal = document.getElementById('admin-modal-edit-city');
    if (modal) modal.style.display = 'flex';
  }

  function closeEditCityModal() {
    const modal = document.getElementById('admin-modal-edit-city');
    if (modal) modal.style.display = 'none';
  }

  async function handleSaveEditCity(e) {
    if (e) e.preventDefault();
    const cityId = document.getElementById('edit-city-id').value;
    const name = document.getElementById('edit-city-name').value.trim();
    const state = document.getElementById('edit-city-state').value.trim().toUpperCase();
    const baseFareCar = parseFloat(document.getElementById('edit-city-base-car').value);
    const kmRateCar = parseFloat(document.getElementById('edit-city-km-car').value);
    const baseFareMoto = parseFloat(document.getElementById('edit-city-base-moto').value);
    const kmRateMoto = parseFloat(document.getElementById('edit-city-km-moto').value);
    const active = document.getElementById('edit-city-active').value === 'true';

    if (!name) {
      showToast('O nome da cidade é obrigatório', 'warning');
      return;
    }

    try {
      const res = await fetch(`/api/cities/${encodeURIComponent(cityId)}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({
          name,
          state,
          baseFareCar,
          kmRateCar,
          baseFareMoto,
          kmRateMoto,
          active
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Tarifas de ${name} atualizadas com sucesso!`, 'success');
        closeEditCityModal();
        loadCities();
      } else {
        showToast(data.message || 'Erro ao atualizar cidade', 'error');
      }
    } catch (err) {
      showToast('Erro de conexão com o servidor', 'error');
    }
  }

  async function deleteCity(cityId, cityName) {
    const confirmed = await showDialog({
      title: 'Remover Cidade',
      message: `Deseja realmente remover a cidade "${cityName}" do sistema? Esta ação desabilitará novas corridas para esta localidade.`,
      type: 'confirm',
      confirmText: 'SIM, REMOVER',
      cancelText: 'CANCELAR'
    });

    if (!confirmed) return;

    try {
      const res = await fetch(`/api/cities/${encodeURIComponent(cityId)}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Cidade ${cityName} removida com sucesso!`, 'success');
        loadCities();
      } else {
        showToast(data.message || 'Erro ao remover cidade', 'error');
      }
    } catch (err) {
      showToast('Erro de conexão ao remover cidade', 'error');
    }
  }

  async function deleteUser(userId, userName) {
    const confirmed = await showDialog({
      title: 'Excluir Conta do Banco de Dados',
      message: `Tem certeza que deseja EXCLUIR PERMANENTEMENTE a conta de "${userName}" do banco de dados? Esta ação é irreversível.`,
      type: 'confirm',
      confirmText: 'SIM, EXCLUIR',
      cancelText: 'CANCELAR'
    });

    if (!confirmed) return;

    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Conta de ${userName} excluída do banco de dados com sucesso!`, 'success');
        loadUsers();
      } else {
        showToast(data.message || 'Erro ao excluir conta', 'error');
      }
    } catch (err) {
      showToast('Erro de conexão ao excluir conta', 'error');
    }
  }

  async function deleteReport(reportId) {
    const confirmed = await showDialog({
      title: 'Excluir Reporte',
      message: `Deseja remover permanentemente este reporte do banco de dados?`,
      type: 'confirm',
      confirmText: 'EXCLUIR',
      cancelText: 'CANCELAR'
    });

    if (!confirmed) return;

    try {
      const res = await fetch(`/api/reports/${encodeURIComponent(reportId)}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Reporte removido do banco de dados com sucesso!', 'success');
        loadReports();
      } else {
        showToast(data.message || 'Erro ao excluir reporte', 'error');
      }
    } catch (err) {
      showToast('Erro de conexão ao excluir reporte', 'error');
    }
  }

  async function deleteAdminMessagesForUser(userId, userName) {
    const confirmed = await showDialog({
      title: 'Excluir Conversa de Suporte',
      message: `Deseja apagar PERMANENTEMENTE todo o histórico de mensagens com "${userName}" do banco de dados?`,
      type: 'confirm',
      confirmText: 'EXCLUIR CONVERSA',
      cancelText: 'CANCELAR'
    });

    if (!confirmed) return;

    try {
      const res = await fetch(`/api/admin-messages/user/${encodeURIComponent(userId)}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Histórico de mensagens excluído do banco de dados com sucesso!', 'success');
        loadAdminConversations();
        closeDirectMessageModal();
      } else {
        showToast(data.message || 'Erro ao excluir mensagens', 'error');
      }
    } catch (err) {
      showToast('Erro de conexão ao excluir mensagens', 'error');
    }
  }

  async function handleAddCity(e) {
    if (e) e.preventDefault();
    const name = document.getElementById('new-city-name').value.trim();
    const state = document.getElementById('new-city-state').value.trim();
    const baseFareCar = parseFloat(document.getElementById('new-city-fare-car').value) || 7.00;
    const kmRateCar = parseFloat(document.getElementById('new-city-km-car').value) || 1.00;
    const baseFareMoto = parseFloat(document.getElementById('new-city-fare-moto').value) || 5.50;
    const kmRateMoto = parseFloat(document.getElementById('new-city-km-moto').value) || 0.85;

    try {
      const res = await fetch('/api/cities', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ name, state, baseFareCar, kmRateCar, baseFareMoto, kmRateMoto })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || `Cidade ${name} processada com sucesso!`, 'success');
        document.getElementById('new-city-name').value = '';
        loadCities();
      } else {
        showToast(data.message || 'Erro ao adicionar cidade', 'error');
      }
    } catch (err) {
      showToast('Erro de conexão ao adicionar cidade', 'error');
    }
  }

  // =========================================================
  // ADMIN DIRECT MESSAGING & SUPPORT SYSTEM
  // =========================================================
  let currentChatUserId = null;
  let currentChatUserName = '';
  let currentChatUserRole = '';

  function openDirectMessageModal(userId, userName, userRole) {
    currentChatUserId = userId;
    currentChatUserName = userName || 'Usuário';
    currentChatUserRole = userRole || 'driver';

    const modal = document.getElementById('modal-admin-direct-chat');
    const nameEl = document.getElementById('admin-chat-target-name');
    const roleEl = document.getElementById('admin-chat-target-role');
    const avatarEl = document.getElementById('admin-chat-target-avatar');

    if (nameEl) nameEl.innerText = currentChatUserName;
    if (roleEl) roleEl.innerText = currentChatUserRole === 'driver' ? 'MOTORISTA PARCEIRO' : 'PASSAGEIRO';
    if (avatarEl) {
      avatarEl.innerText = (currentChatUserName || 'U').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
    }

    if (modal) modal.style.display = 'flex';
    loadDirectMessages();
  }

  function closeDirectMessageModal() {
    currentChatUserId = null;
    const modal = document.getElementById('modal-admin-direct-chat');
    if (modal) modal.style.display = 'none';
    loadConversationsList();
    checkAdminUnreadMessages();
  }

  async function loadDirectMessages(silent = false) {
    if (!currentChatUserId) return;
    try {
      const res = await fetch(`/api/admin-messages?userId=${encodeURIComponent(currentChatUserId)}`, {
        headers: getHeaders()
      });
      if (!res.ok) return;
      const data = await res.json();
      const messages = data.messages || [];

      // Mark as read by admin
      fetch('/api/admin-messages/read', {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ userId: currentChatUserId, readerRole: 'admin' })
      }).catch(() => {});

      const container = document.getElementById('admin-chat-messages-body');
      if (!container) return;

      if (messages.length === 0) {
        container.innerHTML = `
          <div style="text-align: center; padding: 40px 20px; color: #94a3b8; font-size: 13px;">
            <img src="/assets/icons/chat.svg" class="svg-icon-img lg" alt="" style="display: block; margin: 0 auto 10px auto; opacity: 0.4;">
            Inicie a conversa com <b>${currentChatUserName}</b> digitando uma mensagem abaixo.
          </div>
        `;
        return;
      }

      container.innerHTML = '';
      messages.forEach(m => {
        const isAdmin = m.senderRole === 'admin';
        const bubble = document.createElement('div');
        bubble.style.maxWidth = '75%';
        bubble.style.padding = '10px 14px';
        bubble.style.borderRadius = isAdmin ? '16px 16px 4px 16px' : '16px 16px 16px 4px';
        bubble.style.alignSelf = isAdmin ? 'flex-end' : 'flex-start';
        bubble.style.background = isAdmin ? '#00E5FF' : '#1e293b';
        bubble.style.color = isAdmin ? '#000000' : '#FFFFFF';
        bubble.style.border = isAdmin ? 'none' : '1px solid rgba(255,255,255,0.15)';
        bubble.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';

        bubble.innerHTML = `
          <div style="font-size: 10px; font-weight: 800; color: ${isAdmin ? '#00363a' : 'var(--yellow-primary)'}; margin-bottom: 3px; display: flex; justify-content: space-between; gap: 8px;">
            <span>${isAdmin ? 'DIRETORIA (VOCÊ)' : m.senderName}</span>
            <span>${m.timestamp || ''}</span>
          </div>
          <div style="font-size: 13px; font-weight: 600; line-height: 1.35; word-break: break-word;">${m.text}</div>
        `;
        container.appendChild(bubble);
      });

      if (!silent) {
        container.scrollTop = container.scrollHeight;
      }
    } catch (e) {
      console.warn('Erro ao carregar mensagens diretas:', e);
    }
  }

  async function sendDirectMessage(e) {
    if (e) e.preventDefault();
    const input = document.getElementById('admin-chat-input');
    if (!input || !input.value.trim() || !currentChatUserId) return;

    const text = input.value.trim();
    input.value = '';

    try {
      const res = await fetch('/api/admin-messages', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          senderId: 'admin-master',
          senderRole: 'admin',
          senderName: 'Diretoria MAX DRIVE',
          recipientId: currentChatUserId,
          recipientRole: currentChatUserRole,
          recipientName: currentChatUserName,
          text
        })
      });

      if (res.ok) {
        showToast('Mensagem enviada com sucesso ao usuário!', 'success');
        loadDirectMessages();
      } else {
        showToast('Erro ao enviar mensagem', 'error');
      }
    } catch (err) {
      showToast('Erro de conexão ao enviar mensagem', 'error');
    }
  }

  async function loadConversationsList() {
    const listContainer = document.getElementById('admin-conversations-list');
    if (!listContainer) return;

    try {
      const res = await fetch('/api/admin-messages', { headers: getHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      const conversations = data.conversations || [];

      if (conversations.length === 0) {
        listContainer.innerHTML = `
          <div style="text-align: center; padding: 40px; color: #94a3b8; font-size: 13px; background: rgba(255,255,255,0.02); border-radius: 14px;">
            Nenhuma conversa ativa no momento.<br>
            Você pode iniciar uma conversa clicando no botão <b>"Mensagem"</b> na tabela de Motoristas ou Usuários.
          </div>
        `;
        return;
      }

      listContainer.innerHTML = '';
      conversations.forEach(c => {
        const item = document.createElement('div');
        item.style.background = c.unreadCount > 0 ? 'rgba(0, 229, 255, 0.05)' : 'rgba(255, 255, 255, 0.02)';
        item.style.border = c.unreadCount > 0 ? '1px solid rgba(0, 229, 255, 0.4)' : '1px solid var(--border-subtle)';
        item.style.borderRadius = 'var(--radius-sm)';
        item.style.padding = '10px 14px';
        item.style.display = 'flex';
        item.style.alignItems = 'center';
        item.style.justifyContent = 'space-between';
        item.style.cursor = 'pointer';
        item.style.transition = 'all 0.15s ease';

        const initials = (c.userName || 'U').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();

        item.innerHTML = `
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 36px; height: 36px; border-radius: 50%; background: ${c.userRole === 'driver' ? 'rgba(255, 230, 0, 0.12)' : 'rgba(0, 229, 255, 0.12)'}; border: 1px solid ${c.userRole === 'driver' ? 'rgba(255, 230, 0, 0.35)' : 'rgba(0, 229, 255, 0.35)'}; color: ${c.userRole === 'driver' ? 'var(--yellow-primary)' : 'var(--cyan-action)'}; font-weight: 800; font-size: 12px; display: flex; align-items: center; justify-content: center;">
              ${initials}
            </div>
            <div>
              <div style="font-weight: 700; font-size: 13px; color: #fff; display: flex; align-items: center; gap: 6px;">
                ${c.userName}
                <span class="badge-status ${c.userRole === 'driver' ? 'approved' : 'pending'}" style="font-size: 9px; padding: 1px 5px;">
                  ${c.userRole === 'driver' ? 'MOTORISTA' : 'PASSAGEIRO'}
                </span>
                ${c.unreadCount > 0 ? `<span style="background: #EF4444; color: #fff; font-size: 9px; font-weight: 800; padding: 1px 6px; border-radius: 10px;">${c.unreadCount} NOVA(S)</span>` : ''}
              </div>
              <div style="font-size: 11.5px; color: var(--text-secondary); margin-top: 2px; max-width: 480px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                ${c.lastMessage || '--'}
              </div>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 10.5px; color: var(--text-tertiary);">${c.lastTimestamp || ''}</span>
            <button class="btn-action-small btn-msg" style="padding: 5px 12px; font-size: 11px;">
              ABRIR CHAT
            </button>
            <button class="btn-action-small" style="background: rgba(239, 68, 68, 0.15); color: #EF4444; border: 1px solid rgba(239, 68, 68, 0.4); padding: 5px 8px; font-size: 11px;" onclick="event.stopPropagation(); AdminApp.deleteAdminMessagesForUser('${c.userId}', '${(c.userName || 'Usuário').replace(/'/g, "\\'")}')" title="Excluir todas as mensagens desta conversa">
              <img src="/assets/icons/trash.svg" class="svg-icon-img sm" alt="" style="vertical-align: -2px; margin-right: 3px;"> Excluir
            </button>
          </div>
        `;

        item.onclick = () => openDirectMessageModal(c.userId, c.userName, c.userRole);
        listContainer.appendChild(item);
      });
    } catch (e) {
      console.warn('Erro ao carregar lista de conversas:', e);
    }
  }

  async function checkAdminUnreadMessages() {
    try {
      const res = await fetch('/api/admin-messages/unread-count?role=admin', { headers: getHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      const badge = document.getElementById('admin-msgs-badge');
      if (badge) {
        if (data.unreadCount > 0) {
          badge.innerText = data.unreadCount;
          badge.style.display = 'inline-block';
        } else {
          badge.style.display = 'none';
        }
      }
    } catch (e) {}
  }

  // Init
  window.addEventListener('DOMContentLoaded', checkAuth);

  return {
    switchTab,
    authenticate,
    logout,
    filterUsers,
    filterDrivers,
    exportUsersCSV,
    toggleBan,
    toggleApproveDriver,
    openDriverEvalModal,
    closeDriverEvalModal,
    approveCurrentEvaluatedDriver,
    rejectCurrentEvaluatedDriver,
    toggleBanCurrentEvaluatedDriver,
    openPhotoLightbox,
    openLightboxFromSlot,
    openPdfViewer,
    closePhotoLightbox,
    openReportModal,
    closeReportModal,
    submitReportResponse,
    loadReports,
    loadPayments,
    exportFinancialCSV,
    confirmDriverPayment,
    grantFreePass,
    blockDriverPayment,
    unblockDriverPayment,
    openAuditModal,
    closeAuditModal,
    handleAuditFileSelect,
    loadCities,
    handleAddCity,
    openEditCityModal,
    closeEditCityModal,
    handleSaveEditCity,
    deleteCity,
    deleteUser,
    deleteReport,
    deleteAdminMessagesForUser,
    showToast,
    showDialog,
    openDirectMessageModal,
    closeDirectMessageModal,
    sendDirectMessage,
    loadConversationsList,
    checkAdminUnreadMessages
  };
})();

window.AdminApp = AdminApp;
