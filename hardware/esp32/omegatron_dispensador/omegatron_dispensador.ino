// OMEGATRON - Dispensador de EPP (prototipo de 1 motor: guantes)
// El backend decide TODO (operario, turno, vida útil, stock). La ESP32 solo lee la
// tarjeta, pregunta y gira el motor si la respuesta es 200.

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <SPI.h>
#include <MFRC522.h>
#include "secrets.h"  // WIFI_SSID, WIFI_PASSWORD, BACKEND_HOST, HARDWARE_API_KEY

// ---------------- CONFIGURACIÓN ----------------
#define ESTACION_ID "EST-01"  // debe existir en la base (tabla Estacion.codigo)

// Si el backend no responde, ¿entregar guantes igual? true = la demo nunca "falla",
// pero esa entrega NO se registra ni respeta vida útil. Usar solo como último recurso.
#define GIRO_SI_NO_HAY_BACKEND false

// La primera petición en `npm run dev` compila la ruta y puede tardar >10 s, y el plan
// free de Render despierta el servicio dormido en ~50 s (el handshake TLS suma ~1-2 s).
const uint16_t HTTP_CONNECT_TIMEOUT_MS = 8000;
const uint16_t HTTP_RESPONSE_TIMEOUT_MS = 60000;
const unsigned long ANTIRREBOTE_MS = 3000;  // misma tarjeta dentro de este lapso se ignora

// ---------------- HARDWARE ----------------
#define RST_PIN 22
#define SS_PIN 5
MFRC522 mfrc522(SS_PIN, RST_PIN);

const int motor1Pin1 = 26;
const int motor1Pin2 = 27;

// HTTPS (Render) sin validar el certificado: suficiente para el prototipo, evita
// mantener el certificado raíz en el firmware. HTTP plano para la laptop en la red local.
WiFiClientSecure clienteSeguro;
WiFiClient clientePlano;

String ultimoUid = "";
unsigned long ultimoUidMs = 0;

void setup() {
  Serial.begin(115200);
  delay(300);

  pinMode(motor1Pin1, OUTPUT);
  pinMode(motor1Pin2, OUTPUT);
  apagarMotor();

  SPI.begin();
  mfrc522.PCD_Init();

  conectarWiFi();
  verificarBackend();

  Serial.println("\n--- OMEGATRON LISTO ---");
  Serial.println("Esperando tarjeta...");
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) conectarWiFi();

  if (!mfrc522.PICC_IsNewCardPresent() || !mfrc522.PICC_ReadCardSerial()) return;

  String uid = leerUid();
  mfrc522.PICC_HaltA();
  mfrc522.PCD_StopCrypto1();

  // Antirrebote: el lector suele leer la misma tarjeta varias veces seguidas.
  if (uid == ultimoUid && millis() - ultimoUidMs < ANTIRREBOTE_MS) return;
  ultimoUid = uid;
  ultimoUidMs = millis();

  Serial.println("\nUID detectado: " + uid);
  consultarBackend(uid);
}

// ---------------- RED ----------------

