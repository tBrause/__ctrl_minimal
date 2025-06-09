#include <iostream>
#include <cstring>
#include <unistd.h>
#include <net/if.h>
#include <sys/ioctl.h>
#include <sys/socket.h>
#include <linux/can.h>
#include <linux/can/raw.h>

bool sendSDORequest(int s, int node_id, uint16_t index, uint8_t subindex)
{
    struct can_frame frame{};
    frame.can_id = 0x600 + node_id;
    frame.can_dlc = 8;
    frame.data[0] = 0x40; // SDO read
    frame.data[1] = index & 0xFF;
    frame.data[2] = index >> 8;
    frame.data[3] = subindex;
    std::memset(&frame.data[4], 0, 4);

    return write(s, &frame, sizeof(frame)) == sizeof(frame);
}

bool receiveSDOResponse(int s, int node_id, uint32_t &out_value)
{
    struct can_frame frame{};
    fd_set read_fds;
    struct timeval timeout = {1, 0}; // 1 second timeout

    FD_ZERO(&read_fds);
    FD_SET(s, &read_fds);

    int ret = select(s + 1, &read_fds, nullptr, nullptr, &timeout);
    if (ret <= 0)
        return false;

    if (read(s, &frame, sizeof(frame)) <= 0)
        return false;

    if (frame.can_id != 0x580 + node_id)
        return false;

    if (frame.data[0] == 0x80)
    {
        uint16_t err = frame.data[4] | (frame.data[5] << 8);
        std::cerr << "  Fehlerantwort (0x80), Code 0x" << std::hex << err << std::dec << "\n";
        return false;
    }

    if (frame.data[0] == 0x43)
    {
        out_value = frame.data[4] | (frame.data[5] << 8) | (frame.data[6] << 16) | (frame.data[7] << 24);
        return true;
    }

    std::cerr << "  Unerwartete Antwort (Code 0x" << std::hex << static_cast<int>(frame.data[0]) << ")\n";
    return false;
}

int main()
{
    const char *ifname = "can0";
    int s = socket(PF_CAN, SOCK_RAW, CAN_RAW);
    if (s < 0)
    {
        std::perror("Socket");
        return 1;
    }

    struct ifreq ifr{};
    std::strncpy(ifr.ifr_name, ifname, IFNAMSIZ);
    if (ioctl(s, SIOCGIFINDEX, &ifr) < 0)
    {
        std::perror("SIOCGIFINDEX");
        return 1;
    }

    struct sockaddr_can addr{};
    addr.can_family = AF_CAN;
    addr.can_ifindex = ifr.ifr_ifindex;
    if (bind(s, (struct sockaddr *)&addr, sizeof(addr)) < 0)
    {
        std::perror("Bind");
        return 1;
    }

    uint16_t index = 0x6002;
    uint8_t subindices[] = {0x80, 0x81, 0x82};

    for (int node_id = 2; node_id <= 7; ++node_id)
    {
        std::cout << "Node 0x" << std::hex << node_id << std::dec << ":\n";
        for (uint8_t sub : subindices)
        {
            std::cout << "  Abfrage 0x" << std::hex << index << "." << static_cast<int>(sub) << " ... ";

            if (!sendSDORequest(s, node_id, index, sub))
            {
                std::cout << "Fehler beim Senden\n";
                continue;
            }

            uint32_t value = 0;
            if (receiveSDOResponse(s, node_id, value))
            {
                std::cout << "Wert = 0x" << std::hex << value << std::dec << "\n";
            }
            else
            {
                std::cout << "Keine Antwort oder Fehler\n";
            }

            usleep(100000); // kurze Pause
        }
        std::cout << "\n";
    }

    close(s);
    return 0;
}
