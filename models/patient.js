const mongoose = require("mongoose");

const patientSchema = new mongoose.Schema({
    firstName: String,
    lastName: String,
    dateOfBirth: Date,
    medicalCondition: String,
    roomNumber: String,
    notes: String,
    discharged: {
        type: Boolean,
        default: false
    },
    dischargeDate: Date
});

module.exports = mongoose.model("Patient", patientSchema);