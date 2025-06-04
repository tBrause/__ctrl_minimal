#include <iostream>
#include <iomanip>
#include <cstring>
#include <set>

#include <net/if.h>
#include <sys/ioctl.h>
#include <sys/socket.h>
#include <linux/can.h>
#include <linux/can/raw.h>
#include <unistd.h>

int main()
{
    // CAN-ID Filter aus der Lite-Liste
    std::set<uint32_t> lite_ids = {
        0x292, 0x293, 0x294, 0x295, 0x296, 0x297, 0x298,
        0x299, 0x29A, 0x29B, 0x29C, 0x29D, 0x29E, 0x29F};

    struct ifreq ifr;
    struct sockaddr_can addr;
    struct can_frame frame;
    int s;

    // Raw Socket öffnen
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

    std::cout << "Starte CAN-Logger (nur Lite-IDs)\n";

    while (true)
    {
        int nbytes = read(s, &frame, sizeof(struct can_frame));

        if (nbytes > 0)
        {
            if (lite_ids.count(frame.can_id))
            {
                std::cout << "ID=0x" << std::hex << std::uppercase << frame.can_id
                          << " DLC=" << std::dec << (int)frame.can_dlc
                          << " DATA= ";
                for (int i = 0; i < frame.can_dlc; i++)
                {
                    std::cout << std::hex << std::setw(2) << std::setfill('0')
                              << (int)frame.data[i] << " ";
                }
                std::cout << std::dec << "\n";
            }
        }
    }

    close(s);
    return 0;
}
