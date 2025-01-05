const express = require('express')
const app = express()
const cors = require('cors');
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster3.ggy8e.mongodb.net/?retryWrites=true&w=majority&appName=Cluster3`;

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
        const userCollection = client.db('foodDB').collection('users')
        const menuCollection = client.db('foodDB').collection('menus')
        const reviewCollection = client.db('foodDB').collection('reviews')
        const cartCollection = client.db('foodDB').collection('carts')

        // user related apis
        app.get('/users', async (req, res) => {
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

        app.delete('/user/:id', async(req,res)=>{
            const id = req.params.id;
            const query = {_id: new ObjectId(id)}
            const result = await userCollection.deleteOne(query);
            res.send(result);
        })

        app.patch('/user/admin/:id', async(req,res)=>{
            const id = req.params.id;
            const filter = {_id: new ObjectId(id)}
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

        app.delete('/cart/:id', async (req, res) => {
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

        app.get('/reviews', async (req, res) => {
            const result = await reviewCollection.find().toArray();
            res.send(result)
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