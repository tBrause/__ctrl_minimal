#include <iostream>
#include <cstring>
#include <cstdlib>
#include <unistd.h>
#include <sys/types.h>
#include <sys/socket.h>
#include <sys/ioctl.h>
#include <linux/can.h>
#include <linux/can/raw.h>
#include <net/if.h>
#include <chrono>

bool sendSDORequest(int sock, int node_id, uint16_t index, uint8_t subindex)
{
    struct can_frame frame{};
    frame.can_id = 0x600 + node_id;
    frame.can_dlc = 8;
    frame.data[0] = 0x40; // SDO read
    frame.data[1] = index & 0xFF;
    frame.data[2] = index >> 8;
    frame.data[3] = subindex;
    memset(&frame.data[4], 0, 4);

    int result = write(sock, &frame, sizeof(frame));
    return (result == sizeof(frame));
}

bool readSDOResponse(int sock, int node_id, uint32_t &value)
{
    struct can_frame frame;
    auto start = std::chrono::steady_clock::now();

    while (true)
    {
        int nbytes = read(sock, &frame, sizeof(frame));
        if (nbytes > 0)
        {
            if (frame.can_id == 0x580 + node_id && frame.data[0] == 0x43)
            {
                value = frame.data[4] |
                        (frame.data[5] << 8) |
                        (frame.data[6] << 16) |
                        (frame.data[7] << 24);
                return true;
            }
        }

        auto now = std::chrono::steady_clock::now();
        if (std::chrono::duration_cast<std::chrono::milliseconds>(now - start).count() > 500)
        {
            return false;
        }
    }
}

int main()
{
    int sock;
    struct sockaddr_can addr{};
    struct ifreq ifr{};

    sock = socket(PF_CAN, SOCK_RAW, CAN_RAW);
    if (sock < 0)
    {
        perror("socket");
        return 1;
    }

    strcpy(ifr.ifr_name, "can0");
    if (ioctl(sock, SIOCGIFINDEX, &ifr) < 0)
    {
        perror("ioctl");
        return 1;
    }

    addr.can_family = AF_CAN;
    addr.can_ifindex = ifr.ifr_ifindex;

    struct timeval timeout = {0, 300000}; // 300 ms
    setsockopt(sock, SOL_SOCKET, SO_RCVTIMEO, &timeout, sizeof(timeout));

    if (bind(sock, (struct sockaddr *)&addr, sizeof(addr)) < 0)
    {
        perror("bind");
        return 1;
    }

    const int nodes[] = {2, 3, 4, 5, 6};
    const uint16_t index = 0x6002;
    const uint8_t subindices[] = {0x80, 0x81}; // ET1, ET2

    for (int node : nodes)
    {
        std::cout << "Node 0x" << std::hex << node << ":\n";

        for (uint8_t sub : subindices)
        {
            std::cout << "  Abfrage 0x" << std::hex << index
                      << "." << (int)sub << " ... ";

            if (!sendSDORequest(sock, node, index, sub))
            {
                std::cout << "Fehler beim Senden der Anfrage\n";
                continue;
            }

            uint32_t value = 0;
            if (readSDOResponse(sock, node, value))
            {
                std::cout << "Wert: 0x" << std::hex << value << "\n";
            }
            else
            {
                std::cout << "Keine Antwort oder Timeout\n";
            }
        }
        std::cout << std::endl;
    }

    close(sock);
    return 0;
}
