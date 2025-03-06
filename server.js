const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");
const multer = require("multer");
const dotenv = require("dotenv");
const fs = require("fs");
const jwt = require("jsonwebtoken");


dotenv.config();
const app = express();

app.use(express.json());
app.use(cors());

const uploadDir = "./uploads/images";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Database Connection
mongoose.connect(process.env.MONGO_URL, {
  serverSelectionTimeoutMS: 5000 // Timeout after 5s instead of default 30s
})
.then(() => console.log("DB connected successfully"))
.catch(err => console.error("DB connection failed:", err));


const PORT = process.env.PORT || 5000;

// Multer Setup
const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    cb(null, `${file.fieldname}_${Date.now()}_${path.extname(file.originalname)}`);
  }
});

const upload = multer({ storage });

// Serve uploaded images
app.use("/images", express.static(path.join(__dirname, "uploads/images")));

// Routes
app.get("/", (req, res) => {
  res.send("API working HA HAAAAAAA");
});

app.post("/upload", upload.single("product"), (req, res) => {
  res.json({
    success: true,
    image_url: `${req.protocol}://${req.get("host")}/images/${req.file.filename}`
  });
});

//http://localhost:5000/images/product_1740983755325_.jpg"


// Schema & Model
const productSchema = new mongoose.Schema({
  id: { type: Number, required: true },
  name: { type: String, required: true },
  image: { type: String, required: true },
  category: { type: String, required: true },
  new_price: { type: Number, required: true },
  old_price: { type: Number, required: true },
  date: { type: Date, default: Date.now },
  available: { type: Boolean, default: true }
});

const Product = mongoose.model("products", productSchema);

