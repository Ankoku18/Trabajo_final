/**
 * Script de inicialización común para todos los módulos
 * Incluir en todas las páginas HTML antes de los scripts específicos
 */

// API Client compartido - Construir URL dinámica para evitar problemas CORS
let API_BASE_URL;
if (window.location.protocol === 'file:') {
  // Si se abre como archivo local, usar localhost
  API_BASE_URL = 'http://localhost:3000/api';
} else if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
  // En desarrollo: usar el mismo origen del frontend para evitar CORS
  const port = window.location.port || (window.location.protocol === 'https:' ? 443 : 80);
  API_BASE_URL = `${window.location.protocol}//${window.location.hostname}:${port}/api`;
} else {
  // En producción: usar ruta relativa (mismo dominio)
  API_BASE_URL = '/api';
}

// Utilidades compartidas
const utils = {
  formatCaseId: (id) => `#${String(id ?? '').padStart(8, '0')}`,
  
  formatDate: (value) => {
    if (!value) return 'Sin fecha'
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return value
    return d.toLocaleString('es-CO', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric'
    })
  },

  formatDateTime: (value) => {
    if (!value) return 'Sin fecha'
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return value
    return d.toLocaleString('es-CO', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  },

  timeAgo: (value) => {
    if (!value) return 'Sin fecha'
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return 'Sin fecha'
    const diff = Date.now() - d.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    
    if (minutes < 60) return `Hace ${minutes} min`
    if (hours < 24) return `Hace ${hours} hora${hours === 1 ? '' : 's'}`
    return `Hace ${days} dia${days === 1 ? '' : 's'}`
  },

  showToast: (msg, isError = false) => {
    let box = document.getElementById('app-toast')
    if (!box) {
      box = document.createElement('div')
      box.id = 'app-toast'
      box.style.position = 'fixed'
      box.style.right = '20px'
      box.style.bottom = '20px'
      box.style.padding = '12px 16px'
      box.style.borderRadius = '8px'
      box.style.boxShadow = '0 10px 30px rgba(0,0,0,0.12)'
      box.style.zIndex = '9999'
      box.style.fontWeight = '600'
      document.body.appendChild(box)
    }
    box.textContent = msg
    box.style.background = isError ? '#fee2e2' : '#d1fae5'
    box.style.color = isError ? '#991b1b' : '#065f46'
    clearTimeout(box._timer)
    box._timer = setTimeout(() => box.remove(), 2400)
  },

  getPriorityColor: (priority) => {
    const p = String(priority || '').toLowerCase()
    if (p === 'alta' || p === 'urgente' || p === 'crítica') return '#dc2626'
    if (p === 'media') return '#f97316'
    return '#10b981'
  },

  getStatusColor: (status) => {
    const s = String(status || '').toLowerCase()
    if (s.includes('abierto') || s.includes('activo')) return '#06b6d4'
    if (s.includes('progreso')) return '#f59e0b'
    if (s.includes('resuelto')) return '#10b981'
    if (s.includes('cerrado')) return '#6b7280'
    if (s.includes('cancelado')) return '#a855f7'
    return '#94a3b8'
  },

  normalize: (val) => String(val || '').toLowerCase()
}

// Resolver ruta al login desde cualquier subcarpeta (file:// o servidor)
function resolveLoginPath() {
  if (window.location.protocol !== 'file:') {
    return '/index.html'
  }

  const marker = 'Proyecto de Software CSU - COLSOF/'
  const path = decodeURIComponent(window.location.pathname).replace(/\\/g, '/')
  const idx = path.indexOf(marker)
  if (idx === -1) return 'index.html'

  const after = path.slice(idx + marker.length)
  const parts = after.split('/').filter(Boolean)
  const depth = Math.max(parts.length, 1)
  return '../'.repeat(depth) + 'index.html'
}

