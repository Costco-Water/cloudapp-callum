const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const methodOverride = require("method-override");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const MongoStore = require("connect-mongo");
const User = require("./models/Users.js");
const Patient = require("./models/patient.js");
const Room = require("./models/Room.js");
const app = express();

// Connect to MongoDB
mongoose.connect("mongodb://20.0.153.128:10999/callumDB")
    .then(() => console.log("MongoDB Connected"))
    .catch((err) => console.error("MongoDB Connection Error:", err));

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride("_method"));
app.set("view engine", "ejs");

app.use(session({
    secret: "secretKey123",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: "mongodb://20.0.153.128:10999/callumDB" })
}));

// Middleware to make session data available in EJS
app.use(async (req, res, next) => {
    if (req.session.userId) {
        try {
            const user = await User.findById(req.session.userId);
            res.locals.session = {
                userId: user._id,
                role: user.role,
                username: user.username
            };
        } catch (err) {
            res.locals.session = null;
        }
    } else {
        res.locals.session = null;
    }
    next();
});

// Authentication middleware
function isAuthenticated(req, res, next) {
    if (req.session.userId) return next();
    res.redirect("/login");
}

function isAdmin(req, res, next) {
    if (req.session.userId) {
        User.findById(req.session.userId).then(user => {
            if (user && user.role === 'admin') return next();
            else return res.status(403).send("Forbidden: Admins only");
        }).catch(err => res.status(500).send("Error checking admin role"));
    } else {
        res.redirect("/login");
    }
}

// User routes
app.get("/register", (req, res) => {
    res.render("register");
});

app.post("/register", async (req, res) => {
    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    try {
        const newUser = new User({ username, password: hashedPassword, role: "user" });
        await newUser.save();
        res.redirect("/login");
    } catch (err) {
        res.status(500).send("Registration failed.");
    }
});

app.get("/login", (req, res) => {
    res.render("login");
});

app.post("/login", async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username });

    if (!user) return res.send("User not found");

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.send("Incorrect password");

    req.session.userId = user._id;
    res.redirect("/patients");
});

app.get("/logout", isAuthenticated, (req, res) => {
    req.session.destroy(() => {
        res.redirect("/login");
    });
});

// Patient routes
app.get("/", isAuthenticated, (req, res) => {
    res.redirect("/patients");
});

app.get("/patients", isAuthenticated, async (req, res) => {
    try {
        const patients = await Patient.find();
        res.render("patients", { patients });
    } catch (error) {
        res.status(500).send("Error fetching patients");
    }
});

app.get("/patient/new", isAuthenticated, isAdmin, (req, res) => {
    res.render("new_patient");
});

app.post("/patient", isAuthenticated, isAdmin, async (req, res) => {
    try {
        const newPatient = new Patient({
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            dateOfBirth: req.body.dateOfBirth,
            medicalCondition: req.body.medicalCondition,
            roomNumber: req.body.roomNumber,
            notes: req.body.notes
        });
        await newPatient.save();

        // If room is assigned, update the room's currentPatients
        if (req.body.roomNumber && req.body.roomNumber !== 'Discharge') {
            const room = await Room.findOne({ roomNumber: req.body.roomNumber });
            if (room) {
                room.currentPatients.push(newPatient._id);
                room.isOccupied = true;
                await room.save();
            }
        }

        res.redirect("/patients");
    } catch (error) {
        console.error("Patient creation error:", error);
        res.status(500).send("Error adding Patient");
    }
});

app.get("/patient/:id", isAuthenticated, async (req, res) => {
    try {
        const patient = await Patient.findById(req.params.id);
        if (!patient) return res.status(404).send("Patient Not Found");
        res.render("patient", { patient });
    } catch (error) {
        res.status(500).send("Error fetching patient");
    }
});

app.get("/patient/:id/edit", isAuthenticated, isAdmin, async (req, res) => {
    try {
        const patient = await Patient.findById(req.params.id);
        if (!patient) return res.status(404).send("Patient Not Found");
        res.render("edit_patient", { patient });
    } catch (error) {
        res.status(500).send("Error fetching patient");
    }
});

app.put("/patient/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
        const patient = await Patient.findByIdAndUpdate(
            req.params.id,
            {
                firstName: req.body.firstName,
                lastName: req.body.lastName,
                dateOfBirth: req.body.dateOfBirth,
                medicalCondition: req.body.medicalCondition,
                roomNumber: req.body.roomNumber,
                notes: req.body.notes
            },
            { new: true }
        );
        if (!patient) return res.status(404).send("Patient Not Found");
        res.redirect("/patients");
    } catch (error) {
        res.status(500).send("Error updating patient");
    }
});

app.post("/patient/:id/discharge", isAuthenticated, isAdmin, async (req, res) => {
    try {
        const patient = await Patient.findById(req.params.id);
        if (!patient) return res.status(404).send("Patient Not Found");

        // Remove from current room if assigned
        if (patient.roomNumber && patient.roomNumber !== 'Discharge') {
            const currentRoom = await Room.findOne({ roomNumber: patient.roomNumber });
            if (currentRoom) {
                currentRoom.currentPatients = currentRoom.currentPatients.filter(p => p.toString() !== patient._id.toString());
                currentRoom.isOccupied = currentRoom.currentPatients.length > 0;
                await currentRoom.save();
            }
        }

        // Add to discharge room
        const dischargeRoom = await Room.findOne({ roomNumber: 'Discharge' });
        if (dischargeRoom) {
            if (!dischargeRoom.currentPatients) {
                dischargeRoom.currentPatients = [];
            }
            dischargeRoom.currentPatients.push(patient._id);
            dischargeRoom.isOccupied = true;
            await dischargeRoom.save();
        }

        // Update patient
        patient.discharged = true;
        patient.dischargeDate = new Date();
        patient.roomNumber = 'Discharge';
        await patient.save();

        res.redirect("/patients");
    } catch (error) {
        console.error("Discharge error:", error);
        res.status(500).send("Error discharging patient");
    }
});

