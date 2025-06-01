const mongoose = require("mongoose");

const patientSchema = new mongoose.Schema({
    firstName: String,
    lastName: String,
    dateOfBirth: Date,
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
    dischargeDate: Date
});

module.exports = mongoose.model("Patient", patientSchema);