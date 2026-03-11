// =============================================
// AquaTrack — View Templates
// =============================================

function formatDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatTime(iso) {
    const d = new Date(iso);
    return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

function formatDateTime(iso) {
    return `${formatDate(iso)} ${formatTime(iso)}`;
}

function getClientName(id) {
    const c = DB.findById(DB.KEYS.CLIENTS, id);
    return c ? c.nombre : 'Desconocido';
}

function getOperadorName(id) {
    const u = DB.findById(DB.KEYS.USERS, id);
    return u ? u.nombre : 'Desconocido';
}

function getInitials(name) {
    return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
}

// =============================================
// LOGIN VIEW
// =============================================
function renderLogin() {
    return `
    <div class="login-page">
      <div class="login-card">
        <div class="login-logo">
          <span class="logo-icon">💧</span>
          <h1>AquaTrack v0.5</h1>
          <p>Sistema de Logística y Ventas</p>
        </div>
        <form id="login-form">
          <div class="form-group">
            <label class="form-label">Usuario</label>
            <div class="form-input-icon">
              <span class="icon">👤</span>
              <input type="text" class="form-input" id="login-username" placeholder="Ej: operador1" autocomplete="username" required>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Contraseña</label>
            <div class="form-input-icon">
              <span class="icon">🔒</span>
              <input type="password" class="form-input" id="login-password" placeholder="••••••" autocomplete="current-password" required>
            </div>
          </div>
          <button type="submit" class="btn btn-primary btn-lg btn-full" id="login-btn">
            Iniciar Sesión
          </button>
        </form>
        <div class="text-center mt-4">
          <p class="text-sm text-muted">Demo: <strong>operador1</strong> / <strong>demo123</strong></p>
          <p class="text-sm text-muted">Admin: <strong>admin</strong> / <strong>admin123</strong></p>
        </div>
      </div>
    </div>`;
}

// =============================================
// HEADER
// =============================================
function renderHeader(user) {
    return `
    <header class="header">
      <div class="header-brand">
        <span class="brand-icon">💧</span>
        AquaTrack v0.5
      </div>
      <div class="header-user">
        <div style="text-align:right">
          <div class="user-name">${user.nombre}</div>
          <div class="user-role">${user.rol}</div>
        </div>
        <div class="user-avatar">${getInitials(user.nombre)}</div>
        <button class="btn btn-ghost btn-icon" onclick="App.logout()" title="Cerrar sesión">🚪</button>
      </div>
    </header>`;
}

// =============================================
// OPERATOR DASHBOARD
// =============================================
function renderDashboard() {
    const user = Session.getUser();
    const movements = DB.getAll(DB.KEYS.MOVEMENTS)
        .filter(m => m.operadorId === user.id)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const today = new Date().toDateString();
    const todayMoves = movements.filter(m => new Date(m.timestamp).toDateString() === today);
    const todayAgua = todayMoves.reduce((s, m) => s + (m.cantidadAgua || 0), 0);
    const todayHielo = todayMoves.reduce((s, m) => s + (m.cantidadHielo || 0), 0);
    const todayVentas = todayMoves.filter(m => m.tipo === 'VENTA').length;

    // Get today's route for this operator
    const rutas = DB.getAll(DB.KEYS.RUTAS).filter(r => r.activa && r.operadoresAsignados?.includes(user.id));
    let routeHtml = '';
    if (rutas.length > 0) {
        const ruta = rutas[0];
        const routeClients = ruta.orden?.map(id => DB.findById(DB.KEYS.CLIENTS, id)).filter(Boolean) || [];
        const visitedIds = todayMoves.map(m => m.clienteId);
        routeHtml = `
      <div class="activity-list mt-4">
        <div class="section-title">🛣️ ${ruta.nombre} — Clientes del día</div>
        <div class="card">
          ${routeClients.length === 0 ? '<div class="empty-state"><p class="text-muted">Sin clientes asignados</p></div>' : routeClients.map((c, i) => {
            const visited = visitedIds.includes(c.id);
            return `
            <div class="route-item ${visited ? 'visited' : ''}">
              <div class="route-number">${i + 1}</div>
              <div class="route-info">
                <div class="route-name">${c.nombre}</div>
                <div class="route-address">${c.direccion}</div>
              </div>
              <div class="route-status">${visited ? '✅' : '⭕'}</div>
            </div>`;
          }).join('')}
        </div>
      </div>`;
    }

    const recentItems = movements.slice(0, 8).map(m => {
        const isVenta = m.tipo === 'VENTA';
        return `
      <div class="activity-item">
        <div class="activity-icon ${isVenta ? 'venta' : 'sin-venta'}">
          ${isVenta ? '🚰' : '🚫'}
        </div>
        <div class="activity-info">
          <div class="activity-name">${getClientName(m.clienteId)}</div>
          <div class="activity-detail">
            ${isVenta ? `${m.cantidadAgua}💧 ${m.cantidadHielo}🧊` : 'Sin venta'}
            ${m.fueEditado ? '<span class="badge badge-warning">Editado</span>' : ''}
          </div>
        </div>
        <div class="activity-time">${formatTime(m.timestamp)}</div>
      </div>`;
    }).join('');

    return `
    ${renderHeader(user)}
    <div class="main-content page-enter">
      <div class="scan-cta" onclick="App.navigate('scan')">
        <span class="scan-icon">📷</span>
        <div class="scan-text">ESCANEAR CLIENTE</div>
        <div class="scan-subtext">Toca para registrar visita</div>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon">📋</div>
          <div class="stat-value">${todayMoves.length}</div>
          <div class="stat-label">Visitas hoy</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">✅</div>
          <div class="stat-value">${todayVentas}</div>
          <div class="stat-label">Ventas hoy</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">💧</div>
          <div class="stat-value">${todayAgua}</div>
          <div class="stat-label">Garrafones</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">🧊</div>
          <div class="stat-value">${todayHielo}</div>
          <div class="stat-label">Hielo</div>
        </div>
      </div>

      <div class="activity-list">
        <div class="section-title">📜 Últimos registros</div>
        <div class="card">
          ${recentItems || '<div class="empty-state"><div class="empty-icon">📭</div><h4>Sin registros aún</h4><p class="text-muted">Escanea un QR para comenzar</p></div>'}
        </div>
      </div>
    </div>`;
}

// =============================================
// QR SCAN PAGE
// =============================================
function renderScanPage() {
    const user = Session.getUser();
    const clients = DB.getAll(DB.KEYS.CLIENTS).filter(c => c.estado === 'ACTIVO');
    const options = clients.map(c => {
        const qr = DB.getAll(DB.KEYS.QRS).find(q => q.clienteId === c.id);
        return `<option value="${c.id}">${c.nombre} — ${qr ? qr.codigoQR : 'Sin QR'}</option>`;
    }).join('');

    return `
    ${renderHeader(user)}
    <div class="main-content page-enter">
      <button class="back-btn" onclick="App.navigate('dashboard')">← Volver al dashboard</button>

      <div class="scan-simulation">
        <div class="scan-viewfinder">
          <span class="camera-icon">📷</span>
        </div>
        <p class="scan-label">Apunta la cámara al código QR del cliente</p>
      </div>

      <div class="scan-client-select">
        <h4>🧪 Demo: Selecciona un cliente para simular escaneo</h4>
        <div class="form-group mt-2">
          <select class="form-input" id="scan-client-select">
            <option value="">— Seleccionar cliente —</option>
            ${options}
          </select>
        </div>
        <button class="btn btn-primary btn-full mt-2" onclick="App.handleScan()">
          ⚡ Simular Escaneo
        </button>
      </div>
    </div>`;
}

// =============================================
// VENTA PAGE
// =============================================
function renderVentaPage(clienteId) {
    const user = Session.getUser();
    const cliente = DB.findById(DB.KEYS.CLIENTS, parseInt(clienteId));
    if (!cliente) return renderNotFound();

    // Info del cliente
    const infoItems = [];
    if (cliente.numEnvases) infoItems.push(`📦 ${cliente.numEnvases} envases`);
    if (cliente.rackPrestado) infoItems.push('🗄️ Rack prestado');
    const infoHtml = infoItems.length > 0 ? `<div class="client-info-bar">${infoItems.join(' • ')}</div>` : '';

    return `
    ${renderHeader(user)}
    <div class="main-content page-enter">
      <button class="back-btn" onclick="App.navigate('scan')">← Volver a escanear</button>

      <div class="client-header">
        <h2>📍 ${cliente.nombre}</h2>
        <div class="client-address">📌 ${cliente.direccion}</div>
        ${cliente.referencia ? `<div class="text-sm text-muted mt-1">Ref: ${cliente.referencia}</div>` : ''}
        ${infoHtml}
        ${cliente.notas ? `<div class="client-notes mt-2">📝 ${cliente.notas}</div>` : ''}
      </div>

      <div class="flex flex-col gap-3" id="counters-area">
        <div class="product-counter" id="counter-agua">
          <div class="counter-label">💧 Garrafones de Agua</div>
          <div class="counter-controls">
            <button class="counter-btn minus" onclick="App.updateCounter('agua', -1)">−</button>
            <div class="counter-value" id="val-agua">0</div>
            <button class="counter-btn" onclick="App.updateCounter('agua', 1)">+</button>
          </div>
        </div>

        <div class="product-counter" id="counter-hielo">
          <div class="counter-label">🧊 Bolsas de Hielo</div>
          <div class="counter-controls">
            <button class="counter-btn minus" onclick="App.updateCounter('hielo', -1)">−</button>
            <div class="counter-value" id="val-hielo">0</div>
            <button class="counter-btn" onclick="App.updateCounter('hielo', 1)">+</button>
          </div>
        </div>
      </div>

      <div class="checkbox-group mt-3" onclick="App.toggleNoCompro()">
        <input type="checkbox" id="no-compro">
        <label for="no-compro">🚫 No compró (registrar solo visita)</label>
      </div>

      <div class="motivos-container mt-3 hidden" id="motivos-container">
        <label class="form-label">📋 Selecciona el motivo</label>
        <div class="motivos-grid" id="motivos-grid">
          ${MOTIVOS_NO_VENTA.map(m => `
            <div class="motivo-option" data-motivo="${m.id}" onclick="App.selectMotivo('${m.id}')">
              <span class="motivo-icon">${m.icon}</span>
              <span class="motivo-label">${m.label}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="form-group mt-3">
        <label class="form-label">📝 Notas (opcional)</label>
        <textarea class="form-input" id="venta-notas" placeholder="Ej: Cliente pide visita el viernes"></textarea>
      </div>

      <button class="btn btn-success btn-lg btn-full mt-3" onclick="App.confirmarVenta(${cliente.id})" id="btn-confirmar">
        ✅ Confirmar Registro
      </button>
    </div>`;
}

// =============================================
// SUCCESS PAGE
// =============================================
function renderSuccessPage(movimiento) {
    const user = Session.getUser();
    const cliente = DB.findById(DB.KEYS.CLIENTS, movimiento.clienteId);
    const isVenta = movimiento.tipo === 'VENTA';

    return `
    ${renderHeader(user)}
    <div class="main-content">
      <div class="success-screen">
        <div class="success-icon">✓</div>
        <h2>${isVenta ? '¡Venta Registrada!' : '¡Visita Registrada!'}</h2>
        <p class="text-muted">El registro se guardó exitosamente</p>

        <div class="success-details">
          <div class="detail-row">
            <span class="detail-label">Cliente</span>
            <span class="detail-value">${cliente ? cliente.nombre : ''}</span>
          </div>
          ${isVenta ? `
          <div class="detail-row">
            <span class="detail-label">Agua</span>
            <span class="detail-value">${movimiento.cantidadAgua} garrafones</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Hielo</span>
            <span class="detail-value">${movimiento.cantidadHielo} bolsas</span>
          </div>` : ''}
          <div class="detail-row">
            <span class="detail-label">Tipo</span>
            <span class="detail-value">${isVenta ? '🟢 Venta' : '🟡 Sin venta'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Hora</span>
            <span class="detail-value">${formatTime(movimiento.timestamp)}</span>
          </div>
        </div>

        <button class="btn btn-primary btn-lg btn-full mt-4" onclick="App.navigate('dashboard')">
          Volver al Dashboard
        </button>
      </div>
    </div>`;
}

// =============================================
// ADMIN PANEL
// =============================================
function renderAdminPanel(tab = 'clientes') {
    const user = Session.getUser();
    const tabs = [
        { id: 'clientes', label: '👥 Clientes', icon: '👥' },
        { id: 'rutas', label: '🛣️ Rutas', icon: '🛣️' },
        { id: 'movimientos', label: '📋 Movimientos', icon: '📋' },
        { id: 'reportes', label: '📊 Reportes', icon: '📊' },
    ];

    const tabButtons = tabs.map(t =>
        `<button class="admin-tab ${t.id === tab ? 'active' : ''}" onclick="App.navigate('admin/${t.id}')">${t.label}</button>`
    ).join('');

    let content = '';
    if (tab === 'clientes') content = renderAdminClientes();
    else if (tab === 'rutas') content = renderAdminRutas();
    else if (tab === 'movimientos') content = renderAdminMovimientos();
    else if (tab === 'reportes') content = renderAdminReportes();

    return `
    ${renderHeader(user)}
    <div class="main-content page-enter">
      <div class="admin-tabs">${tabButtons}</div>
      ${content}
    </div>`;
}

// =============================================
// ADMIN — CLIENTES TAB
// =============================================
function renderAdminClientes() {
    const clients = DB.getAll(DB.KEYS.CLIENTS);
    
    const estadoOptions = ESTADOS_CLIENTE.map(e => `<option value="${e.id}">${e.label}</option>`).join('');
    const zonaOptions = ZONAS.map(z => `<option value="${z.id}">${z.label}</option>`).join('');

    const rows = clients.map(c => {
        const qr = DB.getAll(DB.KEYS.QRS).find(q => q.clienteId === c.id);
        const movs = DB.getAll(DB.KEYS.MOVEMENTS).filter(m => m.clienteId === c.id);
        const estadoInfo = ESTADOS_CLIENTE.find(e => e.id === c.estado) || ESTADOS_CLIENTE[0];
        const zonaInfo = ZONAS.find(z => z.id === c.zona);
        return `
      <tr data-estado="${c.estado}" data-zona="${c.zona || ''}">
        <td><strong>${c.codigo || 'CLI-' + String(c.id).padStart(3, '0')}</strong></td>
        <td><strong>${c.nombre}</strong></td>
        <td class="text-sm">${c.direccion}</td>
        <td><span class="badge badge-${estadoInfo.color}">${estadoInfo.label}</span></td>
        <td class="text-sm">${zonaInfo ? zonaInfo.label : '—'}</td>
        <td class="text-center">${movs.length}</td>
        <td>
          <button class="btn btn-ghost btn-sm" onclick="App.showClientQR(${c.id})" title="Ver QR">📱</button>
          <button class="btn btn-ghost btn-sm" onclick="App.showClientDetail(${c.id})" title="Ver detalle">👁️</button>
          <button class="btn btn-ghost btn-sm" onclick="App.showEditClientForm(${c.id})" title="Editar">✏️</button>
        </td>
      </tr>`;
    }).join('');

    return `
    <div class="filters-row">
      <input type="text" class="form-input" placeholder="🔍 Buscar cliente..." id="search-clients" oninput="App.filterClients()">
      <select class="form-input" id="filter-estado" onchange="App.filterClients()">
        <option value="">Todos los estados</option>
        ${estadoOptions}
      </select>
      <select class="form-input" id="filter-zona" onchange="App.filterClients()">
        <option value="">Todas las zonas</option>
        ${zonaOptions}
      </select>
      <button class="btn btn-primary" onclick="App.showNewClientForm()">+ Nuevo</button>
    </div>
    <div class="card">
      <div class="table-container">
        <table class="data-table" id="clients-table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Nombre</th>
              <th>Dirección</th>
              <th>Estado</th>
              <th>Zona</th>
              <th>Visitas</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

// =============================================
// ADMIN — RUTAS TAB
// =============================================
function renderAdminRutas() {
    const rutas = DB.getAll(DB.KEYS.RUTAS);
    const operators = DB.getAll(DB.KEYS.USERS).filter(u => u.rol === 'OPERADOR');

    const rows = rutas.map(r => {
        const ops = r.operadoresAsignados.map(id => {
            const op = DB.findById(DB.KEYS.USERS, id);
            return op ? op.nombre : '';
        }).filter(Boolean).join(', ');
        const clientesCount = r.clientes ? r.clientes.length : 0;
        return `
      <tr>
        <td><strong>${r.nombre}</strong></td>
        <td class="text-sm">${r.descripcion || '—'}</td>
        <td class="text-sm">${ops || 'Sin asignar'}</td>
        <td class="text-center">${clientesCount}</td>
        <td><span class="badge ${r.activa ? 'badge-success' : 'badge-error'}">${r.activa ? 'Activa' : 'Inactiva'}</span></td>
        <td>
          <button class="btn btn-ghost btn-sm" onclick="App.showOrdenarRuta(${r.id})" title="Ordenar clientes">🔢</button>
          <button class="btn btn-ghost btn-sm" onclick="App.showEditRuta(${r.id})" title="Editar">✏️</button>
          <button class="btn btn-ghost btn-sm" onclick="App.deleteRuta(${r.id})" title="Eliminar">🗑️</button>
        </td>
      </tr>`;
    }).join('');

    return `
    <div class="search-bar">
      <div></div>
      <button class="btn btn-primary" onclick="App.showNewRutaForm()">+ Nueva Ruta</button>
    </div>
    <div class="card">
      <div class="table-container">
        <table class="data-table" id="rutas-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Descripción</th>
              <th>Operadores</th>
              <th>Clientes</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="6" class="text-center text-muted">No hay rutas creadas</td></tr>'}</tbody>
        </table>
      </div>
    </div>`;
}

// =============================================
// ADMIN — MOVIMIENTOS TAB
// =============================================
function renderAdminMovimientos() {
    const movements = DB.getAll(DB.KEYS.MOVEMENTS)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const clients = DB.getAll(DB.KEYS.CLIENTS);
    const operators = DB.getAll(DB.KEYS.USERS).filter(u => u.rol === 'OPERADOR');

    const clientOpts = clients.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
    const opOpts = operators.map(o => `<option value="${o.id}">${o.nombre}</option>`).join('');

    const rows = movements.map(m => {
        const isVenta = m.tipo === 'VENTA';
        return `
      <tr>
        <td class="text-sm">${formatDateTime(m.timestamp)}</td>
        <td><strong>${getClientName(m.clienteId)}</strong></td>
        <td>${getOperadorName(m.operadorId)}</td>
        <td class="text-center">${m.cantidadAgua}</td>
        <td class="text-center">${m.cantidadHielo}</td>
        <td>
          <span class="badge ${isVenta ? 'badge-success' : 'badge-warning'}">${isVenta ? 'Venta' : 'Sin venta'}</span>
          ${m.fueEditado ? '<span class="badge badge-info" style="margin-left:4px">Editado</span>' : ''}
        </td>
        <td>
          <button class="btn btn-ghost btn-sm" onclick="App.showEditMovimiento(${m.id})">✏️</button>
        </td>
      </tr>`;
    }).join('');

    return `
    <div class="filters-row">
      <select class="form-input" id="filter-client" onchange="App.filterMovimientos()">
        <option value="">Todos los clientes</option>
        ${clientOpts}
      </select>
      <select class="form-input" id="filter-operador" onchange="App.filterMovimientos()">
        <option value="">Todos los operadores</option>
        ${opOpts}
      </select>
      <select class="form-input" id="filter-tipo" onchange="App.filterMovimientos()">
        <option value="">Todos los tipos</option>
        <option value="VENTA">Ventas</option>
        <option value="VISITA_SIN_VENTA">Sin venta</option>
      </select>
    </div>
    <div class="card">
      <div class="table-container">
        <table class="data-table" id="movimientos-table">
          <thead>
            <tr>
              <th>Fecha/Hora</th>
              <th>Cliente</th>
              <th>Operador</th>
              <th>💧</th>
              <th>🧊</th>
              <th>Tipo</th>
              <th>Acc.</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

// =============================================
// ADMIN — REPORTES TAB
// =============================================
function renderAdminReportes() {
    return `
    <div class="filters-row">
      <select class="form-input" id="reporte-periodo" onchange="App.actualizarReportes()">
        <option value="all">Todo el tiempo</option>
        <option value="today" selected>Hoy</option>
        <option value="week">Última semana</option>
        <option value="month">Último mes</option>
        <option value="mes-actual">Mes en curso</option>
      </select>
    </div>
    <div id="reportes-contenido">
      ${renderReportesContenido('today')}
    </div>`;
}

function renderReportesContenido(periodo) {
    const allMovements = DB.getAll(DB.KEYS.MOVEMENTS);
    
    // Filtrar por periodo
    let movements = allMovements;
    const now = new Date();
    
    if (periodo === 'today') {
        const today = now.toDateString();
        movements = allMovements.filter(m => new Date(m.timestamp).toDateString() === today);
    } else if (periodo === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        movements = allMovements.filter(m => new Date(m.timestamp) >= weekAgo);
    } else if (periodo === 'month') {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        movements = allMovements.filter(m => new Date(m.timestamp) >= monthAgo);
    } else if (periodo === 'mes-actual') {
        const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1);
        movements = allMovements.filter(m => new Date(m.timestamp) >= inicioMes);
    }

    const totalVisitas = movements.length;
    const totalVentas = movements.filter(m => m.tipo === 'VENTA').length;
    const allAgua = movements.reduce((s, m) => s + (m.cantidadAgua || 0), 0);
    const allHielo = movements.reduce((s, m) => s + (m.cantidadHielo || 0), 0);

    // Por operador
    const operators = DB.getAll(DB.KEYS.USERS).filter(u => u.rol === 'OPERADOR');
    const opStats = operators.map(op => {
        const opMoves = movements.filter(m => m.operadorId === op.id);
        return `
      <tr>
        <td><strong>${op.nombre}</strong></td>
        <td class="text-center">${opMoves.length}</td>
        <td class="text-center">${opMoves.filter(m => m.tipo === 'VENTA').length}</td>
        <td class="text-center">${opMoves.reduce((s, m) => s + (m.cantidadAgua || 0), 0)}</td>
        <td class="text-center">${opMoves.reduce((s, m) => s + (m.cantidadHielo || 0), 0)}</td>
      </tr>`;
    }).join('');

    // Top clientes
    const clients = DB.getAll(DB.KEYS.CLIENTS);
    const topClients = clients.map(c => {
        const cMoves = movements.filter(m => m.clienteId === c.id && m.tipo === 'VENTA');
        return { ...c, totalAgua: cMoves.reduce((s, m) => s + (m.cantidadAgua || 0), 0), visitas: cMoves.length };
    }).sort((a, b) => b.totalAgua - a.totalAgua).slice(0, 5);

    const topRows = topClients.map((c, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><strong>${c.nombre}</strong></td>
      <td class="text-center">${c.visitas}</td>
      <td class="text-center">${c.totalAgua}</td>
    </tr>`).join('');

    return `
    <div class="stats-grid" style="grid-template-columns: repeat(4, 1fr);">
      <div class="stat-card"><div class="stat-icon">📋</div><div class="stat-value">${totalVisitas}</div><div class="stat-label">Visitas</div></div>
      <div class="stat-card"><div class="stat-icon">✅</div><div class="stat-value">${totalVentas}</div><div class="stat-label">Ventas</div></div>
      <div class="stat-card"><div class="stat-icon">💧</div><div class="stat-value">${allAgua}</div><div class="stat-label">Garrafones</div></div>
      <div class="stat-card"><div class="stat-icon">🧊</div><div class="stat-value">${allHielo}</div><div class="stat-label">Hielo</div></div>
    </div>

    <div class="card mt-4">
      <div class="card-header"><h3>👷 Desempeño por Operador</h3></div>
      <div class="table-container">
        <table class="data-table">
          <thead><tr><th>Operador</th><th>Visitas</th><th>Ventas</th><th>💧</th><th>🧊</th></tr></thead>
          <tbody>${opStats}</tbody>
        </table>
      </div>
    </div>

    <div class="card mt-4">
      <div class="card-header"><h3>🏆 Top Clientes (por garrafones)</h3></div>
      <div class="table-container">
        <table class="data-table">
          <thead><tr><th>#</th><th>Cliente</th><th>Visitas</th><th>💧 Total</th></tr></thead>
          <tbody>${topRows}</tbody>
        </table>
      </div>
    </div>`;
}

// =============================================
// NOT FOUND
// =============================================
function renderNotFound() {
    return `
    <div class="main-content">
      <div class="empty-state" style="padding:5rem 1rem">
        <div class="empty-icon">🔍</div>
        <h4>Página no encontrada</h4>
        <p class="text-muted mb-4">La ruta solicitada no existe</p>
        <button class="btn btn-primary" onclick="App.navigate('dashboard')">Ir al inicio</button>
      </div>
    </div>`;
}
