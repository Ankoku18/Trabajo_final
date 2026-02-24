/* =====================================================
   Lista de Usuarios – Admin
   GET /api/usuarios → { id, nombre, email, rol, activo, fecha_creacion }
   ===================================================== */
(function () {
  const API_URL = 'http://localhost:3000/api';
  let allUsuarios = [];

  // ── Helpers ──────────────────────────────────────
  const qs = (sel, root = document) => root.querySelector(sel);

  function setVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function formatFecha(fecha) {
    if (!fecha) return '—';
    try {
      return new Date(fecha).toLocaleDateString('es-CO', {
        year: 'numeric', month: 'short', day: 'numeric'
      });
    } catch {
      return fecha;
    }
  }

  // ── Cargar datos desde la API ─────────────────────
  async function loadUsuarios() {
    try {
      const res = await fetch(`${API_URL}/usuarios`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const payload = await res.json();
      allUsuarios = payload.data || payload || [];

      updateKPIs();
      renderTable(allUsuarios);
      console.log('✓ Lista de usuarios cargados:', allUsuarios.length);
    } catch (err) {
      console.error('Error al cargar usuarios:', err);
      const tbody = document.getElementById('tablaUsuarios');
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#c0392b;">
          Error al conectar con la base de datos. Verifique que el servidor esté activo.</td></tr>`;
      }
    }
  }

  // ── KPIs ─────────────────────────────────────────
  function updateKPIs() {
    const activos    = allUsuarios.filter(u => (u.estado || (u.activo !== false ? 'Activo' : 'Inactivo')).toLowerCase() === 'activo').length;
    const inactivos  = allUsuarios.filter(u => (u.estado || (u.activo !== false ? 'Activo' : 'Inactivo')).toLowerCase() === 'inactivo').length;
    const suspendidos = allUsuarios.filter(u => (u.estado || '').toLowerCase() === 'suspendido').length;

    setVal('total', allUsuarios.length);
    setVal('activos', activos);
    setVal('inactivos', inactivos);
    setVal('suspendidos', suspendidos);
  }

  // ── Renderizar tabla ──────────────────────────────
  function renderTable(usuarios) {
    const tbody = document.getElementById('tablaUsuarios');
    if (!tbody) return;

    if (usuarios.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:#666;">
        No se encontraron usuarios con los filtros actuales.</td></tr>`;
      return;
    }

    tbody.innerHTML = usuarios.map(u => {
      const activo = u.activo !== false;
      const estadoStr = (u.estado || (activo ? 'Activo' : 'Inactivo')).toLowerCase();
      const estadoClass = estadoStr === 'suspendido' ? 'status-suspended' : (estadoStr === 'activo' ? 'status-active' : 'status-inactive');
      const estadoText = estadoStr === 'suspendido' ? 'Suspendido' : (estadoStr === 'activo' ? 'Activo' : 'Inactivo');
      const dotColor = estadoStr === 'activo' ? 'green' : (estadoStr === 'suspendido' ? 'yellow' : 'gray');
      const userJson = encodeURIComponent(JSON.stringify(u));

      return `
        <tr class="editable-row" data-user="${userJson}" title="Doble clic para editar" style="cursor:pointer">
          <td>${u.id}</td>
          <td>
            <div class="user-cell">
              <span class="user-avatar-sm">${(u.nombre || '?')[0].toUpperCase()}</span>
              <span>${u.nombre || '—'}</span>
            </div>
          </td>
          <td>${u.email || '—'}</td>
          <td><span class="badge-rol">${u.rol || 'Usuario'}</span></td>
          <td><span class="dot ${dotColor}"></span> <span class="${estadoClass}">${estadoText}</span></td>
          <td>${formatFecha(u.fecha_creacion)}</td>
        </tr>
      `;
    }).join('');

    // Doble clic para abrir el modal de edición
    tbody.querySelectorAll('.editable-row').forEach(tr => {
      tr.addEventListener('dblclick', () => {
        try {
          const user = JSON.parse(decodeURIComponent(tr.dataset.user));
          openEditModal(user);
        } catch (e) {
          console.error('Error al parsear usuario:', e);
        }
      });
    });
  }

  // ── Filtros ───────────────────────────────────────
  function applyFilters() {
    const searchVal = (qs('#search')?.value || '').toLowerCase().trim();
    const rolVal = qs('#filterRole')?.value || 'todos';
    const statusVal = qs('#filterStatus')?.value || 'todos';

    const filtered = allUsuarios.filter(u => {
      // Búsqueda de texto
      if (searchVal) {
        const haystack = `${u.id} ${u.nombre} ${u.email}`.toLowerCase();
        if (!haystack.includes(searchVal)) return false;
      }

      // Filtro por rol
      if (rolVal !== 'todos') {
        if ((u.rol || '').toLowerCase() !== rolVal.toLowerCase()) return false;
      }

      // Filtro por estado
      if (statusVal !== 'todos') {
        const estadoUser = (u.estado || (u.activo !== false ? 'activo' : 'inactivo')).toLowerCase();
        if (estadoUser !== statusVal.toLowerCase()) return false;
      }

      return true;
    });

    renderTable(filtered);
  }

  // ── Modal: Editar Usuario ─────────────────────────
  let currentEditId = null;

  function openEditModal(user) {
    currentEditId = user.id;
    const modal = document.getElementById('editUserModal');
    if (!modal) return;

    // Avatar con iniciales
    const nom = (user.nombre || '?')[0].toUpperCase();
    const ape = user.apellido ? user.apellido[0].toUpperCase() : (user.nombre || '??')[1]?.toUpperCase() || '';
    const avatarEl = document.getElementById('modalAvatarEl');
    if (avatarEl) {
      avatarEl.textContent = nom + ape;
      // Color según rol
      const rolColorMap = { administrador: '#1d4ed8', gestor: '#0891b2', tecnico: '#7c3aed' };
      const rolKey = (user.rol || '').toLowerCase();
      avatarEl.style.background = rolColorMap[rolKey] || '#64748b';
    }

    // ID badge
    const badge = document.getElementById('modalIdBadge');
    if (badge) badge.textContent = `ID #${user.id}`;

    // Poblar campos
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
    set('editNombre', user.nombre);
    set('editApellido', user.apellido);
    set('editEmail', user.email);
    set('editRol', user.rol || 'Tecnico');
    set('editEstado', (user.estado || (user.activo !== false ? 'Activo' : 'Inactivo')).toLowerCase());
    set('editPassword', '');

    // Colapsar sección contraseña
    const pwdFields = document.getElementById('passwordFields');
    if (pwdFields) pwdFields.style.display = 'none';
    const toggleBtn = document.getElementById('togglePwdSection');
    if (toggleBtn) toggleBtn.innerHTML = '<i class="fa fa-key"></i> Cambiar contraseña';
    const pwdInput = document.getElementById('editPassword');
    if (pwdInput) pwdInput.type = 'password';
    const eyeIcon = document.getElementById('eyeIcon');
    if (eyeIcon) eyeIcon.className = 'fa fa-eye';

    // Limpiar alerta
    const alertEl = document.getElementById('modalAlert');
    if (alertEl) { alertEl.style.display = 'none'; alertEl.textContent = ''; }

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    setTimeout(() => document.getElementById('editNombre')?.focus(), 50);
  }

  function closeEditModal() {
    const modal = document.getElementById('editUserModal');
    if (modal) modal.style.display = 'none';
    document.body.style.overflow = '';
    currentEditId = null;
  }

  async function saveUser() {
    if (!currentEditId) return;

    const getVal = id => (document.getElementById(id)?.value || '').trim();
    const nombre   = getVal('editNombre');
    const apellido = getVal('editApellido');
    const email    = getVal('editEmail');
    const rol      = getVal('editRol');
    const estado   = getVal('editEstado');
    const password = getVal('editPassword');

    if (!nombre) return showModalAlert('El nombre es obligatorio.', 'error');
    if (!email || !email.includes('@')) return showModalAlert('Ingresa un correo electrónico válido.', 'error');
    if (password && password.length < 8) return showModalAlert('La contraseña debe tener al menos 8 caracteres.', 'error');

    const payload = { nombre, apellido, email, rol, estado };
    if (password) payload.password = password;

    const saveBtn = document.getElementById('modalSaveBtn');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Guardando...'; }

    try {
      const res = await fetch(`${API_URL}/usuarios/${currentEditId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!res.ok || !data.success) throw new Error(data.error || `Error HTTP ${res.status}`);

      // Actualizar caché local
      const idx = allUsuarios.findIndex(u => u.id === currentEditId);
      if (idx !== -1) allUsuarios[idx] = { ...allUsuarios[idx], ...data.data };

      closeEditModal();
      updateKPIs();
      applyFilters();
      showToast(`✓ Usuario #${currentEditId} actualizado correctamente`, 'success');
    } catch (err) {
      console.error('Error al guardar usuario:', err);
      showModalAlert(err.message || 'Error al guardar. Verifica la conexión al servidor.', 'error');
    } finally {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = '<i class="fa fa-save"></i> Guardar cambios'; }
    }
  }

  function showModalAlert(msg, type) {
    const el = document.getElementById('modalAlert');
    if (!el) return;
    el.textContent = msg;
    el.className = `modal-alert modal-alert-${type}`;
    el.style.display = 'block';
  }

  function showToast(msg, type) {
    const toast = document.getElementById('toastNotif');
    if (!toast) return;
    toast.textContent = msg;
    toast.className = `toast-notif toast-${type}`;
    toast.style.display = 'block';
    setTimeout(() => { toast.style.display = 'none'; }, 3500);
  }

  // ── Exportar CSV ─────────────────────────────────
  window.exportar = function () {
    if (allUsuarios.length === 0) {
      alert('No hay datos para exportar.');
      return;
    }

    const headers = ['ID', 'Nombre', 'Email', 'Rol', 'Estado', 'Fecha Registro'];
    const rows = allUsuarios.map(u => [
      u.id,
      u.nombre || '',
      u.email || '',
      u.rol || '',
      u.activo !== false ? 'Activo' : 'Inactivo',
      formatFecha(u.fecha_creacion)
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `usuarios_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Inicializar ───────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    loadUsuarios();

    // Eventos de filtros
    const searchInput = document.getElementById('search');
    const filterRole  = document.getElementById('filterRole');
    const filterStatus = document.getElementById('filterStatus');

    if (searchInput) searchInput.addEventListener('input', applyFilters);
    if (filterRole) filterRole.addEventListener('change', applyFilters);
    if (filterStatus) filterStatus.addEventListener('change', applyFilters);

    // ══ Eventos del modal ══════════════════════════════
    document.getElementById('modalCloseBtn')?.addEventListener('click', closeEditModal);
    document.getElementById('modalCancelBtn')?.addEventListener('click', closeEditModal);
    document.getElementById('modalSaveBtn')?.addEventListener('click', saveUser);

    // Cerrar al pulsar fuera del panel
    document.getElementById('editUserModal')?.addEventListener('click', function(e) {
      if (e.target === this) closeEditModal();
    });

    // Cerrar con Escape
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') closeEditModal();
    });

    // Toggle sección contraseña
    document.getElementById('togglePwdSection')?.addEventListener('click', function() {
      const fields = document.getElementById('passwordFields');
      if (!fields) return;
      const visible = fields.style.display !== 'none';
      fields.style.display = visible ? 'none' : 'block';
      this.innerHTML = visible
        ? '<i class="fa fa-key"></i> Cambiar contraseña'
        : '<i class="fa fa-key"></i> Ocultar contraseña';
      if (!visible) document.getElementById('editPassword')?.focus();
    });

    // Toggle visibilidad contraseña (ojo)
    document.getElementById('togglePwdEye')?.addEventListener('click', function() {
      const input = document.getElementById('editPassword');
      const icon  = document.getElementById('eyeIcon');
      if (!input || !icon) return;
      const isPass = input.type === 'password';
      input.type = isPass ? 'text' : 'password';
      icon.className = isPass ? 'fa fa-eye-slash' : 'fa fa-eye';
    });

    // Guardar con Enter en formulario
    document.getElementById('editUserForm')?.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveUser(); }
    });
  });
})();
