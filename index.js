const express = require('express');
const admin = require('firebase-admin');
require('dotenv').config();
const multer = require('multer');
const pdf = require('pdf-parse');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Configure Multer for memory storage
const upload = multer({ storage: multer.memoryStorage() });

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });


const serviceAccount = {
  "type": process.env.FIREBASE_TYPE,
  "project_id": process.env.FIREBASE_PROJECT_ID,
  "private_key_id": process.env.FIREBASE_PRIVATE_KEY_ID,
  // 3. IMPORTANT: Restore the actual newline characters
  "private_key": process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n').replace(/\\/g, ''),
  "client_email": process.env.FIREBASE_CLIENT_EMAIL,
  "client_id": process.env.FIREBASE_CLIENT_ID,
  "auth_uri": process.env.FIREBASE_AUTH_URI,
  "token_uri": process.env.FIREBASE_TOKEN_URI,
  "auth_provider_x509_cert_url": process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
  "client_x509_cert_url": process.env.FIREBASE_CLIENT_X509_CERT_URL
};

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

const app = express();
const port = process.env.PORT || 3000;
const cors = require('cors');
const { resumeAnalysisPrompt } = require('./prompts');

// Enable CORS for all routes
app.use(cors());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`Incoming request: ${req.method} ${req.url}`);
  next();
});

// Middleware to parse JSON bodies
app.use(express.json());

// Firebase Auth Middleware
const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const idToken = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Error verifying token:', error);
    return res.status(403).json({ error: 'Unauthorized: Invalid token' });
  }
};

// Apply middleware to all API routes (or specific ones as needed)
// For this example, we'll apply it to the /hello endpoint.
// If you want it globally for all routes, use app.use(verifyToken);

app.get('/hello', verifyToken, (req, res) => {
  console.log('Inside /hello route handler');
  res.json({ test: 'hello', user: req.user });
});

app.post('/analyze-resume', verifyToken, upload.single('resume'), async (req, res) => {
  const uid = req.user.uid;
  const userLimitRef = db.collection('userLimit').doc(uid);
  const description = req.body.jobDescription;

  if (!req.file) {
    return res.status(400).json({ error: 'No resume file uploaded' });
  }

  if (!description) {
    return res.status(400).json({ error: 'No job description provided' });
  }

  try {
    const doc = await userLimitRef.get();
    let canProceed = false;
    let currentData = null;

    if (doc.exists) {
      currentData = doc.data();
      if (currentData.currentCount < currentData.maxCount) {
        canProceed = true;
      }
    } else {
      // Create new entry
      currentData = {
        userId: uid,
        maxCount: 5,
        currentCount: 0, // Will be incremented to 1
        lastUse: new Date().toISOString()
      };
      await userLimitRef.set(currentData);
      canProceed = true;
    }

    if (canProceed) {
      // 1. Parse PDF
      const pdfData = await pdf(req.file.buffer);
      const resumeText = pdfData.text;

      // 2. Call Gemini API
      const prompt = resumeAnalysisPrompt.replace('{resume}', resumeText).replace('{jobDescription}', description);
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const rawResponse = await response.text();
      const jsonMatch = rawResponse.match(/```json\n([\s\S]*?)```/);
      let analysis;
      if (jsonMatch && jsonMatch[1]) {
        analysis = JSON.parse(jsonMatch[1]);
      } else {
        // Fallback or error handling if JSON block is not found
        console.warn('Could not extract JSON from Gemini response. Raw response:', rawResponse);
        analysis = { error: 'Failed to parse analysis from Gemini response', rawResponse };
      }
      

      // 3. Update Limit
      await userLimitRef.update({
        currentCount: admin.firestore.FieldValue.increment(1),
        lastUse: new Date().toISOString()
      });

      return res.json({ 
        message: 'Analysis successful', 
        analysis: analysis,
        // currentCount: (currentData.currentCount || 0) + 1 
      });

    } else {
      return res.status(429).json({ error: 'max limit reached' });
    }
  } catch (error) {
    console.error('Error processing request:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Public route for testing server status
app.get('/', (req, res) => {
  res.send('Server is running');
});

module.exports = app;

// app.listen(port, () => {
//   console.log(`Server is running on port ${port}`);
// });
