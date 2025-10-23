require("dotenv").config();

const path = require("path");
const hbs = require("hbs");
const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoStore = require('connect-mongo');
const flash = require("connect-flash");
const Stock = require("../models/Stocks");

const app = express();
const port = process.env.PORT || 8080;

// COMMENT atau HAPUS trust proxy untuk HTTP
// if (process.env.NODE_ENV === 'production') {
//   app.set('trust proxy', 1);
// }

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
console.log("Connecting to MongoDB...");
mongoose
  .connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("MongoDB connected successfully");
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

// Middleware untuk set cookie domain dinamis
app.use((req, res, next) => {
  const host = req.get('host');
  console.log('Request host:', host);
  
  // Extract base domain (tanpa subdomain)
  let domain;
  if (host.includes('her1godblog.tech')) {
    domain = '.her1godblog.tech';
  } else if (host.includes('her1god.codes')) {
    domain = '.her1god.codes';
  } else if (host.includes('azurewebsites.net')) {
    domain = undefined; // Default Azure domain
  } else {
    domain = undefined; // Localhost atau domain lain
  }
  
  // Override session cookie domain
  if (req.session && domain) {
    req.session.cookie.domain = domain;
  }
  
  next();
});

// Session middleware (taruh SEBELUM middleware di atas)
app.use(
  session({
    secret: process.env.SESSION_SECRET || "default-secret-key",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: mongoURI,
      collectionName: 'sessions',
      ttl: 24 * 60 * 60,
    }),
    proxy: false,
    name: 'connect.sid',
    cookie: { 
      secure: false,
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: 'lax',
      path: '/',
      domain: undefined, // Will be set by middleware
    },
  })
);

// Middleware dinamis domain (taruh SETELAH session middleware)
app.use((req, res, next) => {
  const host = req.get('host');
  console.log('Request host:', host);
  
  let domain;
  if (host.includes('her1godblog.tech')) {
    domain = '.her1godblog.tech';
  } else if (host.includes('her1god.codes')) {
    domain = '.her1god.codes';
  }
  
  if (req.session && domain) {
    req.session.cookie.domain = domain;
    console.log('Cookie domain set to:', domain);
  }
  
  next();
});

// Flash messages middleware
app.use(flash());

// Middleware untuk pass flash messages ke semua views
app.use((req, res, next) => {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.user = req.session.user;
  next();
});

// Middleware untuk autentikasi
function isAuthenticated(req, res, next) {
  console.log("=== AUTH CHECK ===");
  console.log("Session ID:", req.sessionID);
  console.log("Session user:", req.session.user);
  console.log("Session:", req.session);
  
  if (req.session && req.session.user) {
    console.log("✅ User authenticated:", req.session.user.email);
    return next();
  } else {
    console.log("❌ Not authenticated, redirecting to login");
    req.flash('error_msg', 'Silakan login terlebih dahulu');
    res.redirect("/login");
  }
}

// Routes

// Halaman awal
app.get("", isAuthenticated, async (req, res) => {
  try {
    const apiKey = process.env.GOAPI_API_KEY || "f46158fb-3cf7-5a89-ada2-c4b52118";
    const apiResponse = await axios.get(
      `https://api.goapi.io/stock/idx/companies?api_key=${apiKey}`
    );

    const dataResults = apiResponse.data.data.results;
    if (!dataResults) {
      throw new Error("Data tidak ditemukan dalam respons API.");
    }

    const companies = dataResults;

    if (!Array.isArray(companies)) {
      throw new Error("Data perusahaan tidak dalam format array yang diharapkan.");
    }

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
    });
  } catch (error) {
    console.error("Terjadi kesalahan saat mengambil data perusahaan:", error);
    req.flash('error_msg', 'Gagal mengambil data perusahaan');
    res.render("error", { 
      pesanKesalahan: "Gagal mengambil data perusahaan"
    });
  }
});

// Route login (halaman login)
app.get("/login", (req, res) => {
  if (req.session && req.session.user) {
    return res.redirect("/");
  }
  res.render("login", {
    judul: "Halaman Login",
  });
});

// Route login (proses login)
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  console.log("=== LOGIN ATTEMPT ===");
  console.log("Email:", email);
  console.log("Host:", req.get('host'));
  console.log("Protocol:", req.protocol);

  if (email === "admin@example.com" && password === "password123") {
    // Set session
    req.session.user = { email };
    
    // PENTING: Regenerate session ID untuk keamanan
    req.session.regenerate((err) => {
      if (err) {
        console.error("Session regenerate error:", err);
        return res.status(500).send("Session error");
      }
      
      // Set user lagi setelah regenerate
      req.session.user = { email };
      
      // Force save session
      req.session.save((saveErr) => {
        if (saveErr) {
          console.error("Session save error:", saveErr);
          return res.status(500).send("Session save error");
        }
        
        console.log("✅ Login successful");
        console.log("Session ID:", req.sessionID);
        console.log("Session user:", req.session.user);
        
        req.flash('success_msg', 'Login berhasil!');
        res.redirect("/");
      });
    });
  } else {
    console.log("❌ Wrong credentials");
    req.flash('error_msg', 'Email atau password salah');
    res.redirect("/login");
  }
});

// Route logout
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});

// Protected routes
app.get("/hasilSimpan-stok", isAuthenticated, async (req, res) => {
  try {
    const simpanStok = await Stock.find();
    res.render("hasilSimpan-stok", {
      judul: "Halaman Hasil Simpan Stok",
      simpanStok,
    });
  } catch (error) {
    console.error("Error retrieving saved stocks:", error);
    req.flash('error_msg', 'Gagal mengambil data stok');
    res.render("error", {
      pesanKesalahan: "Error retrieving saved stocks"
    });
  }
});

// Route search
app.get("/search", isAuthenticated, async (req, res) => {
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

// Route simpan stok
app.post("/simpan-stok", isAuthenticated, async (req, res) => {
  const { symbol, name, logo } = req.body;

  try {
    // Cek apakah symbol sudah ada di database
    const existingStock = await Stock.findOne({ symbol });

    if (existingStock) {
      console.log("DUPLICATE DETECTED:", symbol); // Debug log
      req.flash('error_msg', `Stock dengan symbol "${symbol}" sudah tersimpan sebelumnya`);
      console.log("Flash error_msg set:", req.flash('error_msg')); // Debug log
      return res.redirect("/hasilSimpan-stok");
    }

    const newStock = new Stock({
      symbol,
      name,
      logo,
    });

    await newStock.save();
    console.log("STOCK SAVED:", symbol); // Debug log
    req.flash('success_msg', `Stock ${symbol} berhasil disimpan!`);
    console.log("Flash success_msg set:", req.flash('success_msg')); // Debug log
    res.redirect("/hasilSimpan-stok");
  } catch (error) {
    console.error("Error saving stock:", error);
    req.flash('error_msg', 'Gagal menyimpan stock');
    res.redirect("/hasilSimpan-stok");
  }
});

// Route hapus stok
app.post("/hapus-stok/:id", isAuthenticated, async (req, res) => {
  const stockId = req.params.id;

  try {
    await Stock.findByIdAndDelete(stockId);
    req.flash('success_msg', 'Stock berhasil dihapus');
    res.redirect("/hasilSimpan-stok");
  } catch (error) {
    console.error("Error deleting stock:", error);
    req.flash('error_msg', 'Gagal menghapus stock');
    res.redirect("/hasilSimpan-stok");
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