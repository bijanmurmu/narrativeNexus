const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs"); // for hashing passwords
require("dotenv").config();

const multer = require("multer");
// const { v2: cloudinary } = require("cloudinary");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const session = require("express-session");

const app = express();
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));
// Setup session
app.use(
    session({
        secret:
            process.env.SESSION_SECRET ||
            "your-very-secure-secret-key-change-this-in-production",
        resave: false,
        saveUninitialized: false, // Changed to false for better security
        name: "blogapp.sid", // Custom session name
        cookie: {
            secure: false, // Set to true in production with HTTPS
            httpOnly: true, // Prevents XSS attacks
            maxAge: 24 * 60 * 60 * 1000, // 24 hours
        },
        // For production, add MongoDB session store:
        // store: MongoStore.create({
        //     mongoUrl: process.env.MONGODB_URI,
        //     touchAfter: 24 * 3600 // lazy session update
        // })
    })
);

// MongoDB database:
// Connection
mongoose
    .connect(process.env.MONGODB_URI)
    .then(() => {
        console.log("Connected to MongoDB");
    })
    .catch((err) => {
        console.error(err);
    });

// Password User Schema
const Schema = mongoose.Schema;

const userSchema = new Schema({
    email: { type: String, unique: true },
    password: String,
});

// Blog User Schema
const SchemaBlog = mongoose.Schema;

const userSchemaBlog = new SchemaBlog(
    {
        by: String,
        data: String,
        imageUrl: String,
    },
    {
        timestamps: true,
    }
);

// Collection For Password & Blog Post
const User = mongoose.model("User", userSchema);
const Blog = mongoose.model("Blog", userSchemaBlog);

// Cloudinary Config
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_NAME,
    api_key: process.env.CLOUDINARY_KEY,
    api_secret: process.env.CLOUDINARY_SECRET,
});

// Setup multer for memory storage (Cloudinary will handle file storage)
const storage = multer.memoryStorage();

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith("image/")) {
            cb(null, true);
        } else {
            cb(new Error("Only image files are allowed!"), false);
        }
    },
});

if (
    !process.env.CLOUDINARY_NAME ||
    !process.env.CLOUDINARY_KEY ||
    !process.env.CLOUDINARY_SECRET
) {
    console.error(
        "Cloudinary configuration is missing. Please check your environment variables."
    );
    process.exit(1);
}

const uploadToCloudinary = async (fileBuffer, fileName) => {
    try {
        // Convert buffer to base64 string
        const base64String = fileBuffer.toString('base64');
        const dataURI = `data:image/jpeg;base64,${base64String}`;

        const uploadResult = await cloudinary.uploader.upload(dataURI, {
            public_id: fileName,
            folder: "narrative_nexus",
            resource_type: "image",
            transformation: [
                { width: 1000, height: 600, crop: "limit" },
                { quality: "auto" },
                { fetch_format: "auto" },
            ],
        });

        return uploadResult;
    } catch (error) {
        console.error("Cloudinary upload error:", error);
        throw new Error(`Failed to upload image: ${error.message}`);
    }
};


// Utility functions
function generateSlug(title) {
    return title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
}

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

app.get("/compose", (req, res) => {
    res.render("compose");
});

app.get("/expMore", (req, res) => {
    res.render("learnMore");
});

app.get("/aboutMe", (req, res) => {
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
            password: hashedPassword,
        });

        await newUser.save();
        res.redirect("/login");
    } catch (error) {
        console.error("Error saving user:", error);
        res.status(500).send("Error registering user");
    }
});

// var email = "";

app.post("/login", async (req, res) => {
    email = req.body.email;
    const password = req.body.password;

    try {
        // Find user by email
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(400).send("User or password not found");
        }

        // Compare password with the hashed password
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(400).send("User or password not found");
        }

        req.session.email = email;

        // Successful login, And show Blogs:
        try {
            const blogs = await Blog.find({}).sort({ createdAt: -1 }); // Sort by newest first
            res.render("last", { blogs: blogs }); // Send the to last.ejs
        } catch (error) {
            res.status(500).send("Error fetching blog texts");
        }
    } catch (error) {
        console.error("Error during login:", error);
        res.status(500).send("Error logging in");
    }
});

app.post("/compose", upload.single('blogImage'), async (req, res) => {

    if (!req.session.email) return res.redirect("/login");

    const text = req.body.blogText;
    const imageFile = req.file; // Changed from req.blogImage to req.file
    let imageUrl = null;

    if (imageFile) {
        try {
            const fileName = `blog_${Date.now()}_${Math.round(Math.random() * 1e9)}`;
            const uploadResult = await uploadToCloudinary(imageFile.buffer, fileName);
            imageUrl = uploadResult.secure_url;
            console.log("Image uploaded successfully:", imageUrl);
        } catch (uploadError) {
            console.error("Cloudinary upload error:", uploadError);
            // Continue without image if upload fails, but log the error
            console.log("Continuing without image due to upload failure");
        }
    }

    try {
        // Create a new Blog document
        const newBlog = new Blog({
            by: req.session.email,
            data: text, // Use 'data' instead of 'text' to match the schema
            imageUrl: imageUrl,
        });

        await newBlog.save(); // Wait for the save operation to complete
        console.log("Blog saved:", newBlog.toJSON());

        // Fetch updated blogs and render
        const blogs = await Blog.find({}).sort({ createdAt: -1 }); // Sort by newest first
        res.render("last", { blogs: blogs });
    } catch (error) {
        console.error("Error saving blog:", error);
        res.status(500).send("Error saving blog post");
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
