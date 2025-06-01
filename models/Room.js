const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema({
    roomNumber: {
        type: String,
        required: true,
        unique: true
    },
    type: {
        type: String,
        enum: ['General', 'Emergency', 'Isolation', 'Recovery', 'Discharge'],
        required: true
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

roomSchema.statics.setupDefaultRooms = async function() {
    try {
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
                room,
                { upsert: true, new: true }
            );
        }
        console.log('Default rooms setup completed');
    } catch (error) {
        console.error('Error setting up default rooms:', error);
    }
};

const Room = mongoose.model("Room", roomSchema);

// Setup default rooms with error handling
Room.setupDefaultRooms().catch(console.error);

module.exports = Room;