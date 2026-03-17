import mongoose from "mongoose";
import fs from "fs";
import csv from "csv-parser";
import Product from "./models/Product.js";

mongoose.connect("mongodb://localhost:27017/yourdb");

const files = {};

fs.createReadStream("drive-files.csv")
  .pipe(csv())
  .on("data", (row) => {

    let name = row.filename.replace(/\.[^/.]+$/, ""); // remove extension

    if (!files[name]) files[name] = {};

    if (row.filename.endsWith(".jpg") || row.filename.endsWith(".png")) {
      files[name].image = row.link;
    }

    if (row.filename.endsWith(".pdf")) {
      files[name].datasheet = row.link;
    }

  })
  .on("end", async () => {

    for (const productName in files) {

      const data = files[productName];

      await Product.updateOne(
        { name: productName },
        {
          $set: {
            image: data.image,
            datasheet: data.datasheet
          }
        }
      );

      console.log("Updated:", productName);
    }

    console.log("All products updated");
    process.exit();

  });