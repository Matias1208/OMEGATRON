// Copia este archivo como "secrets.h" (en la misma carpeta) y completa tus datos.
// secrets.h NO se sube a GitHub.
#pragma once

// Red Wi-Fi: con backend local, la ESP32 y la laptop DEBEN estar en la MISMA red.
#define WIFI_SSID "nombre-de-la-red"
#define WIFI_PASSWORD "contrasena-de-la-red"

// Backend en Render (cualquier red con internet), sin "/" final:
#define BACKEND_HOST "https://omegatron-backend.onrender.com"
// O la laptop en la red local (PowerShell: ipconfig -> "Dirección IPv4" del adaptador Wi-Fi):
// #define BACKEND_HOST "http://192.168.1.50:3000"

// Debe ser idéntica a HARDWARE_API_KEY del backend (.env local o Environment de Render).
#define HARDWARE_API_KEY "cambia-esto"
