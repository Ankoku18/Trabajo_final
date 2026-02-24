// scripts.js - lógica unificada para el dashboard y creación de usuarios

(function(){
  // =====================
  // Autenticación y Usuario
  // =====================
  
  // Verificar si hay un usuario autenticado
  const usuarioData = localStorage.getItem('usuario');
  if (!usuarioData) {
    // Si no hay usuario, redirigir al login
    const loginPath = resolveLoginPath();
    window.location.href = loginPath;
    return;
  }

  // Parsear datos del usuario
  let usuario;
  try {
    usuario = JSON.parse(usuarioData);
  } catch (e) {
    console.error('Error al parsear datos del usuario:', e);
    localStorage.removeItem('usuario');
    window.location.href = resolveLoginPath();
    return;
  }

  // Verificar que el usuario tenga el rol correcto (Administrador o Técnico)
  if (usuario.rol && !['administrador', 'tecnico'].includes(usuario.rol.toLowerCase())) {
    alert('No tienes permisos para acceder a esta página.');
    window.location.href = resolveLoginPath();
    return;
  }

  // Actualizar la información del perfil en la interfaz cuando el DOM esté listo
  // (app-init.js también lo hace; este bloque cubre páginas sin app-init.js)
  document.addEventListener('DOMContentLoaded', function() {
    const nombreCompleto = [usuario.nombre, usuario.apellido].filter(Boolean).join(' ').trim() || usuario.email || 'Administrador';
    document.querySelectorAll('.profile-name').forEach(el => { el.textContent = nombreCompleto; });
    document.querySelectorAll('.profile-email').forEach(el => { el.textContent = usuario.email || ''; });
  });

  // Utilidades
  function qs(sel, ctx=document){ return ctx.querySelector(sel); }
  function qsa(sel, ctx=document){ return Array.from(ctx.querySelectorAll(sel)); }

  // Configuración de API
  const API_URL = window.API_BASE_URL || ((window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '' ||
    window.location.protocol === 'file:')
    ? 'http://localhost:3000/api'
    : '/api');
  const normalizeCasos = (payload) => {
    if (Array.isArray(payload)) return payload;
    return payload?.data || payload?.cases || [];
  };
  let refreshInterval = null;
  let currentTimeRange = '12'; // meses por defecto
  let lastCasos = []; // caché de casos para no re-fetch al cambiar rango



  // Modal de construcción (compatibilidad con ambos ids)
  (function(){
    const modal = qs('#mdlConstruccion') || qs('#modal-construccion');
    const cerrar = qs('#btnCerrarModal') || qs('#cerrar-modal');
    if (!modal) return;
    qsa('.open-modal').forEach(a => a.addEventListener('click', (e) => { e.preventDefault(); modal.classList.add('active'); modal.style.display = 'flex'; }));
    if (cerrar) cerrar.addEventListener('click', () => { modal.classList.remove('active'); modal.style.display = 'none'; });
    modal.addEventListener('click', (e) => { if (e.target === modal) { modal.classList.remove('active'); modal.style.display = 'none'; } });
  })();

  // =====================
  // CARGAR ESTADÍSTICAS DINÁMICAS
  // =====================
  async function loadDashboardStats() {
    try {
      // --- Tarjetas del mes: usar endpoint dedicado ---
      const statsRes = await fetch(`${API_URL}/dashboard/stats`);
      if (statsRes.ok) {
        const statsJson = await statsRes.json();
        if (statsJson.success && statsJson.data) {
          const d = statsJson.data;
          const statCards = qsa('.stat-card');
          if (statCards.length >= 4) {
            updateStatCard(statCards[0], 'Solucionados', d.resueltos,  d.cambio_resueltos);
            updateStatCard(statCards[1], 'Creados',      d.creados,    d.cambio_creados);
            updateStatCard(statCards[2], 'En Pausa',     d.pausados,   d.cambio_pausados);
            updateStatCard(statCards[3], 'Cerrados',     d.cerrados,   d.cambio_cerrados);
          }
          console.log('✓ Estadísticas del mes actualizadas:', d);
        }
      }

      // --- Gráfico y flujo de casos: seguir usando /api/casos ---
      const casosRes = await fetch(`${API_URL}/casos`);
      if (!casosRes.ok) throw new Error('Error al cargar casos para gráfico');
      const payload = await casosRes.json();
      const casos = normalizeCasos(payload);

      lastCasos = casos;
      updateFlujoCasos(casos);
      generateDynamicChart(casos, currentTimeRange);
    } catch (error) {
      console.error('Error al cargar estadísticas:', error);
    }
  }

  function calcularTendencia(actual, anterior) {
    if (anterior === 0) return actual > 0 ? 100 : 0;
    const porcentaje = ((actual - anterior) / anterior) * 100;
    return Math.round(porcentaje);
  }

  function updateStatCard(card, title, value, trend) {
    const valueEl = card.querySelector('.stat-value');
    const trendEl = card.querySelector('.stat-change');
    
    if (valueEl) {
      // Animación de conteo
      const currentValue = parseInt(valueEl.textContent.replace(/,/g, '')) || 0;
      animateValue(valueEl, currentValue, value, 800);
    }
    
    if (trendEl && trend !== undefined) {
      const isPositive = trend >= 0;
      trendEl.textContent = `${isPositive ? '+' : ''}${trend}% ${isPositive ? '↑' : '↓'}`;
      
      // Cambiar clase: verde si positivo, rojo si negativo
      trendEl.className = `stat-change ${isPositive ? 'positive' : 'negative'}`;
      
      // Aplicar estilos dinámicos
      if (isPositive) {
        trendEl.style.color = 'var(--col-good)';
      } else {
        trendEl.style.color = 'var(--col-bad)';
      }
    }
  }

  function animateValue(element, start, end, duration) {
    const range = end - start;
    const increment = range / (duration / 16);
    let current = start;
    
    const timer = setInterval(() => {
      current += increment;
      if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
        current = end;
        clearInterval(timer);
      }
      element.textContent = Math.floor(current).toLocaleString('es-CO');
    }, 16);
  }

  function updateFlujoCasos(casos) {
    const resueltos = casos.filter(c => c.estado?.toLowerCase() === 'resuelto').length;
    const enCurso = casos.filter(c => ['abierto', 'en_progreso'].includes(c.estado?.toLowerCase())).length;
    const pausados = casos.filter(c => c.estado?.toLowerCase() === 'pausado').length;
    const cancelados = casos.filter(c => c.estado?.toLowerCase() === 'cerrado').length;
    
    const total = casos.length || 1;
    
    const progressRows = qsa('.progress-row');
    if (progressRows.length >= 4) {
      updateProgressRow(progressRows[0], 'Resueltos', resueltos, (resueltos / total) * 100);
      updateProgressRow(progressRows[1], 'En Curso', enCurso, (enCurso / total) * 100);
      updateProgressRow(progressRows[2], 'Pausados', pausados, (pausados / total) * 100);
      updateProgressRow(progressRows[3], 'Cancelados', cancelados, (cancelados / total) * 100);
    }
  }

  function updateProgressRow(row, name, value, percentage) {
    const valueEl = row.querySelector('.value');
    const barEl = row.querySelector('.bar');
    
    if (valueEl) valueEl.textContent = value.toLocaleString('es-CO');
    if (barEl) {
      barEl.style.width = `${Math.min(percentage, 100)}%`;
      barEl.className = `bar w-${Math.min(Math.round(percentage), 100)}`;
    }
  }

  function updateChart(casos) {
    // Agrupar casos por mes
    const casosPorMes = {};
    casos.forEach(caso => {
      if (caso.fecha_creacion) {
        const fecha = new Date(caso.fecha_creacion);
        const mesKey = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
        casosPorMes[mesKey] = (casosPorMes[mesKey] || 0) + 1;
      }
    });
    
    // Los últimos 12 meses
    const meses = Object.keys(casosPorMes).sort().slice(-12);
    console.log('✓ Gráfico actualizado con datos de', meses.length, 'meses');
  }

  // =====================
  // CARGAR LISTA DE USUARIOS
  // =====================

  /** Obtiene iniciales de un nombre (ej: "Juan García" → "JG", "juan.garcia" → "JG") */
  function getInitials(name) {
    if (!name) return '?';
    return name.split(/[\s._-]+/).filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('');
  }

  /** Clase de color para el avatar según rol */
  function uiColorClass(rol) {
    const r = (rol || '').toLowerCase();
    if (r.includes('admin'))   return 'ui-admin';
    if (r.includes('tecnico') || r.includes('técnico')) return 'ui-tecnico';
    if (r.includes('gestor'))  return 'ui-gestor';
    return 'ui-default';
  }

  /** Clase de badge de rol */
  function roleBadgeClass(rol) {
    const r = (rol || '').toLowerCase();
    if (r.includes('admin'))   return 'rb-admin';
    if (r.includes('tecnico') || r.includes('técnico')) return 'rb-tecnico';
    if (r.includes('gestor'))  return 'rb-gestor';
    return 'rb-default';
  }

  /** Badge de estado */
  function statusBadge(activo, pendiente) {
    if (pendiente) return `<span class="status-badge sb-pending"><span class="dot yellow"></span>Pendiente</span>`;
    if (activo)    return `<span class="status-badge sb-active"><span class="dot green"></span>Activo</span>`;
    return              `<span class="status-badge sb-inactive"><span class="dot red"></span>Inactivo</span>`;
  }

  async function loadUsuarios() {
    try {
      const response = await fetch(`${API_URL}/usuarios`);
      if (!response.ok) throw new Error('Error al cargar usuarios');
      
      const payload = await response.json();
      const usuarios = payload.data || payload || [];
      
      // Actualizar lista de usuarios (tabla principal del dashboard)
      const listContainer = qs('.list');
      if (listContainer && usuarios.length > 0) {
        const usuariosMostrar = usuarios.slice(0, 4);
        const headerRow = `
          <div class="list-header" role="row">
            <div class="list-header-cell" role="columnheader">ID</div>
            <div class="list-header-cell" role="columnheader">Usuario</div>
            <div class="list-header-cell" role="columnheader">Estado</div>
            <div class="list-header-cell" role="columnheader">Rol</div>
            <div class="list-header-cell" role="columnheader"></div>
          </div>`;
        const rows = usuariosMostrar.map(user => {
          const initials  = getInitials(user.nombre || user.email || '');
          const colorCls  = uiColorClass(user.rol);
          const roleCls   = roleBadgeClass(user.rol);
          const badgeHtml = statusBadge(user.activo, false);
          const rolLabel  = user.rol
            ? user.rol.charAt(0).toUpperCase() + user.rol.slice(1).toLowerCase()
            : 'Usuario';
          return `
          <div class="list-row" role="row">
            <div class="list-id" role="cell">${user.id}</div>
            <div class="user-cell" role="cell">
              <span class="user-initials ${colorCls}">${initials}</span>
              <div>
                <div class="list-name">${user.nombre || user.email}</div>
                <div class="list-email">${user.email}</div>
              </div>
            </div>
            <div role="cell">${badgeHtml}</div>
            <div role="cell"><span class="role-badge ${roleCls}">${rolLabel}</span></div>
            <div role="cell"><button class="btn-icon" aria-label="Más opciones">⋯</button></div>
          </div>`;
        }).join('');
        listContainer.innerHTML = headerRow + rows;
      }
      
      // Actualizar mini-lista de usuarios activos
      const miniList = qs('.mini-list');
      if (miniList && usuarios.length > 0) {
        const topUsuarios = usuarios.filter(u => u.activo).slice(0, 4);
        const miniItems = topUsuarios.map((user, idx) => {
          const rolLabel = user.rol
            ? user.rol.charAt(0).toUpperCase() + user.rol.slice(1).toLowerCase()
            : 'Usuario';
          const roleCls = roleBadgeClass(user.rol);
          return `
          <div class="mini-item">
            <div class="mini-left">
              <span class="mini-avatar"><img src="https://i.pravatar.cc/36?img=${idx + 10}" alt="${user.nombre || user.email}"></span>
              <div class="mini-info">
                <div class="name">${user.nombre || user.email}</div>
                <div class="email">${user.email}</div>
              </div>
            </div>
            <div class="mini-right"><span class="role-badge ${roleCls}">${rolLabel}</span></div>
          </div>`;
        }).join('');
        
        miniList.innerHTML = miniItems + '<div class="text-center-margin"><a class="card-action-link" href="Usuarios/Lista/Lista.html">Ver más</a></div>';
      }
      
      console.log('✓ Usuarios cargados:', usuarios.length, 'usuarios');
    } catch (error) {
      console.error('Error al cargar usuarios:', error);
    }
  }

  // Exportar CSV (dashboard)
  (function(){
    const btnCSV = qs('#btnCSV');
    if (!btnCSV) return;
    btnCSV.addEventListener('click', async () => {
      try {
        const response = await fetch(`${API_URL}/casos`);
        if (!response.ok) throw new Error('Error al cargar datos');
        
        const payload = await response.json();
        const casos = normalizeCasos(payload);
        
        // Crear CSV con datos reales
        const headers = ['ID', 'Cliente', 'Estado', 'Prioridad', 'Categoría', 'Asignado', 'Fecha Creación'];
        const filas = [headers];
        
        casos.forEach(caso => {
          filas.push([
            caso.id || '',
            caso.cliente || '',
            caso.estado || '',
            caso.prioridad || '',
            caso.categoria || '',
            caso.asignado_a || '',
            caso.fecha_creacion || ''
          ]);
        });
        
        const csv = filas.map(r => r.map(cell => `"${cell}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const fecha = new Date().toISOString().split('T')[0];
        a.href = url;
        a.download = `reporte_casos_${fecha}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        
        // Mostrar notificación
        showNotification('✓ CSV exportado exitosamente', 'success');
      } catch (error) {
        console.error('Error al exportar CSV:', error);
        showNotification('✗ Error al exportar CSV', 'error');
      }
    });
  })();

  // =====================
  // FILTROS DE RANGO DE TIEMPO
  // =====================
  (function(){
    const buttons = qsa('.btn-group button:not(#btnCSV)');
    buttons.forEach(btn => {
      btn.addEventListener('click', function() {
        buttons.forEach(b => b.classList.remove('active'));
        this.classList.add('active');

        const text = this.textContent.trim();
        if (text.includes('12 Meses')) currentTimeRange = '12';
        else if (text.includes('6 Meses')) currentTimeRange = '6';
        else if (text.includes('30 Días')) currentTimeRange = '30';
        else if (text.includes('7 Días')) currentTimeRange = '7';

        // Redibujar con los casos ya en memoria
        if (lastCasos.length > 0) {
          generateDynamicChart(lastCasos, currentTimeRange);
        } else {
          loadDashboardStats();
        }
      });
    });
  })();

  // =====================
  // GENERAR GRÁFICO DINÁMICO
  // =====================
  function generateDynamicChart(casos, timeRange) {
    const chartWrap = qs('.chart-wrap');
    if (!chartWrap) return;

    let labels = [];
    let keysFn;

    if (timeRange === '7' || timeRange === '30') {
      const dias = parseInt(timeRange);
      labels = generarEtiquetasDias(dias);
      const keys = generarKeysDias(dias);
      keysFn = keys;
    } else {
      const meses = parseInt(timeRange);
      labels = generarEtiquetasMeses(meses);
      const keys = generarKeysMeses(meses);
      keysFn = keys;
    }

    // Serie 1: Creados (por fecha_creacion)
    const creadosMap = {};
    keysFn.forEach(k => { creadosMap[k] = 0; });
    casos.forEach(c => {
      const k = extractKey(c.fecha_creacion, timeRange);
      if (k && creadosMap.hasOwnProperty(k)) creadosMap[k]++;
    });

    // Serie 2: Resueltos (por fecha_actualizacion, estado = resuelto)
    const resueltosMap = {};
    keysFn.forEach(k => { resueltosMap[k] = 0; });
    casos.forEach(c => {
      if (c.estado?.toLowerCase() !== 'resuelto') return;
      const k = extractKey(c.fecha_actualizacion || c.fecha_creacion, timeRange);
      if (k && resueltosMap.hasOwnProperty(k)) resueltosMap[k]++;
    });

    const creadosArr   = keysFn.map(k => creadosMap[k]);
    const resueltosArr = keysFn.map(k => resueltosMap[k]);

    const totalCreados   = creadosArr.reduce((a, b) => a + b, 0);
    const totalResueltos = resueltosArr.reduce((a, b) => a + b, 0);

    // Actualizar subtítulo
    const periodoText = timeRange === '7' ? 'Últimos 7 días' : timeRange === '30' ? 'Últimos 30 días' : timeRange === '6' ? 'Últimos 6 meses' : 'Últimos 12 meses';
    const sub = qs('#chartSubtitle');
    if (sub) sub.textContent = `${periodoText} · Creados: ${totalCreados.toLocaleString('es-CO')} · Resueltos: ${totalResueltos.toLocaleString('es-CO')}`;

    const maxValor = Math.max(...creadosArr, ...resueltosArr, 1);
    const svg = crearSVGGrafico(creadosArr, resueltosArr, maxValor, labels);

    chartWrap.innerHTML = '';
    chartWrap.appendChild(svg);
  }

  // Genera el key (string) de una fecha para el rango actual
  function extractKey(dateStr, timeRange) {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d)) return null;
    if (timeRange === '7' || timeRange === '30') {
      return d.toISOString().split('T')[0];
    }
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  function generarKeysDias(dias) {
    const keys = [];
    const hoy = new Date();
    for (let i = dias - 1; i >= 0; i--) {
      const f = new Date(hoy); f.setDate(f.getDate() - i);
      keys.push(f.toISOString().split('T')[0]);
    }
    return keys;
  }

  function generarKeysMeses(meses) {
    const keys = [];
    const hoy = new Date();
    for (let i = meses - 1; i >= 0; i--) {
      const f = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
      keys.push(`${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}`);
    }
    return keys;
  }

  function agruparPorDia(casos, dias) {
    const datos = {};
    const hoy = new Date();

    for (let i = dias - 1; i >= 0; i--) {
      const fecha = new Date(hoy);
      fecha.setDate(fecha.getDate() - i);
      const key = fecha.toISOString().split('T')[0];
      datos[key] = 0;
    }

    casos.forEach(caso => {
      if (caso.fecha_creacion) {
        const fecha = new Date(caso.fecha_creacion);
        const key = fecha.toISOString().split('T')[0];
        if (datos.hasOwnProperty(key)) {
          datos[key]++;
        }
      }
    });

    return datos;
  }

  function agruparPorMes(casos, meses) {
    const datos = {};
    const hoy = new Date();

    for (let i = meses - 1; i >= 0; i--) {
      const fecha = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
      const key = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
      datos[key] = 0;
    }

    casos.forEach(caso => {
      if (caso.fecha_creacion) {
        const fecha = new Date(caso.fecha_creacion);
        const key = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
        if (datos.hasOwnProperty(key)) {
          datos[key]++;
        }
      }
    });

    return datos;
  }

  function generarEtiquetasDias(dias) {
    const etiquetas = [];
    const hoy = new Date();

    for (let i = dias - 1; i >= 0; i--) {
      const fecha = new Date(hoy);
      fecha.setDate(fecha.getDate() - i);
      etiquetas.push(String(fecha.getDate()).padStart(2, '0'));
    }

    return etiquetas;
  }

  function generarEtiquetasMeses(meses) {
    const etiquetas = [];
    const hoy = new Date();
    const mesesNombre = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    for (let i = meses - 1; i >= 0; i--) {
      const fecha = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
      etiquetas.push(mesesNombre[fecha.getMonth()]);
    }

    return etiquetas;
  }

  function crearSVGGrafico(creadosArr, resueltosArr, max, labels) {
    const W = 580, H = 240;
    const pad = { top: 24, right: 24, bottom: 38, left: 48 };
    const gW = W - pad.left - pad.right;
    const gH = H - pad.top - pad.bottom;
    const n  = creadosArr.length;
    const ns = 'http://www.w3.org/2000/svg';

    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Gráfico de casos por período');
    svg.style.width = '100%';
    svg.style.height = '100%';
    svg.style.overflow = 'visible';

    // ── Degradados ──
    const defs = document.createElementNS(ns, 'defs');
    defs.innerHTML = `
      <linearGradient id="gradCreados" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%"  stop-color="#5b6bff" stop-opacity="0.22"/>
        <stop offset="90%" stop-color="#5b6bff" stop-opacity="0.02"/>
      </linearGradient>
      <linearGradient id="gradResueltos" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%"  stop-color="#10b981" stop-opacity="0.18"/>
        <stop offset="90%" stop-color="#10b981" stop-opacity="0.02"/>
      </linearGradient>
    `;
    svg.appendChild(defs);

    // ── Grid + etiquetas Y ──
    const STEPS = 4;
    for (let i = 0; i <= STEPS; i++) {
      const y   = pad.top + gH - (i / STEPS) * gH;
      const val = Math.round((i / STEPS) * max);
      const gl  = document.createElementNS(ns, 'line');
      gl.setAttribute('x1', pad.left); gl.setAttribute('x2', pad.left + gW);
      gl.setAttribute('y1', y);        gl.setAttribute('y2', y);
      gl.setAttribute('stroke', i === 0 ? '#cbd5e1' : '#e5e7eb');
      gl.setAttribute('stroke-width', '1');
      svg.appendChild(gl);
      const yt = document.createElementNS(ns, 'text');
      yt.setAttribute('x', pad.left - 7); yt.setAttribute('y', y + 4);
      yt.setAttribute('text-anchor', 'end');
      yt.setAttribute('font-size', '11'); yt.setAttribute('fill', '#9ca3af');
      yt.setAttribute('font-family', 'Inter,system-ui,sans-serif');
      yt.textContent = val;
      svg.appendChild(yt);
    }

    // ── Calcula coordenadas ──
    const xOf = (i) => pad.left + (n > 1 ? (i / (n - 1)) : 0.5) * gW;
    const yOf = (v) => pad.top + gH - (max > 0 ? (v / max) : 0) * gH;

    const ptsC = creadosArr.map((v, i)   => ({ x: xOf(i), y: yOf(v), v }));
    const ptsR = resueltosArr.map((v, i) => ({ x: xOf(i), y: yOf(v), v }));

    // ── Bezier suavizado (catmull-rom) ──
    const T = 0.35;
    function bezierPath(pts) {
      if (pts.length === 0) return '';
      let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[Math.max(i - 1, 0)];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = pts[Math.min(i + 2, pts.length - 1)];
        const cx1 = p1.x + (p2.x - p0.x) * T;
        const cy1 = p1.y + (p2.y - p0.y) * T;
        const cx2 = p2.x - (p3.x - p1.x) * T;
        const cy2 = p2.y - (p3.y - p1.y) * T;
        d += ` C ${cx1.toFixed(1)} ${cy1.toFixed(1)}, ${cx2.toFixed(1)} ${cy2.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
      }
      return d;
    }

    const baseline = pad.top + gH;

    // Dibujar áreas y líneas (primero Creados, luego Resueltos encima)
    [
      { pts: ptsC, gradId: 'gradCreados',   stroke: '#5b6bff' },
      { pts: ptsR, gradId: 'gradResueltos', stroke: '#10b981' }
    ].forEach(({ pts, gradId, stroke }) => {
      const dLine = bezierPath(pts);
      if (!dLine) return;
      const area = document.createElementNS(ns, 'path');
      area.setAttribute('d', `${dLine} L ${pts[pts.length - 1].x.toFixed(1)} ${baseline} L ${pts[0].x.toFixed(1)} ${baseline} Z`);
      area.setAttribute('fill', `url(#${gradId})`);
      svg.appendChild(area);

      const line = document.createElementNS(ns, 'path');
      line.setAttribute('d', dLine);
      line.setAttribute('stroke', stroke);
      line.setAttribute('stroke-width', '2.5');
      line.setAttribute('fill', 'none');
      line.setAttribute('stroke-linejoin', 'round');
      line.setAttribute('stroke-linecap', 'round');
      svg.appendChild(line);
    });

    // ── Etiquetas X ──
    const maxLabels = 8;
    const step = Math.max(1, Math.ceil(n / maxLabels));
    (labels || []).forEach((lbl, i) => {
      if (i % step !== 0 && i !== n - 1) return;
      const xt = document.createElementNS(ns, 'text');
      xt.setAttribute('x', ptsC[i].x.toFixed(1)); xt.setAttribute('y', H - 6);
      xt.setAttribute('text-anchor', 'middle');
      xt.setAttribute('font-size', '11'); xt.setAttribute('fill', '#9ca3af');
      xt.setAttribute('font-family', 'Inter,system-ui,sans-serif');
      xt.textContent = lbl;
      svg.appendChild(xt);
    });

    // ── Puntos interactivos con tooltip ──
    const tooltip = document.createElementNS(ns, 'g');
    tooltip.setAttribute('id', 'chartTooltip');
    tooltip.style.display = 'none';
    tooltip.style.pointerEvents = 'none';
    tooltip.innerHTML = `
      <rect id="ttBox" x="0" y="0" width="110" height="54" rx="7" fill="#1e293b" fill-opacity="0.92"/>
      <text id="ttLabel" x="8" y="17" font-size="11" fill="#94a3b8" font-family="Inter,system-ui,sans-serif"></text>
      <text id="ttCreados"   x="8" y="33" font-size="12" fill="#7d88ff" font-family="Inter,system-ui,sans-serif" font-weight="600"></text>
      <text id="ttResueltos" x="8" y="49" font-size="12" fill="#10b981" font-family="Inter,system-ui,sans-serif" font-weight="600"></text>
    `;
    svg.appendChild(tooltip);

    // Zonas de hover (rectángulos invisibles por columna)
    ptsC.forEach((p, i) => {
      const colW = n > 1 ? gW / (n - 1) : gW;
      const hx   = p.x - colW / 2;
      const zone = document.createElementNS(ns, 'rect');
      zone.setAttribute('x', Math.max(pad.left, hx).toFixed(1));
      zone.setAttribute('y', String(pad.top));
      zone.setAttribute('width', colW.toFixed(1));
      zone.setAttribute('height', String(gH));
      zone.setAttribute('fill', 'transparent');
      zone.style.cursor = 'crosshair';

      zone.addEventListener('mouseenter', () => {
        const ttG   = svg.getElementById('chartTooltip');
        const ttBox = svg.getElementById('ttBox');
        const lbl   = (labels || [])[i] || '';
        svg.getElementById('ttLabel').textContent    = lbl;
        svg.getElementById('ttCreados').textContent   = `● Creados: ${creadosArr[i]}`;
        svg.getElementById('ttResueltos').textContent = `● Resueltos: ${resueltosArr[i]}`;
        let tx = p.x + 10, ty = Math.min(ptsC[i].y, ptsR[i].y) - 10;
        if (tx + 114 > W) tx = p.x - 120;
        if (ty < 4) ty = 4;
        ttG.setAttribute('transform', `translate(${tx.toFixed(1)},${ty.toFixed(1)})`);
        ttG.style.display = 'block';

        // Marcar los dos puntos activos
        svg.querySelectorAll('.hover-dot').forEach(d => d.remove());
        [
          { pt: ptsC[i],  stroke: '#5b6bff' },
          { pt: ptsR[i], stroke: '#10b981' }
        ].forEach(({ pt, stroke }) => {
          const d = document.createElementNS(ns, 'circle');
          d.setAttribute('cx', pt.x.toFixed(1)); d.setAttribute('cy', pt.y.toFixed(1));
          d.setAttribute('r', '5.5');
          d.setAttribute('fill', '#fff');
          d.setAttribute('stroke', stroke); d.setAttribute('stroke-width', '2.5');
          d.classList.add('hover-dot');
          svg.insertBefore(d, ttG);
        });
      });

      zone.addEventListener('mouseleave', () => {
        const ttG = svg.getElementById('chartTooltip');
        if (ttG) ttG.style.display = 'none';
        svg.querySelectorAll('.hover-dot').forEach(d => d.remove());
      });

      svg.appendChild(zone);
    });

    return svg;
  }

  // =====================
  // SISTEMA DE NOTIFICACIONES
  // =====================
  function showNotification(message, type = 'info') {
    const notif = document.createElement('div');
    notif.className = `notification notification-${type}`;
    notif.textContent = message;
    notif.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 15px 20px;
      border-radius: 10px;
      background: ${type === 'success' ? '#16a34a' : type === 'error' ? '#dc2626' : '#2563eb'};
      color: white;
      font-weight: 600;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      animation: slideInRight 0.3s ease;
    `;
    
    document.body.appendChild(notif);
    
    setTimeout(() => {
      notif.style.animation = 'slideOutRight 0.3s ease';
      setTimeout(() => notif.remove(), 300);
    }, 3000);
  }

  // Agregar estilos de animación
  if (!qs('#notification-styles')) {
    const style = document.createElement('style');
    style.id = 'notification-styles';
    style.textContent = `
      @keyframes slideInRight {
        from { transform: translateX(400px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(400px); opacity: 0; }
      }
      .btn-group button.active {
        background: #15467b;
        color: white;
        font-weight: 700;
      }
    `;
    document.head.appendChild(style);
  }

  // =====================
  // AUTO-REFRESH
  // =====================
  function startAutoRefresh() {
    // Cargar datos inicialmente
    loadDashboardStats();
    loadUsuarios();
    
    // Actualizar cada 30 segundos
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = setInterval(() => {
      loadDashboardStats();
      loadUsuarios();
      console.log('🔄 Dashboard actualizado automáticamente');
    }, 30000);
  }

  // Iniciar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startAutoRefresh);
  } else {
    startAutoRefresh();
  }

  // Generar contraseña segura (form usuarios)
  (function(){
    const btnGen = qs('.gen-pass-btn');
    const input = qs('#contrasena');
    if (!btnGen || !input) return;
    function generarContrasena(longitud = 12) {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*?';
      let pass = '';
      for (let i = 0; i < longitud; i++) pass += chars.charAt(Math.floor(Math.random() * chars.length));
      return pass;
    }
    btnGen.addEventListener('click', (e) => {
      e.preventDefault();
      input.value = generarContrasena();
    });
  })();

  // Envío del formulario de creación: llamada real a la API
  (function(){
    const form = qs('.user-form');
    if (!form) return;
    const modalExito = qs('#modal-exito');
    const modalError = qs('#modal-error');
    const modalErrorMsg = modalError ? modalError.querySelector('.text-muted') : null;
    const cerrarError = qs('#cerrar-modal-error');
    const goToMenu = () => { window.location.href = 'Menu principal Admin.html'; };

    if (cerrarError && modalError) cerrarError.onclick = () => { modalError.style.display = 'none'; };

    form.addEventListener('submit', async function(e){
      e.preventDefault();
      e.stopImmediatePropagation();

      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      const nombre   = (qs('#nombres',  form) || {}).value?.trim() || '';
      const apellido = (qs('#apellidos', form) || {}).value?.trim() || '';
      const email    = (qs('#correo',   form) || {}).value?.trim() || '';
      const rol      = (qs('#rol',      form) || {}).value || '';
      const password = (qs('#contrasena', form) || {}).value || '';

      const submitBtn = form.querySelector('.submit-btn');
      const originalHTML = submitBtn ? submitBtn.innerHTML : '';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creando...';
      }

      try {
        const res  = await fetch(`${API_URL}/usuarios`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre, apellido, email, password, rol })
        });
        const data = await res.json();

        if (res.ok && data.success) {
          form.reset();
          if (modalExito) {
            modalExito.style.display = 'flex';
            setTimeout(goToMenu, 1800);
            const cerrarExito = qs('#cerrar-modal-exito');
            if (cerrarExito) cerrarExito.onclick = goToMenu;
          } else {
            goToMenu();
          }
        } else {
          const msg = data.error || 'Error al crear el usuario. Intente nuevamente.';
          if (modalErrorMsg) modalErrorMsg.textContent = msg;
          if (modalError) modalError.style.display = 'flex';
        }
      } catch (err) {
        console.error('Error al crear usuario:', err);
        const msg = 'No se pudo conectar con el servidor. Verifique que esté activo.';
        if (modalErrorMsg) modalErrorMsg.textContent = msg;
        if (modalError) modalError.style.display = 'flex';
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalHTML;
        }
      }
    });
  })();
})();
