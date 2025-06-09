#include <iostream>
#include <fstream>
#include <iomanip>
#include <sstream>
#include <cstring>
#include <unistd.h>
#include <net/if.h>
#include <sys/socket.h>
#include <sys/ioctl.h>
#include <linux/can.h>
#include <linux/can/raw.h>
#include <ctime>

bool isPDO(uint32_t can_id)
{
    return (can_id >= 0x190 && can_id <= 0x1FF);
}

std::string currentTimestamp()
{
    std::time_t now = std::time(nullptr);
    char buf[20];
    std::strftime(buf, sizeof(buf), "%F %T", std::localtime(&now));
    return std::string(buf);
}

int main()
{
    const char *ifname = "can0";
    const char *logfile_name = "pdo_log.txt";

    std::ofstream logfile(logfile_name, std::ios::app);
    if (!logfile)
    {
        std::cerr << "Fehler beim Oeffnen der Logdatei\n";
        return 1;
    }

    int s = socket(PF_CAN, SOCK_RAW, CAN_RAW);
    if (s < 0)
    {
        std::perror("Socket");
        return 1;
    }

    struct ifreq ifr{};
    std::strncpy(ifr.ifr_name, ifname, IFNAMSIZ - 1);
    if (ioctl(s, SIOCGIFINDEX, &ifr) < 0)
    {
        std::perror("ioctl");
        return 1;
    }

    struct sockaddr_can addr{};
    addr.can_family = AF_CAN;
    addr.can_ifindex = ifr.ifr_ifindex;
    if (bind(s, (struct sockaddr *)&addr, sizeof(addr)) < 0)
    {
        std::perror("bind");
        return 1;
    }

    std::cout << "Starte PDO-Logger (IDs 0x190–0x1FF), logge nach " << logfile_name << " ...\n";

    struct can_frame frame;
    while (true)
    {
        int nbytes = read(s, &frame, sizeof(frame));
        if (nbytes < 0)
        {
            std::perror("read");
            break;
        }

        if (isPDO(frame.can_id))
        {
            std::ostringstream oss;
            oss << currentTimestamp()
                << "  ID: 0x" << std::hex << std::setw(3) << std::setfill('0') << frame.can_id
                << "  DATA:";
            for (int i = 0; i < frame.can_dlc; ++i)
            {
                oss << " " << std::hex << std::setw(2) << std::setfill('0') << (int)frame.data[i];
            }

            std::string line = oss.str();
            std::cout << line << "\n";
            logfile << line << "\n";
            logfile.flush();
        }
    }

    close(s);
    logfile.close();
    return 0;
}
