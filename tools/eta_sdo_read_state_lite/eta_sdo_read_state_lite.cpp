#include <iostream>
#include <iomanip>
#include <fstream>
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
#include <sqlite3.h>

// Zeitstempel für DB
std::string nowTimeString()
{
    std::time_t t = std::time(nullptr);
    char buf[32];
    std::strftime(buf, sizeof(buf), "%Y-%m-%d %H:%M:%S", std::localtime(&t));
    return buf;
}

// ETA-Status in Klartext
std::string stateToText(uint32_t state)
{
    switch (state)
    {
    case 0x8080:
        return "8080";
    case 0x80C0:
        return "80c0";
    case 0x8040:
        return "8040";
    case 0x4040:
        return "4040";
    default:
    {
        std::ostringstream oss;
        oss << "Unbekannt (0x" << std::hex << std::setw(4) << std::setfill('0') << state << ")";
        return oss.str();
    }
    }
}

// SQLite-Log
void insertStateToDB(const std::string &dbfile, int node_id, uint32_t state, int index, int subindex)
{
    sqlite3 *db;
    char *errMsg = nullptr;
    int rc = sqlite3_open(dbfile.c_str(), &db);
    if (rc)
    {
        std::cerr << "Kann Datenbank nicht öffnen: " << sqlite3_errmsg(db) << std::endl;
        return;
    }
    std::string create_sql =
        "CREATE TABLE IF NOT EXISTS state_log ("
        "id INTEGER PRIMARY KEY AUTOINCREMENT,"
        "node_id INTEGER,"
        "state_raw INTEGER,"
        "state_txt TEXT,"
        "od_index INTEGER,"
        "od_subindex INTEGER,"
        "timestamp TEXT"
        ");";
    rc = sqlite3_exec(db, create_sql.c_str(), 0, 0, &errMsg);
    if (rc != SQLITE_OK)
    {
        std::cerr << "Fehler beim Anlegen der Tabelle: " << errMsg << std::endl;
        sqlite3_free(errMsg);
        sqlite3_close(db);
        return;
    }
    std::ostringstream oss;
    oss << "INSERT INTO state_log (node_id, state_raw, state_txt, od_index, od_subindex, timestamp) VALUES ("
        << node_id << ","
        << state << ","
        << "'" << stateToText(state) << "',"
        << index << ","
        << subindex << ","
        << "'" << nowTimeString() << "'"
        << ");";
    rc = sqlite3_exec(db, oss.str().c_str(), 0, 0, &errMsg);
    if (rc != SQLITE_OK)
    {
        std::cerr << "Fehler beim Einfügen in DB: " << errMsg << std::endl;
        sqlite3_free(errMsg);
    }
    sqlite3_close(db);
}

// SDO-Read
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
                usleep(150000);
                return true;
            }
            else if (resp_code == 0x80)
            {
                usleep(150000);
                return false;
            }
        }
        usleep(10000);
    }
    usleep(150000);
    return false;
}

int main(int argc, char *argv[])
{
    if (argc < 2)
    {
        std::cerr << "Nutzung: " << argv[0] << " NODE_ID" << std::endl;
        return 1;
    }
    int node_id = std::atoi(argv[1]);
    const char *ifname = "can0";
    std::string dbfile = "/home/pi/__ctrl_minimal/data/can.db";
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

    uint32_t value = 0;
    uint8_t resp_code = 0;

    std::cout << "\n--- ETA-State-Abfrage am " << nowTimeString() << " ---" << std::endl;
    std::cout << "NodeID: " << node_id << ", Index: 0x" << std::hex << index << ", Subindex: 0x" << std::hex << (int)subindex << std::dec << std::endl;

    if (readSDO(s, node_id, index, subindex, value, resp_code))
    {
        std::cout << "ETA State: 0x" << std::hex << value << std::dec << " = " << stateToText(value) << std::endl;
        insertStateToDB(dbfile, node_id, value, index, subindex);
        std::cout << "In DB geschrieben: " << dbfile << std::endl;
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
