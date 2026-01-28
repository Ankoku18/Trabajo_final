/**
 * Formulario de Creación de Casos
 * Autocompletado dinámico desde BD
 * Requiere: ../shared/app-init.js (API global)
 */

// Estado global
let masterData = {
  casos: [],
  usuarios: [],
  clientes: new Map(), // map de nombre -> datos
  seriales: new Map()  // map de serial -> {marca, tipo}
}

// IDs de elementos del formulario
const formElements = {
  cliente: document.getElementById('cliente'),
  sede: document.getElementById('sede'),
  contacto: document.getElementById('contacto'),
  correo: document.getElementById('correo'),
  telefono: document.getElementById('telefono'),
  contacto2: document.getElementById('contacto2'),
  correo2: document.getElementById('correo2'),
  telefono2: document.getElementById('telefono2'),
  centroCostos: document.getElementById('centro-costos'),
  serial: document.getElementById('serial'),
  marca: document.getElementById('marca'),
  tipo: document.getElementById('tipo'),
  categoria: document.getElementById('categoria'),
  descripcion: document.getElementById('descripcion'),
  asignar: document.getElementById('asignar'),
  prioridad: document.getElementById('prioridad'),
  fileInput: document.querySelector('.file-field input[type="file"]'),
  
  // Resumen rápido
  summaryId: document.getElementById('summary-id'),
  summaryCliente: document.getElementById('summary-cliente'),
  summaryCategoria: document.getElementById('summary-categoria'),
  summaryPrioridad: document.getElementById('summary-prioridad'),
  summaryTecnicos: document.getElementById('summary-tecnicos'),
  summaryAdjuntos: document.getElementById('summary-adjuntos'),
  
  // Botones
  btnGuardarBorrador: document.getElementById('btn-guardar-borrador'),
  btnCrearCaso: document.getElementById('btn-crear-caso'),
  btnCancelar: document.getElementById('btn-cancelar')
}

const datalists = {
  clientes: document.getElementById('clientes-list'),
  seriales: document.getElementById('seriales-list')
}

const modals = {
  exito: document.getElementById('modal-exito'),
  cancelar: document.getElementById('modal-cancelar')
}

// ===== INICIALIZACIÓN =====
document.addEventListener('DOMContentLoaded', async () => {
  await loadMasterData()
  setupEventListeners()
  setupAutoRefresh()
  loadDraft()
  generateCaseId()
})

// ===== CARGAR DATOS MAESTROS =====
async function loadMasterData() {
  try {
    const [casosRes, usuariosRes] = await Promise.all([
      api.getCasos(),
      api.getUsuarios()
    ])

    masterData.casos = casosRes || []
    masterData.usuarios = usuariosRes || []

    // Construir mapas para búsqueda rápida
    masterData.casos.forEach(c => {
      if (c.cliente) {
        masterData.clientes.set(c.cliente.toLowerCase(), {
          nombre: c.cliente,
          sede: c.sede || '',
          contacto: c.contacto || '',
          correo: c.correo || '',
          telefono: c.telefono || '',
          contacto2: c.contacto_alternativo || '',
          correo2: c.correo_alternativo || '',
          telefono2: c.telefono_alternativo || '',
          centroCostos: c.centro_costos || ''
        })
      }
      
      if (c.serial) {
        masterData.seriales.set(c.serial.toLowerCase(), {
          serial: c.serial,
          marca: c.marca || '',
          tipo: c.tipo || ''
        })
      }
    })

    // Poblar datalist de clientes
    Array.from(masterData.clientes.values()).forEach(cliente => {
      const option = document.createElement('option')
      option.value = cliente.nombre
      datalists.clientes.appendChild(option)
    })

    // Poblar datalist de seriales
    Array.from(masterData.seriales.values()).forEach(item => {
      const option = document.createElement('option')
      option.value = item.serial
      datalists.seriales.appendChild(option)
    })

    // Poblar select de técnicos
    formElements.asignar.innerHTML = '<option></option>'
    masterData.usuarios.forEach(u => {
      const option = document.createElement('option')
      option.value = u.id || u.nombre
      option.textContent = u.nombre || u.email
      formElements.asignar.appendChild(option)
    })

    console.log('✅ Datos maestros cargados:', {
      casos: masterData.casos.length,
      clientes: masterData.clientes.size,
      seriales: masterData.seriales.size,
      tecnicos: masterData.usuarios.length
    })
  } catch (error) {
    console.error('❌ Error cargando datos:', error)
    utils.showToast('Error al cargar datos', true)
  }
}

