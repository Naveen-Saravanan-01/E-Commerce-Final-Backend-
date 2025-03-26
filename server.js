const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");
const multer = require("multer");
const dotenv = require("dotenv");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const transporter=require('./nodemailer.js')


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
  resetOtp:{
    type:String,
    default:null
  },
  resetOtpExpire:{
    type:Date,
    default:null


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
    const mailOptions = {
      from: `"Naveen" <${process.env.SENDER_MAIL}>`,
      to: req.body.email,
      subject: "Welcome to Naveen's Website",
      html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px; text-align: center;">

              <div style="display:flex; align-items:center; justify-center">

                <img src="https://i.imgur.com/1HjO0S1.png" alt="Website Logo" style="max-width: 150px; margin-bottom: 20px;">

              </div>
              <h2 style="color: #333;">Welcome, ${req.body.name}!</h2>
              <p style="color: #555; font-size: 16px;">
                  Your account has been successfully created with the email ID: <strong>${req.body.email}</strong>.
              </p>
              <img src="https://i.imgur.com/1HjO0S1.png" alt="Welcome Image" style="max-width: 100%; border-radius: 10px; margin-top: 20px;">
              <p style="margin-top: 20px;">
                  <a href="https://e-commerce-final-backend-production.up.railway.app" style="display: inline-block; padding: 10px 20px; background-color: #007BFF; color: white; text-decoration: none; border-radius: 5px;">
                      Login Now
                  </a>
              </p>
              <p style="font-size: 14px; color: #888; margin-top: 20px;">
                  If you did not sign up for this account, please ignore this email.
              </p>
          </div>
      `
  };
  
  await transporter.sendMail(mailOptions);
  

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

    if (!user.cartData) {
      user.cartData = {};
    }

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
    email: { type: String, required: true},
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
    enum: ["Pending", "Confirmed", "Shipped", "Delivered","Cancelled"], 
    default: "Pending"
  }

})

const       Order = mongoose.model('Order', OrderSchema);


//order Api


app.post('/order', async (req, res) => {
  try {
    const { user, cartItems, totalAmount, userId, email, name } = req.body;

    if (!user || !cartItems || cartItems.length === 0) {
      return res.status(400).json({ success: false, message: "Invalid order data" });
    }

    const newOrder = new Order({
      userid: userId.id || userId,
      userDetails: user,
      cartItems: cartItems,
      orderTotal: totalAmount,
    });

    await newOrder.save();
    // console.log("Order placed successfully");

    // Generate cart items in table format
    const cartItemsMapped = cartItems.map(item => `
      <tr>
        <td style="border: 1px solid #ddd; padding: 8px;">${item.name}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${item.quantity}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">$${item.price}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">$${item.quantity * item.price}</td>
      </tr>
    `).join('');

    const mailOptions = {
      from: `"Naveen" <${process.env.SENDER_MAIL}>`,
      to: email,
      subject: "Order Confirmation - Your Order has been Placed!",
      html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px; text-align: center;">

               <div style="display:flex; align-items:center; justify-center">

                <img src="https://i.imgur.com/1HjO0S1.png" alt="Website Logo" style="max-width: 150px; margin-bottom: 20px;">

              </div>


              <h2 style="color: #333;">Thank You for Your Order, ${name}!</h2>
              <p style="color: #555; font-size: 16px;">
                  Your order has been successfully placed. Here are your order details:
              </p>
              
              <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                <thead>
                  <tr>
                    <th style="border: 1px solid #ddd; padding: 8px; background-color: #f2f2f2;">Product</th>
                    <th style="border: 1px solid #ddd; padding: 8px; background-color: #f2f2f2;">Quantity</th>
                    <th style="border: 1px solid #ddd; padding: 8px; background-color: #f2f2f2;">Price</th>
                    <th style="border: 1px solid #ddd; padding: 8px; background-color: #f2f2f2;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${cartItemsMapped}
                </tbody>
              </table>

              <p style="font-size: 18px; margin-top: 20px;"><strong>Total Amount: $${totalAmount}</strong></p>

              <p>Your order will be processed soon.</p>

              <p style="margin-top: 20px;">
                  <a href="https://localhost:5000/login" style="display: inline-block; padding: 10px 20px; background-color: #007BFF; color: white; text-decoration: none; border-radius: 5px;">
                      Track Your Order
                  </a>
              </p>

              <p style="font-size: 14px; color: #888; margin-top: 20px;">
                Thanks for shopping with us!
              </p>
          </div>
      `
    };

    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: 'Order placed successfully!', order: newOrder });

  } catch (error) {
    console.error("Error placing order:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});



//Fetch email


app.post('/findEmail',async(req,res)=>{

  try{
    const userId=req.body.userId;
    const findUser=await Users.findById(userId);
    const name=findUser.name;
    const userEmail=findUser.email;

    res.json({
      success:true,message:userEmail,name:name
    })

  }catch(err){
    res.json({

      success:false,
      message:err.message

    })
  }



})





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


// Cancel Order API
app.post('/cancelOrder', async (req, res) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({ success: false, message: "Order ID is required" });
    }

    let order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.status === "Cancelled") {
      return res.status(400).json({ success: false, message: "Order is already cancelled" });
    }

    order.orderStatus = "Cancelled";
    await order.save();

    res.json({ success: true, message: "Order cancelled successfully", order });

  } catch (error) {
    console.error("Error cancelling order:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});





// Admin Status Update API


app.put('/status', async (req, res) => {
  try {
    const { orderId, status, email, name } = req.body;

    if (!orderId || !status) {
      return res.status(400).json({ success: false, message: "Order ID and status are required" });
    }

    // Update the order status
    const updatedOrder = await Order.findByIdAndUpdate(
      orderId, 
      { orderStatus: status }, 
      { new: true }
    );

    if (!updatedOrder) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const cartItemsMapped = updatedOrder.cartItems.map(item => `
      <tr>
        <td style="border: 1px solid #ddd; padding: 8px;">${item.name}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${item.quantity}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">$${item.price}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">$${(item.price * item.quantity).toFixed(2)}</td>
      </tr>
    `).join("");

    const totalAmount = updatedOrder.orderTotal.toFixed(2);

    // Email content
    const mailOptions = {
      from: `"Naveen" <${process.env.SENDER_MAIL}>`,
      to: email,
      subject: `Order Update - Your Order is ${updatedOrder.orderStatus}`,
      html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px; text-align: center;">
              <div style="display: flex; align-items: center; justify-content: center;">
                <img src="https://i.imgur.com/1HjO0S1.png" alt="Website Logo" style="max-width: 150px; margin-bottom: 20px;">
              </div>
              <h2 style="color: #333;">Hello, ${name}!</h2>
              <p style="color: #555; font-size: 16px;">
                  Your order status has been updated to <strong>${updatedOrder.orderStatus}</strong>. Here are your order details:
              </p>
              
              <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                <thead>
                  <tr>
                    <th style="border: 1px solid #ddd; padding: 8px; background-color: #f2f2f2;">Product</th>
                    <th style="border: 1px solid #ddd; padding: 8px; background-color: #f2f2f2;">Quantity</th>
                    <th style="border: 1px solid #ddd; padding: 8px; background-color: #f2f2f2;">Price</th>
                    <th style="border: 1px solid #ddd; padding: 8px; background-color: #f2f2f2;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${cartItemsMapped}
                </tbody>
              </table>

              <p style="font-size: 18px; margin-top: 20px;"><strong>Total Amount: $${totalAmount}</strong></p>

              <p>Your order will be processed soon.</p>

              <p style="margin-top: 20px;">
                  <a href="https://yourwebsite.com/track-order/${orderId}" style="display: inline-block; padding: 10px 20px; background-color: #007BFF; color: white; text-decoration: none; border-radius: 5px;">
                      Track Your Order
                  </a>
              </p>

              <p style="font-size: 14px; color: #888; margin-top: 20px;">
                Thanks for shopping with us!
              </p>
          </div>
      `
    };

    await transporter.sendMail(mailOptions);

    res.json({
      success: true,
      message: `Order status updated to '${updatedOrder.orderStatus}' and email sent.`,
      updatedOrder
    });

  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});



//reset password

app.post('/resetOtp', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: "Email is required" });
  }

  try {
    const user = await Users.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Generate OTP (6-digit)
    const otp = String(Math.floor(100000 + Math.random() * 900000));

    user.resetOtp = otp;
    user.resetOtpExpire = Date.now() + 24 * 60 * 60 * 1000; 

    await user.save();

    const mailOptions = {
      from: `"Naveen" <${process.env.SENDER_MAIL}>`,
      to: user.email,
      subject: "Password Reset OTP",
      text: `Your OTP for password reset is: ${otp}. It will expire in 24 hours.`
    };

    await transporter.sendMail(mailOptions);

    res.json({ success: true, message: "OTP sent to email", otp });

  } catch (error) {
    console.error("Error generating OTP:", error);
    res.status(500).json({ success: false, message: "Internal Server Error", error: error.message });
  }
});


app.post('/verifyOtp',async(req,res)=>{

  const {email,otp}=req.body;

  const finduser=await Users.findOne({email})

  if(finduser.resetOtp==="" || finduser.resetOtp!==otp){

     return res.json({
      success:false,message:'Invalid OTP'
    })
  }

  res.json({
    success:true,
    message:'otp verified'
  })

  






})


//Set new pass

app.put('/setNew', async (req, res) => {
    const { email, password } = req.body;

    try {

        const user = await Users.findOneAndUpdate(
            { email },
            { password: password },
            { new: true } 
        );

        if (!user) {
            return res.json({
                success: false,
                message: "Invalid Email",
            });
        }

        res.json({
            success: true,
            message: "Password updated successfully",
        });

    } catch (err) {
        res.json({
            success: false,
            message: "Error updating password",
        });
    }
});



// Start Server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
