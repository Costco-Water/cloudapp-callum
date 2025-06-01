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
    currentPatient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Patient',
        default: null
    },
    notes: String
});

module.exports = mongoose.model("Room", roomSchema);