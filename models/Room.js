const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema({
    roomNumber: {
        type: String,
        required: true,
        unique: true,
        enum: ['1', '2', '3', '4']
    },
    type: {
        type: String,
        enum: ['General', 'Emergency', 'Isolation', 'Recovery'],
        default: 'General'
    },
    capacity: {
        type: Number,
        default: 4
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

module.exports = mongoose.model("Room", roomSchema);