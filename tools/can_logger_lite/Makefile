# Makefile für can_logger

CXX = g++
CXXFLAGS = -Wall -std=c++11
TARGET = can_logger
SRC = can_logger.cpp

all: $(TARGET)

$(TARGET): $(SRC)
	$(CXX) $(CXXFLAGS) -o $(TARGET) $(SRC)

clean:
	rm -f $(TARGET)
