#include <iostream>
#include <iomanip>
#include <cstring>
#include <unistd.h>
#include <net/if.h>
#include <sys/socket.h>
#include <sys/ioctl.h>
#include <linux/can.h>
#include <linux/can/raw.h>

bool readSDO(int s, int node_id, uint16_t index, uint8_t subindex, uint32_t &value, uint8_t &resp_code)
{
    struct can_frame frame{};
    frame.can_id = 0x600 + node_id;
    frame.can_dlc = 8;
    frame.data[0] = 0x40; // SDO read
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

    // Antwort lesen (max 50 Versuche)
    for (int i = 0; i < 50; ++i)
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
                // Wert zusammenbauen (4, 2 oder 1 Byte)
                value = resp.data[4] | (resp.data[5] << 8) | (resp.data[6] << 16) | (resp.data[7] << 24);
                return true;
            }
            else if (resp_code == 0x80)
            {
                // Fehlerantwort
                return false;
            }
        }
        usleep(10000); // 10 ms
    }
    return false;
}

int main()
{
    const char *ifname = "can0";
    int node_id = 2; // ETA2

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
    };

    for (auto &req : abfragen)
    {
        uint32_t value = 0;
        uint8_t resp_code = 0;
        std::cout << "Lese " << req.name << " (0x" << std::hex << req.index << ":" << std::dec << (int)req.subindex << ") ... ";
        if (readSDO(s, node_id, req.index, req.subindex, value, resp_code))
        {
            if (req.signed_val)
            {
                int32_t sval = static_cast<int32_t>(value);
                // ggf. für 16-Bit Werte anpassen
                if (req.scale != 1.0 && value <= 0xFFFF)
                    sval = static_cast<int16_t>(value);
                std::cout << sval << " (raw)";
                if (req.scale != 1.0)
                    std::cout << " = " << std::fixed << std::setprecision(3) << sval * req.scale << " " << req.unit;
                std::cout << std::endl;
            }
            else
            {
                std::cout << value << " (raw)";
                if (req.scale != 1.0)
                    std::cout << " = " << std::fixed << std::setprecision(3) << value * req.scale << " " << req.unit;
                std::cout << std::endl;
            }
        }
        else
        {
            if (resp_code == 0x80)
                std::cout << "Fehler: Kein Zugriff oder Objekt nicht vorhanden." << std::endl;
            else
                std::cout << "Keine Antwort oder Timeout!" << std::endl;
        }
    }

    close(s);
    return 0;
}
