# WICHTIG: Diese Dokumentation ist ein Entwurf und wird laufend aktualisiert. Sie dient als Grundlage für die Entwicklung des EnergyWAN-Projekts.

# NEUE Verzeichnisstruktur

> Stammverzeichnis: /home/pi/__ctrl_minimal/

> Logdateien: /home/pi/__ctrl_minimal/data/

> Dokumentationen: /home/pi/__ctrl_minimal/docs/

- data/
- docs/
  - can-explorer/
    - etaet.js
    - List_of_events.txt
    - Protection_event.txt
    - Readme.md
    - special_event.txt
  - emsc/
    - emsc2_0.html
  - eta_et/
    - et_adapter_0.html
    - et_adapter_1.html
- execute/
  - emsc2.0.9.12
- tools/
  - can_logger
    - can_logger.cpp
- kill_emsc.sh
- pgrep_emsc.sh
- README.md
- start_emsc.sh

# Systemkomponenten

- Eigenes CTRL BASEBORD mit CAN MCP2515 Chip. Auf diesem Board sind ausserdem ein SIM7000E NB-IoT HAT und ein Waveshare CM4-IO-BASE-A verbaut. Diese sind über die RPI GPIOs verbunden.
- Raspberry Pi Compute Module 4
- Waveshere: Waveshare 19887 CM4-IO-BASE-A
- Waveshare: Waveshare NB-IoT HAT SIM7000E
- SIM-Karte: Vodafone NB-IoT SIM-Karte
- Betriebssystem: Raspberry Pi OS Lite

# Anforderungen

## Genereller Ablauf

- Das Programm emsc2.0.9.12 vom Hersteller muss als erstes ausgeführt werden. Dieses Programm dient der Kommunikation mit dem Batteriesystem und der Verwaltung der angeschlossenen Batterien.
- Danach soll das Programm EnergyCAN gestartet werden, welches die Kommunikation über den CAN-Bus übernimmt.
- Anschließend wird das Programm EnergySIM gestartet, welches die Kommunikation mit dem SIM-Kartenmodul übernimmt.
- Die Programme EnergyCAN und EnergySIM sollen im Hintergrund laufen, regelmäßig und unabhängig ihre Aufgaben ausführen.
- Die Programme sollen so programmiert werden, dass sie im Fehlerfall neu gestartet werden können.
- Teile die Daten über Shared Memory
- Sende ausgewählte Daten mit EnergySIM über MQTT an den Broker

# Programmteile

## emsc2.0.9.12

- Angaben vom Hersteller:
  - Object Dictionary Documenation Short Version: [et_adapter_0.html](https://github.com/tBrause/__ctrl_chat/blob/main/et_adapter_0.html)
  - Object Dictionary Documenation Full Version: [et_adapter_1.html](https://github.com/tBrause/__ctrl_chat/blob/main/et_adapter_1.html)

## EnergyCAN

> C++ Verzeichnis: /home/pi/EnergyWAN/EnergyCAN

- Das Programm EnergyCAN ist für die Kommunikation mit dem Batteriesystem zuständig und wird über den CAN-Bus durchgefüht.
- Ein Batteriesystem besteht aus mehreren Batterien(ET) und Adaptern(ETA), die in der Datei confBatt.json hinterlegt sind
- Jeder ETA und ET sendet einen Status über CAN
  - 4040 = Status Nicht verfügbar
  - 8080 = Status Bereit
  - 80c0 = Status Aktiv
- Erst wenn mindestens 4 ETAs den Status 8080 haben, soll der Status dieser ETAs auf 80c0 gesetzt werden.
- Beachte, dass es Nachzügler gibt. Es kann zu Verzögerungen kommen, bis ein ETA den Status 8080 sendet. Wenn 4 ETAs den Status 80c0 gesetzt haben, aber 6 ETAs vorhanden sind, darf die Routine nicht abbrechen. Die Routine soll immer laufen, auch wegen möglicher Fehler im Batteriesystem.
- Sende die Daten an den Shared Memory
- Es soll einen Schutzmechanismus geben, der alle ETAs ausschaltet, also auf 8080 setzt.
- Nutze den Mittelwert von SOC aller ETAs, um den SOC des Batteriesystems zu berechnen.
  Schreibe den SOC in die Datei: battsoc.txt. Im Rythmus von 5 Minuten.

## EnergySIM

> C++ Verzeichnis: /home/pi/EnergyWAN/EnergySIM

- Das Programm EnergySIM ist für die Kommunikation mit dem SIM-Kartenmodul zuständig
- Als Hardware wird ein SIM7000E NB IoT HAT verwendet
- Die Daten sollen mit dem NB-IoT HAT per MQTT an den Broker gesendet werden

## Konfiguration

- Die Konfiguration der Programme erfolgt über JSON-Dateien im Verzeichnis /home/pi/EnergyWAN/config/

## Public

- Die Programmteile die verwendet werden (/home/pi/startall), befinden sich im Verzeichnis /home/pi/EnergyWAN/execute/

## CAN-Interface im OS

Die Hardware erzeugt über den MCP2515 ein `can0`-Interface (SocketCAN-kompatibel unter Linux).
Die Initialisierung und Konfiguration des CAN-Transceivers erfolgt in Verbindung mit dem Programmpaket **emsc2.0.9.12**.

Dieses Paket wurde bisher erfolgreich eingesetzt und stellt u. a. die Konfiguration des MCP2515 sowie das Interface `can0` zur Verfügung.

## CAN-Kommunikation mit dem Batteriesystem

Die Kommunikation mit dem Batteriesystem erfolgt über das Interface `can0`, das über einen MCP2515-Controller bereitgestellt wird.

Zur Referenz diente das bestehende Programmpaket **emsc2.0.9.12**, das erfolgreich über `can0` mit dem Batteriesystem kommunizierte. Dieses Paket arbeitete mit zwei herstellerspezifischen Objektlisten:

- [Objektliste Lite (HTML)](https://github.com/tBrause/__ctrl_chat/blob/main/et_adapter_0.html)
- [Objektliste Full (HTML)](https://github.com/tBrause/__ctrl_chat/blob/main/et_adapter_1.html)

Auf dieser Basis wird das neue Modul **EnergyCAN** entwickelt.

Ziel: Kompatible, stabile CAN-Kommunikation mit dem Batteriesystem.
