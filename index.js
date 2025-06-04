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
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const csrf = require('csurf');
const app = express();
const https = require('https');
const fs = require('fs');
const path = require('path');
const cookieParser = require('cookie-parser');


mongoose.connect("mongodb://20.0.153.128:10999/callumDB")
    .then(() => console.log("MongoDB Connected"))
    .catch((err) => console.error("MongoDB Connection Error:", err));


const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5
});


app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(methodOverride("_method"));
app.set("view engine", "ejs");
app.use(express.static('public'));



app.use(session({
    secret: "secretKey123",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: "mongodb://20.0.153.128:10999/callumDB" }),
    cookie: {
        secure: true,
        httpOnly: true,
        sameSite: 'strict',
        maxAge: 3600000
    }
}));


app.use((req, res, next) => {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
});

app.use(csrf());


app.use(function (err, req, res, next) {
    if (err.code !== 'EBADCSRFTOKEN') return next(err);
    res.status(403).send('Form has been tampered with');
});


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


app.get("/register", (req, res) => {
    res.render("register", { csrfToken: req.csrfToken() });
});

app.post("/register", [
    body('username').trim().escape().isLength({ min: 3 }),
    body('password')
        .isLength({ min: 8 })
        .matches(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).*$/)
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).send("Invalid input - username must be 3+ characters, password must meet requirements");
    }

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
    res.render("login", { csrfToken: req.csrfToken() });
});

app.post("/login", loginLimiter, [
    body('username').trim().escape(),
    body('password').trim()
], async (req, res) => {
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


app.get("/", isAuthenticated, (req, res) => {
    res.redirect("/patients");
});

app.get("/patients", isAuthenticated, async (req, res) => {
    try {
        const patients = await Patient.find();
        res.render("patients", { patients, csrfToken: req.csrfToken() });
    } catch (error) {
        res.status(500).send("Error fetching patients");
    }
});

app.get("/patient/new", isAuthenticated, isAdmin, (req, res) => {
    res.render("new_patient", { csrfToken: req.csrfToken() });
});

app.post("/patient", [
    body('firstName').trim().escape(),
    body('lastName').trim().escape(),
    body('medicalCondition').trim().escape(),
    body('notes').trim().escape()
], isAuthenticated, isAdmin, async (req, res) => {
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
        const patient = await Patient.findById(req.params.id).populate('roomNumber');
        if (!patient) {
            return res.status(404).send("Patient Not Found");
        }
        res.render("patient", { patient, csrfToken: req.csrfToken() });
    } catch (error) {
        console.error("Error fetching patient:", error);
        res.status(500).send("Error fetching patient details");
    }
});

app.get("/patient/:id/edit", isAuthenticated, isAdmin, async (req, res) => {
    try {
        const patient = await Patient.findById(req.params.id);
        if (!patient) return res.status(404).send("Patient Not Found");
        res.render("edit_patient", { patient, csrfToken: req.csrfToken() });
    } catch (error) {
        res.status(500).send("Error fetching patient");
    }
});

app.put("/patient/:id", [
    body('firstName').trim().escape(),
    body('lastName').trim().escape(),
    body('medicalCondition').trim().escape(),
    body('notes').trim().escape()
], isAuthenticated, isAdmin, async (req, res) => {
    try {
        const patient = await Patient.findById(req.params.id);
        if (!patient) return res.status(404).send("Patient Not Found");

        if (patient.roomNumber !== req.body.roomNumber) {
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

            if (req.body.roomNumber && req.body.roomNumber !== 'Discharge') {
                const newRoom = await Room.findOne({ roomNumber: req.body.roomNumber });
                if (newRoom) {
                    if (!newRoom.currentPatients) {
                        newRoom.currentPatients = [];
                    }
                    newRoom.currentPatients.push(patient._id);
                    newRoom.isOccupied = true;
                    await newRoom.save();
                }
            }
        }

        const updatedPatient = await Patient.findByIdAndUpdate(
            req.params.id,
            {
                firstName: req.body.firstName,
                lastName: req.body.lastName,
                dateOfBirth: req.body.dateOfBirth,
                medicalCondition: req.body.medicalCondition,
                roomNumber: req.body.roomNumber,
                notes: req.body.notes,
                discharged: req.body.roomNumber === 'Discharge'
            },
            { new: true }
        );

        res.redirect("/patients");
    } catch (error) {
        console.error("Patient update error:", error);
        res.status(500).send("Error updating patient");
    }
});

app.post("/patient/:id/discharge", isAuthenticated, isAdmin, async (req, res) => {
    try {
        const patient = await Patient.findById(req.params.id);
        if (!patient) return res.status(404).send("Patient Not Found");

        
        if (patient.roomNumber && patient.roomNumber !== 'Discharge') {
            const currentRoom = await Room.findOne({ roomNumber: patient.roomNumber });
            if (currentRoom) {
                currentRoom.currentPatients = currentRoom.currentPatients.filter(p => p.toString() !== patient._id.toString());
                currentRoom.isOccupied = currentRoom.currentPatients.length > 0;
                await currentRoom.save();
            }
        }

        
        const dischargeRoom = await Room.findOne({ roomNumber: 'Discharge' });
        if (dischargeRoom) {
            if (!dischargeRoom.currentPatients) {
                dischargeRoom.currentPatients = [];
            }
            dischargeRoom.currentPatients.push(patient._id);
            dischargeRoom.isOccupied = true;
            await dischargeRoom.save();
        }

        
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


app.get("/rooms", isAuthenticated, async (req, res) => {
    try {
        const rooms = await Room.find().populate('currentPatients');
        
        const patients = await Patient.find({
            discharged: false
        });
        
        res.render("rooms", { 
            rooms, 
            patients, 
            csrfToken: req.csrfToken() 
        });
    } catch (error) {
        console.error("Room fetch error:", error);
        res.status(500).send("Error fetching rooms");
    }
});

app.get("/room/new", isAuthenticated, isAdmin, (req, res) => {
    res.render("new_room", { csrfToken: req.csrfToken() });
});

app.post("/room", [
    body('roomNumber').trim().escape(),
    body('type').trim().escape(),
    body('notes').trim().escape()
], isAuthenticated, isAdmin, async (req, res) => {
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
        res.render("edit_room", { room, csrfToken: req.csrfToken() });
    } catch (error) {
        console.error("Room edit fetch error:", error);
        res.status(500).send("Error fetching room");
    }
});

app.put("/room/:id", [
    body('notes').trim().escape()
], isAuthenticated, isAdmin, async (req, res) => {
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

        
        if (!room.currentPatients) {
            room.currentPatients = [];
        }

        room.currentPatients.push(patient._id);
        room.isOccupied = true;
        await room.save();

        
        patient.roomNumber = room.roomNumber;
        patient.discharged = false; 
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

        if (dischargeRoom) {
            dischargeRoom.currentPatients = dischargeRoom.currentPatients.filter(
                p => p.toString() !== patient._id.toString()
            );
            await dischargeRoom.save();
        }

        patient.discharged = false;
        patient.dischargeDate = null;
        patient.roomNumber = newRoom.roomNumber;
        await patient.save();

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


try {
    const sslOptions = {
        key: fs.readFileSync(path.join(__dirname, 'ssl', 'private.key')),
        cert: fs.readFileSync(path.join(__dirname, 'ssl', 'certificate.pem'))
    };
    
    https.createServer(sslOptions, app).listen(8443, () => {
        console.log("HTTPS server running securely on port 8443");
    });
} catch (error) {
    console.error("SSL Error:", error);
    process.exit(1);
}