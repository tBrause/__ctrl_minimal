#!/bin/sh

sudo ip link set can0 down
sudo ip link set can0 type can bitrate 250000
sudo ip link set can0 up
sudo ifconfig can0 txqueuelen 200
sudo ifconfig can0 up

LOG='/home/'$USER'/data/'

if [ ! -d "$LOG" ]; then
mkdir -p "$LOG"
fi

cd '/home/'$USER'/execute'

if [ ! -x "emsc2.0.9.12" ]; then
sudo chmod +x emsc2.0.9.12
exit 1
fi

sudo ./emsc2.0.9.12 -t 0 -D can0 -p 5555 >$LOG'emsc.log' &

exit 0
