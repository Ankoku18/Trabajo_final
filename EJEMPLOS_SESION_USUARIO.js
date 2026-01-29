// ============================================================
// EJEMPLO: Cómo usar el usuario en las páginas protegidas
// Guardar este código en: Usuario ADMINISTRDOR/verificar-sesion.js
// Usuario GESTOR/verificar-sesion.js
// O importarlo en cada página
// ============================================================

/**
 * FUNCIÓN PARA PROTEGER PÁGINAS
 * Llama a esto en el head de cada página protegida para verificar autenticación
 */
function verificarSesion() {
  const usuarioJSON = localStorage.getItem('usuario');
  
  if (!usuarioJSON) {
    // No hay usuario logueado - redirigir a login
    console.warn('No hay sesión activa. Redirigiendo al login...');
    window.location.href = '../../index.html';
    return null;
  }
  
  try {
    const usuario = JSON.parse(usuarioJSON);
    
    // Validar que tenga los campos necesarios
    if (!usuario.id || !usuario.email || !usuario.rol) {
      throw new Error('Datos de usuario incompletos');
    }
    
    return usuario;
  } catch (error) {
    console.error('Error al recuperar sesión:', error);
    // Limpiar localStorage corrupto
    localStorage.removeItem('usuario');
    window.location.href = '../../index.html';
    return null;
  }
}

/**
 * FUNCIÓN PARA CERRAR SESIÓN (LOGOUT)
 */
function cerrarSesion() {
  // Limpiar todo lo relacionado con la sesión
  localStorage.removeItem('usuario');
  localStorage.removeItem('rememberedEmail'); // Opcional: olvidar email
  
  // Redirigir al login
  window.location.href = '../../index.html';
}

/**
 * FUNCIÓN PARA VALIDAR ROL
 * Verifica si el usuario tiene un rol específico
 */
function tieneRol(rolesRequeridos) {
  const usuario = JSON.parse(localStorage.getItem('usuario'));
  
  if (!usuario) return false;
  
  // rolesRequeridos puede ser string o array
  const roles = Array.isArray(rolesRequeridos) 
    ? rolesRequeridos 
    : [rolesRequeridos];
  
  return roles.includes(usuario.rol);
}

/**
 * FUNCIÓN PARA OBTENER DATOS DEL USUARIO LOGUEADO
 */
function obtenerUsuario() {
  const usuarioJSON = localStorage.getItem('usuario');
  
  if (!usuarioJSON) return null;
  
  return JSON.parse(usuarioJSON);
}

// ============================================================
// EJEMPLO DE USO EN PÁGINAS
// ============================================================

/*
// EN: Usuario ADMINISTRDOR/Menu principal Admin.html
// (En el <script> antes del </body>)

<script src="verificar-sesion.js"></script>
<script>
  // Verificar que el usuario esté logueado
  const usuario = verificarSesion();
  
  if (!usuario) {
    // Ya fue redirigido, no continuar
    throw new Error('Sin autenticación');
  }
  
  // Mostrar nombre del usuario en la página
  document.getElementById('nombreUsuario').textContent = usuario.nombre + ' ' + usuario.apellido;
  
  // Verificar que sea administrador
  if (usuario.rol !== 'Administrador') {
    alert('Acceso denegado. Solo administradores pueden entrar aquí.');
    window.location.href = '../../index.html';
  }
  
  // Resto del código de la página...
</script>
*/

// ============================================================
// EJEMPLO 2: COMPONENTE DE PERFIL Y LOGOUT
// ============================================================

/*
// Crear un componente en el header de cada página:

<div id="userMenus" style="display: none;">
  <span id="userDisplay"></span>
  <button onclick="cerrarSesion()" class="logout-btn">Cerrar Sesión</button>
</div>

<script>
  const usuario = obtenerUsuario();
  
  if (usuario) {
    document.getElementById('userMenus').style.display = 'flex';
    document.getElementById('userDisplay').textContent = 
      `${usuario.nombre} ${usuario.apellido} (${usuario.rol})`;
  }
</script>
*/

// ============================================================
// EJEMPLO 3: PROTEGER RUTAS POR ROL
// ============================================================

/*
function protegerPorRol(rolesPermitidos) {
  const usuario = verificarSesion();
  
  if (!usuario) {
    window.location.href = '../../index.html';
    return false;
  }
  
  const roles = Array.isArray(rolesPermitidos) 
    ? rolesPermitidos 
    : [rolesPermitidos];
  
  if (!roles.includes(usuario.rol)) {
    alert(`Acceso denegado. Esta página requiere uno de estos roles: ${roles.join(', ')}`);
    history.back();
    return false;
  }
  
  return true;
}

// USO:
if (!protegerPorRol(['Administrador', 'Gestor'])) {
  throw new Error('Acceso no autorizado');
}
*/

// ============================================================
// EJEMPLO 4: TABLA DE DATOS CON USUARIO
// ============================================================

/*
// Mostrar información del usuario en una tabla HTML

function mostrarPerfilUsuario() {
  const usuario = obtenerUsuario();
  
  if (!usuario) return;
  
  const html = `
    <table class="profile-table">
      <tr>
        <td><strong>ID:</strong></td>
        <td>${usuario.id}</td>
      </tr>
      <tr>
        <td><strong>Nombre:</strong></td>
        <td>${usuario.nombre} ${usuario.apellido}</td>
      </tr>
      <tr>
        <td><strong>Email:</strong></td>
        <td>${usuario.email}</td>
      </tr>
      <tr>
        <td><strong>Rol:</strong></td>
        <td><span class="role-badge role-${usuario.rol.toLowerCase()}">${usuario.rol}</span></td>
      </tr>
      <tr>
        <td><strong>Último acceso:</strong></td>
        <td>${new Date(usuario.loginTime).toLocaleString('es-CO')}</td>
      </tr>
    </table>
  `;
  
  document.getElementById('perfilDiv').innerHTML = html;
}
*/

// ============================================================
// EJEMPLO 5: INTERCEPTOR DE FETCH PARA INCLUIR USUARIO
// ============================================================

/*
// Si necesitas incluir el ID de usuario en todas las requests

const originalFetch = window.fetch;
window.fetch = function(...args) {
  const usuario = obtenerUsuario();
  
  if (usuario && args.length > 1) {
    // Si no tiene headers, crear objeto config
    if (!args[1]) args[1] = {};
    if (!args[1].headers) args[1].headers = {};
    
    // Agregar ID de usuario a los headers
    args[1].headers['X-User-ID'] = usuario.id;
  }
  
  return originalFetch.apply(this, args);
};
*/

// ============================================================
// EXPORTAR FUNCIONES (Si usas módulos ESM)
// ============================================================

export {
  verificarSesion,
  cerrarSesion,
  tieneRol,
  obtenerUsuario
};
