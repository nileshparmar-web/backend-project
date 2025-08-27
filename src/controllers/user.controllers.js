import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiErrors.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import path from "path";
import jwt from "jsonwebtoken"

// method for generating the accessToken and refreshToken
const generateAccessTokenAndRefreshToken = async (userId) => {

    try {
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();
    
        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false});

        return { accessToken, refreshToken }

    } catch (error) {
         throw new ApiError(500, "Something went wrong while generating refreshToken and accessToken ")
    }
}

const registerUser = asyncHandler( async (req, res) => {
    
    // steps to follow for registere the user
    // get user details from frontend
    // validation of user details - non empty
    // chek is user already exists
    // check for cover images and check for avatar
    // upload them to cloudinary
    // create user object - create entry in db
    // remove password and refreshtoken from response
    // check for user creation
    // return res

    console.log("Files received by Multer:", req.files);

    // here we are fetching the detail of user
    const { username, fullName, email, password } = req.body;
    console.log("email : " , email);
    console.log("username : " , username);

    console.log("here the body: " , req.body);

    // we are validates fieldes are empty or not

    if ([fullName, email, password, username].some((field) => field?.trim() === "")) {
        throw new ApiError(400, "All fields are required..")
    }

    // here i am going to check the format of imail is correct or not

    if(!email.includes("@") && 
        email.indexof("@") === 0 &&
        email.indexof("@") === email.length - 1 &&
        email.split("@")[0].length === 0 &&
        email.split("@")[1].length === 0 &&
        !email.split("@")[1].includes(".") &&
        email.split("@")[1].indexof(".") === 0 &&
        email.split("@")[1].indexof(".") === email.split("@")[1].length - 1 ){

            throw new ApiError(400, "Invalid email format, provide correct email");
            
        }

    //here we are checks the user is already exist or not
    const existedUser = await User.findOne({
        $or : [{ username }, { email }]
    })

    if(existedUser) {
        throw new ApiError(409, "User with email or username already exist");
        
    }

    // take avatar file and coverImage file from user and put temporary in local server

    const avatarLocalPath = req.files?.avatar?.[0]?.path;
    //const coverImageLocalPath = req.files?.coverImage?.[0]?.path;

    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
         coverImageLocalPath = req.files.coverImage[0].path;
    }

    console.log("Avatar Path:", avatarLocalPath); 
    console.log("CoverImage's Path :", coverImageLocalPath);

    if(!avatarLocalPath) {
      throw new ApiError(400, "Avatar file is required in local server ")
    }

    // upload them to cloudinary
    const avatar = await uploadOnCloudinary(path.resolve(avatarLocalPath));
    console.log("Cloudinary Upload Result for avatar:", avatar);

    const coverImage = await uploadOnCloudinary(coverImageLocalPath);
    console.log("Cloudinary Upload Result for coverImage:", coverImage); 

    if (!avatar) {
        throw new ApiError(400, "Avatar file is required..")
    }

    // now upload all this data and files path in database

    const user = await User.create(
        { fullName,
          avatar : avatar.url,
          coverImage : coverImage?.url || "",
          email,
          password,
          username: username.toLowerCase()
        })

    // here we checked the user's data successfully entered in db and also select which item we dont want to add in response
    const createdUser = await User.findById(user._id).select(" -password -refreshToken ")
     
    if(!createdUser) {
        throw new ApiError(500, "Something went wrong while registering the user")
    }

    // here we send the respond that user is successfully registered
    return res.status(201).json(
        new ApiResponse(200, createdUser, "user registered successfully..")
    )



})

const loginUser = asyncHandler( async (req, res) => {
    // take data from user using req.body
    // check the username or email is exist for that user
    // find the user
    // check the password
    // generate accesstoken and refreshtoken 
    // send cookies to user
    

    // fetch data from user
    const { username, email, password } = req.body;
    console.log("equested body: ", req.body);
    

    // check the user provide username or email
    if( !(username || email)) {
        throw new ApiError(400, "username or email is required for login")
    }

    // find user
    const user = await User.findOne({
        $or: [{ username }, { email }]
    })
    console.log("logined user: ", user)

    if(!user) {
        throw new ApiError(404, "User does not exist..")
    }

    // validate the password
    const isPasswordValid = await user.isPasswordCorrect(password);

    if(!isPasswordValid) {
        throw new ApiError(401, "Paasword is Invalid");
    }

    // generate the tokens
    const { accessToken, refreshToken } =   await generateAccessTokenAndRefreshToken(user._id);
    console.log("accessToken : ",accessToken);
    console.log("refreshToken : ", refreshToken);
    

    const loggedInUser = await User.findById(user._id).select(" -password  -refreshToken");
    console.log("logedInUser : ", loggedInUser);
    

    // send cookies
    const options = {
          httpOnly: true,
          secure: true
    }

    console.log("Sending Response:", {
           user: loggedInUser,
                  accessToken,
                  refreshToken
});

return res
  .status(200)
  .cookie("accessToken", accessToken, options)
  .cookie("refreshToken", refreshToken, options)
  .json(
    new ApiResponse(
      200,
      {
        user: loggedInUser,
        accessToken,
        refreshToken
      },
      "User logedIn Successfully.."
    )
  );
})

const logoutUser = asyncHandler( async (req, res) => {

    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken : undefined
            }
        },
        {
            new: true
        }
    )

    const options = {
          httpOnly: true,
          secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(
        new ApiResponse(200, {}, "User loggedOut Successfully")
    )


      
})

const refreshAccessToken = asyncHandler (async (req, res) => {
      
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if (!incomingRefreshToken) {
        throw new ApiError(401, "Unauthorized request..")
    }

    try {
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
    
        const user = await User.findById(decodedToken?._id)
    
        if (!user) {
            throw new ApiError(401, "Invalid refresh token")
        }
    
        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "Refresh token is expired or used..")
        }
    
        const options = {
            httpOnly: true,
            secure: true
        }
    
        const {accessToken, newRefreshToken} = await generateAccessTokenAndRefreshToken(user._id);
    
        return res
        .status(200)
        .cookie("accessToke", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    accessToken,
                    refreshToken: newRefreshToken
                },
                "Access token Refreshed successfully.."
               
            )
        )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid Refresh Token..")
    }
})

export { registerUser,
         loginUser,
         logoutUser,
         refreshAccessToken
 }


