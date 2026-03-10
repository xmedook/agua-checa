// =============================================
// AquaTrack — Main App Controller
// =============================================

const App = {
    // State
    counters: { agua: 0, hielo: 0 },
    noCompro: false,
    lastMovimiento: null,

    // ==========================================
    // INITIALIZATION
    // ==========================================
    init() {
        DB.seed();
        window.addEventListener('hashchange', () => this.route());
        this.route();
    },

    // ==========================================
    // ROUTER
    // ==========================================
    route() {
        const hash = location.hash.slice(1) || '';
        const app = document.getElementById('app');

        if (!Session.isLoggedIn() && hash !== 'login') {
            location.hash = '#login';
            return;
        }

        if (Session.isLoggedIn() && hash === 'login') {
            const user = Session.getUser();
            location.hash = user.rol === 'ADMIN' ? '#admin/clientes' : '#dashboard';
            return;
        }

        // Parse route
        const parts = hash.split('/');
        const route = parts[0];
        const sub = parts[1];
        const param = parts[2];

        let html = '';
        switch (route) {
            case 'login':
                html = renderLogin();
                break;
            case 'dashboard':
                html = renderDashboard();
                break;
            case 'scan':
                html = renderScanPage();
                break;
            case 'venta':
                this.counters = { agua: 0, hielo: 0 };
                this.noCompro = false;
                html = renderVentaPage(sub);
                break;
            case 'success':
                html = renderSuccessPage(this.lastMovimiento);
                break;
            case 'admin':
                if (!Session.isAdmin()) { location.hash = '#dashboard'; return; }
                html = renderAdminPanel(sub || 'clientes');
                break;
            default:
                html = Session.isLoggedIn() ? renderDashboard() : renderLogin();
        }

        app.innerHTML = html;
        this.bindEvents(route);
        window.scrollTo(0, 0);
    },

    navigate(path) {
        location.hash = '#' + path;
    },

    // ==========================================
    // EVENT BINDING
    // ==========================================
    bindEvents(route) {
        if (route === 'login') {
            const form = document.getElementById('login-form');
            if (form) {
                form.addEventListener('submit', (e) => {
                    e.preventDefault();
                    this.handleLogin();
                });
            }
        }
    },

    // ==========================================
    // AUTH
    // ==========================================
    handleLogin() {
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;

        if (!username || !password) {
            Toast.show('Completa todos los campos', 'warning');
            return;
        }

        const users = DB.getAll(DB.KEYS.USERS);
        const user = users.find(u => u.username === username && u.password === password);

        if (!user) {
            Toast.show('Credenciales inválidas', 'error');
            return;
        }

        if (user.estado !== 'ACTIVO') {
            Toast.show('Usuario inactivo. Contacta al administrador.', 'error');
            return;
        }

        Session.login(user);
        Toast.show(`¡Bienvenido, ${user.nombre}!`, 'success');
        this.navigate(user.rol === 'ADMIN' ? 'admin/clientes' : 'dashboard');
    },

    logout() {
        Session.logout();
        Toast.show('Sesión cerrada', 'info');
        this.navigate('login');
    },

    // ==========================================
    // QR SCAN
    // ==========================================
    handleScan() {
        const select = document.getElementById('scan-client-select');
        if (!select || !select.value) {
            Toast.show('Selecciona un cliente para simular', 'warning');
            return;
        }
        Toast.show('✓ QR escaneado correctamente', 'success');
        setTimeout(() => this.navigate('venta/' + select.value), 400);
    },

    // ==========================================
    // PRODUCT COUNTERS
    // ==========================================
    updateCounter(type, delta) {
        if (this.noCompro) return;
        const newVal = Math.max(0, Math.min(50, this.counters[type] + delta));
        this.counters[type] = newVal;
        const el = document.getElementById('val-' + type);
        if (el) {
            el.textContent = newVal;
            el.style.transform = 'scale(1.2)';
            setTimeout(() => el.style.transform = 'scale(1)', 150);
        }
        // Update active state
        const counter = document.getElementById('counter-' + type);
        if (counter) {
            counter.classList.toggle('active', newVal > 0);
        }
    },

    toggleNoCompro() {
        const cb = document.getElementById('no-compro');
        if (!cb) return;
        this.noCompro = cb.checked;
        const area = document.getElementById('counters-area');
        if (area) {
            area.classList.toggle('counter-disabled', this.noCompro);
        }
        if (this.noCompro) {
            this.counters = { agua: 0, hielo: 0 };
            const elA = document.getElementById('val-agua');
            const elH = document.getElementById('val-hielo');
            if (elA) elA.textContent = '0';
            if (elH) elH.textContent = '0';
        }
    },

    // ==========================================
    // CONFIRMAR VENTA
    // ==========================================
    confirmarVenta(clienteId) {
        const btn = document.getElementById('btn-confirmar');
        if (btn) btn.disabled = true;

        const user = Session.getUser();
        const notas = document.getElementById('venta-notas')?.value || '';
        const qr = DB.getAll(DB.KEYS.QRS).find(q => q.clienteId === clienteId);

        const movimiento = {
            clienteId: clienteId,
            operadorId: user.id,
            timestamp: new Date().toISOString(),
            cantidadAgua: this.counters.agua,
            cantidadHielo: this.counters.hielo,
            tipo: this.noCompro ? 'VISITA_SIN_VENTA' : 'VENTA',
            notas: notas,
            codigoQR: qr ? qr.codigoQR : '',
            fueEditado: false,
        };

        const saved = DB.add(DB.KEYS.MOVEMENTS, movimiento);
        this.lastMovimiento = saved;

        setTimeout(() => {
            this.navigate('success');
        }, 300);
    },

    // ==========================================
    // ADMIN — CLIENT QR MODAL
    // ==========================================
    showClientQR(clienteId) {
        const client = DB.findById(DB.KEYS.CLIENTS, clienteId);
        const qr = DB.getAll(DB.KEYS.QRS).find(q => q.clienteId === clienteId);
        if (!client || !qr) return;

        this.openModal(`
      <div class="modal-header">
        <h3>📱 QR de ${client.nombre}</h3>
        <button class="modal-close" onclick="App.closeModal()">✕</button>
      </div>
      <div class="modal-body">
        <div class="qr-display" id="qr-render-area"></div>
        <div class="text-center mt-3">
          <span class="qr-code-text">${qr.codigoQR}</span>
        </div>
        <p class="text-sm text-muted text-center mt-2">${client.direccion}</p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="App.downloadQR('${qr.codigoQR}', '${client.nombre}')">📥 Descargar</button>
        <button class="btn btn-primary" onclick="App.closeModal()">Cerrar</button>
      </div>
    `);

        // Render QR
        setTimeout(() => {
            const container = document.getElementById('qr-render-area');
            if (container && typeof QRCode !== 'undefined') {
                container.innerHTML = '';
                new QRCode(container, {
                    text: qr.codigoQR,
                    width: 200,
                    height: 200,
                    colorDark: '#1e3a8a',
                    colorLight: '#ffffff',
                });
            }
        }, 100);
    },

    downloadQR(code, name) {
        const canvas = document.querySelector('#qr-render-area canvas');
        if (!canvas) { Toast.show('No se pudo generar la descarga', 'error'); return; }
        const link = document.createElement('a');
        link.download = `qr-${name.replace(/\s+/g, '-').toLowerCase()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        Toast.show('QR descargado', 'success');
    },

    // ==========================================
    // ADMIN — CLIENT DETAIL
    // ==========================================
    showClientDetail(clienteId) {
        const client = DB.findById(DB.KEYS.CLIENTS, clienteId);
        if (!client) return;
        const movs = DB.getAll(DB.KEYS.MOVEMENTS).filter(m => m.clienteId === clienteId);
        const ventas = movs.filter(m => m.tipo === 'VENTA');
        const totalAgua = ventas.reduce((s, m) => s + (m.cantidadAgua || 0), 0);
        const totalHielo = ventas.reduce((s, m) => s + (m.cantidadHielo || 0), 0);
        const ultima = movs.length > 0 ? movs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0] : null;

        this.openModal(`
      <div class="modal-header">
        <h3>👤 ${client.nombre}</h3>
        <button class="modal-close" onclick="App.closeModal()">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group"><label class="form-label">Dirección</label><p>${client.direccion}</p></div>
        ${client.referencia ? `<div class="form-group"><label class="form-label">Referencia</label><p>${client.referencia}</p></div>` : ''}
        ${client.telefono ? `<div class="form-group"><label class="form-label">Teléfono</label><p>${client.telefono}</p></div>` : ''}
        ${client.notas ? `<div class="form-group"><label class="form-label">Notas</label><p class="text-sm text-muted">${client.notas}</p></div>` : ''}
        <hr class="divider">
        <div class="stats-grid" style="grid-template-columns: repeat(2, 1fr);">
          <div class="stat-card"><div class="stat-value">${movs.length}</div><div class="stat-label">Visitas</div></div>
          <div class="stat-card"><div class="stat-value">${totalAgua}</div><div class="stat-label">💧 Total</div></div>
          <div class="stat-card"><div class="stat-value">${totalHielo}</div><div class="stat-label">🧊 Total</div></div>
          <div class="stat-card"><div class="stat-value">${ultima ? formatDate(ultima.timestamp) : 'N/A'}</div><div class="stat-label">Última visita</div></div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-primary" onclick="App.closeModal()">Cerrar</button>
      </div>
    `);
    },

    // ==========================================
    // ADMIN — NEW CLIENT FORM
    // ==========================================
    showNewClientForm() {
        this.openModal(`
      <div class="modal-header">
        <h3>➕ Nuevo Cliente</h3>
        <button class="modal-close" onclick="App.closeModal()">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Nombre *</label>
          <input type="text" class="form-input" id="new-client-nombre" placeholder="Ej: Tienda El Sol" required>
        </div>
        <div class="form-group">
          <label class="form-label">Dirección *</label>
          <input type="text" class="form-input" id="new-client-direccion" placeholder="Ej: Av. Insurgentes 100, Col. Roma">
        </div>
        <div class="form-group">
          <label class="form-label">Referencia</label>
          <input type="text" class="form-input" id="new-client-referencia" placeholder="Ej: Frente al parque, portón rojo">
        </div>
        <div class="form-group">
          <label class="form-label">Teléfono</label>
          <input type="tel" class="form-input" id="new-client-telefono" placeholder="Ej: 5551234567">
        </div>
        <div class="form-group">
          <label class="form-label">Notas</label>
          <textarea class="form-input" id="new-client-notas" placeholder="Notas adicionales..."></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button>
        <button class="btn btn-success" onclick="App.saveNewClient()">Guardar Cliente</button>
      </div>
    `);
    },

    saveNewClient() {
        const nombre = document.getElementById('new-client-nombre')?.value.trim();
        const direccion = document.getElementById('new-client-direccion')?.value.trim();
        if (!nombre || !direccion) {
            Toast.show('Nombre y dirección son obligatorios', 'warning');
            return;
        }

        const client = DB.add(DB.KEYS.CLIENTS, {
            nombre,
            direccion,
            referencia: document.getElementById('new-client-referencia')?.value.trim() || '',
            telefono: document.getElementById('new-client-telefono')?.value.trim() || '',
            notas: document.getElementById('new-client-notas')?.value.trim() || '',
            estado: 'ACTIVO',
        });

        // Generate QR
        const code = `CLIENTE-${String(client.id).padStart(3, '0')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        DB.add(DB.KEYS.QRS, { clienteId: client.id, codigoQR: code, activo: true });

        this.closeModal();
        Toast.show(`Cliente "${nombre}" creado con QR`, 'success');

        // Refresh and show QR
        this.navigate('admin/clientes');
        setTimeout(() => this.showClientQR(client.id), 300);
    },

    // ==========================================
    // ADMIN — EDIT MOVIMIENTO
    // ==========================================
    showEditMovimiento(movId) {
        const mov = DB.findById(DB.KEYS.MOVEMENTS, movId);
        if (!mov) return;
        const client = DB.findById(DB.KEYS.CLIENTS, mov.clienteId);
        const corrections = DB.getAll(DB.KEYS.CORRECTIONS).filter(c => c.movimientoId === movId);

        const correctionHtml = corrections.length > 0 ? corrections.map(c => `
      <div class="correction-log">
        <div class="log-header">⚠️ Corrección — ${formatDateTime(c.timestamp)}</div>
        <p>Antes: Agua=${c.datosAntes.cantidadAgua ?? '?'}, Hielo=${c.datosAntes.cantidadHielo ?? '?'}</p>
        <p>Después: Agua=${c.datosDespues.cantidadAgua ?? '?'}, Hielo=${c.datosDespues.cantidadHielo ?? '?'}</p>
        <p>Motivo: ${c.motivo}</p>
      </div>`).join('') : '';

        this.openModal(`
      <div class="modal-header">
        <h3>✏️ Editar Movimiento #${mov.id}</h3>
        <button class="modal-close" onclick="App.closeModal()">✕</button>
      </div>
      <div class="modal-body">
        <div class="client-header" style="margin-bottom:1rem">
          <h2 style="font-size:1rem">📍 ${client ? client.nombre : 'N/A'}</h2>
          <div class="text-sm text-muted">${formatDateTime(mov.timestamp)} — ${getOperadorName(mov.operadorId)}</div>
        </div>
        ${correctionHtml}
        <div class="form-group mt-3">
          <label class="form-label">💧 Garrafones de Agua</label>
          <input type="number" class="form-input" id="edit-agua" value="${mov.cantidadAgua}" min="0" max="50">
        </div>
        <div class="form-group">
          <label class="form-label">🧊 Bolsas de Hielo</label>
          <input type="number" class="form-input" id="edit-hielo" value="${mov.cantidadHielo}" min="0" max="50">
        </div>
        <div class="form-group">
          <label class="form-label">Motivo de corrección *</label>
          <textarea class="form-input" id="edit-motivo" placeholder="Ej: Error de captura confirmado por cliente" required></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="App.saveCorrection(${mov.id})">Guardar Corrección</button>
      </div>
    `);
    },

    saveCorrection(movId) {
        const motivo = document.getElementById('edit-motivo')?.value.trim();
        if (!motivo) { Toast.show('El motivo es obligatorio', 'warning'); return; }

        const mov = DB.findById(DB.KEYS.MOVEMENTS, movId);
        const newAgua = parseInt(document.getElementById('edit-agua')?.value) || 0;
        const newHielo = parseInt(document.getElementById('edit-hielo')?.value) || 0;

        // Log correction
        DB.add(DB.KEYS.CORRECTIONS, {
            movimientoId: movId,
            adminId: Session.getUser().id,
            datosAntes: { cantidadAgua: mov.cantidadAgua, cantidadHielo: mov.cantidadHielo },
            datosDespues: { cantidadAgua: newAgua, cantidadHielo: newHielo },
            motivo,
            timestamp: new Date().toISOString(),
        });

        // Update movement
        DB.update(DB.KEYS.MOVEMENTS, movId, {
            cantidadAgua: newAgua,
            cantidadHielo: newHielo,
            fueEditado: true,
        });

        this.closeModal();
        Toast.show('Corrección guardada con auditoría', 'success');
        this.navigate('admin/movimientos');
    },

    // ==========================================
    // FILTERS
    // ==========================================
    filterClients() {
        const search = (document.getElementById('search-clients')?.value || '').toLowerCase();
        const rows = document.querySelectorAll('#clients-table tbody tr');
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(search) ? '' : 'none';
        });
    },

    filterMovimientos() {
        const clientId = document.getElementById('filter-client')?.value;
        const opId = document.getElementById('filter-operador')?.value;
        const tipo = document.getElementById('filter-tipo')?.value;
        const rows = document.querySelectorAll('#movimientos-table tbody tr');

        const movements = DB.getAll(DB.KEYS.MOVEMENTS).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        rows.forEach((row, idx) => {
            const m = movements[idx];
            if (!m) return;
            let show = true;
            if (clientId && m.clienteId !== parseInt(clientId)) show = false;
            if (opId && m.operadorId !== parseInt(opId)) show = false;
            if (tipo && m.tipo !== tipo) show = false;
            row.style.display = show ? '' : 'none';
        });
    },

    // ==========================================
    // MODAL HELPERS
    // ==========================================
    openModal(html) {
        const overlay = document.getElementById('modal-overlay');
        const modal = document.getElementById('modal-content');
        overlay.classList.remove('hidden');
        modal.classList.remove('hidden');
        modal.innerHTML = html;
        overlay.onclick = () => this.closeModal();
    },

    closeModal() {
        document.getElementById('modal-overlay').classList.add('hidden');
        document.getElementById('modal-content').classList.add('hidden');
    },
};

// =============================================
// TOAST SYSTEM
// =============================================
const Toast = {
    show(message, type = 'info', duration = 3000) {
        const container = document.getElementById('toast-container');
        const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
      <span class="toast-icon">${icons[type] || icons.info}</span>
      <span class="toast-message">${message}</span>`;
        container.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('leaving');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }
};

// =============================================
// BOOT
// =============================================
document.addEventListener('DOMContentLoaded', () => App.init());
