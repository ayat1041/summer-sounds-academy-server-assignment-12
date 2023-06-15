const express = require("express")
const cors = require("cors")
const app = express();
require('dotenv').config()
const port = process.env.PORT || 5000;
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    console.log(authorization);
    if (!authorization) {
        return res.status(401).send({ error: true, message: 'no header' });
    }
    const token = authorization.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ error: true, message: 'unauthorized access this one?' });
        }
        req.decoded = decoded;
        next();
    })
}



const uri = `mongodb+srv://${process.env.VITE_user}:${process.env.VITE_pass}@cluster0.ichdzcf.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
// const client = new MongoClient(uri, {
//     serverApi: {
//         version: ServerApiVersion.v1,
//         strict: true,
//         deprecationErrors: true,
//     }
// });

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
    useNewUrlParser: true,
    useUnifiedTopology: true,
    maxPoolSize: 10
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
        const paymentCollection = database.collection("payments");

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
            let allUsers = await users.find(query);

            if (queryRole === "instructor") {
                allUsers = await allUsers.sort({ total_students: -1 });
            }

            allUsers = await allUsers.limit(lim).toArray();

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
        app.delete("/enrollment/:id", async (req, res) => {
            const enrollmentId = req.params.id;

            const result = await enrollment.deleteOne({ _id: new ObjectId(enrollmentId) });
            res.send(result);
        });

        // update status after payment
        app.patch("/enrollment/payment/:id", async (req, res) => {
            const enrollmentId = req.params.id;

            const enrollmentObj = await enrollment.findOne({ _id: new ObjectId(enrollmentId) });

            enrollmentObj.status = "paid";

            const result = await enrollment.updateOne(
                { _id: new ObjectId(enrollmentId) },
                { $set: enrollmentObj }
            );
            res.send(result);
        });




        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '12h' })
            res.send({ token })
        })


        // payment intent
        app.post('/create-payment-intent', verifyJWT, async (req, res) => {
            // app.post('/create-payment-intent', async (req, res) => {
            const { price } = req.body;
            const amount = parseFloat(price) * 100;
            console.log(price, amount);
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });
            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        })

        // payment api
        app.post('/payments', async (req, res) => {
            const payment = req.body;
            const result = await paymentCollection.insertOne(payment)
            res.send(result);
        })
        app.get('/payments', async (req, res) => {
            const email = req.query.email || "";
            const payments = await paymentCollection.find({ email: email }).sort({ date: -1 }).toArray();
            res.send(payments);
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

        app.get("/users/:id", async (req, res) => {
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
        app.delete('/users/:id', async (req, res) => {
            const userId = req.params.id;
            const query = { _id: new ObjectId(userId) };
            const result = await users.deleteOne(query);
            res.send(result);
        })


        app.post("/users", async (req, res) => {
            const newUser = req.body;
            const query = { email: newUser.email }
            const existingUser = await users.findOne(query);
            if (existingUser) {
                return res.send({ message: 'user already exists' })
            }
            console.log(newUser);

            const result = await users.insertOne(newUser);
            res.send(result);
        })

        // get all classes
        app.get("/classes", async (req, res) => {
            const sort = req.query.sort || false;
            const approval = req.query.approval || false;
            const lim = parseInt(req.query.lim) || 0;
            let query = {};
            if (approval) {
                query = { status: "approved" };
            }
            let sortOptions = {};
            if (sort === "true") {
                sortOptions = { enrolled_students: -1 };
            }

            const allClasses = await classes.find(query).sort(sortOptions).limit(lim).toArray();
            res.send(allClasses);
        })

        // find single class
        app.get("/classes/:id", async (req, res) => {
            const classId = req.params.id;
            const query = { _id: new ObjectId(classId) };

            const foundClass = await classes.findOne(query);
            res.send(foundClass);
        });

        app.post("/classes", async (req, res) => {
            const {
                class_image,
                class_name,
                details,
                instructor_name,
                instructor_email,
                available_seats,
                price,
                status = "pending",
                feedback = "",
            } = req.body;

            const newClass = {
                class_image,
                class_name,
                details,
                instructor_name,
                instructor_email,
                available_seats: parseInt(available_seats),
                price: parseFloat(price),
                status,
                feedback,
                enrolled_students: 0
            };

            const result = await classes.insertOne(newClass);
            res.send(result);
        });


        app.patch("/classes/updateClass/:id", async (req, res) => {
            const classId = req.params.id;
            const {
                class_image,
                class_name,
                details,
                instructor_name,
                instructor_email,
                available_seats,
                price,
                status = "pending",
                feedback = ""
            } = req.body;

            const updatedClass = {
                class_image,
                class_name,
                details,
                instructor_name,
                instructor_email,
                available_seats: parseInt(available_seats),
                price: parseFloat(price),
                status,
                feedback,
            };


            const filter = { _id: new ObjectId(classId) };
            const update = { $set: updatedClass };

            const result = await classes.updateOne(filter, update);

            res.send(result);
        });

        // approval denied
        app.patch("/classes/approval/denied/:id", async (req, res) => {
            const classId = req.params.id;
            const {
                status = "denied",
                feedback
            } = req.body;

            const updatedClass = {
                status,
                feedback
            };
            const filter = { _id: new ObjectId(classId) };
            const update = { $set: updatedClass };
            const result = await classes.updateOne(filter, update);
            res.send(result);
        });

        //approved
        app.patch("/classes/approval/approved/:id", async (req, res) => {
            const classId = req.params.id;
            const {
                status = "approved",
                feedback
            } = req.body;

            const updatedClass = {
                status,
                feedback
            };
            const filter = { _id: new ObjectId(classId) };
            const update = { $set: updatedClass };
            const result = await classes.updateOne(filter, update);
            const classData = await classes.findOne(filter);

            const query = { email: classData.instructor_email };

            const updatedInstructor = {
                $inc: {
                    no_of_classes: 1
                }
            }

            updatedResult = await users.updateOne(query, updatedInstructor);

            res.send(result);
        });






        // app.post("/classes", async (req, res) => {
        //     const newClass = req.body;
        //     console.log(newClass);
        //     const result = await classes.insertOne(newClass);
        //     res.send(result);
        // })
        // update available seats and enrolled students
        app.patch("/classes/seats/enrolled/:id", async (req, res) => {
            const classId = req.params.id;

            const classObj = await classes.findOne({ _id: new ObjectId(classId) });
            classObj.available_seats -= 1;
            classObj.enrolled_students += 1;

            const result = await classes.updateOne(
                { _id: new ObjectId(classId) },
                { $set: classObj }
            );
            res.send(result);
        });

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