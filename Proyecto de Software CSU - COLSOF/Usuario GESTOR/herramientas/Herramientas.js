// Sistema de Herramientas BD
const tools = {
  backup: { name: 'Respaldo de Base Datos', icon: '💾', desc: 'Crear respaldo completo de BD' },
  optimize: { name: 'Optimizar BD', icon: '⚙️', desc: 'Defragmentar y optimizar índices' },
  repair: { name: 'Reparar BD', icon: '🔧', desc: 'Verificar y reparar integridad' },
  export: { name: 'Exportar Datos', icon: '📤', desc: 'Exportar a CSV/Excel' },
  import: { name: 'Importar Datos', icon: '📥', desc: 'Importar desde archivos' },
  clear: { name: 'Limpiar Caché', icon: '🗑️', desc: 'Limpiar datos en caché' }
};

const loadTools = () => {
  const container = document.getElementById('toolsGrid');
  if (!container) return;
  
  container.innerHTML = Object.entries(tools).map(([key, tool]) => `
    <div class="tool-card" data-tool="${key}">
      <div class="tool-icon">${tool.icon}</div>
      <h3>${tool.name}</h3>
      <p>${tool.desc}</p>
      <button class="btn-execute">Ejecutar</button>
    </div>
  `).join('');
  
  document.querySelectorAll('.tool-card').forEach(card => {
    card.addEventListener('click', () => executeTool(card.dataset.tool));
  });
};

const executeTool = (toolName) => {
  notify(`Ejecutando: ${tools[toolName].name}...`, false);
  // Simulamos la ejecución
  setTimeout(() => {
    notify(`✓ ${tools[toolName].name} completado`, false);
  }, 1500);
};

const notify = (msg, isError = false) => {
  let box = document.getElementById('tools-toast');
  if (!box) {
    box = document.createElement('div');
    box.id = 'tools-toast';
    box.style.cssText = 'position: fixed; right: 20px; bottom: 20px; padding: 12px 16px; border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.12); z-index: 9999; font-weight: 600;';
    document.body.appendChild(box);
  }
  box.textContent = msg;
  box.style.background = isError ? '#fee2e2' : '#d1fae5';
  box.style.color = isError ? '#991b1b' : '#065f46';
  clearTimeout(box._timer);
  box._timer = setTimeout(() => { box.remove(); }, 2400);
};

document.addEventListener('DOMContentLoaded', loadTools);
