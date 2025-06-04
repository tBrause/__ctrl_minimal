#include <iostream>
#include <vector>
#include <string>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <unistd.h>
#include <linux/can.h>
#include <linux/can/raw.h>
#include <sys/socket.h>
#include <net/if.h>
#include <sys/ioctl.h>
#include <fcntl.h>

struct SDOObject
{
    uint16_t index;
    uint8_t subindex;
    std::string description;
    enum
    {
        UNSIGNED8,
        UNSIGNED32
    } type;
};

const std::vector<SDOObject> sdoObjects = {
    {0x1000, 0x00, "Device Type", SDOObject::UNSIGNED32},
    {0x1001, 0x00, "Error Register", SDOObject::UNSIGNED8},
    {0x1018, 0x01, "Vendor ID", SDOObject::UNSIGNED32},
    {0x1018, 0x02, "Product Code", SDOObject::UNSIGNED32},
    {0x1018, 0x03, "Revision Number", SDOObject::UNSIGNED32},
    {0x1018, 0x04, "Serial Number", SDOObject::UNSIGNED32},
};

int openCANSocket(const char *ifname)
{
    int s = socket(PF_CAN, SOCK_RAW, CAN_RAW);
    if (s < 0)
    {
        perror("Socket");
        return -1;
    }
    struct ifreq ifr;
    std::strncpy(ifr.ifr_name, ifname, IFNAMSIZ);
    ifr.ifr_name[IFNAMSIZ - 1] = '\0';
    if (ioctl(s, SIOCGIFINDEX, &ifr) < 0)
    {
        perror("ioctl");
        close(s);
        return -1;
    }
    struct sockaddr_can addr{};
    addr.can_family = AF_CAN;
    addr.can_ifindex = ifr.ifr_ifindex;
    if (bind(s, (struct sockaddr *)&addr, sizeof(addr)) < 0)
    {
        perror("bind");
        close(s);
        return -1;
    }
    // Set nonblocking for reading responses
    int flags = fcntl(s, F_GETFL, 0);
    fcntl(s, F_SETFL, flags | O_NONBLOCK);
    return s;
}

bool sendSDORequest(int s, uint8_t node_id, uint16_t index, uint8_t subindex)
{
    struct can_frame frame{};
    frame.can_id = 0x600 + node_id; // SDO client -> server
    frame.can_dlc = 8;
    frame.data[0] = 0x40; // SDO read request
    frame.data[1] = index & 0xFF;
    frame.data[2] = (index >> 8) & 0xFF;
    frame.data[3] = subindex;
    std::fill(frame.data + 4, frame.data + 8, 0x00);
    int nbytes = write(s, &frame, sizeof(frame));
    return nbytes == sizeof(frame);
}

bool readSDOResponse(int s, uint8_t node_id, uint32_t &value, int timeout_ms = 200)
{
    fd_set readset;
    struct timeval tv;
    tv.tv_sec = 0;
    tv.tv_usec = timeout_ms * 1000;

    FD_ZERO(&readset);
    FD_SET(s, &readset);

    int rv = select(s + 1, &readset, NULL, NULL, &tv);
    if (rv <= 0)
        return false; // Timeout or error

    struct can_frame frame{};
    int nbytes = read(s, &frame, sizeof(frame));
    if (nbytes < (int)sizeof(struct can_frame))
        return false;

    // Check if response ID and command specifier match SDO response for node
    if (frame.can_id == (0x580 + node_id) && (frame.data[0] & 0xE0) == 0x40)
    {
        // Confirm success response: 0x43 = expedited 4-byte response
        if (frame.data[0] == 0x43)
        {
            value = frame.data[4] | (frame.data[5] << 8) | (frame.data[6] << 16) | (frame.data[7] << 24);
            return true;
        }
        // Could handle other SDO response types here if needed
    }
    return false;
}

int main()
{
    const char *can_iface = "can0";
    int socket_fd = openCANSocket(can_iface);
    if (socket_fd < 0)
        return 1;

    const std::vector<uint8_t> node_ids = {2, 3, 4, 5, 6, 7};

    std::cout << "Starte SDO-Scan auf Interface " << can_iface << "\n";

    for (uint8_t node_id : node_ids)
    {
        std::cout << "\nNode 0x" << std::hex << int(node_id) << std::dec << ":\n";

        for (const auto &obj : sdoObjects)
        {
            if (!sendSDORequest(socket_fd, node_id, obj.index, obj.subindex))
            {
                std::cerr << " Fehler beim Senden der Anfrage an Node 0x" << std::hex << int(node_id) << std::dec << "\n";
                continue;
            }
            uint32_t value = 0;
            if (readSDOResponse(socket_fd, node_id, value))
            {
                std::cout << "  " << obj.description << " (0x" << std::hex << obj.index << "." << int(obj.subindex) << "): ";
                if (obj.type == SDOObject::UNSIGNED8)
                {
                    std::cout << (value & 0xFF) << "\n";
                }
                else
                {
                    std::cout << "0x" << std::hex << value << std::dec << "\n";
                }
            }
            else
            {
                std::cout << "  " << obj.description << " (0x" << std::hex << obj.index << "." << int(obj.subindex) << "): "
                          << "Keine Antwort / Fehler\n";
            }
            usleep(200 * 1000); // 200 ms Pause zwischen Anfragen, um Bus nicht zu überlasten
        }
    }
    close(socket_fd);
    return 0;
}