// Add Product API
app.post("/addProduct", async (req, res) => {

    let products =  await Product.find({})
    let id;

    if(products.length>0){
      let last_pro_arr = products.slice(-1)
      let last_pro = last_pro_arr[0];
      id=last_pro.id+1
    }else{
      id=1;
    }
  try {
    const product = new Product({
      id:id,
      name: req.body.name,
      image: req.body.image,
      category: req.body.category,
      new_price: req.body.new_price,
      old_price: req.body.old_price
    });

    console.log(product)

    await product.save();
    console.log("Saved")


    res.json({ success: true, name: req.body.name });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});



//remove product API


app.post('/removeProduct', async (req, res) => {
  try {
    const { id } = req.body;

    // Validate input
    if (!id) {
      return res.json({ success: false, message: "Product ID is required" });
    }

    // Find and delete the product
    const deleted_pro = await Product.findOneAndDelete({ id });

    // If product is not found
    if (!deleted_pro) {
      return res.json({ success: false, message: `Product with ID ${id} not found` });
    }

    console.log("Deleted successfully:", deleted_pro.name);

    res.json({ success: true, message: `Product '${deleted_pro.name}' deleted successfully` });

  } catch (err) {
    console.error("Error deleting product:", err);
    res.status(500).json({ success: false, message: "Internal Server Error", error: err.message });
  }
});

//All Product API

app.get('/allProducts',async(req,res)=>{
  try{

    const products = await Product.find({})

    res.send(products)

  }catch(err){

    res.send(err)

  }
})


//user model

const Users = mongoose.model('users',{
  name:{
    type:String
  },
  email:{
    type:String,
    unique:true


  },
  password:{
    type:String

  },
  cartData:{
    type:Object

  },
  date:{
    type:Date,
    default:Date.now

  }

})

//Register API

app.post('/register',async(req,res)=>{
  let check = await Users.findOne({email:req.body.email})
  if(check){
    return res.json({
      success:false,
      message:"User exists"
    })}

    let cart ={}

    for(let i=0;i<300;i++){
      cart[i]=0;
    }

    const user =new Users({
      name:req.body.name,
      email:req.body.email,
      password:req.body.password,
      cartData:cart,

    })

    await user.save();

    const data={
      user:{
        id:user.id
      }
    }

    const token= jwt.sign(data,'secret_ecom')

    res.json({
      success:true,
      token
    })



  
})


//Login API

app.post('/login',async(req,res)=>{
  let user = await Users.findOne({email:req.body.email})


if(user){
  const passCompare = req.body.password===user.password;

  if(passCompare){
    const data ={
      user:{
        id:user.id
      }
    }
    const token = jwt.sign(data,'secret_ecom')

    res.json({
      success:true,token
    })
  }
  else{
    res.json({
      success:false,message:"Wrong password"
    })
  }
}

else{
  res.json({
    success:false,
    message:"Email not found"
  })
}

})

//NewCollection API

app.get('/newCollection',async(req,res)=>{
  let products = await Product.find({});
  let newCollections = products.slice(1).slice(-8);

  console.log("New collections fetched")

  res.send(newCollections)

})

//Popular collection API 

app.get('/popularCollection', async (req, res) => {
  try {
    let products = await Product.find({ category: "women" });

    console.log(products.length);

    let newCollections = products.slice(1).slice(-4); 


    console.log("New collections fetched:", newCollections.length);

    res.json(newCollections); 
  } catch (error) {
    console.error("Error fetching popular collection:", error);
    res.status(500).send("Internal Server Error");
  }
});

//cart items to db API

app.post('/addtocart', async (req, res) => {
  try {
    const { email, itemId, quantity } = req.body;

    if (!email || itemId === undefined || quantity === undefined) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    // Find user by email
    let user = await Users.findOne({ email });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Ensure cartData exists in user document
    if (!user.cartData) {
      user.cartData = {};
    }

    // Update cart with new item quantity
    user.cartData[itemId] = (user.cartData[itemId] || 0) + quantity;

    // Save updated cart
    await user.save();

    res.json({
      success: true,
      message: "Item added to cart successfully",
      cartData: user.cartData
    });

  } catch (error) {
    console.error("Error adding to cart:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

//order model

const OrderSchema = new mongoose.Schema({

  userid:{ type: String, required: true },

  userDetails: {
    firstName: { type: String, required: true },
    lastName: { type: String},
    email: { type: String},
    phone: { type: String, required: true },
    city: { type: String, required: true },
    area: { type: String, required: true },
    pinCode: { type: String, required: true },
    landmark: { type: String }
  },
  cartItems: [
    {
      productId: { type: String, required: true },
name: { type: String, required: true },
      price: { type: Number, required: true },
      quantity: { type: Number, required: true },
      totalPrice: { type: Number},
      image: { type: String }
    }
  ],
  orderTotal: { type: Number, required: true },
  orderDate: { type: Date, default: Date.now },
  orderStatus: {
    type: String,
    enum: ["pending", "confirmed", "shipped", "delivered"], 
    default: "pending"
  }

})

const       Order = mongoose.model('Order', OrderSchema);

//order API


app.post('/order', async (req, res) => {
  try {
    const { user, cartItems, totalAmount , userId } = req.body;

    if (!user || !cartItems || cartItems.length === 0) {
      return res.status(400).json({ success: false, message: "Invalid order data" });
    }

    const newOrder = new Order({
      userid:userId.id || userId,
      userDetails: user,
      cartItems: cartItems,
      orderTotal: totalAmount
    });

    await newOrder.save();
    console.log("Order placed successfully");

    res.json({ success: true, message: 'Order placed successfully!', order: newOrder });

  } catch (error) {
    console.error("Error placing order:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});


//Fetch Order data

app.get('/getOrder', async (req, res) => {
  try {
    const fetchedData = await Order.find({});
    res.json({
      success: true,
      data: fetchedData,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching orders",
      error: error.message,
    });
  }
});




// Admin Status Update API
app.put('/status', async (req, res) => {
  try {
    const { orderId, status } = req.body;

    if (!orderId || !status) {
      return res.status(400).json({ success: false, message: "Order ID and status are required" });
    }

    const updatedOrder = await Order.findByIdAndUpdate(
      orderId, 
      { orderStatus: status }, 
      { new: true }
    );

    if (!updatedOrder) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    console.log("Order status updated:", updatedOrder.orderStatus);

    res.json({
      success: true,
      message: `Order status updated to '${updatedOrder.orderStatus}'`,
      updatedOrder
    });

  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});




// Start Server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
