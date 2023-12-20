// Import mongoose untuk berinteraksi dengan MongoDB
const mongoose = require("mongoose");
// Import Schema dari mongoose untuk mendefinisikan struktur dokumen
const Schema = mongoose.Schema;

// Membuat schema untuk model Stock
const stockSchema = new Schema({
  // Field symbol dengan tipe String, wajib ada (required), dan unik (unique)
  symbol: { type: String, required: true, unique: true },
  // Field name dengan tipe String, wajib ada (required)
  name: { type: String, required: true },
  // Field logo dengan tipe String (opsional)
  logo: String,
});

// Membuat model Stock berdasarkan schema yang telah didefinisikan
const Stock = mongoose.model("Stock", stockSchema);

// Mengekspor model Stock agar bisa digunakan di file lain
module.exports = Stock;
