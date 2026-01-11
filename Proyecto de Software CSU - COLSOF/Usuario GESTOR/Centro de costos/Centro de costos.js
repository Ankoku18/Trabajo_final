const centers = [
  { id:'CC-2025-001', name:'Soporte Técnico ECOPETROL', client:'ECOPETROL', budget:15000000, spent:8500000, cases:45, status:'Activo', responsible:'Juan Pérez' },
  { id:'CC-2025-002', name:'Mantenimiento BANCO AGRARIO', client:'BANCO AGRARIO', budget:12000000, spent:11200000, cases:38, status:'Alerta', responsible:'Dianne Russell' },
  { id:'CC-2024-089', name:'Hardware QUALA SA', client:'QUALA SA', budget:8000000, spent:7850000, cases:28, status:'Completado', responsible:'Jane Cooper' }
];

const body = document.getElementById('tableBody');

const format = v => new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(v);

function render() {
  body.innerHTML = '';
  let totalBudget = 0, totalSpent = 0, totalCases = 0, active = 0;

  centers.forEach(c => {
    totalBudget += c.budget;
    totalSpent += c.spent;
    totalCases += c.cases;
    if (c.status === 'Activo') active++;

    const progress = Math.round((c.spent / c.budget) * 100);
    const color = progress >= 90 ? 'red' : progress >= 70 ? 'orange' : 'green';

    body.innerHTML += `
      <tr>
        <td>${c.id}</td>
        <td><strong>${c.name}</strong><br><small>${c.client}</small></td>
        <td>${format(c.budget)}</td>
        <td>${format(c.spent)}</td>
        <td>
          ${progress}%
          <div class="progress">
            <div style="width:${progress}%;background:${color}"></div>
          </div>
        </td>
        <td>${c.cases}</td>
        <td><span class="badge ${c.status}">${c.status}</span></td>
        <td>${c.responsible}</td>
        <td>
          <button onclick="view('${c.id}')">👁</button>
        </td>
      </tr>
    `;
  });

  document.getElementById('totalBudget').textContent = format(totalBudget);
  document.getElementById('totalSpent').textContent = format(totalSpent);
  document.getElementById('totalCases').textContent = totalCases;
  document.getElementById('activeCenters').textContent = active;
}

function view(id) {
  const c = centers.find(x => x.id === id);
  document.getElementById('modalTitle').textContent = c.id;
  document.getElementById('modalBody').innerHTML = `
    <p><strong>Centro:</strong> ${c.name}</p>
    <p><strong>Cliente:</strong> ${c.client}</p>
    <p><strong>Responsable:</strong> ${c.responsible}</p>
    <p><strong>Presupuesto:</strong> ${format(c.budget)}</p>
    <p><strong>Ejecutado:</strong> ${format(c.spent)}</p>
    <p><strong>Disponible:</strong> ${format(c.budget - c.spent)}</p>
  `;
  document.getElementById('modal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal').classList.add('hidden');
}

render();
