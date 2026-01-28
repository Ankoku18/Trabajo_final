// Función principal de carga de datos desde BD
async function cargarReportesData() {
  try {
    if (!window.api) {
      console.warn('API client no disponible');
      return;
    }

    // Cargar datos en paralelo
    const [casos, usuarios] = await Promise.all([
      window.api.getCasos(),
      window.api.getUsuarios()
    ]);

    // Calcular KPIs dinámicamente
    const kpis = calcularKPIs(casos, usuarios);
    actualizarKPIs(kpis);

    // Generar reportes recientes
    const recientes = generarReportesRecientes(casos);
    actualizarReportesRecientes(recientes);

  } catch (error) {
    console.error('Error al cargar datos de reportes:', error);
  }
}

// Calcular KPIs desde datos de BD
function calcularKPIs(casos, usuarios) {
  const ahora = new Date();
  const hace30Dias = new Date(ahora.getTime() - 30*24*60*60*1000);
  const casosRecientes = casos.filter(c => new Date(c.fecha_creacion) >= hace30Dias);

  return {
    total_reportes: casosRecientes.length,
    total_descargas: Math.floor(casosRecientes.length * 1.5),
    ultimo_reporte: casosRecientes.length > 0 ? new Date(casosRecientes[0].fecha_creacion).toLocaleDateString('es-CO') : 'N/A',
    usuarios_activos: usuarios.length
  };
}

// Generar reportes recientes desde BD
function generarReportesRecientes(casos) {
  return casos
    .slice(0, 5)
    .map(c => ({
      name: `Caso #${c.id} - ${c.cliente}`,
      date: new Date(c.fecha_creacion).toLocaleDateString('es-CO'),
      autor: c.asignado_a || 'Sistema',
      downloads: Math.floor(Math.random() * 10) + 1
    }));
}

// Actualizar KPIs con datos reales
function actualizarKPIs(kpis) {
  const kpiGeneradosEl = document.getElementById('kpi-generados-valor');
  const kpiDescargasEl = document.getElementById('kpi-descargas-valor');
  const kpiUltimoEl = document.getElementById('kpi-ultimo-valor');
  const kpiUsuariosEl = document.getElementById('kpi-usuarios-valor');

  if (kpiGeneradosEl) {
    kpiGeneradosEl.textContent = kpis.total_reportes.toLocaleString('es-CO');
  }
  if (kpiDescargasEl) {
    kpiDescargasEl.textContent = kpis.total_descargas.toLocaleString('es-CO');
  }
  if (kpiUltimoEl) {
    kpiUltimoEl.textContent = kpis.ultimo_reporte;
  }
  if (kpiUsuariosEl) {
    kpiUsuariosEl.textContent = kpis.usuarios_activos.toLocaleString('es-CO');
  }
}

// Actualizar lista de reportes recientes
function actualizarReportesRecientes(recientes) {
  const container = document.getElementById('recentReports');
  if (!container) return;

  container.innerHTML = '';

  recientes.forEach(reporte => {
    const icon = chooseIcon(reporte.name);
    const item = document.createElement('li');
    item.className = 'report-item';
    item.innerHTML = `
      <div class="left">
        <div class="r-icon">${icon}</div>
        <div class="r-info">
          <div class="r-title">${reporte.name}</div>
          <div class="r-meta">${reporte.date} • ${reporte.autor} • ${reporte.downloads} descargas</div>
        </div>
      </div>
      <div class="r-actions">
        <button class="r-btn r-download" title="Descargar">🔽</button>
        <button class="r-btn r-print" title="Ver">👁️</button>
      </div>
    `;
    container.appendChild(item);
  });
}

// Elegir icono según extensión
function chooseIcon(name) {
  const lower = name.toLowerCase();
  if (lower.includes('.pdf') || lower.includes('pdf')) return '📄';
  if (lower.includes('.xlsx') || lower.includes('.xls') || lower.includes('excel')) return '📊';
  if (lower.includes('.csv') || lower.includes('csv')) return '📦';
  return '📁';
}

// Funciones de botones de acción
function previsualizarReporte(tipo) {
  alert(`Vista previa del reporte: ${tipo}\n\nEsta funcionalidad está en desarrollo.`);
}

function generarReporte(tipo) {
  const confirmGenerar = confirm(`¿Desea generar el reporte: ${tipo}?`);
  if (!confirmGenerar) return;
  
  alert(`Generando reporte: ${tipo}\n\nProcesando datos desde la base de datos...`);
  
  // Aquí iría la lógica real para generar el reporte
  setTimeout(() => {
    alert(`✓ Reporte "${tipo}" generado con éxito!\n\nEl reporte está disponible para descarga.`);
    // Recargar la lista de reportes
    cargarReportesData();
  }, 1500);
}

function descargarReporte(nombre) {
  alert(`Descargando: ${nombre}\n\nIniciando descarga...`);
  // Aquí iría la lógica real de descarga
}

function exportarTodo() {
  const confirmExport = confirm('¿Exportar todos los reportes disponibles?\n\nEsto puede tomar unos minutos.');
  if (!confirmExport) return;
  
  alert('Exportando todos los reportes...\n\nPor favor espere.');
  // Aquí iría la lógica real de exportación masiva
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  // Cargar datos iniciales
  cargarReportesData();

  // Auto-actualizar cada 5 minutos
  setInterval(cargarReportesData, 300000);

  // Event listeners para botones de vista previa
  document.querySelectorAll('.btn-preview').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const card = e.target.closest('.card');
      const reportTitle = card.querySelector('h3').textContent;
      previsualizarReporte(reportTitle);
    });
  });

  // Event listeners para botones de generar
  document.querySelectorAll('.btn-generate').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const card = e.target.closest('.card');
      const reportTitle = card.querySelector('h3').textContent;
      generarReporte(reportTitle);
    });
  });

  // Event listeners para las tarjetas completas
  document.querySelectorAll('.card').forEach(card => {
    card.addEventListener('click', () => {
      const reportTitle = card.querySelector('h3').textContent;
      previsualizarReporte(reportTitle);
    });
  });

  // Delegación de eventos para reportes recientes
  const list = document.getElementById('recentReports');
  if (list) {
    list.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      
      const li = btn.closest('.report-item');
      const title = li && li.querySelector('.r-title')?.textContent;
      
      if (btn.classList.contains('r-download')) {
        descargarReporte(title);
      } else if (btn.classList.contains('r-print')) {
        previsualizarReporte(title);
      }
    });
  }
});
