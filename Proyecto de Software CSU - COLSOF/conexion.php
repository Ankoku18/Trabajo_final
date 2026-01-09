<?php
// Datos de conexión a la base de datos
$servidor = "localhost";
$usuario = "root";
$password = "admin";
$base_datos = "base_de_datos_csu"; 

// Crear la conexión usando MySQLi Orientado a Objetos
$conn = new mysqli($servidor, $usuario, $password, $base_datos);

// Verificar si hay errores en la conexión
if ($conn->connect_error) {
    die("Error de conexión: " . $conn->connect_error);
}

// Establecer codificación de caracteres a UTF-8 (importante para tildes y ñ)
$conn->set_charset("utf8");
?>