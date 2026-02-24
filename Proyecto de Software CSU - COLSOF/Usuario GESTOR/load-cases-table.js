// =====================
// CARGA DINAMICA DE TABLA DE CASOS
// =====================

(function loadCasesTable() {
  // Construcción de URL base
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  const port = window.location.port;
  const API_BASE_URL = `${protocol}//${hostname}${port ? ':' + port : ''}`;

  const TABLE_BODY = document.getElementById('cases-table-body');
  const ITEMS_PER_PAGE = 8;
  let currentPage = 1;
  let allCases = [];

  // Solo ejecutar si estamos en la página de casos
  if (!TABLE_BODY) return;

  async function fetchCases() {
    try {
      console.log('📥 Cargando casos desde la BD...');
      
      const response = await fetch(API_BASE_URL + '/api/casos');
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();

      if (result.success && Array.isArray(result.data)) {
        allCases = result.data;
        console.log(`✅ ${allCases.length} casos cargados desde BD`);
        renderTablePage(1);
        setupPagination();
      } else {
        console.warn('⚠️ Respuesta inesperada:', result);
      }
    } catch (error) {
      console.error('❌ Error cargando casos:', error);
    }
  }

  function renderTablePage(page) {
    currentPage = page;
    TABLE_BODY.innerHTML = '';

    const startIdx = (page - 1) * ITEMS_PER_PAGE;
    const endIdx = startIdx + ITEMS_PER_PAGE;
    const pageCases = allCases.slice(startIdx, endIdx);

    if (pageCases.length === 0) {
      TABLE_BODY.innerHTML = '<tr><td colspan="10" style="text-align:center; padding:20px;">No hay casos</td></tr>';
      return;
    }

    pageCases.forEach(caso => {
      const row = createCaseRow(caso);
      TABLE_BODY.appendChild(row);
    });

    updatePaginationButtons();
  }

  function createCaseRow(caso) {
    const row = document.createElement('tr');
    row.setAttribute('data-case-id', caso.id);
    row.style.cursor = 'pointer';

    // Mapeo de colores para estatus
    const statusColors = {
      'abierto': { color: '#16a34a', bg: '#16a34a22' },
      'en_progreso': { color: '#f59e0b', bg: '#f59e0b22' },
      'pausado': { color: '#6b7280', bg: '#6b728022' },
      'resuelto': { color: '#2563eb', bg: '#2563eb22' },
      'cerrado': { color: '#0f172a', bg: '#0f172a22' },
      'cancelado': { color: '#dc2626', bg: '#dc262622' }
    };

    const priorityColors = {
      'Crítica': { bg: '#b91c1c22', color: '#b91c1c' },
      'Urgente': { bg: '#dc262622', color: '#dc2626' },
      'Alta': { bg: '#f9731622', color: '#f97316' },
      'Media': { bg: '#facc1522', color: '#facc15' },
      'Baja': { bg: '#16a34a22', color: '#16a34a' }
    };

    const statusInfo = statusColors[caso.estado] || statusColors['abierto'];
    const priorityInfo = priorityColors[caso.prioridad] || { bg: '#e5e7eb22', color: '#6b7280' };

    const fecha = new Date(caso.fecha_creacion).toLocaleDateString('es-CO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const isChecked = false;
    const checkboxHTML = `<input type="checkbox">`;

    row.innerHTML = `
      <td class="td-check">${checkboxHTML}</td>
      <td><strong>#${String(caso.id).padStart(12, '0')}</strong></td>
      <td><small>${fecha}</small></td>
      <td>
        <span class="status ${caso.estado}" style="color:${statusInfo.color}; background-color:${statusInfo.bg};">
          <span class="checkdot" style="background:${statusInfo.color}"></span>
          ${caso.estado.replace('_', ' ').toUpperCase()}
        </span>
      </td>
      <td>
        <div class="assignee">
          <span class="ava" style="background:#98D8C8">${(caso.asignado_a || 'N').substring(0, 1).toUpperCase()}</span>
          <div>${caso.asignado_a || 'Sin asignar'}</div>
        </div>
      </td>
      <td>
        <span class="priority ${caso.prioridad.toLowerCase()}" style="background-color:${priorityInfo.bg}; color:${priorityInfo.color}">
          ${caso.prioridad}
        </span>
      </td>
      <td><span class="category-badge">${caso.categoria || 'GENERAL'}</span></td>
      <td>${caso.cliente || 'N/A'}</td>
      <td><small>${caso.autor || 'Sistema'}</small></td>
      <td class="ellipsis">···</td>
    `;

    return row;
  }

  function setupPagination() {
    const totalPages = Math.ceil(allCases.length / ITEMS_PER_PAGE);
    const pagerContainer = document.getElementById('pager-container');
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');

    if (!pagerContainer) return;

    pagerContainer.innerHTML = '';
    for (let i = 1; i <= totalPages; i++) {
      const btn = document.createElement('span');
      btn.className = `pg ${i === 1 ? 'active' : ''}`;
      btn.setAttribute('data-page', i);
      btn.textContent = i;
      btn.style.cursor = 'pointer';
      btn.addEventListener('click', () => renderTablePage(i));
      pagerContainer.appendChild(btn);
    }

    if (btnPrev) {
      btnPrev.addEventListener('click', () => {
        if (currentPage > 1) renderTablePage(currentPage - 1);
      });
    }

    if (btnNext) {
      btnNext.addEventListener('click', () => {
        if (currentPage < totalPages) renderTablePage(currentPage + 1);
      });
    }
  }

  function updatePaginationButtons() {
    const totalPages = Math.ceil(allCases.length / ITEMS_PER_PAGE);
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');
    const pageButtons = document.querySelectorAll('.pg');

    // Actualizar estado de botones prev/next
    if (btnPrev) {
      if (currentPage === 1) {
        btnPrev.disabled = true;
        btnPrev.style.opacity = '0.5';
        btnPrev.style.cursor = 'not-allowed';
      } else {
        btnPrev.disabled = false;
        btnPrev.style.opacity = '1';
        btnPrev.style.cursor = 'pointer';
      }
    }

    if (btnNext) {
      if (currentPage === totalPages) {
        btnNext.disabled = true;
        btnNext.style.opacity = '0.5';
        btnNext.style.cursor = 'not-allowed';
      } else {
        btnNext.disabled = false;
        btnNext.style.opacity = '1';
        btnNext.style.cursor = 'pointer';
      }
    }

    // Actualizar página activa
    pageButtons.forEach(btn => {
      btn.classList.remove('active');
      if (parseInt(btn.getAttribute('data-page')) === currentPage) {
        btn.classList.add('active');
      }
    });
  }

  // Cargar casos cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fetchCases);
  } else {
    fetchCases();
  }
})();
