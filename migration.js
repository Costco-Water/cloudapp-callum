const mongoose = require("mongoose");
const Room = require("./models/Room"); // Fix the path to be relative

mongoose.connect("mongodb://20.0.153.128:10999/callumDB")
    .then(async () => {
        try {
            // Clear existing rooms
            await Room.deleteMany({});

            // Create fixed rooms
            const rooms = [
                { roomNumber: '1', type: 'General', capacity: 4 },
                { roomNumber: '2', type: 'Emergency', capacity: 4 },
                { roomNumber: '3', type: 'Isolation', capacity: 4 },
                { roomNumber: '4', type: 'Recovery', capacity: 4 }
            ];

            await Room.insertMany(rooms);
            console.log("Initial rooms created successfully");
            process.exit(0);
        } catch (error) {
            console.error("Error setting up rooms:", error);
            process.exit(1);
        }
    });