// ===== EVENT LISTENERS =====
function setupEventListeners() {
  // Autocomplete cliente
  formElements.cliente.addEventListener('blur', () => {
    autocompleteCliente()
  })
  formElements.cliente.addEventListener('change', () => {
    autocompleteCliente()
  })
  formElements.cliente.addEventListener('input', () => {
    updateSummary()
  })

  // Autocomplete serial
  formElements.serial.addEventListener('blur', () => {
    autocompleteSerial()
  })
  formElements.serial.addEventListener('change', () => {
    autocompleteSerial()
  })

  // Actualizar resumen en tiempo real
  ;[
    formElements.cliente,
    formElements.categoria,
    formElements.prioridad,
    formElements.asignar,
    formElements.fileInput
  ].forEach(el => {
    if (el) {
      el.addEventListener('change', updateSummary)
      el.addEventListener('input', updateSummary)
    }
  })

  // Botones de acción
  formElements.btnGuardarBorrador.addEventListener('click', saveDraft)
  formElements.btnCrearCaso.addEventListener('click', createCase)
  formElements.btnCancelar.addEventListener('click', confirmCancel)

  // Modal cancelar
  document.getElementById('cancel-yes')?.addEventListener('click', () => {
    clearForm()
    closeModal(modals.cancelar)
  })
  document.getElementById('cancel-no')?.addEventListener('click', () => {
    closeModal(modals.cancelar)
  })
}

// ===== AUTOCOMPLETADO =====
function autocompleteCliente() {
  const clienteName = formElements.cliente.value.trim().toLowerCase()
  const found = masterData.clientes.get(clienteName)

  if (found) {
    formElements.sede.value = found.sede
    formElements.contacto.value = found.contacto
    formElements.correo.value = found.correo
    formElements.telefono.value = found.telefono
    formElements.contacto2.value = found.contacto2
    formElements.correo2.value = found.correo2
    formElements.telefono2.value = found.telefono2
    formElements.centroCostos.value = found.centroCostos
    updateSummary()
  }
}

function autocompleteSerial() {
  const serialValue = formElements.serial.value.trim().toLowerCase()
  const found = masterData.seriales.get(serialValue)

  if (found) {
    formElements.marca.value = found.marca
    formElements.tipo.value = found.tipo
    updateSummary()
  }
}

// ===== ACTUALIZAR RESUMEN =====
function updateSummary() {
  const clienteVal = formElements.cliente.value || '---'
  const categoriaVal = formElements.categoria.value || '---'
  const prioridadVal = formElements.prioridad.value || '---'
  const asignarVal = formElements.asignar.value ? 1 : 0
  const adjuntosVal = formElements.fileInput?.files?.length || 0

  formElements.summaryCliente.textContent = clienteVal
  formElements.summaryCategoria.textContent = categoriaVal
  formElements.summaryCategoria.className = getPillClass(categoriaVal)
  formElements.summaryPrioridad.textContent = prioridadVal
  formElements.summaryPrioridad.className = getPriorityPillClass(prioridadVal)
  formElements.summaryTecnicos.textContent = asignarVal
  formElements.summaryAdjuntos.textContent = adjuntosVal
}

function getPillClass(categoria) {
  const classes = 'pill'
  if (!categoria || categoria === '---') return classes + ' gray'
  if (categoria.toLowerCase() === 'software') return classes + ' blue'
  if (categoria.toLowerCase() === 'hardware') return classes + ' purple'
  if (categoria.toLowerCase().includes('seguridad')) return classes + ' red'
  if (categoria.toLowerCase().includes('red')) return classes + ' orange'
  return classes + ' gray'
}

function getPriorityPillClass(prioridad) {
  const classes = 'pill'
  if (!prioridad || prioridad === '---') return classes + ' gray'
  if (prioridad.toLowerCase() === 'critica') return classes + ' red'
  if (prioridad.toLowerCase() === 'alta') return classes + ' orange'
  if (prioridad.toLowerCase() === 'media') return classes + ' yellow'
  if (prioridad.toLowerCase() === 'baja') return classes + ' green'
  return classes + ' gray'
}

// ===== GENERAR ID ÚNICO =====
function generateCaseId() {
  const now = new Date()
  const year = String(now.getFullYear()).slice(-2)
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const random = String(Math.floor(Math.random() * 1000000)).padStart(6, '0')
  const caseId = `${year}${month}${day}${random}`
  
  formElements.summaryId.textContent = caseId
  return caseId
}

// ===== VALIDAR FORMULARIO =====
function validateForm() {
  const errors = []

  if (!formElements.cliente.value.trim()) {
    errors.push('Cliente es requerido')
  }
  if (!formElements.sede.value.trim()) {
    errors.push('Sede/Dirección es requerida')
  }
  if (!formElements.categoria.value.trim()) {
    errors.push('Categoría es requerida')
  }
  if (!formElements.descripcion.value.trim()) {
    errors.push('Descripción de la falla es requerida')
  }

  if (errors.length > 0) {
    utils.showToast(errors.join('; '), true)
    return false
  }

  return true
}

