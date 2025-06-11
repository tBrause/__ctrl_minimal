#include <iostream>
#include <iomanip>
#include <cstring>
#include <unistd.h>
#include <net/if.h>
#include <sys/socket.h>
#include <sys/ioctl.h>
#include <linux/can.h>
#include <linux/can/raw.h>

// Liest einen 4-Byte-Wert via SDO von ETA2, Objekt 0x6039:1
int main()
{
    const char *ifname = "can0";
    int node_id = 2; // ETA2
    uint16_t index = 0x6039;
    uint8_t subindex = 1;

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

    // SDO-Request-Frame an ETA2 (0x600 + NodeID)
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
        return 1;
    }

    std::cout << "SDO-Request an Node 0x" << std::hex << node_id << " (0x6039:1) gesendet. Warte auf Antwort..." << std::endl;

    // Antwort lesen (auf CAN-ID 0x580 + NodeID)
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
            if (resp.data[0] == 0x43 || resp.data[0] == 0x4B || resp.data[0] == 0x47)
            { // 4-Byte/2-Byte/1-Byte Response
                uint32_t value = resp.data[4] | (resp.data[5] << 8) | (resp.data[6] << 16) | (resp.data[7] << 24);
                std::cout << "Antwort: act. external voltage (0x6039:1) = " << value << " (raw)" << std::endl;
                std::cout << std::fixed << std::setprecision(3)
                          << "Umgerechnet: " << value / 1000.0 << " V" << std::endl;
                close(s);
                return 0;
            }
            else if (resp.data[0] == 0x80)
            {
                std::cout << "Fehlerantwort: Kein Zugriff oder Objekt nicht vorhanden." << std::endl;
                close(s);
                return 2;
            }
            else
            {
                std::cout << "Unerwartete SDO-Antwort: ";
                for (int j = 0; j < resp.can_dlc; ++j)
                    std::cout << std::hex << std::setw(2) << std::setfill('0') << (int)resp.data[j] << " ";
                std::cout << std::endl;
            }
        }
        usleep(10000); // 10 ms Pause
    }

    std::cout << "Timeout - keine Antwort erhalten." << std::endl;
    close(s);
    return 1;
}
