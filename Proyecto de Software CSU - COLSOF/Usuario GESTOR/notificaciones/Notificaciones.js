document.addEventListener('DOMContentLoaded', async () => {
  const listContainer = document.getElementById('notificationList');
  const filters = document.querySelectorAll('.filters button');

  let notifications = [];

  // 1. Cargar notificaciones desde los casos de la BD
  async function loadNotifications() {
    if(listContainer) {
      listContainer.innerHTML = '<div style="padding:20px; text-align:center; color:#666;"><span style="opacity:0.7;">⏳ Cargando notificaciones...</span></div>';
    }
    
    try {
      // Usar window.api del app-init.js global
      if (!window.api) throw new Error('API no cargada. Verifica app-init.js');
      
      const casos = await window.api.getCasos();
      
      // Generar notificaciones dinámicas desde los casos
      notifications = generateNotificationsFromCasos(casos);
      
      renderNotifications('all');
      updateBadgeWithUnreadUrgent();
    } catch (err) {
      console.error('Error cargando notificaciones:', err);
      if(listContainer) {
        listContainer.innerHTML = '<div style="padding:20px; text-align:center; color:#d32f2f;">⚠️ Error de conexión<br><small style="color:#999;">Verifica que el servidor esté activo en http://localhost:3000</small></div>';
      }
    }
  }

  // Generar notificaciones desde casos
  function generateNotificationsFromCasos(casos) {
    return casos.map((caso, idx) => {
      const fecha = new Date(caso.fecha_creacion);
      const horasDesdeCreacion = (Date.now() - fecha.getTime()) / 3600000;
      const leido = horasDesdeCreacion > 24; // Casos más antiguos se marcan como leídos
      
      let tipo = 'sistema';
      if (caso.prioridad === 'Critico' || caso.prioridad === 'Critica') tipo = 'urgente';
      if (caso.asignado_a) tipo = 'asignacion';
      
      return {
        id: caso.id || idx,
        titulo: `${caso.categoria || 'Caso'}: ${caso.cliente || 'Sin cliente'}`,
        mensaje: caso.descripcion || 'Sin descripción',
        tipo: tipo,
        fecha: formatFecha(fecha),
        leido: leido,
        prioridad: caso.prioridad || 'Media',
        estado: caso.estado || 'Abierto'
      };
    }).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  }

  function formatFecha(date) {
    const ahora = new Date();
    const diff = ahora - date;
    const minutos = Math.floor(diff / 60000);
    const horas = Math.floor(diff / 3600000);
    const dias = Math.floor(diff / 86400000);
    
    if (minutos < 1) return 'Ahora';
    if (minutos < 60) return `${minutos}m`;
    if (horas < 24) return `${horas}h`;
    if (dias < 7) return `${dias}d`;
    return date.toLocaleDateString('es-CO');
  }

  // 2. Renderizar lista con colores profesionales
  function renderNotifications(filterType) {
    if (!listContainer) return;
    listContainer.innerHTML = '';
    
    const filtered = notifications.filter(n => {
      if (filterType === 'all') return true;
      if (filterType === 'unread') return !n.leido;
      return n.tipo === filterType;
    });

    if (filtered.length === 0) {
      listContainer.innerHTML = `<div class="empty-state">
        <div class="empty-icon">📭</div>
        <h3>Sin notificaciones</h3>
        <p>No hay notificaciones en esta categoría</p>
      </div>`;
      return;
    }

    filtered.forEach((n, idx) => {
      const div = document.createElement('div');
      const badge = getBadgeClass(n.tipo);
      const prioridad = getPrioridadClass(n.prioridad);
      const iconoTipo = getIconoTipo(n.tipo);
      const timestamp = n.fecha;
      
      div.className = `notification ${n.leido ? '' : 'unread'} ${prioridad}`;
      div.setAttribute('data-id', n.id);
      
      div.innerHTML = `
        <div class="notification-header">
          <div class="notification-icon ${badge}">${iconoTipo}</div>
          <div class="notification-meta">
            <h3 class="notification-title">${escapeHtml(n.titulo)}</h3>
            <p class="notification-message">${escapeHtml(n.mensaje)}</p>
          </div>
          <div class="notification-right">
            <span class="notification-time">${timestamp}</span>
            <span class="notification-badge ${badge}">${getTextoBadge(n.tipo)}</span>
          </div>
        </div>
        <div class="notification-footer">
          <div class="notification-status">
            <small>Estado: <strong>${n.estado}</strong></small>
            <small>Prioridad: <strong>${n.prioridad}</strong></small>
          </div>
          <div class="notification-actions">
            <button class="btn-action read" title="Marcar como leída">✓</button>
            <button class="btn-action delete" title="Eliminar">✕</button>
          </div>
        </div>
      `;
      
      // Agregar eventos
      div.querySelector('.read')?.addEventListener('click', () => {
        markAsRead(idx, n);
        div.classList.remove('unread');
      });
      
      div.querySelector('.delete')?.addEventListener('click', () => {
        div.style.animation = 'slideOut 0.3s ease forwards';
        setTimeout(() => div.remove(), 300);
      });
      
      listContainer.appendChild(div);
    });
  }

  function escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  function getBadgeClass(tipo) {
    const clases = {
      'urgente': 'badge-red',
      'asignacion': 'badge-blue',
      'sistema': 'badge-gray'
    };
    return clases[tipo] || 'badge-gray';
  }

  function getPrioridadClass(prioridad) {
    if (!prioridad) return '';
    const p = prioridad.toLowerCase();
    if (p.includes('critica') || p.includes('critico')) return 'priority-critical';
    if (p === 'alta') return 'priority-high';
    if (p === 'media') return 'priority-medium';
    return 'priority-low';
  }

  function getIconoTipo(tipo) {
    const iconos = {
      'urgente': '⚠️',
      'asignacion': '👤',
      'sistema': 'ℹ️'
    };
    return iconos[tipo] || 'ℹ️';
  }

  function getTextoBadge(tipo) {
    const textos = {
      'urgente': 'Urgente',
      'asignacion': 'Asignación',
      'sistema': 'Sistema'
    };
    return textos[tipo] || 'Notificación';
  }

  function markAsRead(idx, notification) {
    notification.leido = true;
    updateBadgeWithUnreadUrgent();
  }

  // Actualizar badge solo con notificaciones sin leer o urgentes
  function updateBadgeWithUnreadUrgent() {
    const unreadOrUrgent = notifications.filter(n => !n.leido || n.tipo === 'urgente');
    const count = unreadOrUrgent.length;
    const badge = document.getElementById('notificationBadge');
    
    if (badge) {
      badge.textContent = count;
      badge.classList.toggle('hidden', count === 0);
    }
  }

  // Eventos de filtros
  filters.forEach(btn => btn.addEventListener('click', () => { filters.forEach(b => b.classList.remove('active')); btn.classList.add('active'); renderNotifications(btn.dataset.filter); }));

  loadNotifications();
});