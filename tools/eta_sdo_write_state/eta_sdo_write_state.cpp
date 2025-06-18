#include <iostream>
#include <cstring>
#include <cstdlib>
#include <unistd.h>
#include <net/if.h>
#include <sys/socket.h>
#include <sys/ioctl.h>
#include <linux/can.h>
#include <linux/can/raw.h>

int main(int argc, char *argv[])
{
    if (argc < 3)
    {
        std::cerr << "Nutzung: " << argv[0] << " NODE_ID STATE_HEX" << std::endl;
        std::cerr << "Beispiel: " << argv[0] << " 2 8080" << std::endl;
        return 1;
    }
    int node_id = std::atoi(argv[1]);
    uint32_t value = std::strtoul(argv[2], nullptr, 16);

    const char *ifname = "can0";
    uint16_t index = 0x6002;
    uint8_t subindex = 0x01;

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

    struct can_frame frame{};
    frame.can_id = 0x600 + node_id;
    frame.can_dlc = 8;
    frame.data[0] = 0x23; // Write 4 bytes
    frame.data[1] = index & 0xFF;
    frame.data[2] = (index >> 8) & 0xFF;
    frame.data[3] = subindex;
    frame.data[4] = value & 0xFF;
    frame.data[5] = (value >> 8) & 0xFF;
    frame.data[6] = (value >> 16) & 0xFF;
    frame.data[7] = (value >> 24) & 0xFF;

    if (write(s, &frame, sizeof(frame)) != sizeof(frame))
    {
        perror("write");
        return 1;
    }
    std::cout << "SDO-Write gesendet an Node " << node_id << ": State 0x" << std::hex << value << std::endl;

    close(s);
    return 0;
}
