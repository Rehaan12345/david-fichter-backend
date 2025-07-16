const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
const dotenv = require('dotenv');
const axios = require("axios")
const qs = require("qs");

dotenv.config();

const app = express();
const port = 3000;

app.use(cors());

// Initialize Firebase Admin SDK with the service account
admin.initializeApp({
  credential: admin.credential.cert({
    "type": "service_account",
    "project_id": process.env.PROJECT_ID,
    "private_key_id": process.env.PRIVATE_KEY_ID,
    "private_key": process.env.PRIVATE_KEY,
    "client_email": process.env.CLIENT_EMAIL,
    "client_id": process.env.CLIENT_ID,
    "auth_uri": process.env.AUTH_URI,
    "token_uri": process.env.TOKEN_URI,
    "auth_provider_x509_cert_url": process.env.AUTH_PROVIDER,
    "client_x509_cert_url": process.env.CLIENT_URL,
    "universe_domain": "googleapis.com"
  })
});

const db = admin.firestore();

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
  if (allData.addCoor == "add") // means the location was sent as an address not as coordinates, so we will have to change that.
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

  res.status(200).send('Document added successfully');
  
})

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
