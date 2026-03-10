// =============================================
// AquaTrack — Data Layer & Seed Data
// =============================================

const DB = {
  KEYS: {
    USERS: 'aquatrack_users',
    CLIENTS: 'aquatrack_clients',
    QRS: 'aquatrack_qrs',
    MOVEMENTS: 'aquatrack_movements',
    CORRECTIONS: 'aquatrack_corrections',
    SESSION: 'aquatrack_session',
  },

  get(key) {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  },

  set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },

  getAll(key) {
    return this.get(key) || [];
  },

  add(key, item) {
    const items = this.getAll(key);
    item.id = items.length > 0 ? Math.max(...items.map(i => i.id)) + 1 : 1;
    item.createdAt = new Date().toISOString();
    items.push(item);
    this.set(key, items);
    return item;
  },

  update(key, id, updates) {
    const items = this.getAll(key);
    const idx = items.findIndex(i => i.id === id);
    if (idx !== -1) {
      items[idx] = { ...items[idx], ...updates, updatedAt: new Date().toISOString() };
      this.set(key, items);
      return items[idx];
    }
    return null;
  },

  findById(key, id) {
    return this.getAll(key).find(i => i.id === id) || null;
  },

  seed() {
    if (this.get(this.KEYS.USERS)) return; // Already seeded

    // Users
    this.set(this.KEYS.USERS, [
      { id: 1, nombre: 'Juan Pérez', username: 'operador1', password: 'demo123', rol: 'OPERADOR', telefono: '5551234567', estado: 'ACTIVO', createdAt: '2024-01-01T00:00:00Z' },
      { id: 2, nombre: 'María García', username: 'operador2', password: 'demo123', rol: 'OPERADOR', telefono: '5557654321', estado: 'ACTIVO', createdAt: '2024-01-01T00:00:00Z' },
      { id: 3, nombre: 'Carlos Admin', username: 'admin', password: 'admin123', rol: 'ADMIN', telefono: '5559876543', estado: 'ACTIVO', createdAt: '2024-01-01T00:00:00Z' },
    ]);

    // Clients
    this.set(this.KEYS.CLIENTS, [
      { id: 1, nombre: 'Tienda La Esperanza', direccion: 'Av. Reforma 123, Col. Centro', referencia: 'Esquina con calle Morelos, portón azul', telefono: '5551112233', estado: 'ACTIVO', notas: 'Compra regular: 5 garrafones semanales', createdAt: '2024-01-01T00:00:00Z' },
      { id: 2, nombre: 'Restaurant El Buen Sabor', direccion: 'Calle Hidalgo 456, Col. Juárez', referencia: 'Entre 5 de Mayo y Guerrero, fachada verde', telefono: '5552223344', estado: 'ACTIVO', notas: 'Demanda alta de hielo los fines de semana', createdAt: '2024-01-02T00:00:00Z' },
      { id: 3, nombre: 'Oficinas TechCorp', direccion: 'Paseo de la Reforma 789, Col. Polanco', referencia: 'Torre corporativa piso 5', telefono: '5553334455', estado: 'ACTIVO', notas: '3 garrafones quincenales, contacto: Lic. Pérez', createdAt: '2024-01-03T00:00:00Z' },
      { id: 4, nombre: 'Café Moderno', direccion: 'Insurgentes Sur 500, Col. Roma', referencia: 'Junto a la farmacia', telefono: '5554445566', estado: 'ACTIVO', notas: 'Solo hielo, 10 bolsas semanales', createdAt: '2024-01-04T00:00:00Z' },
      { id: 5, nombre: 'Gym FitLife', direccion: 'Av. Universidad 200, Col. Narvarte', referencia: 'Planta baja, local 3', telefono: '5555556677', estado: 'ACTIVO', notas: 'Garrafones para dispensadores', createdAt: '2024-01-05T00:00:00Z' },
    ]);

    // QR codes
    this.set(this.KEYS.QRS, [
      { id: 1, clienteId: 1, codigoQR: 'CLIENTE-001-A7X2', activo: true },
      { id: 2, clienteId: 2, codigoQR: 'CLIENTE-002-B3K9', activo: true },
      { id: 3, clienteId: 3, codigoQR: 'CLIENTE-003-C5M1', activo: true },
      { id: 4, clienteId: 4, codigoQR: 'CLIENTE-004-D8P4', activo: true },
      { id: 5, clienteId: 5, codigoQR: 'CLIENTE-005-E2R7', activo: true },
    ]);

    // Movements (sample history)
    const now = new Date();
    const movements = [];
    const tipos = ['VENTA', 'VENTA', 'VENTA', 'VISITA_SIN_VENTA'];

    for (let i = 0; i < 15; i++) {
      const date = new Date(now);
      date.setHours(8 + Math.floor(Math.random() * 8));
      date.setMinutes(Math.floor(Math.random() * 60));
      date.setDate(date.getDate() - Math.floor(i / 3));
      const tipo = tipos[Math.floor(Math.random() * tipos.length)];
      const isVenta = tipo === 'VENTA';

      movements.push({
        id: i + 1,
        clienteId: (i % 5) + 1,
        operadorId: (i % 2) + 1,
        timestamp: date.toISOString(),
        cantidadAgua: isVenta ? Math.floor(Math.random() * 8) + 1 : 0,
        cantidadHielo: isVenta ? Math.floor(Math.random() * 5) : 0,
        tipo: tipo,
        notas: isVenta ? '' : 'Cliente no disponible',
        codigoQR: `CLIENTE-00${(i % 5) + 1}`,
        fueEditado: i === 3,
        createdAt: date.toISOString(),
      });
    }

    movements.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    this.set(this.KEYS.MOVEMENTS, movements);

    // Corrections
    this.set(this.KEYS.CORRECTIONS, [
      { id: 1, movimientoId: 4, adminId: 3, datosAntes: { cantidadAgua: 5 }, datosDespues: { cantidadAgua: 3 }, motivo: 'Error de captura confirmado por cliente', timestamp: new Date().toISOString() },
    ]);
  }
};

// Session helpers
const Session = {
  login(user) {
    const { password, ...safeUser } = user;
    DB.set(DB.KEYS.SESSION, safeUser);
  },
  logout() {
    localStorage.removeItem(DB.KEYS.SESSION);
  },
  getUser() {
    return DB.get(DB.KEYS.SESSION);
  },
  isLoggedIn() {
    return !!this.getUser();
  },
  isAdmin() {
    const u = this.getUser();
    return u && u.rol === 'ADMIN';
  }
};
