#include <iostream>
#include <iomanip>
#include <cstring>
#include <cstdlib>
#include <unistd.h>
#include <fcntl.h>
#include <sys/ioctl.h>
#include <linux/can.h>
#include <linux/can/raw.h>
#include <net/if.h>

bool readSDOResponse(int socket, int node_id, uint32_t &device_type)
{
    struct can_frame frame;
    while (read(socket, &frame, sizeof(struct can_frame)) > 0)
    {
        if (frame.can_id == 0x580 + node_id && frame.data[0] == 0x43)
        {
            device_type = frame.data[4] | (frame.data[5] << 8) | (frame.data[6] << 16) | (frame.data[7] << 24);
            return true;
        }
    }
    return false;
}

int main()
{
    struct sockaddr_can addr;
    struct ifreq ifr;
    int s;

    if ((s = socket(PF_CAN, SOCK_RAW, CAN_RAW)) < 0)
    {
        perror("Socket");
        return 1;
    }

    std::strcpy(ifr.ifr_name, "can0");
    ioctl(s, SIOCGIFINDEX, &ifr);

    std::memset(&addr, 0, sizeof(addr));
    addr.can_family = AF_CAN;
    addr.can_ifindex = ifr.ifr_ifindex;

    if (bind(s, (struct sockaddr *)&addr, sizeof(addr)) < 0)
    {
        perror("Bind");
        return 1;
    }

    for (int node_id = 1; node_id <= 6; ++node_id)
    {
        struct can_frame frame;
        frame.can_id = 0x600 + node_id;
        frame.can_dlc = 8;
        frame.data[0] = 0x40; // SDO read command
        frame.data[1] = 0x00; // Index 0x1000 (Device Type)
        frame.data[2] = 0x10;
        frame.data[3] = 0x00; // Subindex 0
        frame.data[4] = 0x00;
        frame.data[5] = 0x00;
        frame.data[6] = 0x00;
        frame.data[7] = 0x00;

        if (write(s, &frame, sizeof(frame)) != sizeof(frame))
        {
            perror("Write");
            continue;
        }

        usleep(100000); // 100 ms

        uint32_t device_type = 0;
        if (readSDOResponse(s, node_id, device_type))
        {
            std::cout << "Node 0x" << std::hex << node_id
                      << " → Device Type: 0x" << std::setw(8) << std::setfill('0')
                      << device_type << std::dec << "\n";
        }
        else
        {
            std::cout << "Node 0x" << std::hex << node_id
                      << " → keine Antwort\n"
                      << std::dec;
        }
    }

    close(s);
    return 0;
}
