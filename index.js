const express = require("express")
const cors = require("cors")
const app = express();
const port = process.env.PORT || 5000;
require('dotenv').config()
app.use(cors());
app.use(express.json());



const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
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
        const enrollment = database.collection("enrollment");

        // get all users
        app.get("/users", async (req, res) => {
            const queryRole = req.query.role;
            const queryEmail = req.query.email;
            const lim = parseInt(req.query.lim) || 0;
            let query = {};
            if (queryRole) {
              query.role = queryRole;
            }
            if (queryEmail) {
              query.email = queryEmail;
            }
            const allUsers = await users.find(query).limit(lim).toArray();
            res.send(allUsers);
        })

        app.get("/enrollment", async (req, res) => {
            let query = {};
            const allEnrollment = await enrollment.find(query).toArray();
            res.send(allEnrollment);
        })

        app.post("/enrollment", async (req, res) => {
            const newEnrollment = req.body;
          
            console.log(newEnrollment);
            const result = await enrollment.insertOne(newEnrollment);
            res.send(result);
          });

        // increase instructors total students number
        app.post("/increaseTotalStudents", async (req, res) => {
            const { instructor_email } = req.body;
            console.log(instructor_email);
            // Find the user based on the query object
            const query = { email: instructor_email };
            const user = await users.findOne(query);
          
            if (!user) {
              return res.send({ message: 'User not found' });
            }
          
            // Check if the user entry has the field 'total_students'
            if (!user.total_students) {
              // If the field doesn't exist, add a new field 'total_students' with default value 1
              user.total_students = 1;
            } else {
              // If the field already exists, increment the value of 'total_students' by 1
              user.total_students++;
            }
          
            // Update the user entry in the database
            const result = await users.updateOne(query, { $set: user });
          
            if (result.modifiedCount === 1) {
              return res.send({ message: 'Total students updated successfully' });
            } else {
              return res.send({ message: 'Failed to update total students' });
            }
          });

        app.get("/users/:id", async(req,res)=>{
            const userId = req.params.id;
            const query = { _id: new ObjectId(userId) };

            const movie = await users.findOne(query);
            res.send(movie)
        })
        app.patch("/users/promote/:id", async (req, res) => {
            const userId = req.params.id;
            const role = req.body.role;
            console.log(role);
            const filter = { _id: new ObjectId(userId) };
            let updatedUser = { $set: { role: role } }; // Default update object
          
            // if (role === "instructor") {
            //   updatedUser.$set.no_of_classes = 0; 
            //   updatedUser.$set.name_of_classes = []; 
            // }
          
            const movie = await users.updateOne(filter, updatedUser);
            res.send(movie);
          });
        app.delete('/users/:id', async(req,res)=>{
            const userId = req.params.id;
            const query = { _id: new ObjectId(userId) };
            const result = await users.deleteOne(query);
            res.send(result);
        })


        app.post("/users", async(req,res)=>{
            const newUser = req.body;
            const query = {email: newUser.email}
            const existingUser = await users.findOne(query);
            if(existingUser){
                return res.send({message: 'user already exists'})
            }
            console.log(newUser);
            
            const result = await users.insertOne(newUser);
            res.send(result);
        })

        // get all classes
        app.get("/classes", async (req, res) => {
            const sort = req.query.sort || false;
            const lim = parseInt(req.query.lim) || 0;
            let sortOptions = {};
            if (sort === "true") {
                sortOptions = { enrolled_students: -1 };
              }
            const allClasses = await classes.find().sort(sortOptions).limit(lim).toArray();
            res.send(allClasses);
        })

        app.post("/classes", async(req,res)=>{
            const newClass = req.body;
            console.log(newClass);
            const result = await users.insertOne(newClass);
            res.send(result);
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