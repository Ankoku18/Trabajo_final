const clients = [
  { id:1, name:'ECOPETROL', industry:'Petróleo y Gas', contact:'María Rodríguez', phone:'+57 310 456 7890', email:'mrodriguez@ecopetrol.com.co', address:'Bogotá', activeCases:12, totalCases:145, satisfaction:98, contracts:3, status:'Activo' },
  { id:2, name:'BANCO AGRARIO', industry:'Financiero', contact:'Carlos Mendoza', phone:'+57 311 234 5678', email:'cmendoza@bancoagrario.gov.co', address:'Bogotá', activeCases:8, totalCases:98, satisfaction:95, contracts:2, status:'Activo' },
  { id:3, name:'QUALA SA', industry:'Alimentos y Bebidas', contact:'Andrea Gómez', phone:'+57 312 345 6789', email:'agomez@quala.com.co', address:'Bogotá', activeCases:5, totalCases:78, satisfaction:96, contracts:2, status:'Activo' },
  { id:4, name:'SUPERSALUD', industry:'Gobierno', contact:'Roberto Castro', phone:'+57 316 789 0123', email:'rcastro@supersalud.gov.co', address:'Bogotá', activeCases:0, totalCases:28, satisfaction:88, contracts:1, status:'Inactivo' }
];

const list = document.getElementById('clientsList');

function render() {
  list.innerHTML = '';

  document.getElementById('activeClients').textContent =
    clients.filter(c => c.status === 'Activo').length;

  document.getElementById('totalCases').textContent =
    clients.reduce((s, c) => s + c.totalCases, 0);

  document.getElementById('avgSatisfaction').textContent =
    Math.round(clients.reduce((s, c) => s + c.satisfaction, 0) / clients.length) + '%';

  document.getElementById('totalContracts').textContent =
    clients.reduce((s, c) => s + c.contracts, 0);

  clients.forEach(c => {
    list.innerHTML += `
      <div class="client" onclick="view(${c.id})">
        <div class="logo">${c.name.substring(0,2)}</div>
        <div style="flex:1">
          <h3>${c.name}</h3>
          <small>${c.industry}</small>
          <p>${c.activeCases} / ${c.totalCases} casos</p>
          <p>Satisfacción: <strong>${c.satisfaction}%</strong></p>
        </div>
        <span class="badge ${c.status}">${c.status}</span>
      </div>
    `;
  });
}

function view(id) {
  const c = clients.find(x => x.id === id);
  document.getElementById('modalTitle').textContent = c.name;
  document.getElementById('modalBody').innerHTML = `
    <p><strong>Contacto:</strong> ${c.contact}</p>
    <p><strong>Teléfono:</strong> ${c.phone}</p>
    <p><strong>Email:</strong> ${c.email}</p>
    <p><strong>Dirección:</strong> ${c.address}</p>
    <p><strong>Contratos:</strong> ${c.contracts}</p>
  `;
  document.getElementById('modal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal').classList.add('hidden');
}

render();
