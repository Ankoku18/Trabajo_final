# Formulario de Creación de Casos - Autocompletado desde BD

## ✅ Funcionalidades Implementadas

### 1. **Autocompletado de Cliente**
- Al escribir en el campo "Cliente", el sistema busca en BD
- Si encuentra coincidencia exacta (sin importar mayúsculas), autocompleta:
  - ✅ Sede / Dirección
  - ✅ Contacto / Responsable
  - ✅ Correo
  - ✅ Teléfono
  - ✅ Contacto Alternativo
  - ✅ Centro de Costos

### 2. **Autocompletado de Serial**
- Al seleccionar un serial existente, se autocompletan:
  - ✅ Marca
  - ✅ Tipo de equipo

### 3. **Datalist Dinámico**
- Mientras escribes, verás sugerencias de:
  - Clientes existentes (del datalist)
  - Seriales existentes (del datalist)
  - Cargan desde API al inicio

### 4. **Resumen Rápido en Tiempo Real**
- Se actualiza automáticamente con cada cambio
- Muestra:
  - ID del caso (generado automáticamente)
  - Cliente
  - Categoría (con color)
  - Prioridad (con color)
  - Técnicos asignados
  - Número de adjuntos

### 5. **Guardar Borrador**
- Guarda el formulario en `sessionStorage`
- Al recargar la página, carga automáticamente
- Botón "Guardar Borrador" para guardar manualmente

### 6. **Crear Caso**
- Valida campos requeridos:
  - ✅ Cliente
  - ✅ Sede/Dirección
  - ✅ Categoría
  - ✅ Descripción
- Envía a BD via POST `/api/casos`
- Genera ID único: AAMMDD + 6 dígitos random

### 7. **Auto-Refresh**
- Recarga datos maestros cada 5 minutos
- Mantiene sincronizado con cambios en BD

---

## 🚀 Cómo Usar

### Acceso
```
http://localhost:3000/Usuario%20GESTOR/Creacion%20de%20Casos.html
```

### Flujo de Uso

1. **Llenar Cliente**
   - Escribe nombre de cliente existente
   - Verás sugerencias en dropdown
   - Al seleccionar, se autocompletan datos

2. **Llenar Serial** (Opcional)
   - Escribe o selecciona serial existente
   - Se autocompleta marca y tipo

3. **Llenar Datos Requeridos**
   - Categoría (Software/Hardware/etc)
   - Descripción de la falla

4. **Asignar** (Opcional)
   - Selecciona técnico de la lista
   - Se actualiza en Resumen Rápido

5. **Adjuntos** (Opcional)
   - Sube archivos
   - Se cuenta en Resumen Rápido

6. **Crear o Guardar**
   - "Guardar Borrador" → sessionStorage (recarga automática)
   - "Crear Caso" → BD + confirmación

---

## 📊 Datos Cargados desde API

Al iniciar, el formulario carga:

| Fuente | Destino | Ejemplo |
|--------|---------|---------|
| `api.getCasos()` | Clientes (datalist) | Bancolombia, Colpatria... |
| `api.getCasos()` | Seriales (datalist) | SN123ABC, LAPTOP001... |
| `api.getUsuarios()` | Técnicos (select) | Juan, María, Carlos... |

---

## 🔧 Archivo de Configuración

- **scripts.js**: Lógica completa del formulario
- **Creacion de Casos.html**: HTML actualizado con datalist
- **shared/app-init.js**: API global (localhost:3000)

---

## 📝 Ejemplo de Creación de Caso

```javascript
{
  "id": "250127123456",
  "cliente": "Bancolombia",
  "sede": "Cali - Carrera 5",
  "contacto": "Juan García",
  "correo": "juan@bancolombia.com",
  "telefono": "3211234567",
  "categoria": "Hardware",
  "descripcion": "Monitor no enciende",
  "asignado_a": "Técnico 1",
  "prioridad": "Alta",
  "estado": "Abierto",
  "fecha_creacion": "2025-01-27T15:30:00.000Z"
}
```

---

## ✨ Comportamiento

### Autocomplete Cliente Exacto
```
Escribo: "bancolombia"
↓
Busca en BD (sin importar mayúsculas)
↓
Encuentra "Bancolombia"
↓
Autocompleta TODOS los datos asociados
```

### Resumen Rápido
```
Cambio categoría "Software" → Resumen se actualiza con color azul
Cambio prioridad "Crítica" → Resumen se actualiza con color rojo
Subo 2 adjuntos → Resumen muestra "Adjuntos: 2"
```

### Validación
```
Si falta Cliente:    ❌ "Cliente es requerido"
Si falta Sede:       ❌ "Sede/Dirección es requerida"
Si falta Categoría:  ❌ "Categoría es requerida"
Si falta Descripción:❌ "Descripción de la falla es requerida"

Si todo OK:          ✅ Envía a BD y muestra modal de éxito
```

---

## 🐛 Debugging

Abre la consola del navegador (F12) para ver:
- ✅ Datos maestros cargados
- ✅ Borrador cargado
- ✅ Caso creado exitosamente
- ❌ Errores de validación

---

## 📱 Responsive

- ✅ Desktop (1920px+)
- ✅ Laptop (1366px)
- ✅ Tablet (768px)
- ✅ Mobile (320px) - 3 columnas → 1 columna

---

## 🎯 Estado: LISTO PARA USAR

Servidor: http://localhost:3000 ✅
BD: Conectada ✅
API: Disponible ✅
Formulario: Funcional ✅
