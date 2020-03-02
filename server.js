import express from 'express'
import bodyParser from 'body-parser'
import cors from 'cors'
import mongoose from 'mongoose'

const mongoUrl = process.env.MONGO_URL || "mongodb://localhost/plantsAPI"
mongoose.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true })
mongoose.Promise = Promise

const SalesAd = mongoose.model("SalesAd", {
  type: {
    type: String,
  },
  location: {
    type: String
  },
  description: {
    type: String
  },
  price: {
    type: Number
  },

  ///Images somehow???

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


app.post("/ad", async (req, res) => {
  try {
    const { type, location, description, price } = req.body
    const ad = new SalesAd({ type, location, description, price })
    const saved = await ad.save()
    res.status(201).json({ saved, message: "Ad completed" })
  } catch (err) {
    res.status(404).json({ message: "Not found", errors: err.errors })
  }
})

app.get("/ads", async (req, res) => {
  res.send(await SalesAd.find())
})

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`)
})
