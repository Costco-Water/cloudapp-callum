const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema({
    roomNumber: {
        type: String,
        required: true,
        unique: true
    },
    type: {
        type: String,
        enum: ['General', 'Emergency', 'Isolation', 'Recovery'],
        default: 'General'
    },
    capacity: {
        type: Number,
        default: 1
    },
    isOccupied: {
        type: Boolean,
        default: false
    },
    currentPatients: [{  // Change this to an array
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Patient'
    }],
    notes: String
});

module.exports = mongoose.model("Room", roomSchema);