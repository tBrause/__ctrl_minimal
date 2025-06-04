#include <iostream>
#include <iomanip>
#include <cstring>
#include <set>
#include <linux/can.h>
#include <linux/can/raw.h>
#include <net/if.h>
#include <sys/ioctl.h>
#include <sys/socket.h>
#include <unistd.h>

// Helfer für Little-Endian-Interpretation
uint32_t bytes_to_u32(const uint8_t *data)
{
    return (uint32_t)data[0] |
           ((uint32_t)data[1] << 8) |
           ((uint32_t)data[2] << 16) |
           ((uint32_t)data[3] << 24);
}

int main()
{
    struct ifreq ifr;
    struct sockaddr_can addr;
    struct can_frame frame;
    int s;

    if ((s = socket(PF_CAN, SOCK_RAW, CAN_RAW)) < 0)
    {
        perror("socket");
        return 1;
    }

    strcpy(ifr.ifr_name, "can0");
    ioctl(s, SIOCGIFINDEX, &ifr);

    addr.can_family = AF_CAN;
    addr.can_ifindex = ifr.ifr_ifindex;

    if (bind(s, (struct sockaddr *)&addr, sizeof(addr)) < 0)
    {
        perror("bind");
        return 1;
    }

    std::cout << "Starte CAN-Logger mit Objektfilter auf 0x1000 (Device Type)\n";

    while (true)
    {
        int nbytes = read(s, &frame, sizeof(struct can_frame));

        if (nbytes > 0 && frame.can_dlc >= 8)
        {
            // Prüfen, ob es ein SDO-Response ist (z. B. CAN-ID 0x580 = Server -> Client)
            if ((frame.can_id & 0xFF0) == 0x580)
            {
                // Index extrahieren aus Byte 1 & 2 (SDO-Format)
                uint16_t index = frame.data[1] | (frame.data[2] << 8);

                if (index == 0x1000)
                {
                    // Device Type auslesen (Byte 4-7)
                    uint32_t devType = bytes_to_u32(&frame.data[4]);

                    std::cout << "[0x1000] Device Type: " << devType << "\n";
                }
            }
        }
    }

    close(s);
    return 0;
}
