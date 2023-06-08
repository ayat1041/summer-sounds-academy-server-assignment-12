const express = require("express")
const cors = require("cors")
const app = express();
const port = process.env.PORT || 5000;
require('dotenv').config()
app.use(cors());
app.use(express.json());



const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = `mongodb+srv://${process.env.VITE_user}:${process.env.VITE_pass}@cluster0.ichdzcf.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();
        // Send a ping to confirm a successful connection

        const database = client.db("summerSoundsDB");
        const users = database.collection("users");
        const classes = database.collection("classes");

        // get all users
        app.get("/users", async (req, res) => {
            const cursor = await users.find().toArray();
            // const result = await cursor.toArray();
            res.send(cursor);
        })

        // get all classes
        app.get("/classes", async (req, res) => {
            const cursor = await classes.find().toArray();
            // const result = await cursor.toArray();
            res.send(cursor);
        })
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



app.get("/", (req, res) => {
    res.send('Summer is on');
})

app.listen(port, () => {
    console.log("Im on on", port);
})