const mongoose = require("mongoose");

const patientSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: true
    },
    lastName: {
        type: String,
        required: true
    },
    dateOfBirth: {
        type: Date,
        required: true
    },
    medicalCondition: String,
    roomNumber: {
        type: String,
        enum: ['1', '2', '3', '4', 'Discharge', null],
        default: null
    },
    notes: String,
    discharged: {
        type: Boolean,
        default: false
    },
    dischargeDate: Date,
    admissionDate: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("Patient", patientSchema);