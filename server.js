const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const multer = require("multer");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");

dotenv.config();

const app = express();
const port = 3000;

app.use(cors());

const admin = require('./firebaseadmin');

const db = admin.firestore();

const bucket = admin.storage().bucket();

const upload = multer({ storage: multer.memoryStorage() }); // In-memory only

// Middleware to parse JSON bodies
app.use(express.json());

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

app.get('/', async (req, res) => {
  res.send('Hello World!')
})

app.get("/get-colls", async (req, res) => {
  const collections = await db.listCollections();
  res.send(collections.map(col => col.id));
})

// Endpoint to add a document to Firestore
app.post('/add-document', async (req, res) => {
  try {
    const { data } = req.body;
    const collection = data.collection;

    if (data.address) {
      const see = await getCoordinates(data.address)
      console.log(see)
      const yCoord = see.lng;
      const xCoord = see.lat;
      const coords = [yCoord, xCoord];
      data["coords"] = coords;
    }
    j
    const docRef = db.collection(collection).doc();
    await docRef.set(data);

    res.status(200).send('Document added successfully');
  } catch (error) {
    console.error('Error adding document:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.post("/read-collection", async (req, res) => {
  try {
    const collection = req.body.toSend.collection;

    console.log("-=-------------===")
    console.log(collection);

    // Specify your collection name
    const collectionRef = db.collection(collection);
    
    // Fetch all documents in the collection
    const snapshot = await collectionRef.get();
    
    if (snapshot.empty) {
      return res.status(404).json({ message: 'No documents found' });
    }
    
    // Map documents into a simple array of document data
    const documents = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Return the documents as JSON
    res.status(200).json(documents);
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ error: 'Failed to fetch documents: ' + error });
  }
})

app.post("/add-location", async (req, res) => {
  allData = req.body.data;
  const collection = allData.category;
  let moreData = allData.moreData;
  if (allData.addCoor == "add") // This means the location was sent as an address not as coordinates, so we will have to change that.
  {
    const see = await getCoordinates(allData.location)
    console.log(see)
    const yCoord = see.lng;
    const xCoord = see.lat;
    const coords = [yCoord, xCoord];
    allData["coords"] = coords;
  }
  
  // Now have to unpack all of the moreData and store it within the allData dict.
  if (moreData.length > 0) {
    for (let i = 0; i < moreData.length; i++) {
      allData[Object.keys(moreData[i])[0]] = moreData[i][Object.keys(moreData[i])[0]];
    }
  }

  delete allData.moreData;

  console.log(allData);

  const docRef = db.collection(collection).doc();
  await docRef.set(allData);

  res.status(200).json({ id: docRef.id });
})

app.post("/upload-image", upload.single("image"), async (req, res) => {
  try {
    const file = req.file;
    const folder = req.body.folder;

    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    if (!folder) {
      return res.status(400).json({ error: "No folder specified" });
    }

    const fileName = `${uuidv4()}_${file.originalname}`;
    const destination = `${folder}/${fileName}`;
    const token = uuidv4(); // Needed for public access

    const blob = bucket.file(destination);

    const stream = blob.createWriteStream({
      metadata: {
        contentType: file.mimetype,
        metadata: {
          firebaseStorageDownloadTokens: token
        }
      }
    });

    stream.on("error", (err) => {
      console.error("Upload Error:", err);
      return res.status(500).json({ error: "Upload failed" });
    });

    stream.on("finish", () => {
      const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(destination)}?alt=media&token=${token}`;
      return res.status(200).json({ message: "File uploaded", url: publicUrl });
    });

    stream.end(file.buffer); // Upload in-memory file
  } catch (error) {
    console.error("Unexpected Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/get-images", async (req, res) => { 
  console.log(req.body);
  const folder = req.body.folderId;
  console.log(folder);

  try {
    const [files] = await bucket.getFiles({ prefix: `${folder}/` });

    const urls = await Promise.all(
      files.map(async (file) => {
        const metadata = await file.getMetadata();
        const token = metadata[0].metadata.firebaseStorageDownloadTokens;

        return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(file.name)}?alt=media&token=${token}`;
      })
    );

    res.status(200).json({ images: urls });
  } catch (err) {
    console.error("Error listing files:", err);
    res.status(500).json({ error: "Failed to list images" });
  }
});

async function getCoordinates(address) {
  const apiKey = process.env.MAPS_API_KEY; // Replace with your real API key
  const encodedAddress = encodeURIComponent(address);
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${apiKey}`;
  console.log(url);

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK') {
      const location = data.results[0].geometry.location;
      return {
        lat: location.lat,
        lng: location.lng
      };
    } else {
      throw new Error(`Geocoding error: ${data.status}`);
    }
  } catch (error) {
    console.error('Error fetching coordinates:', error);
    return null;
  }
}

module.exports = app;