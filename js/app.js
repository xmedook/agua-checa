// =============================================
// AquaTrack — Main App Controller
// =============================================

const App = {
    // State
    counters: { agua: 0, hielo: 0 },
    noCompro: false,
    motivoNoVenta: null,
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
                this.motivoNoVenta = null;
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
        const motivosContainer = document.getElementById('motivos-container');
        if (area) {
            area.classList.toggle('counter-disabled', this.noCompro);
        }
        if (motivosContainer) {
            motivosContainer.classList.toggle('hidden', !this.noCompro);
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
    // MOTIVO NO VENTA
    // ==========================================
    selectMotivo(motivoId) {
        this.motivoNoVenta = motivoId;
        // Update UI
        document.querySelectorAll('.motivo-option').forEach(el => {
            el.classList.remove('selected');
        });
        const selected = document.querySelector(`[data-motivo="${motivoId}"]`);
        if (selected) selected.classList.add('selected');
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

        // Validar motivo si es visita sin venta
        if (this.noCompro && !this.motivoNoVenta) {
            Toast.show('Selecciona un motivo de no compra', 'warning');
            if (btn) btn.disabled = false;
            return;
        }

        const movimiento = {
            clienteId: clienteId,
            operadorId: user.id,
            timestamp: new Date().toISOString(),
            cantidadAgua: this.counters.agua,
            cantidadHielo: this.counters.hielo,
            tipo: this.noCompro ? 'VISITA_SIN_VENTA' : 'VENTA',
            notas: notas,
            motivoNoVenta: this.noCompro ? this.motivoNoVenta : null,
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
        const estadoInfo = ESTADOS_CLIENTE.find(e => e.id === client.estado) || ESTADOS_CLIENTE[0];
        const zonaInfo = ZONAS.find(z => z.id === client.zona);

        // Historial de últimas 5 visitas
        const historial = movs.slice(0, 5).map(m => {
            const isVenta = m.tipo === 'VENTA';
            return `<div class="historial-item">
                <span class="historial-fecha">${formatDateTime(m.timestamp)}</span>
                <span class="historial-tipo ${isVenta ? 'venta' : 'sin-venta'}">${isVenta ? '💧' + m.cantidadAgua + ' 🧊' + m.cantidadHielo : 'Sin venta'}</span>
                <span class="historial-op">${getOperadorName(m.operadorId)}</span>
            </div>`;
        }).join('');

        this.openModal(`
      <div class="modal-header">
        <h3>👤 ${client.nombre}</h3>
        <button class="modal-close" onclick="App.closeModal()">✕</button>
      </div>
      <div class="modal-body">
        <div class="detail-grid">
            <div class="detail-item"><label>Código</label><span>${client.codigo || 'CLI-' + String(client.id).padStart(3, '0')}</span></div>
            <div class="detail-item"><label>Estado</label><span class="badge badge-${estadoInfo.color}">${estadoInfo.label}</span></div>
            <div class="detail-item"><label>Zona</label><span>${zonaInfo ? zonaInfo.label : '—'}</span></div>
            <div class="detail-item"><label>Teléfono</label><span>${client.telefono || '—'}</span></div>
        </div>
        <div class="form-group mt-2"><label class="form-label">Dirección</label><p>${client.direccion}</p></div>
        ${client.referencia ? `<div class="form-group"><label class="form-label">Referencia</label><p>${client.referencia}</p></div>` : ''}
        
        <hr class="divider">
        <div class="detail-grid">
            <div class="detail-item"><label># Envases</label><span>${client.numEnvases || '—'}</span></div>
            <div class="detail-item"><label>Rack Prestado</label><span>${client.rackPrestado ? '✅ Sí' : '❌ No'}</span></div>
        </div>
        ${client.notas ? `<div class="form-group mt-2"><label class="form-label">Notas</label><p class="text-sm">${client.notas}</p></div>` : ''}
        ${client.notasMeta ? `<div class="form-group"><label class="form-label">Notas Meta</label><p class="text-sm text-muted">${client.notasMeta}</p></div>` : ''}
        
        <hr class="divider">
        <div class="stats-grid" style="grid-template-columns: repeat(2, 1fr);">
          <div class="stat-card"><div class="stat-value">${movs.length}</div><div class="stat-label">Visitas</div></div>
          <div class="stat-card"><div class="stat-value">${totalAgua}</div><div class="stat-label">💧 Total</div></div>
          <div class="stat-card"><div class="stat-value">${totalHielo}</div><div class="stat-label">🧊 Total</div></div>
          <div class="stat-card"><div class="stat-value">${ultima ? formatDate(ultima.timestamp) : 'N/A'}</div><div class="stat-label">Última visita</div></div>
        </div>
        
        ${historial ? `<div class="mt-3"><label class="form-label">📜 Historial Reciente</label><div class="historial-list">${historial}</div></div>` : ''}
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="App.showEditClientForm(${client.id}); App.closeModal();">✏️ Editar</button>
        <button class="btn btn-primary" onclick="App.closeModal()">Cerrar</button>
      </div>
    `);
    },

    // ==========================================
    // ADMIN — NEW CLIENT FORM
    // ==========================================
    showNewClientForm() {
        const estadoOptions = ESTADOS_CLIENTE.map(e => `<option value="${e.id}">${e.label}</option>`).join('');
        const zonaOptions = ZONAS.map(z => `<option value="${z.id}">${z.label}</option>`).join('');
        
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
          <label class="form-label">Teléfono</label>
          <input type="tel" class="form-input" id="new-client-telefono" placeholder="Ej: 5551234567">
        </div>
        <div class="form-group">
          <label class="form-label">Zona</label>
          <select class="form-input" id="new-client-zona">
            <option value="">Seleccionar zona</option>
            ${zonaOptions}
          </select>
        </div>
        <div class="form-row">
            <div class="form-group">
              <label class="form-label">Latitud</label>
              <input type="number" step="0.0001" class="form-input" id="new-client-lat" placeholder="19.4326">
            </div>
            <div class="form-group">
              <label class="form-label">Longitud</label>
              <input type="number" step="0.0001" class="form-input" id="new-client-lng" placeholder="-99.1332">
            </div>
        </div>
        <div class="form-group">
          <label class="form-label">Referencia</label>
          <input type="text" class="form-input" id="new-client-referencia" placeholder="Ej: Frente al parque, portón rojo">
        </div>
        <div class="form-group">
          <label class="form-label"># Envases</label>
          <input type="number" class="form-input" id="new-client-envases" placeholder="Ej: 5" min="0">
        </div>
        <div class="checkbox-group">
          <input type="checkbox" id="new-client-rack">
          <label for="new-client-rack">Rack prestado</label>
        </div>
        <div class="form-group mt-2">
          <label class="form-label">Notas</label>
          <textarea class="form-input" id="new-client-notas" placeholder="Notas operativas..."></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Notas Meta</label>
          <textarea class="form-input" id="new-client-notasmeta" placeholder="Notas internas o de seguimiento..."></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Estado</label>
          <select class="form-input" id="new-client-estado">
            ${estadoOptions}
          </select>
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

        const zona = document.getElementById('new-client-zona')?.value || 'ZONA_1';
        const estado = document.getElementById('new-client-estado')?.value || 'ACTIVO';
        const codigo = `CLI-${String(Date.now()).slice(-6)}`;

        const client = DB.add(DB.KEYS.CLIENTS, {
            nombre,
            direccion,
            telefono: document.getElementById('new-client-telefono')?.value.trim() || '',
            zona,
            lat: parseFloat(document.getElementById('new-client-lat')?.value) || null,
            lng: parseFloat(document.getElementById('new-client-lng')?.value) || null,
            referencia: document.getElementById('new-client-referencia')?.value.trim() || '',
            numEnvases: parseInt(document.getElementById('new-client-envases')?.value) || 0,
            rackPrestado: document.getElementById('new-client-rack')?.checked || false,
            notas: document.getElementById('new-client-notas')?.value.trim() || '',
            notasMeta: document.getElementById('new-client-notasmeta')?.value.trim() || '',
            estado,
            codigo,
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
    // ADMIN — EDIT CLIENT
    // ==========================================
    showEditClientForm(clienteId) {
        const client = DB.findById(DB.KEYS.CLIENTS, clienteId);
        if (!client) return;
        
        const estadoOptions = ESTADOS_CLIENTE.map(e => 
            `<option value="${e.id}" ${e.id === client.estado ? 'selected' : ''}>${e.label}</option>`
        ).join('');
        const zonaOptions = ZONAS.map(z => 
            `<option value="${z.id}" ${z.id === client.zona ? 'selected' : ''}>${z.label}</option>`
        ).join('');

        this.openModal(`
      <div class="modal-header">
        <h3>✏️ Editar Cliente</h3>
        <button class="modal-close" onclick="App.closeModal()">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Nombre *</label>
          <input type="text" class="form-input" id="edit-client-nombre" value="${client.nombre}" required>
        </div>
        <div class="form-group">
          <label class="form-label">Dirección *</label>
          <input type="text" class="form-input" id="edit-client-direccion" value="${client.direccion}">
        </div>
        <div class="form-group">
          <label class="form-label">Teléfono</label>
          <input type="tel" class="form-input" id="edit-client-telefono" value="${client.telefono || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Zona</label>
          <select class="form-input" id="edit-client-zona">
            <option value="">Seleccionar zona</option>
            ${zonaOptions}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Referencia</label>
          <input type="text" class="form-input" id="edit-client-referencia" value="${client.referencia || ''}">
        </div>
        <div class="form-group">
          <label class="form-label"># Envases</label>
          <input type="number" class="form-input" id="edit-client-envases" value="${client.numEnvases || 0}" min="0">
        </div>
        <div class="checkbox-group">
          <input type="checkbox" id="edit-client-rack" ${client.rackPrestado ? 'checked' : ''}>
          <label for="edit-client-rack">Rack prestado</label>
        </div>
        <div class="form-group mt-2">
          <label class="form-label">Notas</label>
          <textarea class="form-input" id="edit-client-notas">${client.notas || ''}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Notas Meta</label>
          <textarea class="form-input" id="edit-client-notasmeta">${client.notasMeta || ''}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Estado</label>
          <select class="form-input" id="edit-client-estado">
            ${estadoOptions}
          </select>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="App.saveEditClient(${client.id})">Guardar Cambios</button>
      </div>
    `);
    },

    saveEditClient(clienteId) {
        const nombre = document.getElementById('edit-client-nombre')?.value.trim();
        const direccion = document.getElementById('edit-client-direccion')?.value.trim();
        if (!nombre || !direccion) {
            Toast.show('Nombre y dirección son obligatorios', 'warning');
            return;
        }

        DB.update(DB.KEYS.CLIENTS, clienteId, {
            nombre,
            direccion,
            telefono: document.getElementById('edit-client-telefono')?.value.trim() || '',
            zona: document.getElementById('edit-client-zona')?.value || 'ZONA_1',
            referencia: document.getElementById('edit-client-referencia')?.value.trim() || '',
            numEnvases: parseInt(document.getElementById('edit-client-envases')?.value) || 0,
            rackPrestado: document.getElementById('edit-client-rack')?.checked || false,
            notas: document.getElementById('edit-client-notas')?.value.trim() || '',
            notasMeta: document.getElementById('edit-client-notasmeta')?.value.trim() || '',
            estado: document.getElementById('edit-client-estado')?.value || 'ACTIVO',
        });

        this.closeModal();
        Toast.show('Cliente actualizado', 'success');
        this.navigate('admin/clientes');
    },

    // ==========================================
    // ADMIN — RUTAS
    // ==========================================
    showNewRutaForm() {
        const operators = DB.getAll(DB.KEYS.USERS).filter(u => u.rol === 'OPERADOR');
        const clients = DB.getAll(DB.KEYS.CLIENTS).filter(c => c.estado === 'ACTIVO');
        
        const opOptions = operators.map(o => 
            `<label class="checkbox-option"><input type="checkbox" value="${o.id}" id="new-ruta-ops"> ${o.nombre}</label>`
        ).join('');
        
        const clientOptions = clients.map(c => 
            `<label class="checkbox-option"><input type="checkbox" value="${c.id}" class="client-checkbox"> ${c.nombre}</label>`
        ).join('');

        this.openModal(`
      <div class="modal-header">
        <h3>🛣️ Nueva Ruta</h3>
        <button class="modal-close" onclick="App.closeModal()">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Nombre *</label>
          <input type="text" class="form-input" id="new-ruta-nombre" placeholder="Ej: Ruta Norte">
        </div>
        <div class="form-group">
          <label class="form-label">Descripción</label>
          <input type="text" class="form-input" id="new-ruta-desc" placeholder="Zona o descripción">
        </div>
        <div class="form-group">
          <label class="form-label">Operadores asignados</label>
          <div class="checkbox-group-vertical">${opOptions || 'No hay operadores'}</div>
        </div>
        <div class="form-group">
          <label class="form-label">Clientes en la ruta</label>
          <div class="checkbox-group-vertical" style="max-height:150px;overflow-y:auto">${clientOptions || 'No hay clientes'}</div>
        </div>
        <div class="checkbox-group">
          <input type="checkbox" id="new-ruta-activa" checked>
          <label for="new-ruta-activa">Ruta activa</label>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button>
        <button class="btn btn-success" onclick="App.saveNewRuta()">Crear Ruta</button>
      </div>
    `);
    },

    saveNewRuta() {
        const nombre = document.getElementById('new-ruta-nombre')?.value.trim();
        if (!nombre) {
            Toast.show('El nombre es obligatorio', 'warning');
            return;
        }

        const desc = document.getElementById('new-ruta-desc')?.value.trim() || '';
        const activa = document.getElementById('new-ruta-activa')?.checked || false;
        
        // Get selected operators
        const opCheckboxes = document.querySelectorAll('#new-ruta-ops:checked');
        const operadoresAsignados = Array.from(opCheckboxes).map(el => parseInt(el.value));
        
        // Get selected clients
        const clientCheckboxes = document.querySelectorAll('.client-checkbox:checked');
        const clientes = Array.from(clientCheckboxes).map(el => parseInt(el.value));

        const ruta = DB.add(DB.KEYS.RUTAS, {
            nombre,
            descripcion: desc,
            operadoresAsignados,
            clientes,
            orden: [...clientes],
            activa,
        });

        this.closeModal();
        Toast.show(`Ruta "${nombre}" creada`, 'success');
        this.navigate('admin/rutas');
    },

    showEditRuta(rutaId) {
        const ruta = DB.findById(DB.KEYS.RUTAS, rutaId);
        if (!ruta) return;

        const operators = DB.getAll(DB.KEYS.USERS).filter(u => u.rol === 'OPERADOR');
        const clients = DB.getAll(DB.KEYS.CLIENTS).filter(c => c.estado === 'ACTIVO');
        
        const opOptions = operators.map(o => {
            const checked = ruta.operadoresAsignados?.includes(o.id) ? 'checked' : '';
            return `<label class="checkbox-option"><input type="checkbox" value="${o.id}" class="edit-ruta-op" ${checked}> ${o.nombre}</label>`;
        }).join('');
        
        const clientOptions = clients.map(c => {
            const checked = ruta.clientes?.includes(c.id) ? 'checked' : '';
            return `<label class="checkbox-option"><input type="checkbox" value="${c.id}" class="edit-ruta-client" ${checked}> ${c.nombre}</label>`;
        }).join('');

        this.openModal(`
      <div class="modal-header">
        <h3>✏️ Editar Ruta</h3>
        <button class="modal-close" onclick="App.closeModal()">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Nombre *</label>
          <input type="text" class="form-input" id="edit-ruta-nombre" value="${ruta.nombre}">
        </div>
        <div class="form-group">
          <label class="form-label">Descripción</label>
          <input type="text" class="form-input" id="edit-ruta-desc" value="${ruta.descripcion || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Operadores asignados</label>
          <div class="checkbox-group-vertical">${opOptions || 'No hay operadores'}</div>
        </div>
        <div class="form-group">
          <label class="form-label">Clientes en la ruta</label>
          <div class="checkbox-group-vertical" style="max-height:150px;overflow-y:auto">${clientOptions || 'No hay clientes'}</div>
        </div>
        <div class="checkbox-group">
          <input type="checkbox" id="edit-ruta-activa" ${ruta.activa ? 'checked' : ''}>
          <label for="edit-ruta-activa">Ruta activa</label>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="App.saveEditRuta(${ruta.id})">Guardar Cambios</button>
      </div>
    `);
    },

    saveEditRuta(rutaId) {
        const nombre = document.getElementById('edit-ruta-nombre')?.value.trim();
        if (!nombre) {
            Toast.show('El nombre es obligatorio', 'warning');
            return;
        }

        const desc = document.getElementById('edit-ruta-desc')?.value.trim() || '';
        const activa = document.getElementById('edit-ruta-activa')?.checked || false;
        
        const opCheckboxes = document.querySelectorAll('.edit-ruta-op:checked');
        const operadoresAsignados = Array.from(opCheckboxes).map(el => parseInt(el.value));
        
        const clientCheckboxes = document.querySelectorAll('.edit-ruta-client:checked');
        const clientes = Array.from(clientCheckboxes).map(el => parseInt(el.value));

        DB.update(DB.KEYS.RUTAS, rutaId, {
            nombre,
            descripcion: desc,
            operadoresAsignados,
            clientes,
            orden: [...clientes],
            activa,
        });

        this.closeModal();
        Toast.show('Ruta actualizada', 'success');
        this.navigate('admin/rutas');
    },

    showOrdenarRuta(rutaId) {
        const ruta = DB.findById(DB.KEYS.RUTAS, rutaId);
        if (!ruta) return;
        
        const clientesOrden = ruta.orden || ruta.clientes || [];
        const clientes = clientesOrden.map(id => DB.findById(DB.KEYS.CLIENTS, id)).filter(Boolean);
        
        const itemsHtml = clientes.map((c, i) => `
            <div class="orden-item" data-index="${i}">
                <span class="orden-num">${i + 1}</span>
                <span class="orden-nombre">${c.nombre}</span>
                <span class="orden-dir">${c.direccion}</span>
                <div class="orden-acciones">
                    <button class="btn btn-ghost btn-sm" onclick="App.moverClienteRuta(${rutaId}, ${i}, -1)" ${i === 0 ? 'disabled' : ''}>⬆️</button>
                    <button class="btn btn-ghost btn-sm" onclick="App.moverClienteRuta(${rutaId}, ${i}, 1)" ${i === clientes.length - 1 ? 'disabled' : ''}>⬇️</button>
                </div>
            </div>
        `).join('');

        this.openModal(`
      <div class="modal-header">
        <h3>🔢 Ordenar Clientes — ${ruta.nombre}</h3>
        <button class="modal-close" onclick="App.closeModal()">✕</button>
      </div>
      <div class="modal-body">
        <p class="text-sm text-muted mb-3">Usa las flechas para cambiar el orden de visita</p>
        <div class="orden-list" id="orden-list">${itemsHtml}</div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-primary" onclick="App.closeModal()">Cerrar</button>
      </div>
    `);
    },

    moverClienteRuta(rutaId, index, direccion) {
        const ruta = DB.findById(DB.KEYS.RUTAS, rutaId);
        if (!ruta) return;
        
        const orden = [...(ruta.orden || ruta.clientes || [])];
        const newIndex = index + direccion;
        
        if (newIndex < 0 || newIndex >= orden.length) return;
        
        // Intercambiar
        [orden[index], orden[newIndex]] = [orden[newIndex], orden[index]];
        
        DB.update(DB.KEYS.RUTAS, rutaId, { orden });
        
        // Recargar el modal
        this.showOrdenarRuta(rutaId);
        Toast.show('Orden actualizado', 'success');
    },

    showMapaRuta(rutaId) {
        const ruta = DB.findById(DB.KEYS.RUTAS, rutaId);
        if (!ruta) return;
        
        const clientesOrden = ruta.orden || ruta.clientes || [];
        const clientes = clientesOrden.map(id => DB.findById(DB.KEYS.CLIENTS, id)).filter(Boolean);
        
        if (clientes.length === 0) {
            Toast.show('Esta ruta no tiene clientes asignados', 'warning');
            return;
        }

        // Get coordinates bounds
        const lats = clientes.map(c => c.lat).filter(Boolean);
        const lngs = clientes.map(c => c.lng).filter(Boolean);
        
        // Create simple map visualization with SVG
        const minLat = Math.min(...lats) - 0.01;
        const maxLat = Math.max(...lats) + 0.01;
        const minLng = Math.min(...lngs) - 0.01;
        const maxLng = Math.max(...lngs) + 0.01;
        
        const toX = (lng) => ((lng - minLng) / (maxLng - minLng)) * 100;
        const toY = (lat) => ((maxLat - lat) / (maxLat - minLat)) * 100;
        
        // Generate path line
        const pathPoints = clientes.map(c => {
            if (!c.lat || !c.lng) return null;
            return `${toX(c.lng)}%,${toY(c.lat)}%`;
        }).filter(Boolean).join(' ');
        
        const puntosHtml = clientes.map((c, i) => {
            if (!c.lat || !c.lng) return '';
            const x = toX(c.lng);
            const y = toY(c.lat);
            const visited = false; // Could check against today's movements
            return `
                <div class="map-marker" style="left:${x}%;top:${y}%">
                    <div class="marker-num">${i + 1}</div>
                    <div class="marker-tooltip">
                        <strong>${c.nombre}</strong><br>
                        <span class="text-xs">${c.direccion}</span>
                    </div>
                </div>
            `;
        }).join('');

        this.openModal(`
      <div class="modal-header">
        <h3>🗺️ Mapa — ${ruta.nombre}</h3>
        <button class="modal-close" onclick="App.closeModal()">✕</button>
      </div>
      <div class="modal-body">
        <div class="route-map">
            <svg class="route-line" viewBox="0 0 100 100" preserveAspectRatio="none">
                <polyline points="${pathPoints}" fill="none" stroke="var(--primary-500)" stroke-width="2" stroke-dasharray="4"/>
            </svg>
            ${puntosHtml}
        </div>
        <div class="route-leyenda mt-3">
            <div class="leyenda-item"><span class="marker-dot"></span> Punto de ruta (orden)</div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="App.closeModal()">Cerrar</button>
      </div>
    `);
    },

    deleteRuta(rutaId) {
        if (!confirm('¿Eliminar esta ruta?')) return;
        
        const rutas = DB.getAll(DB.KEYS.RUTAS).filter(r => r.id !== rutaId);
        DB.set(DB.KEYS.RUTAS, rutas);
        
        Toast.show('Ruta eliminada', 'success');
        this.navigate('admin/rutas');
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
        const estado = document.getElementById('filter-estado')?.value || '';
        const zona = document.getElementById('filter-zona')?.value || '';
        const rows = document.querySelectorAll('#clients-table tbody tr');
        
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            const rowEstado = row.getAttribute('data-estado');
            const rowZona = row.getAttribute('data-zona');
            
            let show = text.includes(search);
            if (estado && rowEstado !== estado) show = false;
            if (zona && rowZona !== zona) show = false;
            
            row.style.display = show ? '' : 'none';
        });
    },

    actualizarReportes() {
        const periodo = document.getElementById('reporte-periodo')?.value || 'today';
        const contenido = document.getElementById('reportes-contenido');
        if (contenido) {
            contenido.innerHTML = renderReportesContenido(periodo);
        }
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
