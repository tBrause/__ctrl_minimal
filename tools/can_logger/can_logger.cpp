#include <iostream>
#include <iomanip>
#include <cstring>
#include <csignal>
#include <unistd.h>
#include <net/if.h>
#include <sys/ioctl.h>
#include <sys/socket.h>
#include <linux/can.h>
#include <linux/can/raw.h>

bool keepRunning = true;

void signalHandler(int)
{
    keepRunning = false;
}

int main()
{
    signal(SIGINT, signalHandler); // Ctrl+C beenden

    const char *canInterface = "can0";
    int sockfd = socket(PF_CAN, SOCK_RAW, CAN_RAW);
    if (sockfd < 0)
    {
        perror("Socket");
        return 1;
    }

    struct ifreq ifr{};
    std::strncpy(ifr.ifr_name, canInterface, IFNAMSIZ - 1);
    if (ioctl(sockfd, SIOCGIFINDEX, &ifr) < 0)
    {
        perror("ioctl");
        return 1;
    }

    struct sockaddr_can addr{};
    addr.can_family = AF_CAN;
    addr.can_ifindex = ifr.ifr_ifindex;

    if (bind(sockfd, (struct sockaddr *)&addr, sizeof(addr)) < 0)
    {
        perror("Bind");
        return 1;
    }

    std::cout << "Lausche auf " << canInterface << " ... (Ctrl+C zum Beenden)\n";

    struct can_frame frame;
    while (keepRunning)
    {
        ssize_t nbytes = read(sockfd, &frame, sizeof(struct can_frame));
        if (nbytes < 0)
        {
            perror("Read");
            break;
        }

        std::cout << "ID=0x" << std::hex << std::setw(3) << std::setfill('0') << frame.can_id
                  << " DLC=" << std::dec << (int)frame.can_dlc << " DATA=";

        for (int i = 0; i < frame.can_dlc; ++i)
            std::cout << " " << std::hex << std::setw(2) << std::setfill('0') << (int)frame.data[i];

        std::cout << std::dec << std::endl;
    }

    close(sockfd);
    std::cout << "Beendet.\n";
    return 0;
}
