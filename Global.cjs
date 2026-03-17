const { MongoClient } = require("mongodb");

const uri = "mongodb+srv://Yashi:1234@yashiscluster.nmndmfm.mongodb.net/?retryWrites=true&w=majority&appName=yashiscluster";
const client = new MongoClient(uri);

const OLD_URL = "https://extellsystems.com";
const NEW_URL = "https://red-crane-569906.hostingersite.com";

async function replaceUrls() {
  try {
    await client.connect();
    const db = client.db("Extell"); // use your DB name if needed

    const collections = await db.listCollections().toArray();

    for (const col of collections) {
      const collection = db.collection(col.name);

      console.log(`Processing collection: ${col.name}`);

      const docs = await collection.find({}).toArray();

      for (let doc of docs) {
        let updated = false;

        function replaceInObject(obj) {
          for (let key in obj) {
            if (typeof obj[key] === "string") {
              if (obj[key].includes(OLD_URL)) {
                obj[key] = obj[key].replaceAll(OLD_URL, NEW_URL);
                updated = true;
              }
            } else if (typeof obj[key] === "object" && obj[key] !== null) {
              replaceInObject(obj[key]);
            }
          }
        }

        replaceInObject(doc);

        if (updated) {
          await collection.updateOne(
            { _id: doc._id },
            { $set: doc }
          );
        }
      }
    }

    console.log("✅ Replacement completed safely");
  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}

replaceUrls();