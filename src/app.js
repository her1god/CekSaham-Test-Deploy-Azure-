const path = require("path"); //import path untuk jalur folder file
const hbs = require("hbs"); //baca extensi hbs pada file templates
const express = require("express"); //express framework
const bodyParser = require("body-parser"); // untuk ambil form dari body menjadi json
const axios = require("axios"); // untuk link api
const mongoose = require("mongoose"); // untuk mongodb
const Stock = require("../models/Stocks"); // ambil dari models/stocks
const nodemailer = require("nodemailer"); //untuk kirim email

const app = express();
const port = 3000;

const direktoriPublic = path.join(__dirname, "../public");
const direktoriViews = path.join(__dirname, "../templates/views");
const direktoriPartials = path.join(__dirname, "../templates/partials");

app.set("view engine", "hbs");
app.set("views", direktoriViews);
hbs.registerPartials(direktoriPartials);
app.use(express.static(direktoriPublic));

// Middleware untuk mengurai data JSON
app.use(express.json());

// Middleware untuk mengurai data formulir URL-encoded
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.urlencoded({ extended: true }));

mongoose.connect("mongodb://localhost:27017/stocksdb", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// ...

app.post("/hapus-stok/:id", async (req, res) => {
  const stockId = req.params.id;

  try {
    // Hapus saham berdasarkan ID
    await Stock.findByIdAndDelete(stockId);

    // Setelah menghapus, arahkan pengguna kembali ke halaman /hasilSimpan-stok
    res.redirect("/hasilSimpan-stok");
  } catch (error) {
    console.error("Error deleting stock:", error);
    res.status(500).json({ success: false, error: "Error deleting stock" });
  }
});

// ...

app.get("/hasilSimpan-stok", async (req, res) => {
  try {
    const simpanStok = await Stock.find();
    res.render("hasilSimpan-stok", { simpanStok });
  } catch (error) {
    console.error("Error retrieving saved stocks:", error);
    res.render("error", { error: "Error retrieving saved stocks" });
  }
});

app.post("/simpan-stok", async (req, res) => {
  const { symbol, name, logo, email } = req.body;

  try {
    const newStock = new Stock({
      symbol,
      name,
      logo,
    });

    await newStock.save();

    await kirimStokEmail(email, { symbol, name, logo });

    // res.json({ success: true, message: "Stock saved successfully" });
    res.redirect("/hasilSimpan-stok");
  } catch (error) {
    console.error("Error saving stock:", error);
    res.status(500).json({ success: false, error: "Error saving stock" });
  }
});

app.get("", async (req, res) => {
  try {
    // heripanca 33 const apiResponse = await axios.get("https://api.goapi.io/stock/idx/companies?api_key=832addab-1601-59ab-7d6e-eac6dd92");
    // herikondk const apiResponse = await axios.get("https://api.goapi.io/stock/idx/companies?api_key=998156aa-c1b3-5140-462b-b89c8d97");
    // deni const apiResponse = await axios.get("https://api.goapi.io/stock/idx/companies?api_key=52e53797-fe53-5170-1667-fdb1d8f5");
    const apiResponse = await axios.get("https://api.goapi.io/stock/idx/companies?api_key=526b919f-1054-5386-2e29-2ecd5dc0");
    console.log("API Response:", apiResponse.data);

    // Pemeriksaan untuk memastikan bahwa apiResponse.data.data.results tidak undefined
    const dataResults = apiResponse.data.data.results;
    if (!dataResults) {
      throw new Error("Data tidak ditemukan dalam respons API.");
    }

    const companies = dataResults;

    // Pemeriksaan untuk memastikan bahwa companies adalah array sebelum melakukan slice dan map
    if (!Array.isArray(companies)) {
      throw new Error("Data perusahaan tidak dalam format array yang diharapkan.");
    }

    // Hitung jumlah perusahaan
    const totalCount = companies.length;

    // Ambil hanya 10 perusahaan teratas
    const top10Companies = companies.slice(0, 25);

    const companyData = top10Companies.map((company) => ({
      symbol: company.symbol, // Ganti symbol dengan ticker
      name: company.name,
      logo: company.logo,
    }));

    res.render("index");
  } catch (error) {
    console.error("Terjadi kesalahan saat mengambil data perusahaan:", error);
    res.render("error");
  }
});

// ...

app.get("/search", async (req, res) => {
  const kolomCari = req.query.search;
  const tipeCari = req.query.tipeCari;

  let apiUrl;

  if (tipeCari === "stock") {
    // Ganti dengan API endpoint untuk informasi naik turun harga saham
    apiUrl = `https://api.goapi.io/stock/idx/prices?symbols=${kolomCari}&api_key=526b919f-1054-5386-2e29-2ecd5dc0`;
  } else {
    // Ganti dengan API endpoint untuk informasi perusahaan
    apiUrl = `https://api.goapi.io/stock/idx/${kolomCari}/profile?api_key=526b919f-1054-5386-2e29-2ecd5dc0`;
  }

  try {
    const apiResponse = await axios.get(apiUrl);
    const dataCari = apiResponse.data.data;

    if (tipeCari === "stock") {
      // Render halaman informasi naik turun harga saham
      res.render("info-stok", { stockInfo: dataCari });
    } else {
      // Render halaman detail perusahaan
      res.render("detail", { companyDetail: dataCari });
    }
  } catch (error) {
    console.error("Terjadi kesalahan saat mengambil data:", error);
    res.render("error");
  }
});

//halaman untuk 404
app.get("*", (req, res) => {
  res.render("404", {
    title: "404",
    name: "Heri Ramadhan",
    pesanError: "Halaman tidak ditemukan",
  });
});

// fungsi nodemailer untuk kirim email
async function kirimStokEmail(to, stockInfo) {
  // pengaturan nodemailer transporter
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "heripanca33@gmail.com", // Replace with your Gmail email
      pass: "sensor :)", // Replace with your Gmail password
    },
  });

  // Email konten
  const pengaturanMail = {
    from: "", // kirim ke emai; tujuan
    to,
    subject: "Stock Information",
    html: `
      <h1>Stock Information</h1>
      <p>Symbol: ${stockInfo.symbol}</p>
      <p>Name: ${stockInfo.name}</p>
      <p>Logo: ${stockInfo.logo}</p>
    `,
  };

  // kirim email
  await transporter.sendMail(pengaturanMail);
}

// Jalankan server
app.listen(port, () => {
  console.log(`Server berjalan di http://localhost:${port}`);
});
