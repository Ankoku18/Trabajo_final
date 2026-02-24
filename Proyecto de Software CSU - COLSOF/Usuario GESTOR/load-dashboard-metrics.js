// =====================  
// CARGA DINAMICA DE METRICAS DEL DASHBOARD
// =====================

(function loadDashboardMetrics() {
  // Esperar a que el DOM esté listo
  const waitForMetrics = setInterval(() => {
    const metricCreados = document.getElementById('metric-creados');
    const metricPausados = document.getElementById('metric-pausados');
    const metricSolucionados = document.getElementById('metric-solucionados');
    const metricCerrados = document.getElementById('metric-cerrados');

    // Si los elementos existen, proceder
    if (metricCreados && metricPausados && metricSolucionados && metricCerrados) {
      clearInterval(waitForMetrics);
      fetchMetrics();
    }
  }, 100);

  async function fetchMetrics() {
    try {
      // Construir URL base de la API
      const protocol = window.location.protocol;
      const hostname = window.location.hostname;
      const port = window.location.port;
      const apiBaseUrl = `${protocol}//${hostname}${port ? ':' + port : ''}`;

      console.log('📊 Cargando métricas del dashboard desde:', apiBaseUrl + '/api/dashboard/stats');

      const response = await fetch(apiBaseUrl + '/api/dashboard/stats');
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success && result.data) {
        const data = result.data;
        
        // Actualizar métricas en el HTML
        document.getElementById('metric-creados').textContent = (data.total_casos || 0).toLocaleString('es-CO');
        document.getElementById('metric-pausados').textContent = (data.pausados || 0).toLocaleString('es-CO');
        document.getElementById('metric-solucionados').textContent = (data.resueltos || 0).toLocaleString('es-CO');
        document.getElementById('metric-cerrados').textContent = (data.cerrados || 0).toLocaleString('es-CO');

        console.log('✅ Métricas actualizadas correctamente:', data);
      } else {
        console.warn('⚠️ Respuesta inesperada del servidor:', result);
      }
    } catch (error) {
      console.error('❌ Error cargando métricas del dashboard:', error);
      // Mantener valores en 0
    }
  }
})();
