const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const methodOverride = require("method-override");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const MongoStore = require("connect-mongo");
const User = require("./models/Users.js");

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
        const newUser = new User({ username, password: hashedPassword, role: "user" }); // Default to 'user'
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
    res.redirect("/students");
});

app.get("/logout", isAuthenticated, (req, res) => {
    req.session.destroy(() => {
        res.redirect("/login");
    });
});

// Student model
const studentSchema = new mongoose.Schema({
    name: String,
    age: Number,
    course: String,
    email: String,
    phone: Number
});
const Student = mongoose.model("Student", studentSchema);

// Routes
app.get("/", isAuthenticated, (req, res) => {
    res.redirect("/students");
});

app.get("/students", isAuthenticated, async (req, res) => {
    try {
        const students = await Student.find();
        res.render("students", { students });
    } catch (error) {
        res.status(500).send("Error fetching students");
    }
});

app.get("/student/new", isAuthenticated, isAdmin, (req, res) => {
    res.render("new_student");
});

app.post("/student", isAuthenticated, isAdmin, async (req, res) => {
    try {
        const newStudent = new Student({
            name: req.body.name,
            age: req.body.age,
            course: req.body.course,
            email: req.body.email,
            phone: req.body.phone
        });
        await newStudent.save();
        res.redirect("/students");
    } catch (error) {
        res.status(500).send("Error adding student");
    }
});

app.get("/student/:id", isAuthenticated, async (req, res) => {
    try {
        const student = await Student.findById(req.params.id);
        if (!student) return res.status(404).send("Student Not Found");
        res.render("student", { student });
    } catch (error) {
        res.status(500).send("Error fetching student");
    }
});

app.get("/student/:id/edit", isAuthenticated, isAdmin, async (req, res) => {
    try {
        const student = await Student.findById(req.params.id);
        if (!student) return res.status(404).send("Student Not Found");
        res.render("edit_student", { student });
    } catch (error) {
        res.status(500).send("Error fetching student");
    }
});

app.put("/student/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
        const student = await Student.findByIdAndUpdate(
            req.params.id,
            {
                name: req.body.name,
                age: req.body.age,
                course: req.body.course,
                email: req.body.email,
                phone: req.body.phone
            },
            { new: true }
        );
        if (!student) return res.status(404).send("Student Not Found");
        res.redirect("/students");
    } catch (error) {
        res.status(500).send("Error updating student");
    }
});

app.delete("/student/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
        const student = await Student.findByIdAndDelete(req.params.id);
        if (!student) return res.status(404).send("Student Not Found");
        res.redirect("/students");
    } catch (error) {
        res.status(500).send("Error deleting student");
    }
});

// Start server
app.listen(8080, () => console.log("Server is running on port 8080"));
