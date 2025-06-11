#include <iostream>
#include <iomanip>
#include <fstream>
#include <cstring>
#include <cstdlib>
#include <unistd.h>
#include <net/if.h>
#include <sys/socket.h>
#include <sys/ioctl.h>
#include <linux/can.h>
#include <linux/can/raw.h>
#include <ctime>

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

    if (write(s, &frame, sizeof(frame)) != sizeof(frame))
    {
        perror("write");
        return false;
    }

    for (int i = 0; i < 80; ++i)
    {
        struct can_frame resp{};
        int nbytes = read(s, &resp, sizeof(resp));
        if (nbytes < 0)
        {
            perror("read");
            break;
        }
        if (resp.can_id == 0x580 + node_id)
        {
            resp_code = resp.data[0];
            if (resp_code == 0x43 || resp_code == 0x4B || resp_code == 0x47)
            {
                value = resp.data[4] | (resp.data[5] << 8) | (resp.data[6] << 16) | (resp.data[7] << 24);
                usleep(150000);
                return true;
            }
            else if (resp_code == 0x80)
            {
                usleep(150000);
                return false;
            }
        }
        usleep(10000);
    }
    usleep(150000);
    return false;
}

std::string nowTimeString()
{
    std::time_t t = std::time(nullptr);
    char buf[32];
    std::strftime(buf, sizeof(buf), "%Y-%m-%d %H:%M:%S", std::localtime(&t));
    return buf;
}

int main(int argc, char *argv[])
{
    if (argc < 2)
    {
        std::cerr << "Nutzung: " << argv[0] << " NODE_ID" << std::endl;
        return 1;
    }
    int node_id = std::atoi(argv[1]);
    if (node_id <= 0 || node_id > 127)
    {
        std::cerr << "Ungueltige NODE_ID." << std::endl;
        return 1;
    }

    const char *ifname = "can0";
    std::string logfile = "/home/pi/__ctrl_minimal/data/eta" + std::to_string(node_id) + "_sdo_soc_log.txt";

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

    log << "\n--- ETA" << node_id << " Abfrage am " << nowTimeString() << " ---\n";
    std::cout << "\n--- ETA" << node_id << " Abfrage am " << nowTimeString() << " ---\n";

    uint32_t value = 0;
    uint8_t resp_code = 0;
    std::string name = "SOC";
    uint16_t index = 0x6164;
    uint8_t subindex = 0x01;
    double scale = 0.01;
    const char *unit = "%";

    log << name << " (0x" << std::hex << index << ":" << std::dec << (int)subindex << "): ";
    std::cout << "Lese " << name << " (0x" << std::hex << index << ":" << std::dec << (int)subindex << ") ... ";
    if (readSDO(s, node_id, index, subindex, value, resp_code))
    {
        double temp = value * scale;
        log << value << " (raw) = " << std::fixed << std::setprecision(3) << temp << " " << unit << std::endl;
        std::cout << value << " (raw) = " << std::fixed << std::setprecision(3) << temp << " " << unit << std::endl;
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
    log << "\n";
    close(s);
    log.close();
    std::cout << "\nFertig. Ergebnis auch in " << logfile << "\n";
    return 0;
}
