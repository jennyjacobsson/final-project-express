import express from 'express'
import bodyParser from 'body-parser'
import cors from 'cors'
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import cloudinary from 'cloudinary'
import multer from 'multer'
import cloudinaryStorage from 'multer-storage-cloudinary'

dotenv.config()

const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

cloudinary.config({
  cloud_name: 'plants', // this needs to be whatever you get from cloudinary
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
})

const storage = cloudinaryStorage({
  cloudinary,
  folder: 'test',
  allowedFormats: ['jpg', 'png'],
  transformation: [{ width: 300, height: 300, crop: "limit" }]
})
const parser = multer({ storage })


const mongoUrl = process.env.MONGO_URL || "mongodb://localhost/plantsAPI"
mongoose.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true })
mongoose.Promise = Promise

const SalesAd = mongoose.model("SalesAd", {
  imageUrl: String,
  imageId: String,
  name: String,
  email: String,
  title: String,
  type: String,
  location: String,
  description: String,
  price: Number
})

const port = process.env.PORT || 8080
const app = express()

// Add middlewares to enable cors and json body parsing
app.use(cors())
app.use(bodyParser.json())

// Start defining your routes here
app.get('/', (req, res) => {
  res.send('Hello world')
})


app.post("/ad", parser.single('image'), async (req, res) => {
  try {
    const { name, email, title, type, location, description, price } = req.body
    const ad = new SalesAd({
      imageUrl: req.file.secure_url,
      imageId: req.file.public_id,
      name,
      email,
      title,
      type,
      location,
      description,
      price,
    })
    const saved = await ad.save()
    res.status(201).json({ saved, message: "Ad completed" })
  } catch (err) {
    res.status(400).json({ message: "Could not create ad", errors: err.errors })
  }
})

app.get("/ads", async (req, res) => {
  const { search } = req.query
  const params = {}
  if (search) {
    const r = new RegExp(search, 'i')
    params.$or = [
      { type: r },
      { description: r },
      { location: r }
    ]
  }

  const ads = await SalesAd.find(params).limit(30).exec()
  res.json(ads)
})

app.get("/ads/:id", async (req, res) => {
  const { id } = req.params

  const ad = await SalesAd.findById(id)

  res.json(ad)
})

app.post('/response', async (req, res) => {
  const { _id, email, subject, message } = req.body
  const ad = await SalesAd.findById(_id)

  const msg = {
    to: 'enni@oans.net',
    from: 'noreply@johanhermansson.se',
    replyTo: 'johan@johanhermansson.se',
    subject: subject,
    text: message
  };

  sgMail.send(msg).then(() => {
    res.status(201).json({ message: 'Response sent' })
  }).catch(err => {
    console.error(err)
    res.status(400).json({ message: 'E-mail could not be sent', errors: err.errors })
  });
})

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`)
})