void conectarWiFi() {
  Serial.printf("\nConectando a Wi-Fi \"%s\"", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  unsigned long inicio = millis();
  while (WiFi.status() != WL_CONNECTED) {
    Serial.print(".");
    delay(500);
    if (millis() - inicio > 20000) {  // reintenta en vez de quedarse colgado
      Serial.println("\n[ERROR] No conecta al Wi-Fi. Reintentando...");
      WiFi.disconnect();
      WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
      inicio = millis();
    }
  }
  Serial.println("\n[OK] Wi-Fi conectado. IP de la ESP32: " + WiFi.localIP().toString());
}

void iniciarHttp(HTTPClient& http, const String& url) {
  if (url.startsWith("https://")) {
    clienteSeguro.setInsecure();
    http.begin(clienteSeguro, url);
  } else {
    http.begin(clientePlano, url);
  }
}

// Al arrancar: confirma que el backend es alcanzable y explica por qué si no lo es.
void verificarBackend() {
  HTTPClient http;
  String url = String(BACKEND_HOST) + "/api/health";
  Serial.println("Verificando backend en " + url + " ...");
  http.setConnectTimeout(HTTP_CONNECT_TIMEOUT_MS);
  http.setTimeout(HTTP_RESPONSE_TIMEOUT_MS);
  iniciarHttp(http, url);
  int code = http.GET();
  http.end();

  if (code == 200) {
    Serial.println("[OK] Backend alcanzable.");
    return;
  }
  Serial.printf("[ERROR] Backend no responde (codigo %d: %s)\n", code, http.errorToString(code).c_str());
  Serial.println("  Render: ¿BACKEND_HOST es https://<servicio>.onrender.com sin '/' final? Abre /api/health en el navegador.");
  Serial.println("  1. ¿La laptop esta en la MISMA red Wi-Fi que la ESP32 (" + WiFi.localIP().toString() + ")?");
  Serial.println("  2. ¿BACKEND_HOST tiene la IP actual de la laptop? (ipconfig)");
  Serial.println("  3. ¿Corre `npm run dev -- -H 0.0.0.0` en la laptop?");
  Serial.println("  4. ¿El firewall de Windows permite Node.js en esta red?");
}

void consultarBackend(const String& uid) {
  HTTPClient http;
  http.setConnectTimeout(HTTP_CONNECT_TIMEOUT_MS);
  http.setTimeout(HTTP_RESPONSE_TIMEOUT_MS);
  iniciarHttp(http, String(BACKEND_HOST) + "/api/hardware/rfid");
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-api-key", HARDWARE_API_KEY);

  String body = "{\"rfid\":\"" + uid + "\",\"estacion_id\":\"" + ESTACION_ID + "\"}";
  Serial.println("Consultando backend...");
  int code = http.POST(body);
  String respuesta = code > 0 ? http.getString() : "";
  http.end();

  Serial.printf("Codigo HTTP: %d\n", code);
  if (respuesta.length()) Serial.println("Respuesta: " + respuesta);

  if (code == 200) {
    Serial.println("[APROBADO] Entregando guantes...");
    girarMotor();
  } else if (code == 403) {
    Serial.println("[DENEGADO] Retiro excesivo, operario inactivo o tarjeta no registrada.");
  } else if (code == 401) {
    Serial.println("[ERROR] API key incorrecta: revisa HARDWARE_API_KEY en secrets.h y en el .env.");
  } else if (code == 404) {
    Serial.println("[ERROR] Estacion no registrada: revisa ESTACION_ID (" ESTACION_ID ").");
  } else if (code == 503) {
    Serial.println("[ERROR] El backend no pudo comunicarse con Firebase. No se entrega.");
  } else if (code < 0) {
    Serial.printf("[ERROR] Sin conexion con el backend: %s\n", http.errorToString(code).c_str());
    if (GIRO_SI_NO_HAY_BACKEND) {
      Serial.println("[MODO EMERGENCIA] Entregando sin control del backend (no queda registrado).");
      girarMotor();
    }
  } else {
    Serial.println("[ERROR] Respuesta inesperada del backend. No se entrega.");
  }
}

// ---------------- RFID / MOTOR ----------------

String leerUid() {
  String uid = "";
  for (byte i = 0; i < mfrc522.uid.size; i++) {
    if (mfrc522.uid.uidByte[i] < 0x10) uid += "0";
    uid += String(mfrc522.uid.uidByte[i], HEX);
  }
  uid.toUpperCase();
  return uid;
}

void girarMotor() {
  digitalWrite(motor1Pin1, HIGH);
  digitalWrite(motor1Pin2, LOW);
  delay(1500);
  apagarMotor();
  Serial.println("[OK] Motor detenido. Guantes entregados.");
}

void apagarMotor() {
  digitalWrite(motor1Pin1, LOW);
  digitalWrite(motor1Pin2, LOW);
}
