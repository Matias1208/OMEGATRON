// Copia este archivo como "secrets.h" (en la misma carpeta) y completa tus datos.
// secrets.h NO se sube a GitHub.
#pragma once

// Red Wi-Fi: la ESP32 y la laptop con el backend DEBEN estar en la MISMA red.
#define WIFI_SSID "nombre-de-la-red"
#define WIFI_PASSWORD "contrasena-de-la-red"

// IP de la laptop en ESA red (PowerShell: ipconfig -> "Dirección IPv4" del adaptador Wi-Fi).
#define BACKEND_HOST "http://192.168.1.50:3000"

// Debe ser idéntica a HARDWARE_API_KEY del .env del backend.
#define HARDWARE_API_KEY "cambia-esto"
