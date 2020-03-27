import express from 'express'
import bodyParser from 'body-parser'
import cors from 'cors'
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import cloudinary from 'cloudinary'
import multer from 'multer'
import cloudinaryStorage from 'multer-storage-cloudinary'
import crypto from "crypto"
import bcrypt from "bcrypt"

dotenv.config()

const salt = bcrypt.genSaltSync(10);

const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

cloudinary.config({
  cloud_name: 'plants',
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
})

const storage = cloudinaryStorage({
  cloudinary,
  folder: 'plants',
  allowedFormats: ['jpg', 'png'],
  transformation: [{ width: 500, height: 500, crop: "limit" }]
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
  price: Number,
  createdAt: Number,
  userId: String
})

const User = mongoose.model("User", {
  name: {
    type: String,
    unique: true,
    trim: true
  },
  email: {
    type: String,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  accessToken: {
    type: String,
    default: () => crypto.randomBytes(128).toString("hex")
  }
})

const authenticateUser = async (req, res, next) => {
  const user = await User.findOne({ accessToken: req.header("Authorization") })
  if (user) {
    req.user = user
    next()
  } else {
    res.status(401).json({ loggedOut: true, message: "Please log in to view this content" })
  }
}

const port = process.env.PORT || 8080
const app = express()

// Add middlewares to enable cors and json body parsing
app.use(cors())
app.use(bodyParser.json())

// Start defining your routes here
app.get('/', (req, res) => {
  res.send('Hello world')
})


//Registration
app.post("/users", async (req, res) => {
  try {
    const { name, email, password } = req.body
    const user = new User({
      name, email, password: bcrypt.hashSync(password, salt)
    })
    const saved = await user.save()
    res.status(201).json({ saved, message: "Registration succeeded" })
  } catch (err) {
    console.error(err)
    res.status(400).json({ message: "Could not create user", errors: err.errors })
  }
})

//Log in
app.post("/login", async (req, res) => {
  const { email, password } = req.body
  const user = await User.findOne({ email })
  if (user && bcrypt.compareSync(password, user.password)) {
    res.json({ userId: user._id, userName: user.name, accessToken: user.accessToken })
  } else {
    res.status(400).json({ notFound: true })
  }
}
)

app.post('/ad', authenticateUser)
app.post("/ad", parser.single('image'), async (req, res) => {
  try {
    const { title, type, location, description, price } = req.body
    const ad = new SalesAd({
      imageUrl: req.file.secure_url,
      imageId: req.file.public_id,
      title,
      type,
      location,
      description,
      price,
      userId: req.user.id
    })
    const saved = await ad.save()
    res.status(201).json({ saved, message: "Ad completed" })
  } catch (err) {
    res.status(400).json({ message: "Could not create ad", errors: err.errors })
  }
})

app.get("/ads", async (req, res) => {
  const { search, userId } = req.query
  const params = {}
  if (search) {
    const regex = new RegExp(search, 'i')
    params.$or = [
      { title: regex },
      { type: regex },
      { description: regex },
      { location: regex }
    ]
  }

  if (userId) {
    params.userId = userId
  }

  const ads = await SalesAd.find(params).limit(30).exec()
  res.json(ads)
})

app.get("/ads/:id", async (req, res) => {
  const { id } = req.params
  const ad = await SalesAd.findById(id)
  res.json(ad)
})

app.delete("/ads/:id", authenticateUser)
app.delete("/ads/:id", async (req, res) => {
  const { id } = req.params
  const ad = await SalesAd.findById(id)
  if (ad.userId !== req.user.id) {
    res.status(400).send({ message: 'You have wrong permissions' })
  }
  await SalesAd.deleteOne({ _id: id })
  res.json({})
})

app.post('/answer', async (req, res) => {
  const { id, name, email, message } = req.body
  const ad = await SalesAd.findById(id)
  const text = [
    'Hello,',
    '',
    'Someone has answered on your plant ad:',
    '',
    `Name: ${name}`,
    `E-mail: ${email}`,
    `Message: ${message}`,
    '',
    `The link to your plant ad: https://plant-adoption.netlify.com/plants/${ad._id}`,
    '',
    '/Plant adoption'
  ]

  const msg = {
    to: 'enni@oans.net',
    // ad.email
    from: 'noreply@johanhermansson.se',
    replyTo: email,
    subject: 'Answer from Plant adoption!',
    text: text.join("\n")
  };

  sgMail.send(msg).then(() => {
    res.status(201).json({ message: 'Answer sent' })
  }).catch(err => {
    console.error(err)
    res.status(400).json({ message: 'E-mail could not be sent', errors: err.message })
  });
})

app.get('/mypage', authenticateUser)
//This will only be shown if the next()-function is called from the middleware
app.get('/mypage', (req, res) => {
  res.json({ secret: 'This is a super secret message' })
})

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`)
})
