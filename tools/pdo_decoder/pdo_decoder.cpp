#include <iostream>
#include <iomanip>
#include <sstream>
#include <fstream>
#include <cstring>
#include <ctime>
#include <unistd.h>
#include <net/if.h>
#include <sys/socket.h>
#include <sys/ioctl.h>
#include <linux/can.h>
#include <linux/can/raw.h>

// Zeitstempel als String
std::string currentTimestamp()
{
    std::time_t now = std::time(nullptr);
    char buf[20];
    std::strftime(buf, sizeof(buf), "%F %T", std::localtime(&now));
    return std::string(buf);
}

// Zuordnung CAN-ID zu ETA-Name
std::string deviceName(uint32_t can_id)
{
    switch (can_id)
    {
    case 0x192:
        return "ETA 2";
    case 0x193:
        return "ETA 3";
    case 0x194:
        return "ETA 4";
    case 0x195:
        return "ETA 5";
    case 0x196:
        return "ETA 6";
    case 0x197:
        return "ETA 7";
    default:
    {
        std::ostringstream oss;
        oss << "CAN 0x" << std::hex << can_id;
        return oss.str();
    }
    }
}

// Status-Klartext für typische Codes
std::string stateText(uint16_t state)
{
    if (state == 0x8080)
        return "Ready-to-Attach";
    if (state == 0x80C0)
        return "Normal Operation";
    if (state == 0x8040)
        return "Do-Not-Attach";
    if (state == 0x4040)
        return "Comp. Check / Do-Not-Attach";
    std::ostringstream oss;
    oss << "0x" << std::hex << state;
    return oss.str();
}

// Hauptdekodierung
std::string decodePDO(const can_frame &frame)
{
    if (frame.can_dlc < 8)
        return "Unvollständiger Frame";

    // Rohdaten
    uint16_t status = frame.data[1] << 8 | frame.data[0];
    uint16_t object_code = frame.data[3] << 8 | frame.data[2];
    uint16_t voltage_raw = frame.data[5] << 8 | frame.data[4];
    uint16_t temp_raw = frame.data[7] << 8 | frame.data[6];

    // Werte mit Annahmen zur Skalierung
    double voltage = voltage_raw / 1000.0; // z.B. 51788 -> 51.788 V
    double temperature = temp_raw / 100.0; // TESTWEISE: z.B. 4736 -> 47.36 °C (Skalierung anpassen, falls abweichend)

    std::ostringstream oss;
    oss << "Status: " << stateText(status)
        << ", ObjectCode: 0x" << std::hex << object_code
        << ", Spannung: " << std::fixed << std::setprecision(3) << voltage << " V"
        << ", Temperatur: " << std::fixed << std::setprecision(2) << temperature << " C"
        << " (Raw: V=" << voltage_raw << ", T=" << temp_raw << ") | Payload: ";
    for (int i = 0; i < 8; ++i)
    {
        oss << std::hex << std::setw(2) << std::setfill('0') << (int)frame.data[i] << " ";
    }
    return oss.str();
}

int main()
{
    const char *ifname = "can0";
    const char *logfile_name = "pdo_decoded_log.txt";

    std::ofstream logfile(logfile_name, std::ios::app);
    if (!logfile)
    {
        std::cerr << "Fehler beim Öffnen der Logdatei\n";
        return 1;
    }

    int s = socket(PF_CAN, SOCK_RAW, CAN_RAW);
    if (s < 0)
    {
        std::perror("Socket");
        return 1;
    }

    struct ifreq ifr{};
    std::strncpy(ifr.ifr_name, ifname, IFNAMSIZ - 1);
    if (ioctl(s, SIOCGIFINDEX, &ifr) < 0)
    {
        std::perror("ioctl");
        return 1;
    }

    struct sockaddr_can addr{};
    addr.can_family = AF_CAN;
    addr.can_ifindex = ifr.ifr_ifindex;
    if (bind(s, (struct sockaddr *)&addr, sizeof(addr)) < 0)
    {
        std::perror("bind");
        return 1;
    }

    std::cout << "Starte PDO-Klartext-Decoder (IDs 0x192–0x197), Ausgabe in " << logfile_name << "\n";

    struct can_frame frame;
    while (true)
    {
        int nbytes = read(s, &frame, sizeof(frame));
        if (nbytes < 0)
        {
            std::perror("read");
            break;
        }

        if (frame.can_id >= 0x192 && frame.can_id <= 0x197)
        {
            std::string decoded = decodePDO(frame);
            std::ostringstream output;
            output << currentTimestamp()
                   << "  " << deviceName(frame.can_id)
                   << "  " << decoded;

            std::string line = output.str();
            std::cout << line << "\n";
            logfile << line << "\n";
            logfile.flush();
        }
    }

    close(s);
    logfile.close();
    return 0;
}
