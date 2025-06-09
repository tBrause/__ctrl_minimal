#include <iostream>
#include <fstream>
#include <iomanip>
#include <sstream>
#include <cstring>
#include <ctime>
#include <unistd.h>
#include <net/if.h>
#include <sys/socket.h>
#include <sys/ioctl.h>
#include <linux/can.h>
#include <linux/can/raw.h>

bool isPDO(uint32_t can_id)
{
    return (can_id >= 0x190 && can_id <= 0x1FF);
}

std::string currentTimestamp()
{
    std::time_t now = std::time(nullptr);
    char buf[20];
    std::strftime(buf, sizeof(buf), "%F %T", std::localtime(&now));
    return std::string(buf);
}

std::string decodePDO(const can_frame &frame)
{
    if (frame.can_dlc < 8)
        return "Unvollständiger Frame";

    uint16_t status = frame.data[1] << 8 | frame.data[0];
    uint16_t voltage_raw = frame.data[3] << 8 | frame.data[2];
    uint16_t temp_raw = frame.data[5] << 8 | frame.data[4];
    uint16_t counter = frame.data[7] << 8 | frame.data[6];

    // Angepasste Skalierungsfaktoren basierend auf deinem Beispiel
    double voltage = voltage_raw / 122.0;  // z. B. 6498 → ~53.2 V
    double temperature = temp_raw / 185.0; // z. B. 6500 → ~35.1 °C

    std::ostringstream oss;
    oss << "Status: 0x" << std::hex << std::setw(4) << std::setfill('0') << status
        << ", Spannung: " << std::fixed << std::setprecision(2) << voltage << " V"
        << ", Temperatur: " << std::fixed << std::setprecision(1) << temperature << " °C"
        << ", Zähler: " << std::dec << counter
        << " (Raw: V=" << voltage_raw << ", T=" << temp_raw << ")";
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

    std::cout << "Starte PDO-Decoder (IDs 0x190–0x1FF), Ausgabe in " << logfile_name << "\n";

    struct can_frame frame;
    while (true)
    {
        int nbytes = read(s, &frame, sizeof(frame));
        if (nbytes < 0)
        {
            std::perror("read");
            break;
        }

        if (isPDO(frame.can_id))
        {
            std::string decoded = decodePDO(frame);
            std::ostringstream output;
            output << currentTimestamp()
                   << "  ID: 0x" << std::hex << std::setw(3) << std::setfill('0') << frame.can_id
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