// Cliente API
class APIClient {
  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      })

      if (!response.ok) {
        // Intentar leer el mensaje de error del cuerpo JSON
        let errorMsg = `HTTP ${response.status}: ${response.statusText}`
        try {
          const errData = await response.json()
          if (errData.error) errorMsg = errData.error
        } catch (_) { /* ignorar si el cuerpo no es JSON */ }
        throw new Error(errorMsg)
      }

      const data = await response.json()
      
      if (data.success === false) {
        throw new Error(data.error || 'Error desconocido')
      }

      return data
    } catch (error) {
      console.error(`API Error [${endpoint}]:`, error)
      throw error
    }
  }

  async getCasos(filters = {}) {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.append(key, value)
    })
    
    const endpoint = `/casos${params.toString() ? '?' + params : ''}`
    const result = await this.request(endpoint)
    return result.data || []
  }

  async getCaso(id) {
    const result = await this.request(`/casos/${id}`)
    return result.data
  }

  async crearCaso(caso) {
    const result = await this.request('/casos', {
      method: 'POST',
      body: JSON.stringify(caso)
    })
    return result.data
  }

  async actualizarCaso(id, updates) {
    const result = await this.request(`/casos/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    })
    return result.data
  }

  async getEstadisticasCasos() {
    const result = await this.request('/estadisticas')
    return result.data
  }

  async getUsuarios(filters = {}) {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) params.append(key, value)
    })
    
    const endpoint = `/usuarios${params.toString() ? '?' + params : ''}`
    const result = await this.request(endpoint)
    return result.data || []
  }

  async getUsuario(id) {
    const result = await this.request(`/usuarios/${id}`)
    return result.data
  }

  async getEstadisticasUsuarios() {
    const result = await this.request('/usuarios-stats')
    return result.data
  }
}

// Instancia global
const api = new APIClient()

// Hacer disponible globalmente
window.api = api
window.utils = utils
window.API_BASE_URL = API_BASE_URL
window.resolveLoginPath = resolveLoginPath

// Supabase (frontend)
const SUPABASE_URL = window.SUPABASE_URL || ''
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || ''

async function initSupabaseClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return

  if (!window.supabase) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
      script.async = true
      script.onload = resolve
      script.onerror = reject
      document.head.appendChild(script)
    })
  }

  if (window.supabase && typeof window.supabase.createClient === 'function') {
    window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    console.log('✅ Supabase client inicializado')
  } else {
    console.warn('⚠️ No se pudo inicializar Supabase: libreria no disponible')
  }
}

console.log('✅ Sistema inicializado - API conectada a:', API_BASE_URL)

initSupabaseClient().catch((error) => {
  console.warn('⚠️ Error inicializando Supabase:', error)
})

// ===== ACTUALIZACIÓN AUTOMÁTICA DEL BADGE DE NOTIFICACIONES =====
function actualizarBadgeNotificaciones() {
  const badge = document.getElementById('notificationBadge');
  if (!badge) return;

  // Intentar cargar notificaciones desde API o usar datos de ejemplo
  (async () => {
    try {
      const casos = await api.getCasos();
      
      // Calcular notificaciones sin leer (casos nuevos o urgentes)
      const ahora = new Date();
      let countNoLeidas = 0;
      
      casos.forEach(caso => {
        const fechaCreacion = new Date(caso.fecha_creacion);
        const horasDesdeCreacion = (ahora - fechaCreacion) / 3600000;
        
        // Contar como no leída si:
        // - Es menor a 24 horas
        // - O es crítica/urgente
        const esReciente = horasDesdeCreacion < 24;
        const esUrgente = caso.prioridad && (caso.prioridad.toLowerCase().includes('critica') || caso.prioridad.toLowerCase().includes('urgente'));
        
        if (esReciente || esUrgente) {
          countNoLeidas++;
        }
      });
      
      // Actualizar badge
      badge.textContent = countNoLeidas;
      badge.classList.toggle('hidden', countNoLeidas === 0);
      
      console.log(`📬 Badge actualizado: ${countNoLeidas} notificaciones`);
    } catch (error) {
      console.warn('⚠️ No se pudo actualizar badge de notificaciones:', error);
      // En caso de error, mostrar 4 notificaciones de ejemplo
      badge.textContent = '4';
      badge.classList.remove('hidden');
    }
  })();
}

// ===== GESTIÓN DEL USUARIO EN SESIÓN =====

/**
 * Lee el usuario del localStorage y actualiza todos los elementos de perfil
 * visibles en la página. Si no hay sesión activa, redirige al login.
 */
function initUserSession() {
  const raw = localStorage.getItem('usuario');

  // Si no hay sesión, redirigir al login
  if (!raw) {
    window.location.replace(resolveLoginPath());
    return null;
  }

  let usuario;
  try {
    usuario = JSON.parse(raw);
  } catch (_) {
    localStorage.removeItem('usuario');
    window.location.replace(resolveLoginPath());
    return null;
  }

  // Construir nombre completo para mostrar
  const nombreCompleto = [usuario.nombre, usuario.apellido]
    .filter(Boolean)
    .join(' ')
    .trim() || usuario.email || 'Usuario';

  const emailMostrado = usuario.email || usuario.rol || '';

  // Actualizar todos los elementos .profile-name y .profile-email
  document.querySelectorAll('.profile-name').forEach(el => {
    el.textContent = nombreCompleto;
  });
  document.querySelectorAll('.profile-email').forEach(el => {
    el.textContent = emailMostrado;
  });

  // Exponer globalmente para uso en otros scripts
  window.currentUser = usuario;

  return usuario;
}

function initProfileMenus() {
  const profiles = Array.from(document.querySelectorAll('.profile'));
  if (!profiles.length) return;

  const closeAllMenus = () => {
    profiles.forEach((profile) => {
      const menu = profile.querySelector('.profile-menu');
      const btn = profile.querySelector('.profile-menu-btn');
      if (menu) menu.classList.remove('show');
      if (btn) btn.setAttribute('aria-expanded', 'false');
    });
  };

  profiles.forEach((profile, index) => {
    const btn = profile.querySelector('.profile-menu-btn');
    const menu = profile.querySelector('.profile-menu');
    if (!btn || !menu) return;

    const menuId = menu.id || `profile-menu-${index + 1}`;
    menu.id = menuId;
    btn.setAttribute('aria-haspopup', 'menu');
    btn.setAttribute('aria-controls', menuId);
    btn.setAttribute('aria-expanded', 'false');

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const wasOpen = menu.classList.contains('show');
      closeAllMenus();
      if (!wasOpen) {
        menu.classList.add('show');
        btn.setAttribute('aria-expanded', 'true');
      }
    });

    menu.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    const logoutBtn = menu.querySelector('.logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('usuario');
        window.location.replace(resolveLoginPath());
      });
    }
  });

  document.addEventListener('click', closeAllMenus);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllMenus();
  });
}

const initAppCommon = () => {
  initUserSession();
  actualizarBadgeNotificaciones();
  initProfileMenus();
};

// Ejecutar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAppCommon);
} else {
  initAppCommon();
}

// Actualizar cada 2 minutos
setInterval(actualizarBadgeNotificaciones, 120000);


