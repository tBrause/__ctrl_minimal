#include <iostream>
#include <iomanip>
#include <fstream>
#include <cstring>
#include <unistd.h>
#include <net/if.h>
#include <sys/socket.h>
#include <sys/ioctl.h>
#include <linux/can.h>
#include <linux/can/raw.h>
#include <ctime>

// ... (Kopf wie bisher, siehe oben)

bool readSDO(int s, int node_id, uint16_t index, uint8_t subindex, uint32_t &value, uint8_t &resp_code)
{
    struct can_frame frame{};
    frame.can_id = 0x600 + node_id;
    frame.can_dlc = 8;
    frame.data[0] = 0x40;
    frame.data[1] = index & 0xFF;
    frame.data[2] = (index >> 8) & 0xFF;
    frame.data[3] = subindex;
    frame.data[4] = 0x00;
    frame.data[5] = 0x00;
    frame.data[6] = 0x00;
    frame.data[7] = 0x00;

    // Schreibe SDO-Request
    if (write(s, &frame, sizeof(frame)) != sizeof(frame))
    {
        perror("write");
        return false;
    }

    // Versuche für maximal 0,8 Sek. (80x 10ms)
    for (int i = 0; i < 80; ++i)
    {
        struct can_frame resp{};
        int nbytes = read(s, &resp, sizeof(resp));
        if (nbytes < 0)
        {
            perror("read");
            break;
        }
        // NUR ANTWORT VON GEWÜNSCHTER NODE AKZEPTIEREN
        if (resp.can_id == 0x580 + node_id)
        {
            resp_code = resp.data[0];
            if (resp_code == 0x43 || resp_code == 0x4B || resp_code == 0x47)
            {
                value = resp.data[4] | (resp.data[5] << 8) | (resp.data[6] << 16) | (resp.data[7] << 24);
                usleep(150000); // 150 ms Pause NACH erfolgreichem Lesen
                return true;
            }
            else if (resp_code == 0x80)
            {
                usleep(150000); // 150 ms Pause bei Fehlerantwort
                return false;
            }
        }
        usleep(10000); // 10 ms Pause zwischen Reads
    }
    usleep(150000); // Sicherheitspause bei Timeout
    return false;
}

// Der Rest bleibt gleich (main, Logging, ...)

std::string nowTimeString()
{
    std::time_t t = std::time(nullptr);
    char buf[32];
    std::strftime(buf, sizeof(buf), "%Y-%m-%d %H:%M:%S", std::localtime(&t));
    return buf;
}

int main()
{
    const char *ifname = "can0";
    const char *logfile = "multi_sdo_log.txt"; // Logdateiname

    int node_min = 2; // Erste ETA Node-ID
    int node_max = 7; // Letzte ETA Node-ID

    struct
    {
        uint16_t index;
        uint8_t subindex;
        const char *name;
        const char *unit;
        double scale;
        bool signed_val;
    } abfragen[] = {
        {0x6040, 0x01, "act. voltage", "V", 0.001, false},
        {0x6039, 0x01, "act. external voltage", "V", 0.001, false},
        {0x603E, 0x01, "act. current", "A", 0.001, true},
        {0x6042, 0x01, "act. elect. temp", "°C", 0.1, false},
        {0x6164, 0x01, "SOC", "%", 0.01, false},
        {0x6176, 0x01, "SOH", "%", 0.01, false},
    };

    std::ofstream log(logfile, std::ios::app);
    if (!log)
    {
        std::cerr << "Fehler beim Öffnen der Logdatei!" << std::endl;
        return 1;
    }

    int s = socket(PF_CAN, SOCK_RAW, CAN_RAW);
    if (s < 0)
    {
        perror("Socket");
        return 1;
    }

    struct ifreq ifr{};
    std::strncpy(ifr.ifr_name, ifname, IFNAMSIZ - 1);
    if (ioctl(s, SIOCGIFINDEX, &ifr) < 0)
    {
        perror("ioctl");
        return 1;
    }

    struct sockaddr_can addr{};
    addr.can_family = AF_CAN;
    addr.can_ifindex = ifr.ifr_ifindex;
    if (bind(s, (struct sockaddr *)&addr, sizeof(addr)) < 0)
    {
        perror("bind");
        return 1;
    }

    log << "\n--- Abfrage am " << nowTimeString() << " ---\n";
    std::cout << "\n--- Abfrage am " << nowTimeString() << " ---\n";

    for (int node_id = node_min; node_id <= node_max; ++node_id)
    {
        log << "\n=== ETA " << node_id << " (Node-ID " << node_id << ") ===\n";
        std::cout << "\n=== ETA " << node_id << " (Node-ID " << node_id << ") ===\n";
        for (auto &req : abfragen)
        {
            uint32_t value = 0;
            uint8_t resp_code = 0;
            log << req.name << " (0x" << std::hex << req.index << ":" << std::dec << (int)req.subindex << "): ";
            std::cout << "Lese " << std::setw(22) << std::left << req.name << " (0x" << std::hex << req.index << ":" << std::dec << (int)req.subindex << ") ... ";
            if (readSDO(s, node_id, req.index, req.subindex, value, resp_code))
            {
                double fval = req.signed_val ? ((req.scale != 1.0 && value <= 0xFFFF)
                                                    ? static_cast<int16_t>(value) * req.scale
                                                    : static_cast<int32_t>(value) * req.scale)
                                             : value * req.scale;
                log << value << " (raw)";
                std::cout << value << " (raw)";
                if (req.scale != 1.0)
                {
                    log << " = " << std::fixed << std::setprecision(3) << fval << " " << req.unit;
                    std::cout << " = " << std::fixed << std::setprecision(3) << fval << " " << req.unit;
                }
                log << std::endl;
                std::cout << std::endl;
            }
            else
            {
                if (resp_code == 0x80)
                {
                    log << "Fehler: Kein Zugriff oder Objekt nicht vorhanden.\n";
                    std::cout << "Fehler: Kein Zugriff oder Objekt nicht vorhanden." << std::endl;
                }
                else
                {
                    log << "Keine Antwort oder Timeout!\n";
                    std::cout << "Keine Antwort oder Timeout!" << std::endl;
                }
            }
            usleep(100000); // 100ms Pause nach jeder Einzelabfrage (entlastet Bus & Gerät)
        }
    }

    close(s);
    log << "\n";
    log.close();
    std::cout << "\nFertig. Ergebnisse auch in " << logfile << "\n";
    return 0;
}
