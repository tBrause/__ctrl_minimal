#include <iostream>
#include <iomanip>
#include <cstring>
#include <cstdlib>
#include <sstream>
#include <unistd.h>
#include <net/if.h>
#include <sys/socket.h>
#include <sys/ioctl.h>
#include <linux/can.h>
#include <linux/can/raw.h>
#include <ctime>

// NMT-Befehl senden (command = 0x01=Op, 0x80=Pre-Op, 0x02=Stop, 0x81=Reset)
bool sendNMT(int node_id, uint8_t command)
{
    int s = socket(PF_CAN, SOCK_RAW, CAN_RAW);
    if (s < 0)
    {
        perror("Socket");
        return false;
    }
    struct ifreq ifr{};
    strcpy(ifr.ifr_name, "can0");
    if (ioctl(s, SIOCGIFINDEX, &ifr) < 0)
    {
        perror("ioctl");
        close(s);
        return false;
    }
    struct sockaddr_can addr{};
    addr.can_family = AF_CAN;
    addr.can_ifindex = ifr.ifr_ifindex;
    if (bind(s, (struct sockaddr *)&addr, sizeof(addr)) < 0)
    {
        perror("bind");
        close(s);
        return false;
    }

    struct can_frame frame{};
    frame.can_id = 0x000;
    frame.can_dlc = 2;
    frame.data[0] = command;
    frame.data[1] = node_id;

    if (write(s, &frame, sizeof(frame)) != sizeof(frame))
    {
        perror("write");
        close(s);
        return false;
    }
    close(s);
    return true;
}

// SDO-Read (wie gehabt)
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
            if (resp_code == 0x4B || resp_code == 0x43 || resp_code == 0x47)
            {
                value = resp.data[4] | (resp.data[5] << 8) | (resp.data[6] << 16) | (resp.data[7] << 24);
                return true;
            }
            else if (resp_code == 0x80)
            {
                return false;
            }
        }
        usleep(10000);
    }
    return false;
}

std::string stateToText(uint32_t state)
{
    switch (state)
    {
    case 0x8080:
        return "Ready-to-Attach";
    case 0x80C0:
        return "Normal Operation";
    case 0x8040:
        return "Do-Not-Attach";
    case 0x4040:
        return "Comp. Check / Do-Not-Attach";
    default:
    {
        std::ostringstream oss;
        oss << "Unbekannt (0x" << std::hex << std::setw(4) << std::setfill('0') << state << ")";
        return oss.str();
    }
    }
}

int main(int argc, char *argv[])
{
    if (argc < 3)
    {
        std::cerr << "Nutzung: " << argv[0] << " NODE_ID NMT_COMMAND_HEX\n";
        std::cerr << "COMMANDS: 01=Op, 80=PreOp, 02=Stop, 81=Reset\n";
        std::cerr << "Beispiel: " << argv[0] << " 3 80\n";
        return 1;
    }
    int node_id = std::atoi(argv[1]);
    int nmt_cmd = (int)strtol(argv[2], nullptr, 16);

    std::cout << "--- Sende NMT 0x" << std::hex << nmt_cmd << " an Node " << std::dec << node_id << " ---\n";
    if (!sendNMT(node_id, (uint8_t)nmt_cmd))
    {
        std::cerr << "Fehler beim Senden des NMT-Kommandos!\n";
        return 1;
    }
    usleep(400000); // 400ms warten

    // SDO-Read vorbereiten
    int s = socket(PF_CAN, SOCK_RAW, CAN_RAW);
    if (s < 0)
    {
        perror("Socket");
        return 1;
    }
    struct ifreq ifr{};
    strcpy(ifr.ifr_name, "can0");
    if (ioctl(s, SIOCGIFINDEX, &ifr) < 0)
    {
        perror("ioctl");
        close(s);
        return 1;
    }
    struct sockaddr_can addr{};
    addr.can_family = AF_CAN;
    addr.can_ifindex = ifr.ifr_ifindex;
    if (bind(s, (struct sockaddr *)&addr, sizeof(addr)) < 0)
    {
        perror("bind");
        close(s);
        return 1;
    }

    uint32_t value = 0;
    uint8_t resp_code = 0;
    std::cout << "Lese State (0x6002:1) ..." << std::endl;
    if (readSDO(s, node_id, 0x6002, 0x01, value, resp_code))
    {
        std::cout << "ETA State: 0x" << std::hex << value << std::dec << " = " << stateToText(value) << std::endl;
    }
    else
    {
        if (resp_code == 0x80)
            std::cout << "Fehler: Kein Zugriff oder Objekt nicht vorhanden." << std::endl;
        else
            std::cout << "Keine Antwort oder Timeout!" << std::endl;
    }
    close(s);
    return 0;
}