app.delete("/patient/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
        const patient = await Patient.findByIdAndDelete(req.params.id);
        if (!patient) return res.status(404).send("Patient Not Found");
        res.redirect("/patients");
    } catch (error) {
        res.status(500).send("Error deleting patient");
    }
});

// Room routes
app.get("/rooms", isAuthenticated, async (req, res) => {
    try {
        const rooms = await Room.find().populate('currentPatients');
        const patients = await Patient.find();
        res.render("rooms", { rooms, patients });
    } catch (error) {
        console.error("Room fetch error:", error);
        res.status(500).send("Error fetching rooms");
    }
});

app.get("/room/new", isAuthenticated, isAdmin, (req, res) => {
    res.render("new_room");
});

app.post("/room", isAuthenticated, isAdmin, async (req, res) => {
    try {
        const newRoom = new Room({
            roomNumber: req.body.roomNumber,
            type: req.body.type,
            capacity: req.body.capacity,
            notes: req.body.notes
        });
        await newRoom.save();
        res.redirect("/rooms");
    } catch (error) {
        console.error("Room creation error:", error);
        res.status(500).send("Error adding room");
    }
});

app.get("/room/:id/edit", isAuthenticated, isAdmin, async (req, res) => {
    try {
        const room = await Room.findById(req.params.id).populate('currentPatients');
        if (!room) return res.status(404).send("Room Not Found");
        res.render("edit_room", { room });
    } catch (error) {
        console.error("Room edit fetch error:", error);
        res.status(500).send("Error fetching room");
    }
});

app.put("/room/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
        const room = await Room.findByIdAndUpdate(
            req.params.id,
            {
                type: req.body.type,
                capacity: req.body.capacity,
                notes: req.body.notes
            },
            { new: true }
        );
        if (!room) return res.status(404).send("Room Not Found");
        res.redirect("/rooms");
    } catch (error) {
        console.error("Room update error:", error);
        res.status(500).send("Error updating room");
    }
});

app.post("/room/:id/assign", isAuthenticated, isAdmin, async (req, res) => {
    try {
        const room = await Room.findById(req.params.id);
        const patient = await Patient.findById(req.body.patientId);
        
        if (!room || !patient) {
            return res.status(404).send("Room or Patient not found");
        }

        // Remove patient from their current room if they're assigned to one
        if (patient.roomNumber) {
            const oldRoom = await Room.findOne({ roomNumber: patient.roomNumber });
            if (oldRoom) {
                oldRoom.currentPatients = oldRoom.currentPatients.filter(
                    p => p.toString() !== patient._id.toString()
                );
                oldRoom.isOccupied = oldRoom.currentPatients.length > 0;
                await oldRoom.save();
            }
        }

        // Add patient to new room
        if (!room.currentPatients) {
            room.currentPatients = [];
        }

        if (room.currentPatients.length >= room.capacity) {
            return res.status(400).send("Room is at full capacity");
        }

        room.currentPatients.push(patient._id);
        room.isOccupied = true;
        await room.save();

        patient.roomNumber = room.roomNumber;
        await patient.save();

        res.redirect("/rooms");
    } catch (error) {
        console.error("Assignment error:", error);
        res.status(500).send("Error assigning room");
    }
});

app.delete("/room/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
        const room = await Room.findById(req.params.id);
        if (!room) return res.status(404).send("Room Not Found");
        
        // Update any patients assigned to this room
        await Patient.updateMany(
            { roomNumber: room.roomNumber },
            { $set: { roomNumber: null } }
        );
        
        await Room.findByIdAndDelete(req.params.id);
        res.redirect("/rooms");
    } catch (error) {
        console.error("Room deletion error:", error);
        res.status(500).send("Error deleting room");
    }
});

app.post("/patient/:id/reassign", isAuthenticated, isAdmin, async (req, res) => {
    try {
        const patient = await Patient.findById(req.params.id);
        const newRoom = await Room.findOne({ roomNumber: req.body.roomNumber });
        const dischargeRoom = await Room.findOne({ roomNumber: 'Discharge' });
        
        if (!patient || !newRoom) {
            return res.status(404).send("Patient or Room not found");
        }

        // Remove from discharge room if they're there
        if (dischargeRoom) {
            dischargeRoom.currentPatients = dischargeRoom.currentPatients.filter(
                p => p.toString() !== patient._id.toString()
            );
            await dischargeRoom.save();
        }

        // Update patient status
        patient.discharged = false;
        patient.dischargeDate = null;
        patient.roomNumber = newRoom.roomNumber;
        await patient.save();

        // Add to new room
        if (!newRoom.currentPatients.includes(patient._id)) {
            newRoom.currentPatients.push(patient._id);
            newRoom.isOccupied = true;
            await newRoom.save();
        }

        res.redirect("/patients");
    } catch (error) {
        console.error("Reassignment error:", error);
        res.status(500).send("Error reassigning patient");
    }
});

// Start server
app.listen(8080, () => console.log("Server is running on port 8080"));