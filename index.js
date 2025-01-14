const express = require('express')
require('dotenv').config()
const app = express()
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());


const uri = `mongodb://${process.env.DB_USER}:${process.env.DB_PASS}@cluster3-shard-00-00.ggy8e.mongodb.net:27017,cluster3-shard-00-01.ggy8e.mongodb.net:27017,cluster3-shard-00-02.ggy8e.mongodb.net:27017/?ssl=true&replicaSet=atlas-12vcf6-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Cluster3`;


console.log(uri);
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

const verifyToken = (req, res, next) => {
    if (!req?.headers?.authorization) {
        return res.status(401).send({ message: 'unauthorized access' })
    }
    const token = req?.headers?.authorization.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
        if (err) {
            return res.status(401).send({ message: 'unauthorized access' })
        }
        req.decoded = decoded
        next();
    })
}


async function run() {
    try {
        const userCollection = client.db('foodDB').collection('users')
        const menuCollection = client.db('foodDB').collection('menus')
        const reviewCollection = client.db('foodDB').collection('reviews')
        const cartCollection = client.db('foodDB').collection('carts')

        // jwt related apis
        app.post('/jwt', async (req, res) => {
            const data = req.body;
            const token = jwt.sign(data, process.env.ACCESS_TOKEN, { expiresIn: '30d' })
            res.send({ token });
        })

        // validation
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await userCollection.findOne(query);
            const isAdmin = user?.role === 'admin'
            if (!isAdmin) {
                return res.status(403).send({ message: 'Forbidden access' })
            }
            next();
        }

        // user related apis
        app.get('/user/admin/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            // console.log('email', email);
            // console.log('header data', req?.decoded?.email);
            if (email !== req?.decoded?.email) {
                return res.status(403).send({ message: 'Forbidden access' })
            }
            const query = { email: email }
            const user = await userCollection.findOne(query);
            let admin = false;
            if (user) {
                admin = user.role = 'admin'
            }
            res.send({ admin })
        })

        app.get('/users', verifyToken, async (req, res) => {
            // console.log(req.user);
            const result = await userCollection.find().toArray();
            res.send(result)
        })

        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user?.email };
            const isExist = await userCollection.findOne(query)
            if (isExist) {
                return res.send({ message: 'user already exist in db' })
            }
            const result = await userCollection.insertOne(user);
            res.send(result);
        })

        app.delete('/user/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await userCollection.deleteOne(query);
            res.send(result);
        })

        app.patch('/user/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await userCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })

        // cart related apis
        app.get('/cart', async (req, res) => {
            const email = req.query.email;
            const query = { email };
            const result = await cartCollection.find(query).toArray();
            res.send(result);
        })

        app.post('/carts', async (req, res) => {
            const cartData = req.body;
            const result = await cartCollection.insertOne(cartData);
            res.send(result);
        })

        app.delete('/cart/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await cartCollection.deleteOne(query);
            res.send(result);
        })

        // menu related apis
        app.get('/menus', async (req, res) => {
            const result = await menuCollection.find().toArray();
            res.send(result)
        })

        app.get('/menu/:id', async (req, res) => {
            const id = req.params;
            const query = { _id: new ObjectId(id) };
            const result = await menuCollection.findOne(query);
            res.send(result);
        })

        app.post('/menu', async (req, res) => {
            const item = req.body;
            const result = await menuCollection.insertOne(item);
            res.send(result);
        })

        app.patch('/menu/:id', async (req, res) => {
            const id = req.params.id;
            const item = req.body;
            const filter = { _id: new ObjectId(id) };
            const options = { upsert: true }
            const updatedDoc = {
                $set: item
            }
            const result = await menuCollection.updateOne(filter, updatedDoc, options)
            res.send(result)
        })

        app.delete('/menu/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await menuCollection.deleteOne(query);
            res.send(result);
        })

        // review related apis
        app.get('/reviews', async (req, res) => {
            const result = await reviewCollection.find().toArray();
            res.send(result)
        })

        // payment intent
        app.post('/create-payment-intent', async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100);
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            })
            res.send({
                clientSecret: paymentIntent.client_secret,
            })
        })

        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();
        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);




app.get('/', (req, res) => {
    res.send('Food fry is running!')
})

app.listen(port, () => {
    console.log(`Food fry is running on port ${port}`)
})