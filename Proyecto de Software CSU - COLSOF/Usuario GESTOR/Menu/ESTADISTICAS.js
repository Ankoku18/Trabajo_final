// Datos
const monthlyData = {
  labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'],
  datasets: [
    { label: 'Creados', data: [245, 280, 310, 265, 290, 320], borderWidth: 2 },
    { label: 'Resueltos', data: [230, 265, 295, 250, 280, 305], borderWidth: 2 },
    { label: 'Pendientes', data: [15, 15, 15, 15, 10, 15], borderWidth: 2 }
  ]
};

new Chart(document.getElementById('monthlyChart'), {
  type: 'line',
  data: monthlyData
});

new Chart(document.getElementById('categoryChart'), {
  type: 'pie',
  data: {
    labels: ['Hardware', 'Software', 'Impresión', 'Mantenimiento', 'Office'],
    datasets: [{
      data: [450, 380, 280, 220, 180]
    }]
  }
});

new Chart(document.getElementById('priorityChart'), {
  type: 'bar',
  data: {
    labels: ['Urgente', 'Alta', 'Media', 'Baja'],
    datasets: [{
      data: [150, 520, 480, 360]
    }]
  }
});

new Chart(document.getElementById('hourChart'), {
  type: 'bar',
  data: {
    labels: ['8am', '10am', '12pm', '2pm', '4pm', '6pm'],
    datasets: [{
      data: [12, 25, 35, 28, 22, 8]
    }]
  }
});

// Tabla técnicos
const technicians = [
  { name: 'Juan Pérez', solved: 145, avg: 2.3, sat: 98 },
  { name: 'Dianne Russell', solved: 132, avg: 2.5, sat: 96 },
  { name: 'Jane Cooper', solved: 128, avg: 2.8, sat: 94 },
  { name: 'Robert Fox', solved: 115, avg: 3.1, sat: 92 },
  { name: 'Cody Fisher', solved: 98, avg: 3.5, sat: 90 }
];

const tbody = document.getElementById('techTable');
technicians.forEach(t => {
  tbody.innerHTML += `
    <tr>
      <td>${t.name}</td>
      <td>${t.solved}</td>
      <td>${t.avg}</td>
      <td>${t.sat}%</td>
    </tr>
  `;
});


