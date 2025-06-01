const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema({
    roomNumber: {
        type: String,
        required: true,
        unique: true,
        enum: ['1', '2', '3', '4', 'Discharge']
    },
    type: {
        type: String,
        enum: ['General', 'Emergency', 'Isolation', 'Recovery', 'Discharge'],
        default: 'General'
    },
    capacity: {
        type: Number,
        default: 100
    },
    currentPatients: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Patient'
    }],
    isOccupied: {
        type: Boolean,
        default: false
    },
    notes: String
});

// Add a static method to ensure fixed room types
roomSchema.statics.setupDefaultRooms = async function() {
    const rooms = [
        { roomNumber: '1', type: 'General', capacity: 100 },
        { roomNumber: '2', type: 'Emergency', capacity: 100 },
        { roomNumber: '3', type: 'Isolation', capacity: 100 },
        { roomNumber: '4', type: 'Recovery', capacity: 100 },
        { roomNumber: 'Discharge', type: 'Discharge', capacity: 1000 }
    ];

    for (const room of rooms) {
        await this.findOneAndUpdate(
            { roomNumber: room.roomNumber },
            { $setOnInsert: room },
            { upsert: true, new: true }
        );
    }
};

const Room = mongoose.model("Room", roomSchema);

// Setup default rooms when the application starts
Room.setupDefaultRooms().catch(console.error);

module.exports = Room;