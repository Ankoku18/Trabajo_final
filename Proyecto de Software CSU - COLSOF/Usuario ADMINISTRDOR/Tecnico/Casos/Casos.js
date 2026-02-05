document.addEventListener('DOMContentLoaded', function() {
    let casos = [];
    let todosLosCasos = [];
    let selectedCasos = new Set();
    let sortConfig = { key: 'id', direction: 'asc' };
    let currentPage = 1;
    const itemsPerPage = 10;

    const API_BASE = 'http://localhost:4000/api?action=get_casos_simple';

    // DOM elements
    const table = document.getElementById('casesTable');
    const tableBody = table ? table.querySelector('tbody') : null;
    const tableWrapper = document.getElementById('tableWrapper');
    const searchInput = document.getElementById('searchInput');
    const statusFilter = document.getElementById('statusFilter');
    const priorityFilter = document.getElementById('priorityFilter');
    const emptyMessage = document.getElementById('emptyMessage');

    const statTotal = document.getElementById('statTotal');
    const statEnCurso = document.getElementById('statEnCurso');
    const statAlta = document.getElementById('statAlta');
    const statSla = document.getElementById('statSla');
    const statTotalNote = document.getElementById('statTotalNote');
    const statEnCursoNote = document.getElementById('statEnCursoNote');
    const statAltaNote = document.getElementById('statAltaNote');
    const statSlaNote = document.getElementById('statSlaNote');

    const btnRefresh = document.getElementById('btnRefresh');
    const btnNew = document.getElementById('btnNew');
    const btnExport = document.getElementById('btnExport');
    const statCards = document.querySelectorAll('.stat-card');

    // Load data from API
    async function loadDataFromAPI() {
        try {
            addLoadingState();
            const response = await fetch(API_BASE);
            const data = await response.json();
            
            if (Array.isArray(data)) {
                todosLosCasos = data.map((caso, index) => ({
                    id: caso.id || `C-${1000 + index}`,
                    titulo: caso.categoria || 'Sin título',
                    cliente: caso.cliente || 'Sin cliente',
                    tecnico: caso.asignado_a || 'Sin asignar',
                    prioridad: caso.prioridad || 'Media',
                    estado: mapEstadoToDisplay(caso.estado),
                    sla: calcularSLA(caso.fecha_creacion),
                    porcentajeSLA: calcularPorcentajeSLA(caso.estado, caso.fecha_creacion, caso.fecha_resolucion),
                    fechaCreacion: caso.fecha_creacion,
                    fechaResolucion: caso.fecha_resolucion,
                    descripcion: caso.descripcion || 'Sin descripción',
                    created_at: caso.created_at
                }));
                
                casos = [...todosLosCasos];
                sortTable(sortConfig.key);
                renderTable(casos);
                renderStats(casos);
                removeLoadingState();
            }
        } catch (error) {
            console.error('Error loading data from API:', error);
            showNotification('Error cargando datos. Usando datos simulados...', 'error');
            loadMockData();
            removeLoadingState();
        }
    }

    function loadMockData() {
        todosLosCasos = [
            { id: 'C-1001', titulo: 'Error en login', cliente: 'Empresa A', tecnico: 'Luis', prioridad: 'Alta', estado: 'En Curso', sla: '2h', porcentajeSLA: 85, descripcion: 'Los usuarios no pueden ingresar al sistema', fechaCreacion: new Date(Date.now() - 3600000) },
            { id: 'C-1002', titulo: 'Reportes lentos', cliente: 'Empresa B', tecnico: 'Carlos', prioridad: 'Media', estado: 'En Curso', sla: '1d', porcentajeSLA: 72, descripcion: 'Los reportes tardan más de 5 minutos', fechaCreacion: new Date(Date.now() - 86400000) },
            { id: 'C-1003', titulo: 'Backup fallido', cliente: 'Empresa C', tecnico: 'María', prioridad: 'Crítica', estado: 'En Curso', sla: '<1h', porcentajeSLA: 45, descripcion: 'El backup automático no se está ejecutando', fechaCreacion: new Date(Date.now() - 1800000) },
            { id: 'C-1004', titulo: 'Integración API', cliente: 'Empresa A', tecnico: 'Pedro', prioridad: 'Media', estado: 'Resuelto', sla: '3d', porcentajeSLA: 100, descripcion: 'Configurar nueva API de terceros', fechaCreacion: new Date(Date.now() - 259200000) },
            { id: 'C-1005', titulo: 'UI incompleta', cliente: 'Empresa D', tecnico: 'Ana', prioridad: 'Baja', estado: 'Pausado', sla: '5d', porcentajeSLA: 60, descripcion: 'Actualizar estilos CSS', fechaCreacion: new Date(Date.now() - 432000000) },
        ];
        casos = [...todosLosCasos];
    }

    function mapEstadoToDisplay(estado) {
        const estadoMap = {
            'abierto': 'En Curso',
            'en_progreso': 'En Curso',
            'pausado': 'Pausado',
            'resuelto': 'Resuelto',
            'cerrado': 'Cerrado'
        };
        return estadoMap[estado?.toLowerCase()] || 'En Curso';
    }

    function calcularSLA(fechaCreacion) {
        if (!fechaCreacion) return '24h';
        const fecha = new Date(fechaCreacion);
        const ahora = new Date();
        const horas = Math.round((ahora - fecha) / (1000 * 60 * 60));
        if (horas < 1) return '<1h';
        if (horas < 24) return `${horas}h`;
        const dias = Math.round(horas / 24);
        return `${dias}d`;
    }

    function calcularPorcentajeSLA(estado, fechaCreacion, fechaResolucion) {
        const slaBase = 100;
        const fecha = new Date(fechaCreacion);
        const ahora = new Date();
        const horasTranscurridas = (ahora - fecha) / (1000 * 60 * 60);
        
        if (estado === 'resuelto' || estado === 'cerrado') {
            return 100;
        }
        if (estado === 'pausado') {
            return Math.max(50, 100 - Math.round(horasTranscurridas));
        }
        return Math.max(10, slaBase - Math.round(horasTranscurridas));
    }

    function sortTable(key) {
        if (sortConfig.key === key) {
            sortConfig.direction = sortConfig.direction === 'asc' ? 'desc' : 'asc';
        } else {
            sortConfig.key = key;
            sortConfig.direction = 'asc';
        }

        casos.sort((a, b) => {
            let aVal = a[key];
            let bVal = b[key];

            if (typeof aVal === 'string') {
                aVal = aVal.toLowerCase();
                bVal = bVal.toLowerCase();
            }

            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });

        renderTable(casos);
    }

    function highlightSearchText(text, search) {
        if (!search) return text;
        const regex = new RegExp(`(${search})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    }

    function renderTable(data) {
        if (!tableBody || !table) return;
        tableBody.innerHTML = '';

        const isEmpty = data.length === 0;
        if (emptyMessage) {
            emptyMessage.classList.toggle('hidden', !isEmpty);
        }
        table.classList.toggle('hidden', isEmpty);
        if (tableWrapper) {
            tableWrapper.classList.toggle('table-empty', isEmpty);
        }
        if (isEmpty) return;

        const search = searchInput.value.toLowerCase();

        data.forEach((caso, index) => {
            const row = document.createElement('tr');
            row.style.animation = `slideInLeft ${0.2 + index * 0.05}s ease-out`;
            row.dataset.casoId = caso.id;
            row.classList.toggle('selected', selectedCasos.has(caso.id));

            const prioridadClass = caso.prioridad.toLowerCase();
            const estadoClass = caso.estado.toLowerCase().replace(/\s+/g, '-');

            const slaColor = caso.porcentajeSLA >= 80 ? '#10b981' : caso.porcentajeSLA >= 60 ? '#f59e0b' : '#ef4444';

            row.innerHTML = `
                <td style="width: 80px;">
                    <input type="checkbox" class="row-checkbox" data-caso-id="${caso.id}" ${selectedCasos.has(caso.id) ? 'checked' : ''} />
                </td>
                <td>${caso.id}</td>
                <td><strong>${highlightSearchText(caso.titulo, search)}</strong></td>
                <td>${highlightSearchText(caso.cliente, search)}</td>
                <td title="${caso.tecnico}">${caso.tecnico.substring(0, 15)}</td>
                <td><span class="badge prioridad-${prioridadClass}" title="Prioridad">${caso.prioridad}</span></td>
                <td><span class="badge estado-${estadoClass}" title="Estado">${caso.estado}</span></td>
                <td style="width: 150px;">
                    <div class="sla-container" title="${caso.sla}">
                        <progress value="${caso.porcentajeSLA}" max="100" style="accent-color: ${slaColor};"></progress>
                        <span>${caso.porcentajeSLA}%</span>
                    </div>
                </td>
                <td style="width: 60px;">
                    <button type="button" class="btn-action btn-details" title="Ver detalles" data-caso-id="${caso.id}"><i class="fa fa-eye"></i></button>
                </td>
            `;

            // Interactividad en la fila
            row.addEventListener('click', (e) => {
                if (e.target.closest('.row-checkbox')) {
                    toggleRowSelection(caso.id);
                } else if (!e.target.closest('.btn-action')) {
                    rowHoverEffect(row);
                }
            });

            row.addEventListener('mouseenter', () => {
                row.style.transform = 'translateX(4px)';
            });

            row.addEventListener('mouseleave', () => {
                row.style.transform = 'translateX(0)';
            });

            // Botón de detalles
            const btnDetails = row.querySelector('.btn-details');
            if (btnDetails) {
                btnDetails.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    showCaseDetails(caso);
                });
            }

            // Checkbox
            const checkbox = row.querySelector('.row-checkbox');
            if (checkbox) {
                checkbox.addEventListener('change', (e) => {
                    if (e.target.checked) {
                        selectedCasos.add(caso.id);
                    } else {
                        selectedCasos.delete(caso.id);
                    }
                });
            }

            tableBody.appendChild(row);
        });

        updateTableHeader();
    }

    function updateTableHeader() {
        const thead = table.querySelector('thead tr');
        if (thead) {
            const headers = thead.querySelectorAll('th');
            headers.forEach((header, index) => {
                if (index > 0 && index < 7) {
                    header.style.cursor = 'pointer';
                    header.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const keys = ['id', 'titulo', 'cliente', 'tecnico', 'prioridad', 'estado'];
                        sortTable(keys[index - 1]);
                    });
                }
            });
        }
    }

    function toggleRowSelection(casoId) {
        if (selectedCasos.has(casoId)) {
            selectedCasos.delete(casoId);
        } else {
            selectedCasos.add(casoId);
        }
        renderTable(casos);
    }

    function rowHoverEffect(row) {
        row.style.backgroundColor = 'rgba(25, 118, 210, 0.05)';
        setTimeout(() => {
            row.style.backgroundColor = '';
        }, 200);
    }

    function showCaseDetails(caso) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.animation = 'fadeIn 0.3s ease-out';
        
        const content = `
            <div class="modal-content" style="animation: slideUp 0.3s ease-out;">
                <div class="modal-header">
                    <h2>Detalles del Caso: ${caso.id}</h2>
                    <button type="button" class="btn-close" data-action="close">✕</button>
                </div>
                <div class="modal-body">
                    <div class="detail-grid">
                        <div class="detail-item">
                            <label>Título:</label>
                            <p>${caso.titulo}</p>
                        </div>
                        <div class="detail-item">
                            <label>Cliente:</label>
                            <p>${caso.cliente}</p>
                        </div>
                        <div class="detail-item">
                            <label>Técnico Asignado:</label>
                            <p>${caso.tecnico}</p>
                        </div>
                        <div class="detail-item">
                            <label>Prioridad:</label>
                            <p><span class="badge prioridad-${caso.prioridad.toLowerCase()}">${caso.prioridad}</span></p>
                        </div>
                        <div class="detail-item">
                            <label>Estado:</label>
                            <p><span class="badge estado-${caso.estado.toLowerCase().replace(/\s+/g, '-')}">${caso.estado}</span></p>
                        </div>
                        <div class="detail-item">
                            <label>SLA:</label>
                            <p>${caso.sla} (${caso.porcentajeSLA}%)</p>
                        </div>
                        <div class="detail-item full-width">
                            <label>Descripción:</label>
                            <p>${caso.descripcion}</p>
                        </div>
                        <div class="detail-item full-width">
                            <label>Fecha de Creación:</label>
                            <p>${new Date(caso.fechaCreacion).toLocaleString('es-CO')}</p>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn" data-action="close">Cerrar</button>
                    <button type="button" class="btn btn-primary" data-action="copy" data-caso-id="${caso.id}">
                        <i class="fa fa-copy"></i> Copiar ID
                    </button>
                </div>
            </div>
        `;
        
        modal.innerHTML = content;
        document.body.appendChild(modal);

        // Event listeners para botones del modal
        const btnClose = modal.querySelector('[data-action="close"]');
        const btnCopy = modal.querySelector('[data-action="copy"]');

        if (btnClose) {
            btnClose.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                modal.style.animation = 'fadeOut 0.3s ease-out';
                setTimeout(() => modal.remove(), 300);
            });
        }

        if (btnCopy) {
            btnCopy.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const casoId = btnCopy.dataset.casoId;
                window.copyToClipboard(casoId);
                modal.style.animation = 'fadeOut 0.3s ease-out';
                setTimeout(() => modal.remove(), 300);
            });
        }

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.animation = 'fadeOut 0.3s ease-out';
                setTimeout(() => modal.remove(), 300);
            }
        });
    }

    function applyFilters() {
        const search = searchInput.value.toLowerCase();
        const estado = statusFilter.value;
        const prioridad = priorityFilter.value;

        casos = todosLosCasos.filter(c => {
            const matchesSearch =
                c.id.toLowerCase().includes(search) ||
                c.titulo.toLowerCase().includes(search) ||
                c.cliente.toLowerCase().includes(search);

            const matchesStatus = estado === 'todos' || c.estado === estado;
            const matchesPriority = prioridad === 'todos' || c.prioridad === prioridad;

            return matchesSearch && matchesStatus && matchesPriority;
        });

        currentPage = 1;
        sortTable(sortConfig.key);
        renderTable(casos);
        renderStats(casos);
    }

    function renderStats(data) {
        const total = data.length;
        const enCurso = data.filter(c => c.estado === 'En Curso').length;
        const alta = data.filter(c => c.prioridad.toLowerCase() === 'alta' || c.prioridad.toLowerCase() === 'urgente' || c.prioridad.toLowerCase() === 'critica').length;
        const slaProm = total ? Math.round(data.reduce((acc, c) => acc + c.porcentajeSLA, 0) / total) : 0;

        animateCounter(statTotal, parseInt(statTotal.textContent) || 0, total);
        animateCounter(statEnCurso, parseInt(statEnCurso.textContent) || 0, enCurso);
        animateCounter(statAlta, parseInt(statAlta.textContent) || 0, alta);
        animateCounter(statSla, parseInt(statSla.textContent) || 0, slaProm);

        if (statTotalNote) statTotalNote.textContent = total ? 'Casos en la vista' : 'Sin datos';
        if (statEnCursoNote) statEnCursoNote.textContent = enCurso ? 'En seguimiento' : 'Ninguno activo';
        if (statAltaNote) statAltaNote.textContent = alta ? 'Requieren priorización' : 'Sin alertas altas';
        if (statSlaNote) statSlaNote.textContent = total ? 'Promedio visible' : 'Sin SLA para mostrar';

        // Pulso en tarjetas si los números cambian
        statCards.forEach(card => {
            card.style.animation = 'pulse 0.6s ease-out';
            setTimeout(() => card.style.animation = '', 600);
        });
    }

    function animateCounter(element, start, end) {
        if (!element) return;
        if (start === end) return;
        
        const duration = 600;
        const steps = 40;
        const stepValue = (end - start) / steps;
        let current = start;
        let step = 0;

        const interval = setInterval(() => {
            step++;
            current += stepValue;
            element.textContent = Math.round(current);

            if (step >= steps) {
                element.textContent = end;
                clearInterval(interval);
            }
        }, duration / steps);
    }

    function resetAndRefresh() {
        if (searchInput) searchInput.value = '';
        if (statusFilter) statusFilter.value = 'todos';
        if (priorityFilter) priorityFilter.value = 'todos';
        selectedCasos.clear();
        loadDataFromAPI();
    }

    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <i class="fa fa-${type === 'error' ? 'exclamation-circle' : type === 'success' ? 'check-circle' : 'info-circle'}"></i>
                <span>${message}</span>
            </div>
        `;
        notification.style.animation = 'slideIn 0.3s ease-out';
        
        const container = document.querySelector('.main-content') || document.body;
        container.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => notification.remove(), 300);
        }, 4000);
    }

    function addLoadingState() {
        if (table) table.style.opacity = '0.6';
        if (btnRefresh) btnRefresh.disabled = true;
    }

    function removeLoadingState() {
        if (table) table.style.opacity = '1';
        if (btnRefresh) btnRefresh.disabled = false;
    }

    window.copyToClipboard = function(text) {
        navigator.clipboard.writeText(text).then(() => {
            showNotification('ID copiado al portapapeles', 'success');
        });
    };

    window.exportToCSV = function() {
        const headers = ['ID', 'Caso', 'Cliente', 'Técnico', 'Prioridad', 'Estado', 'SLA %'];
        const rows = casos.map(c => [c.id, c.titulo, c.cliente, c.tecnico, c.prioridad, c.estado, c.porcentajeSLA]);
        
        const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `casos_${new Date().getTime()}.csv`;
        a.click();
        
        showNotification('Datos exportados a CSV', 'success');
    };

    // Setup event listeners
    if (searchInput) {
        searchInput.addEventListener('input', applyFilters);
        searchInput.addEventListener('focus', function() {
            this.style.boxShadow = '0 0 0 4px rgba(2, 132, 199, 0.2)';
        });
        searchInput.addEventListener('blur', function() {
            this.style.boxShadow = '';
        });
    }

    if (statusFilter) {
        statusFilter.addEventListener('change', applyFilters);
    }

    if (priorityFilter) {
        priorityFilter.addEventListener('change', applyFilters);
    }

    if (btnRefresh) {
        btnRefresh.addEventListener('click', (e) => {
            e.preventDefault();
            btnRefresh.style.animation = 'spin 1s linear';
            resetAndRefresh();
        });
    }

    if (btnExport) {
        btnExport.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            window.exportToCSV();
        });
    }

    if (btnNew) {
        btnNew.addEventListener('click', (e) => {
            e.preventDefault();
            showNotification('Modal de creación de casos en desarrollo...', 'info');
        });
    }

    // Stat cards interaction
    statCards.forEach((card, index) => {
        card.style.cursor = 'pointer';
        card.addEventListener('click', () => {
            card.style.animation = 'bounce 0.6s ease-out';
            const statNames = ['Total', 'En Curso', 'Prioridad Alta', 'SLA Promedio'];
            showNotification(`Estadística: ${statNames[index]}`, 'info');
        });
    });

    // Auto-refresh every 30 seconds
    setInterval(() => {
        loadDataFromAPI();
    }, 30000);

    // Initial load
    loadDataFromAPI();
});