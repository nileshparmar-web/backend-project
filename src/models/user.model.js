import mongoose, {Schema} from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

const userSchema = new Schema(
    {
        username: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            index: true
        },
        email: {
           type: String,
           required: true,
           unique: true,
           lowercase: true,
           trim: true
        },
        fullName: {
            type: String,
            required: true,
            trim: true,
            index: true
        },
        avatar: {
            type: String, //using cloudinary url
            required: true,

        },
        coverImage: {
            type: String //using cloudinary url
        },
        watchHistory: [
            {
                type: Schema.Types.ObjectId,
                ref: "Video"
            }
        ],
        password: {
            type: String,
            required: [true, "Password is required"]
        },
        refreshToken: {
            type: String
        }

    },  {timestamps : true})



// password encryption middleware
userSchema.pre("save", async function(next) {

    if(!this.isModified("password")) return next();

    this.password = await bcrypt.hash(this.password, 10)
    next()
})

// check the password is coorect or not by comparing
userSchema.methods.isPasswordCorrect = async function(password) {
    return await bcrypt.compare(password, this.password)
}

// generate the access token using jwt.sign
userSchema.methods.generateAccessToken = function() {
     jwt.sign(
        {
                 _id: this._id,
               email: this.email,
            username: this.username,
            fullName: this.fullName
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn: process.env.ACCESS_TOKEN_EXPIRY
        }
     )
}

// generate the refresh token using jwt.sign
userSchema.methods.generateRefreshToken = function() {
     jwt.sign(
        {
                 _id: this._id,
        },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRY
        }
     )
}



export const User = mongoose.model("User", userSchema)