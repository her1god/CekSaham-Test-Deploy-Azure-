require("dotenv").config();

const path = require("path");
const hbs = require("hbs");
const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken"); // TAMBAH INI
const Stock = require("../models/Stocks");

const app = express();
const port = process.env.PORT || 8080;

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || "super-secret-jwt-key-12345";

// Konfigurasi direktori
const direktoriPublic = path.join(__dirname, "../public");
const direktoriViews = path.join(__dirname, "../templates/views");
const direktoriPartials = path.join(__dirname, "../templates/partials");

// Setup view engine
app.set("view engine", "hbs");
app.set("views", direktoriViews);
hbs.registerPartials(direktoriPartials);
app.use(express.static(direktoriPublic));

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Koneksi MongoDB
const mongoURI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/stocksdb";
mongoose
  .connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => {
    console.error("MongoDB error:", err);
    process.exit(1);
  });

// HAPUS SEMUA SESSION CODE (session, MongoStore, flash)

// Middleware untuk parse cookie
const cookieParser = require('cookie-parser');
app.use(cookieParser());

// Middleware untuk autentikasi dengan JWT
function isAuthenticated(req, res, next) {
  // Cek token dari cookie ATAU query parameter
  let token = req.cookies.auth_token || req.query.token;
  
  console.log("=== AUTH CHECK ===");
  console.log("Token from cookie:", req.cookies.auth_token ? "EXISTS" : "NOT FOUND");
  console.log("Token from query:", req.query.token ? "EXISTS" : "NOT FOUND");
  console.log("Host:", req.get('host'));
  
  if (!token) {
    console.log("❌ No token, redirect to login");
    return res.redirect("/login");
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    req.token = token; // Simpan token untuk dipakai di view
    console.log("✅ User authenticated:", decoded.email);
    next();
  } catch (err) {
    console.log("❌ Invalid token:", err.message);
    res.clearCookie('auth_token');
    res.redirect("/login");
  }
}

// Routes

// Halaman login
app.get("/login", (req, res) => {
  res.render("login", { judul: "Halaman Login" });
});

// Proses login
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  console.log("=== LOGIN ATTEMPT ===");
  console.log("Email:", email);
  console.log("Host:", req.get('host'));

  if (email === "admin@example.com" && password === "password123") {
    // Generate JWT token
    const token = jwt.sign(
      { email: email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    // Coba set cookie (mungkin tidak jalan)
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: false,
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: 'lax',
    });
    
    console.log("✅ Login successful");
    console.log("Token generated:", token.substring(0, 20) + "...");
    
    // Redirect dengan token di URL
    res.redirect("/?token=" + token);
  } else {
    console.log("❌ Wrong credentials");
    res.redirect("/login?error=1");
  }
});

// Logout
app.get("/logout", (req, res) => {
  res.clearCookie('auth_token');
  res.redirect("/login");
});

// Halaman home (protected)
app.get("", isAuthenticated, async (req, res) => {
  try {
    const apiKey = process.env.GOAPI_API_KEY || "f46158fb-3cf7-5a89-ada2-c4b52118";
    const apiResponse = await axios.get(
      `https://api.goapi.io/stock/idx/companies?api_key=${apiKey}`
    );

    const dataResults = apiResponse.data.data.results;
    const companies = dataResults;
    const totalCount = companies.length;
    const top25Companies = companies.slice(0, 25);

    const companyData = top25Companies.map((company) => ({
      symbol: company.symbol,
      name: company.name,
      logo: company.logo,
    }));

    res.render("index", {
      judul: "Halaman Home",
      companies: companyData,
      totalCount,
      user: req.user,
      token: req.token, // Pass token ke view
    });
  } catch (error) {
    console.error("Error:", error);
    res.render("error", { pesanKesalahan: "Gagal mengambil data" });
  }
});

// Route search
app.get("/search", isAuthenticated, (req, res) => {
  res.render("search", { 
    judul: "Halaman Search",
    user: req.user,
    token: req.token // Pass token
  });
});

app.post("/search", isAuthenticated, async (req, res) => {
  const kolomCari = req.query.search;
  const tipeCari = req.query.tipeCari?.toLowerCase();

  if (!kolomCari || !tipeCari) {
    req.flash('error_msg', 'Parameter pencarian tidak lengkap');
    return res.redirect("/");
  }

  if (!["stock", "company"].includes(tipeCari)) {
    req.flash('error_msg', 'Tipe pencarian tidak valid');
    return res.redirect("/");
  }

  const apiKey = process.env.GOAPI_API_KEY || "f46158fb-3cf7-5a89-ada2-c4b52118";
  let apiUrl;

  if (tipeCari === "stock") {
    apiUrl = `https://api.goapi.io/stock/idx/prices?symbols=${kolomCari}&api_key=${apiKey}`;
  } else {
    apiUrl = `https://api.goapi.io/stock/idx/${kolomCari}/profile?api_key=${apiKey}`;
  }

  try {
    const apiResponse = await axios.get(apiUrl);
    const dataCari = apiResponse.data.data;

    if (tipeCari === "stock") {
      res.render("info-stok", {
        stockInfo: dataCari,
      });
    } else {
      res.render("detail", {
        companyDetail: dataCari,
      });
    }
  } catch (error) {
    console.error("Terjadi kesalahan saat mengambil data:", error);
    req.flash('error_msg', 'Gagal mengambil data dari API');
    res.redirect("/");
  }
});

// Route hasil simpan stok
app.get("/hasilSimpan-stok", isAuthenticated, async (req, res) => {
  try {
    const simpanStok = await Stock.find();
    res.render("hasilSimpan-stok", {
      judul: "Halaman Hasil Simpan Stok",
      simpanStok,
      user: req.user,
      token: req.token, // Pass token
    });
  } catch (error) {
    console.error("Error:", error);
    res.render("error", { pesanKesalahan: "Error retrieving saved stocks" });
  }
});

// Route simpan stok
app.post("/simpan-stok", isAuthenticated, async (req, res) => {
  const { symbol, name, logo } = req.body;
  const token = req.token;

  try {
    // Cek apakah symbol sudah ada di database
    const existingStock = await Stock.findOne({ symbol });

    if (existingStock) {
      console.log("DUPLICATE DETECTED:", symbol);
      return res.redirect("/hasilSimpan-stok?token=" + token);
    }

    const newStock = new Stock({
      symbol,
      name,
      logo,
    });

    await newStock.save();
    console.log("STOCK SAVED:", symbol);
    
    res.redirect("/hasilSimpan-stok?token=" + token);
  } catch (error) {
    console.error("Error saving stock:", error);
    res.redirect("/hasilSimpan-stok?token=" + token);
  }
});

// Route hapus stok
app.post("/hapus-stok/:id", isAuthenticated, async (req, res) => {
  const { id } = req.params;
  const token = req.token;

  try {
    await Stock.findByIdAndDelete(id);
    console.log("Stock deleted:", id);
    res.redirect("/hasilSimpan-stok?token=" + token);
  } catch (error) {
    console.error("Error deleting stock:", error);
    res.redirect("/hasilSimpan-stok?token=" + token);
  }
});

// Route 404
app.get("*", (req, res) => {
  res.render("404", {
    title: "404",
    pesanKesalahan: "Halaman tidak ditemukan",
  });
});

// Start server
app.listen(port, '0.0.0.0', () => {
  console.log(`Server berjalan di port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`MongoDB URI: ${mongoURI.substring(0, 20)}...`);
});