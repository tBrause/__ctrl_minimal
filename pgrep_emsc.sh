#!/bin/bash

# Anwendung "EnergyEMSC" beenden, falls sie laeuft
ENERGYEMSC_PIDS=$(pgrep -f emsc2.0.9.12)

if [ -n "$ENERGYEMSC_PIDS" ]; then
echo "PIDs: $ENERGYEMSC_PIDS"
sleep 2
else
echo "EnergyEMSC laeuft nicht oder wurde bereits beendet"
fi


exit 0
