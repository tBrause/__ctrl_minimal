#!/bin/bash

# Kill the EMSC process if it is running
if pgrep -x "emsc2.0.9.12" > /dev/null; then
echo "Killing EMSC process..."
pkill -f "emsc2.0.9.12"
else
echo "EMSC process is not running."
fi

exit 0