// ===== CREAR CASO =====
async function createCase() {
  if (!validateForm()) return

  const caseId = formElements.summaryId.textContent
  const newCase = {
    id: caseId,
    cliente: formElements.cliente.value.trim(),
    sede: formElements.sede.value.trim(),
    contacto: formElements.contacto.value.trim() || null,
    correo: formElements.correo.value.trim() || null,
    telefono: formElements.telefono.value.trim() || null,
    contacto_alternativo: formElements.contacto2.value.trim() || null,
    correo_alternativo: formElements.correo2.value.trim() || null,
    telefono_alternativo: formElements.telefono2.value.trim() || null,
    centro_costos: formElements.centroCostos.value.trim() || null,
    serial: formElements.serial.value.trim() || null,
    marca: formElements.marca.value.trim() || null,
    tipo: formElements.tipo.value.trim() || null,
    categoria: formElements.categoria.value,
    descripcion: formElements.descripcion.value.trim(),
    asignado_a: formElements.asignar.value || null,
    prioridad: formElements.prioridad.value || 'Media',
    estado: 'Abierto',
    fecha_creacion: new Date().toISOString()
  }

  try {
    formElements.btnCrearCaso.disabled = true
    formElements.btnCrearCaso.textContent = 'Creando...'

    const result = await api.crearCaso(newCase)
    
    console.log('✅ Caso creado:', result)
    utils.showToast(`Caso ${caseId} creado exitosamente`, false)
    
    showModal(modals.exito)
    setTimeout(() => {
      clearForm()
      sessionStorage.removeItem('case-draft')
      generateCaseId()
      closeModal(modals.exito)
    }, 2000)
  } catch (error) {
    console.error('❌ Error creando caso:', error)
    utils.showToast('Error al crear caso: ' + error.message, true)
  } finally {
    formElements.btnCrearCaso.disabled = false
    formElements.btnCrearCaso.textContent = 'Crear Caso'
  }
}

// ===== GUARDAR BORRADOR =====
function saveDraft() {
  const draft = {
    cliente: formElements.cliente.value,
    sede: formElements.sede.value,
    contacto: formElements.contacto.value,
    correo: formElements.correo.value,
    telefono: formElements.telefono.value,
    contacto2: formElements.contacto2.value,
    correo2: formElements.correo2.value,
    telefono2: formElements.telefono2.value,
    centroCostos: formElements.centroCostos.value,
    serial: formElements.serial.value,
    marca: formElements.marca.value,
    tipo: formElements.tipo.value,
    categoria: formElements.categoria.value,
    descripcion: formElements.descripcion.value,
    asignar: formElements.asignar.value,
    prioridad: formElements.prioridad.value,
    timestamp: Date.now()
  }

  sessionStorage.setItem('case-draft', JSON.stringify(draft))
  utils.showToast('Borrador guardado', false)
}

// ===== CARGAR BORRADOR =====
function loadDraft() {
  const draft = sessionStorage.getItem('case-draft')
  if (draft) {
    try {
      const data = JSON.parse(draft)
      formElements.cliente.value = data.cliente || ''
      formElements.sede.value = data.sede || ''
      formElements.contacto.value = data.contacto || ''
      formElements.correo.value = data.correo || ''
      formElements.telefono.value = data.telefono || ''
      formElements.contacto2.value = data.contacto2 || ''
      formElements.correo2.value = data.correo2 || ''
      formElements.telefono2.value = data.telefono2 || ''
      formElements.centroCostos.value = data.centroCostos || ''
      formElements.serial.value = data.serial || ''
      formElements.marca.value = data.marca || ''
      formElements.tipo.value = data.tipo || ''
      formElements.categoria.value = data.categoria || ''
      formElements.descripcion.value = data.descripcion || ''
      formElements.asignar.value = data.asignar || ''
      formElements.prioridad.value = data.prioridad || ''
      
      console.log('✅ Borrador cargado')
      updateSummary()
    } catch (e) {
      console.error('Error cargando borrador:', e)
    }
  }
}

// ===== AUTO-REFRESH =====
function setupAutoRefresh() {
  // Recargar datos cada 5 minutos
  setInterval(() => {
    loadMasterData()
  }, 5 * 60 * 1000)
}

// ===== LIMPIAR FORMULARIO =====
function clearForm() {
  Object.values(formElements).forEach(el => {
    if (el && el.tagName === 'INPUT') el.value = ''
    if (el && el.tagName === 'SELECT') el.value = ''
    if (el && el.tagName === 'TEXTAREA') el.value = ''
  })
  
  generateCaseId()
  updateSummary()
}

// ===== MODAL HELPERS =====
function showModal(modal) {
  if (modal) {
    modal.style.display = 'flex'
  }
}

function closeModal(modal) {
  if (modal) {
    modal.style.display = 'none'
  }
}

function confirmCancel() {
  showModal(modals.cancelar)
}

console.log('✅ Formulario de creación de casos inicializado')
