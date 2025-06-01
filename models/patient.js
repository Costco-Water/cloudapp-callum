const mongoose = require("mongoose");

const patientSchema = new mongoose.Schema({
    firstName: String,
    lastName: String,
    dateOfBirth: Date,
    medicalCondition: String,
    roomNumber: { type: String, default: "Unassigned" },
    admissionDate: { type: Date, default: Date.now },
    notes: String
});

module.exports = mongoose.model("Patient", patientSchema);