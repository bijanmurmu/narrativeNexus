const express = require('express');
const bodyParser = require('body-parser');
const ejs = require('ejs');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); // for hashing passwords


const app = express();
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));


// MongoDB database:
// Connection
mongoose.connect('mongodb+srv://admin-bimbok:bimbok123@cluster0.1w1cxot.mongodb.net/kiHobe')
    .then(() => {
        console.log("Connected to MongoDB");
    })
    .catch(err => {
        console.error(err);
    });

// Password User Schema
const Schema = mongoose.Schema;

const userSchema = new Schema({
    email: { type: String, unique: true },
    password: String
});

// Blog User Schema
const SchemaBlog = mongoose.Schema;

const userSchemaBlog = new SchemaBlog({
    by: String,
    data: String,
}, {
    timestamps: true
});


// Collection For Password & Blog Post
const User = mongoose.model('User', userSchema);
const Blog = mongoose.model("Blog", userSchemaBlog);


// Get Requests
app.get("/", (req, res) => {
    res.render("index");
});

app.get("/login", (req, res) => {
    res.render("login");
});

app.get("/register", (req, res) => {
    res.render("register");
});

app.get("/compose", (req,res)=> {
    res.render("compose");
} )

app.get("/expMore", (req, res)=> {
    res.render("learnMore");
});

app.get("/aboutMe", (req, res)=> {
    res.render("aboutMe");
});

// All post Requests
app.post("/register", async (req, res) => {
    const email = req.body.email;
    const password = req.body.password;
    const confirm_password = req.body.confirm_password;

    console.log(email, password, confirm_password);

    if (password !== confirm_password) {
        return res.status(400).send("Passwords do not match");
    }

    try {
        // Check if a user with this email already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).send("Email already registered");
        }

        // Hash the password before saving
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create a new User document
        const newUser = new User({
            email,
            password: hashedPassword
        });

        await newUser.save();
        res.redirect("/login");
    } catch (error) {
        console.error("Error saving user:", error);
        res.status(500).send("Error registering user");
    }
});

var email = "";

app.post("/login", async (req, res) => {
    email = req.body.email;
    const password = req.body.password;

    try {
        // Find user by email
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(400).send("User not found");
        }

        // Compare password with the hashed password
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(400).send("Invalid password");
        }

        // Successful login, And show Blogs:
        try {
            const blogs = await Blog.find({}); // Fetch all documents from the Blog collection
            res.render("last", {blogs : blogs}); // Send the to last.ejs
        } catch (error) {
            res.status(500).send('Error fetching blog texts');
        }


    } catch (error) {
        console.error("Error during login:", error);
        res.status(500).send("Error logging in");
    }
});

app.post("/compose", async (req, res) => {
    const text = req.body.blogText;

    try {
        // Create a new Blog document
        const newBlog = new Blog({
            by: email,
            data: text  // Use 'data' instead of 'text' to match the schema
        });
        
        await newBlog.save();  // Wait for the save operation to complete
        console.log("Blog saved:", newBlog.toJSON());
        const blogs = await Blog.find({}); // Fetch all documents from the Blog collection
        res.render("last", {blogs : blogs});
    } catch (error) {
        console.error("Error saving blog:", error);
        res.status(500).send("Error saving blog post");
    }
});


const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
